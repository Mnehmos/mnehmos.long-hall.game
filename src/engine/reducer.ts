import type {
    RunState, Action, EquipmentSlot, Item, Actor, PartyState, InventoryState, Enemy,
} from './types';
import { createInitialRunState, createActor } from './state';
import { SeededRNG } from '../core/rng';
import { performShortRest } from './rest';
import { hashWithSeed } from '../core/hash';
import { RECRUITS, getDropForEnemy } from '../content/tables';
import { calculateEscapeDC } from './generateRoom';
import { roll } from '../core/dice';
import { getAbilityById } from '../content/abilities';
import { resolveEnemyTurn } from './combatHelpers';
import { cappedHistory } from './history';
import { REST_COOLDOWN, XP_THRESHOLDS, MAX_PARTY_SIZE } from './constants';
import { enchantItem, applyMaxHpDelta, totalMaxHpBonus } from './enchant';
import { enterRoom } from './enterRoom';

// Helper to update weapon mastery stats
function updateWeaponStats(
    item: Item,
    damage: number,
    isKill: boolean,
    isCritical: boolean,
    enemyName?: string
): Item {
    const stats = item.stats || { kills: 0, damageDealt: 0, highestHit: 0, criticalHits: 0, encountersUsed: 0 };
    const history = item.history || [];

    const newStats = {
        ...stats,
        damageDealt: stats.damageDealt + damage,
        highestHit: Math.max(stats.highestHit, damage),
        criticalHits: isCritical ? stats.criticalHits + 1 : stats.criticalHits,
        kills: isKill ? stats.kills + 1 : stats.kills,
    };

    const newHistory = [...history];

    // Log notable events
    if (isKill && enemyName) {
        newHistory.push(`Slew ${enemyName}`);
    }
    if (damage > stats.highestHit && damage >= 10) {
        newHistory.push(`New record hit: ${damage} damage!`);
    }
    if (isCritical) {
        newHistory.push(`Critical strike!`);
    }

    // Keep history to last 10 entries
    while (newHistory.length > 10) {
        newHistory.shift();
    }

    return {
        ...item,
        stats: newStats,
        history: newHistory
    };
}

// Helper to update weapon on an actor
function updateActorWeapon(actor: Actor, updatedWeapon: Item): Actor {
    return {
        ...actor,
        equipment: {
            ...actor.equipment,
            main_hand: updatedWeapon
        }
    };
}

/**
 * Grant the spoils for one defeated enemy: gold, a possible item drop, and XP
 * split across the living party (with level-ups).
 *
 * ATTACK and USE_ABILITY both call this. They used to have separate reward
 * paths -- ability kills paid `power * 2` gold, dropped no items, and awarded
 * no XP at all, so finishing an enemy with a spell was strictly worse than
 * hitting it with a stick.
 */
function awardKill(
    party: PartyState,
    inventory: InventoryState,
    enemy: Enemy,
    rng: SeededRNG,
    history: string[]
): { party: PartyState; inventory: InventoryState } {
    const goldDrop = enemy.power * 3 + rng.int(0, Math.max(0, enemy.power * 2 - 1));
    let nextInventory = inventory;

    const droppedItem = getDropForEnemy(enemy.power, () => rng.float());
    if (droppedItem) {
        nextInventory = { ...inventory, items: [...inventory.items, droppedItem] };
        history.push(`🎁 ${enemy.name} dropped ${droppedItem.name}!`);
    }

    const xpGain = enemy.power * 15;
    const aliveCount = Math.max(1, party.members.filter(m => m.isAlive).length);
    const xpPerMember = Math.floor(xpGain / aliveCount);

    history.push(`${enemy.name} defeated! +${goldDrop} gold, +${xpGain} XP`);

    const members = party.members.map(m => {
        if (!m.isAlive) return m;

        const newXp = m.xp + xpPerMember;
        let newLevel = m.level;
        let newMaxHp = m.hp.max;
        let newCurrentHp = m.hp.current;
        const newHitDice = { ...m.hitDice };
        let newStatPoints = m.statPoints || 0;

        while (newLevel < XP_THRESHOLDS.length - 1 && newXp >= XP_THRESHOLDS[newLevel]) {
            newLevel++;
            newStatPoints++;
            const hitDieRoll = roll('1d8', rng).total;
            const hpGain = Math.max(1, hitDieRoll + Math.floor(newLevel / 2));
            newMaxHp += hpGain;
            newCurrentHp += hpGain;
            if (newLevel % 2 === 0) {
                newHitDice.max += 1;
                newHitDice.current += 1;
            }
            history.push(`🎉 ${m.name} leveled up to ${newLevel}! +${hpGain} HP (rolled ${hitDieRoll}), +1 Stat Point!`);
        }

        return {
            ...m,
            xp: newXp,
            level: newLevel,
            hp: { current: newCurrentHp, max: newMaxHp },
            hitDice: newHitDice,
            statPoints: newStatPoints,
        };
    });

    return {
        party: { ...party, members, gold: party.gold + goldDrop },
        inventory: nextInventory,
    };
}

/**
 * A room interaction (praying, disarming) is only legal once its guards are
 * dead. Guarded shrines and hazards carry enemies, and the UI hides the button
 * while they live -- but the reducer has to enforce it too.
 */
function canInteractWithRoom(state: RunState, type: 'hazard' | 'shrine'): boolean {
    const room = state.currentRoom;
    if (!room || room.type !== type) return false;
    return !room.enemies.some(e => e.hp > 0);
}

/**
 * Apply trap damage to the front-most LIVING party member.
 *
 * This used to always hit `members[0]`. Once the original hero died, every
 * trap re-killed the corpse and flagged game over while the rest of the party
 * was still standing.
 */
function applyTrapDamage(state: RunState, damage: number, prefix: string): RunState {
    const victimIndex = state.party.members.findIndex(m => m.isAlive);
    if (victimIndex === -1) return state;

    const victim = state.party.members[victimIndex];
    const newHp = Math.max(0, victim.hp.current - damage);
    const died = newHp <= 0;

    const members = state.party.members.map((m, i) =>
        i === victimIndex
            ? { ...m, hp: { ...m.hp, current: newHp }, isAlive: !died }
            : m
    );

    const history = [...state.history, `${prefix} Trap deals ${damage} damage to ${victim.name}!`];
    if (died) history.push(`☠️ ${victim.name} has fallen!`);

    const allDead = members.every(m => !m.isAlive);
    if (allDead) history.push('The entire party has fallen! Game Over.');

    return {
        ...state,
        party: { ...state.party, members },
        roomResolved: true,
        gameOver: allDead,
        history: cappedHistory(history),
    };
}

/**
 * Derive the RNG for a single reducer step.
 *
 * Every randomised action draws from `hash(seed, cursor)` and the cursor
 * advances by one per dispatch, so a run is fully determined by its seed plus
 * its action sequence. Before this, combat used bare `Math.random()`, which
 * meant the "seeded run" was cosmetic and server-side replay was impossible.
 */
function actionRng(seed: string, cursor: number): SeededRNG {
    return new SeededRNG(hashWithSeed(`${seed}#${cursor}`, cursor));
}

export function gameReducer(state: RunState, action: Action): RunState {
  // Advance the cursor before dispatching so every return path carries it
  // forward via the `...state` spread.
  const rngCursor = (state.rngCursor ?? 0) + 1;
  const rng = actionRng(state.seed, rngCursor);
  return runAction({ ...state, rngCursor }, action, rng);
}

function runAction(state: RunState, action: Action, rng: SeededRNG): RunState {
  switch (action.type) {
    case 'START_RUN':
      return createInitialRunState(action.seed);

    case 'ADVANCE_ROOM':
        return enterRoom(state, state.depth + 1, rng);

    case 'TAKE_SHORT_REST': {
        return performShortRest(state, action.actorIdsToHeal);
    }

    case 'ATTACK': {
        if (!state.currentRoom || state.combatTurn !== 'player') return state;
        
        const room = state.currentRoom;
        const targetIndex = room.enemies.findIndex(e => e.id === action.targetId);
        if (targetIndex === -1) return state;
        
        // Find attacking party member
        const target = room.enemies[targetIndex];
        const attacker = state.party.members.find(m => m.id === action.attackerId);
        if (!attacker || !attacker.isAlive) return state;
        
        // Calculate combat stats based on Skills
        // Determine weapon type (naive check for now)
        const weapon = attacker.equipment.main_hand;
        const weaponName = weapon?.name.toLowerCase() || '';
        let type: 'melee' | 'ranged' | 'magic' = 'melee';
        
        if (weaponName.includes('bow') || weaponName.includes('crossbow') || weaponName.includes('sling')) type = 'ranged';
        else if (weaponName.includes('staff') || weaponName.includes('wand') || weaponName.includes('tome')) type = 'magic';
        
        // Base stats from Skills
        let hitSkill = 0;
        let dmgSkill = 0;
        
        // Safety check for skills (if older save)
        const skills = attacker.skills || { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0 };
        
        switch (type) {
            case 'melee':
                hitSkill = skills.attack;
                dmgSkill = skills.strength;
                break;
            case 'ranged':
                hitSkill = skills.ranged;
                dmgSkill = skills.ranged; // Uses Ranged for both hit and damage
                break;
            case 'magic':
                hitSkill = skills.magic;
                dmgSkill = skills.magic;
                break;
        }

        let totalAttackBonus = hitSkill;
        let totalDamageBonus = dmgSkill;

        // Sum bonuses from all equipped items (including enchantments)
        Object.values(attacker.equipment).forEach(item => {
            if (!item) return;
            totalAttackBonus += (item.baseStats.attackBonus || 0);
            totalDamageBonus += (item.baseStats.damageBonus || 0);
            // Include enchantment bonuses
            if (item.enchantment?.effect) {
                totalAttackBonus += (item.enchantment.effect.attackBonus || 0);
                totalDamageBonus += (item.enchantment.effect.damageBonus || 0);
            }
        });

        const attackRoll = roll('1d20', rng).total;
        const hit = (attackRoll + totalAttackBonus) >= target.ac;
        
        let newHistory = [...state.history];
        let newEnemies = [...room.enemies];
        // Clone the members array too. `{ ...state.party }` shares the same
        // array reference, so the index assignments below used to write
        // straight back into the caller's state and make the reducer impure.
        let newParty = { ...state.party, members: [...state.party.members] };
        let newInventory = state.inventory; // Track inventory changes from dropped items
        let roomResolved = false;

        // Check if this attacker already acted and is using an extra action
        const alreadyActed = (state.actedThisRound || []).includes(action.attackerId);
        let newExtraActions = state.extraActions || 0;
        let newActedThisRound = [...(state.actedThisRound || [])];

        if (alreadyActed && newExtraActions > 0) {
            // Using an extra action - consume it, don't add to actedThisRound again
            newExtraActions -= 1;
            newHistory.push(`(Using extra action! ${newExtraActions > 0 ? newExtraActions + ' remaining' : ''})`);
        } else {
            // Normal action - track this attacker
            newActedThisRound.push(action.attackerId);
        }
        
        if (hit) {
            // Damage roll: 1d8 + skill + weapon
            // Note: Weapon damage die should ideally come from item.baseStats.damageDie, but using fixed 1d8 for now as simplified.
            const damageRoll = roll('1d8', rng);
            let damage = Math.max(1, damageRoll.total + totalDamageBonus);
            const isCritical = attackRoll === 20; // Natural 20 is a critical hit

            // Check for Champion Strike (Empowered)
            if (attacker.statuses?.includes('champion_strike')) {
                 const bonusDice = roll('2d6', rng); // Match the ability dice
                 damage += bonusDice.total;
                 newHistory.push(`${attacker.name} consumes Champion Strike! +${bonusDice.total} damage.`);
                 
                 // Remove status
                 const aIndex = newParty.members.findIndex(m => m.id === action.attackerId);
                 if (aIndex !== -1) {
                     newParty.members[aIndex] = {
                         ...newParty.members[aIndex],
                         statuses: attacker.statuses.filter(s => s !== 'champion_strike')
                     };
                 }
            }

            newEnemies[targetIndex] = {
                ...target,
                hp: Math.max(0, target.hp - damage)
            };

            const isKill = newEnemies[targetIndex].hp <= 0;

            // Track weapon mastery stats
            if (weapon) {
                const attackerIndex = newParty.members.findIndex(m => m.id === action.attackerId);
                if (attackerIndex !== -1) {
                    const updatedWeapon = updateWeaponStats(weapon, damage, isKill, isCritical, isKill ? target.name : undefined);
                    newParty.members[attackerIndex] = updateActorWeapon(newParty.members[attackerIndex], updatedWeapon);
                }
            }

            newHistory.push(`${attacker.name} attacks ${target.name} (${type}): [${attackRoll}+${totalAttackBonus}=${attackRoll+totalAttackBonus} vs AC ${target.ac}] ${isCritical ? 'CRITICAL ' : ''}HIT! ${damageRoll.total}+${totalDamageBonus} = ${damage} damage!`);

            // Check if dead
            if (isKill) {
                const rewards = awardKill(newParty, newInventory, target, rng, newHistory);
                newParty = { ...rewards.party, members: [...rewards.party.members] };
                newInventory = rewards.inventory;
                newEnemies = newEnemies.filter(e => e.hp > 0);
            }
        } else {
            newHistory.push(`${attacker.name} attacks ${target.name}: [${attackRoll}+${totalAttackBonus}=${attackRoll+totalAttackBonus} vs AC ${target.ac}] MISS!`);
        }

        // Attacking always breaks stealth, hit or miss. This used to live inside
        // the `isKill` branch, so a rogue who never landed a killing blow stayed
        // hidden -- and hidden members are skipped as enemy targets, making them
        // permanently untargetable.
        {
            const aIndex = newParty.members.findIndex(m => m.id === action.attackerId);
            if (aIndex !== -1 && newParty.members[aIndex].statuses?.includes('hidden')) {
                newParty.members[aIndex] = {
                    ...newParty.members[aIndex],
                    statuses: newParty.members[aIndex].statuses.filter(s => s !== 'hidden'),
                };
                newHistory.push(`${newParty.members[aIndex].name} reveals themselves from the shadows!`);
            }
        }

        // Check victory
        if (newEnemies.length === 0) {
            // Calculate gold reward (5-15 gold, more for bosses)
            const goldReward = state.inBossRoom ? rng.int(20, 49) : rng.int(5, 15);
            newHistory.push(`Victory! All enemies defeated. +${goldReward} gold.`);
            
            // Only auto-resolve combat/elite rooms. Shrines/Hazards allow interaction after combat.
            roomResolved = (room.type === 'combat' || room.type === 'elite');
            
            // BOSS ROOM: Return to intermission with rare+ shrine blessing
            if (state.inBossRoom && state.parentIntermission) {
                // Collect boss room loot
                const bossLoot = room.loot || [];
                const updatedInventory = {
                    ...newInventory,
                    items: [...newInventory.items, ...bossLoot]
                };
                
                if (bossLoot.length > 0) {
                    newHistory.push(`🎁 Boss Loot Collected: ${bossLoot.map(i => i.name).join(', ')}`);
                }
                
                newHistory.push(`🏆 Boss Defeated! Returning to rest area with a rare blessing...`);
                
                // Generate a rare+ shrine blessing (tier 3-5)
                // BUT DO NOT AUTO-APPLY. Wait for user to click button.
                
                return {
                    ...state,
                    // Remove boss room link from the intermission room we are returning to
                    // This prevents players from entering the boss room again (spamming it)
                    currentRoom: { ...state.parentIntermission, bossRoom: undefined },
                    parentIntermission: null,
                    inBossRoom: false,
                    roomResolved: false, // Allow long rest at intermission
                    combatTurn: null,
                    actedThisRound: [],
                    victory: true,
                    shrineBoon: null, // No auto popup
                    pendingBossReward: true, // Enable the "Pray at Shrine" button
                    history: cappedHistory([...newHistory, `🏆 Boss Defeated! A powerful shrine awaits your prayer...`]),
                    party: {
                        ...newParty,
                        gold: state.party.gold + goldReward
                    },
                    inventory: updatedInventory
                };
            }
            
            // Normal combat victory
            return {
                ...state,
                currentRoom: { ...room, enemies: newEnemies },
                roomResolved: true,
                combatTurn: null,
                actedThisRound: [],
                victory: true,
                history: cappedHistory(newHistory),
                party: {
                    ...newParty,
                    gold: state.party.gold + goldReward
                },
                inventory: newInventory
            };
        }
        
        // Determine if all alive party members have acted
        const aliveMemberIds = newParty.members.filter(m => m.isAlive).map(m => m.id);
        const allActed = aliveMemberIds.every(id => newActedThisRound.includes(id));

        // Default: stay on player turn until all have acted
        let combatTurn: 'player' | 'enemy' | null = allActed ? 'enemy' : 'player';

        // If there are extra actions remaining, stay on player turn
        if (combatTurn === 'enemy' && newExtraActions > 0) {
            combatTurn = 'player';
            newHistory.push(`(Extra action available!)`);
        }

        // If still more party members to act, show who's next
        if (combatTurn === 'player' && !allActed) {
            const nextToAct = newParty.members.find(m => m.isAlive && !newActedThisRound.includes(m.id));
            if (nextToAct) {
                newHistory.push(`→ ${nextToAct.name}'s turn`);
            }
        }

        let nextState: RunState = {
            ...state,
            currentRoom: { ...room, enemies: newEnemies },
            roomResolved,
            combatTurn,
            actedThisRound: combatTurn === 'enemy' ? [] : newActedThisRound, // Reset if going to enemy turn
            history: cappedHistory(newHistory),
            party: newParty,
            extraActions: newExtraActions,
            inventory: newInventory
        };

        // Enemy turn (if combat continues)
        if (combatTurn === 'enemy' && newEnemies.length > 0) {
            return resolveEnemyTurn(nextState, rng);
        }

        return nextState;
    }

    case 'BUY_ITEM': {
        // The item must be on THIS room's shelf. Previously the price came in
        // on the action (scraped out of the DOM by the click handler) and the
        // item could fall back to the global ITEMS table, so the shop was
        // effectively "name your own price for anything in the game".
        const room = state.currentRoom;
        const item = room?.shopItems?.find(i => i.id === action.itemId);
        if (!item) {
            return {
                ...state,
                history: cappedHistory([...state.history, 'That item is not for sale here.'])
            };
        }

        const cost = item.cost;
        if (state.party.gold < cost) {
            return {
                ...state,
                history: cappedHistory([...state.history, `Not enough gold. ${item.name} costs ${cost}g.`])
            };
        }

        const newRoom = {
            ...room!,
            shopItems: room!.shopItems!.filter(i => i.id !== action.itemId)
        };

        return {
            ...state,
            currentRoom: newRoom,
            party: {
                ...state.party,
                gold: state.party.gold - cost
            },
            inventory: {
                ...state.inventory,
                items: [...state.inventory.items, item]
            },
            history: cappedHistory([...state.history, `Bought ${item.name} for ${cost}g`])
        };
    }

    case 'SELL_ITEM': {
        // Find the item in inventory
        const itemIndex = state.inventory.items.findIndex(i => i.id === action.itemId);
        if (itemIndex === -1) {
            return {
                ...state,
                history: cappedHistory([...state.history, "Item not found in inventory."])
            };
        }
        
        const item = state.inventory.items[itemIndex];
        // Sell price: 25% of base cost + enchantment bonus (tier * 10g)
        const baseSellPrice = Math.floor((item.cost || 10) * 0.25);
        const enchantBonus = item.enchantment ? item.enchantment.tier * 10 : 0;
        const sellPrice = baseSellPrice + enchantBonus;
        
        // Remove item from inventory
        const newItems = [...state.inventory.items];
        newItems.splice(itemIndex, 1);
        
        return {
            ...state,
            party: {
                ...state.party,
                gold: state.party.gold + sellPrice
            },
            inventory: {
                ...state.inventory,
                items: newItems
            },
            history: cappedHistory([...state.history, `Sold ${item.name} for ${sellPrice} gold`])
        };
    }

    case 'EQUIP_ITEM': {
        // Move from inventory to actor slot
        const actorIndex = state.party.members.findIndex(m => m.id === action.actorId);
        if (actorIndex === -1) return state;

        const actor = state.party.members[actorIndex];
        const itemIndex = state.inventory.items.findIndex(i => i.id === action.itemId);
        if (itemIndex === -1) return state;

        const item = state.inventory.items[itemIndex];
        
        // Determine target slot
        let targetSlot: EquipmentSlot | undefined = action.slot as EquipmentSlot;
        
        if (!targetSlot) {
            // Auto-determine slot based on item type
            switch (item.type) {
                case 'weapon': targetSlot = 'main_hand'; break;
                case 'shield': targetSlot = 'off_hand'; break;
                case 'head': targetSlot = 'head'; break;
                case 'chest': targetSlot = 'chest'; break;
                case 'legs': targetSlot = 'legs'; break;
                case 'feet': targetSlot = 'feet'; break;
                case 'neck': targetSlot = 'neck'; break;
                case 'ring': 
                    // Logic for rings: fill empty, else swap 1
                    if (!actor.equipment['ring1']) targetSlot = 'ring1';
                    else if (!actor.equipment['ring2']) targetSlot = 'ring2';
                    else targetSlot = 'ring1'; // Default swap 1
                    break;
            }
        }
        
        if (!targetSlot) return state; // Valid slot check

        // Initialize new inventory
        const newInventoryItems = [...state.inventory.items];
        newInventoryItems.splice(itemIndex, 1);
        
        // Create new equipment object
        const newEquipment = { ...actor.equipment };
        const oldItem = newEquipment[targetSlot];
        
        // Update slot
        newEquipment[targetSlot] = item;
        
        // Return old item to inventory
        if (oldItem) {
            newInventoryItems.push(oldItem);
        }
        
        // Handle 2H weapons / Offhand logic (Simplified for now - strictly 1-handed logic unless we add 'isTwoHanded' prop)
         // If equipping SHIELD, unequip 2H weapon? 
         // For now, assuming all weapons are 1H or logic is manually managed by user swapping.
         // Let's add simple unequip logic:
         // If equipping main_hand, nothing special yet.
         
        const newParty = { ...state.party };
        newParty.members = [...state.party.members];

        const hpDiff = totalMaxHpBonus(item) - totalMaxHpBonus(oldItem);
        newParty.members[actorIndex] = applyMaxHpDelta(
            { ...actor, equipment: newEquipment },
            hpDiff
        );

        return {
            ...state,
            party: newParty,
            inventory: { ...state.inventory, items: newInventoryItems },
            history: cappedHistory([...state.history, `Equipped ${item.name} to ${targetSlot}`])
        };
    }

    case 'UNEQUIP_ITEM': {
        const actorIndex = state.party.members.findIndex(m => m.id === action.actorId);
        if (actorIndex === -1) return state;
        const actor = state.party.members[actorIndex];
        
        const item = actor.equipment[action.slot];
        if (!item) return state; // Nothing to unequip
        
        // Remove from equipment
        const newEquipment = { ...actor.equipment };
        delete newEquipment[action.slot]; // OR set to undefined depending on type definition. 
        // type Equipment = partial record. delete is fine or undefined.
        newEquipment[action.slot] = undefined;
        
        // Add to inventory
        const newInventoryItems = [...state.inventory.items, item];
        
        const newParty = { ...state.party };
        newParty.members = [...state.party.members];

        newParty.members[actorIndex] = applyMaxHpDelta(
            { ...actor, equipment: newEquipment },
            -totalMaxHpBonus(item)
        );

        return {
            ...state,
            party: newParty,
            inventory: { ...state.inventory, items: newInventoryItems },
            history: cappedHistory([...state.history, `Unequipped ${item.name}.`])
        };
    }

    case 'DISARM_TRAP': {
        if (!canInteractWithRoom(state, 'hazard')) return state;

        // Check for rogue in party (trap bonus)
        const hasRogue = state.party.members.some(m => m.isAlive && m.role === 'rogue');
        const rogueBonus = hasRogue ? 5 : 0; // +5 bonus with rogue

        // Roll dexterity check (d20 + 2 + rogue bonus vs DC 12)
        const baseRoll = roll('1d20', rng).total;
        const disarmRoll = baseRoll + 2 + rogueBonus;
        const success = disarmRoll >= 12;

        if (success) {
            const goldReward = rng.int(5, 15);
            const bonusMsg = hasRogue ? ' (Rogue +5 bonus!)' : '';
            return {
                ...state,
                roomResolved: true,
                victory: true,
                party: {
                    ...state.party,
                    gold: state.party.gold + goldReward
                },
                history: cappedHistory([...state.history, `Trap disarmed! (Rolled ${baseRoll}+${2 + rogueBonus}=${disarmRoll} vs DC 12)${bonusMsg}. +${goldReward} gold.`])
            };
        }

        // Failed disarm triggers the trap
        return applyTrapDamage(
            state,
            roll('1d6', rng).total,
            `Failed to disarm! (Rolled ${disarmRoll}).`
        );
    }

    case 'TRIGGER_TRAP': {
        if (!canInteractWithRoom(state, 'hazard')) return state;
        return applyTrapDamage(state, roll('2d6', rng).total, 'Triggered the trap!');
    }

    case 'PRAY_AT_SHRINE': {
        const isBossShrine = !!state.pendingBossReward;
        if (!isBossShrine && !canInteractWithRoom(state, 'shrine')) return state;
        if (state.roomResolved && !isBossShrine) return state; // Already prayed here

        // Check for cleric in party (shrine bonus)
        const hasCleric = state.party.members.some(m => m.isAlive && m.role === 'cleric');
        const clericBonus = hasCleric ? 1.5 : 1; // 50% bonus with cleric

        const healTarget = state.party.members.findIndex(m => m.isAlive);
        const hero = healTarget === -1 ? state.party.members[0] : state.party.members[healTarget];

        let newParty = { ...state.party, members: [...state.party.members] };
        let newShortRests = state.shortRestsRemaining;

        // Boons are closures that mutate the locals above and return a log line.
        const boons: { type: string; apply: () => string }[] = [];

        // Heal if not at full HP (cleric boosts heal amount)
        if (!isBossShrine && hero.hp.current < hero.hp.max) {
            boons.push({
                type: 'heal',
                apply: () => {
                    const baseHeal = Math.floor(hero.hp.max * 0.5);
                    const healAmount = Math.floor(baseHeal * clericBonus);
                    const newHp = Math.min(hero.hp.max, hero.hp.current + healAmount);
                    newParty.members = newParty.members.map((m, i) =>
                        i === healTarget ? { ...m, hp: { ...m.hp, current: newHp } } : m
                    );
                    const bonusMsg = hasCleric ? ' (Cleric +50%)' : '';
                    return `The shrine glows warmly. ${hero.name} healed for ${healAmount} HP!${bonusMsg}`;
                }
            });

            boons.push({
                type: 'fullheal',
                apply: () => {
                    newParty.members = newParty.members.map(m =>
                        m.isAlive ? { ...m, hp: { ...m.hp, current: m.hp.max } } : m
                    );
                    return `Divine energy surges through the party. Fully healed!`;
                }
            });
        }

        // Restore rest if not at max
        if (!isBossShrine && state.shortRestsRemaining < 2) {
            boons.push({
                type: 'rest',
                apply: () => {
                    newShortRests = state.shortRestsRemaining + 1;
                    return `The shrine restores your vitality. +1 Short Rest!`;
                }
            });
        }

        // Gold is always useful
        if (!isBossShrine) {
            boons.push({
                type: 'gold',
                apply: () => {
                    const goldBonus = rng.int(15, 30);
                    newParty.gold = state.party.gold + goldBonus;
                    return `Golden light showers upon you. +${goldBonus} gold!`;
                }
            });
        }

        // ENCHANT EQUIPMENT - the core run differentiator.
        const equippedItems: { memberId: string; item: Item; slot: EquipmentSlot }[] = [];
        for (const member of state.party.members) {
            if (!member.isAlive) continue;
            (Object.entries(member.equipment) as [EquipmentSlot, Item | undefined][])
                .forEach(([slot, item]) => {
                    if (item) equippedItems.push({ memberId: member.id, item, slot });
                });
        }

        // Room 0 (the starting shrine) always blesses the hero's weapon so the
        // opening of a run reads the same way every time.
        const startingWeaponSlot = state.depth === 0 && hero.equipment.main_hand
            ? { memberId: hero.id, item: hero.equipment.main_hand, slot: 'main_hand' as EquipmentSlot }
            : null;

        const enchantTarget = startingWeaponSlot
            ?? (equippedItems.length > 0 ? rng.pick(equippedItems) : null);

        if (enchantTarget) {
            boons.push({
                type: 'enchant',
                apply: () => {
                    const owner = newParty.members.find(m => m.id === enchantTarget.memberId);
                    const result = enchantItem(enchantTarget.item, enchantTarget.slot, rng, {
                        faith: owner?.skills?.faith || 0,
                        guaranteedStrong: isBossShrine,
                        depth: state.depth,
                        forceWeapon: !!startingWeaponSlot,
                    });

                    newParty.members = newParty.members.map(m => {
                        if (m.id !== enchantTarget.memberId) return m;
                        const withItem = {
                            ...m,
                            equipment: { ...m.equipment, [enchantTarget.slot]: result.item },
                        };
                        // Enchantments that grant max HP have to move the
                        // wearer's HP pool, or unequipping later would subtract
                        // HP that was never added.
                        return applyMaxHpDelta(withItem, result.maxHpDelta);
                    });

                    const before = enchantTarget.item.customName || enchantTarget.item.name;
                    const after = result.item.customName || result.item.name;
                    const upgradeText = result.isUpgrade ? ' (STACKED!)' : '';
                    const icon = startingWeaponSlot ? '⚔️' : '✨';
                    return `${icon} ${result.tierName} Boon${upgradeText}! ${owner?.name ?? 'The party'}'s ${before} becomes ${after}! (+${result.bonusValue} power)`;
                }
            });
        }

        // A boss shrine offers ONLY the enchantment, so a party with nothing
        // equipped would previously leave `boons` empty and crash on
        // `chosenBoon.apply()`. Fall back to gold rather than throwing.
        if (boons.length === 0) {
            boons.push({
                type: 'gold',
                apply: () => {
                    const goldBonus = rng.int(40, 80);
                    newParty.gold = state.party.gold + goldBonus;
                    return `The shrine finds nothing to bless, and offers coin instead. +${goldBonus} gold!`;
                }
            });
        }

        // The starting shrine and boss shrines always take the enchant branch;
        // ordinary shrines pick at random.
        const chosenBoon = (startingWeaponSlot || isBossShrine)
            ? (boons.find(b => b.type === 'enchant') ?? boons[0])
            : rng.pick(boons);

        const boonMessage = chosenBoon.apply();

        return {
            ...state,
            party: newParty,
            shortRestsRemaining: newShortRests,
            roomResolved: true,
            pendingBossReward: false, // Clear flag
            shrineBoon: boonMessage, // Show shrine blessing popup
            history: cappedHistory([...state.history, boonMessage])
        };
    }

    case 'DISMISS_POPUP': {
        return {
            ...state,
            victory: false,
            shrineBoon: null // Also clear shrine boon popup
        };
    }
    
    case 'TAKE_LONG_REST': {
        // Long rest - restore all HP, stress, hit dice, short rests, and ability cooldowns
        const restoredMembers = state.party.members.map(m => ({
            ...m,
            hp: { ...m.hp, current: m.hp.max },
            stress: { ...m.stress, current: 0 },
            hitDice: { ...m.hitDice, current: m.hitDice.max },
            isAlive: m.hp.current > 0 ? true : m.isAlive, // Don't resurrect dead
            // Reset ALL ability cooldowns
            abilities: m.abilities?.map(a => ({ ...a, currentCooldown: 0 })) || []
        }));

        return {
            ...state,
            party: { ...state.party, members: restoredMembers },
            shortRestsRemaining: 2,
            longRestsTaken: state.longRestsTaken + 1,
            history: cappedHistory([...state.history, 'Party takes a long rest. All resources restored!'])
        };
    }
    
    case 'HIRE_RECRUIT': {
        const room = state.currentRoom;
        // Find recruit from room's available recruits (or fallback to RECRUITS for compatibility)
        const recruit = room?.availableRecruits?.find(r => r.id === action.recruitId)
            || RECRUITS.find(r => r.id === action.recruitId);
        if (!recruit) return state;

        // Check gold
        if (state.party.gold < recruit.cost) {
            return {
                ...state,
                history: cappedHistory([...state.history, `Not enough gold to hire ${recruit.name}. Need ${recruit.cost} gold.`])
            };
        }

        // Check party size
        if (state.party.members.length >= MAX_PARTY_SIZE) {
            return {
                ...state,
                history: cappedHistory([...state.history, `Party is full! Max ${MAX_PARTY_SIZE} members.`])
            };
        }

        // Create new party member at recruit's scaled level with starter equipment.
        // The id is salted with the depth so a member hired after someone died
        // can't collide with an existing id (which would make ATTACK and
        // EQUIP_ITEM target the wrong actor).
        const newMember = createActor(
            `party-${state.depth}-${state.party.members.length + 1}-${rng.int(1000, 9999)}`,
            recruit.name,
            recruit.role,
            recruit.level || 1, // Use recruit's scaled level (defaults to 1 if missing)
            true // Include starter equipment
        );

        // Update room to remove hired recruit
        const newRoom = room && room.availableRecruits ? {
            ...room,
            availableRecruits: room.availableRecruits.filter(r => r.id !== action.recruitId)
        } : room;

        return {
            ...state,
            currentRoom: newRoom,
            party: {
                ...state.party,
                gold: state.party.gold - recruit.cost,
                members: [...state.party.members, newMember]
            },
            history: cappedHistory([...state.history, `${recruit.name} joins the party!`])
        };
    }
    
    
    case 'ESCAPE': {
        if (!state.currentRoom || state.combatTurn !== 'player') return state;
        const room = state.currentRoom;
        if (room.type !== 'combat' && room.type !== 'elite' && ((room.type !== 'shrine' && room.type !== 'hazard') || !room.enemies || room.enemies.length === 0)) return state;

        // Calculate dynamic escape DC based on difficulty, enemies, and party composition
        const aliveMembers = state.party.members.filter(m => m.isAlive);
        const partyAgility = Math.max(...aliveMembers.map(m => m.skills.agility), 0);
        const hasRogue = aliveMembers.some(m => m.role === 'rogue');
        const enemyCount = room.enemies.filter(e => e.hp > 0).length;
        const isElite = room.type === 'elite';

        const { dc, breakdown } = calculateEscapeDC(state.depth, enemyCount, isElite, partyAgility, hasRogue);

        // Roll escape check
        const escapeRoll = roll('1d20', rng).total;
        const success = escapeRoll >= dc;

        if (success) {
            // Escaping funnels through the same entry path as advancing, so the
            // two can't drift. Notably it derives the room from (seed, depth),
            // which means fleeing no longer rerolls the room's contents.
            return enterRoom(state, state.depth + 1, rng, [
                `🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] SUCCESS! (${breakdown})`,
            ]);
        }

        // Failed - the enemies get a free round of attacks.
        const failState: RunState = {
            ...state,
            history: cappedHistory([
                ...state.history,
                `🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] FAILED! Enemies attack! (${breakdown})`,
            ]),
        };
        return resolveEnemyTurn(failState, rng);
    }

    case 'USE_ABILITY': {
        if (!state.currentRoom || state.combatTurn !== 'player') return state;
        const room = state.currentRoom;
        
        const actorIndex = state.party.members.findIndex(m => m.id === action.actorId);
        if (actorIndex === -1) return state;
        const actor = state.party.members[actorIndex];
        
        const abilityDef = getAbilityById(action.abilityId);
        if (!abilityDef) return state;
        
        // Find ability state
        const abilityStateIndex = actor.abilities.findIndex(a => a.abilityId === action.abilityId);
        if (abilityStateIndex === -1) return state;
        const abilityState = actor.abilities[abilityStateIndex];
        
        if (abilityState.currentCooldown > 0) return state; // Cooldown not ready
        
        // Check stealth requirement
        if (['sneak_attack'].includes(action.abilityId)) {
            if (!actor.statuses?.includes('hidden')) return state;
        }

        let newHistory = [...state.history];
        let newEnemies = [...room.enemies];
        // Clone members: the index assignments below would otherwise write
        // through into the caller's state.
        let newParty = { ...state.party, members: [...state.party.members] };

        // Calculate Bonuses based on Skills (Simplified for now, can be expanded)
        const skills = actor.skills || { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0 };
        let powerBonus = 0;
        let accuracyBonus = 0;

        // Sum equipment bonuses (including enchantments)
        let equipAtkBonus = 0;
        let equipDmgBonus = 0;
        Object.values(actor.equipment).forEach(item => {
            if (!item) return;
            equipAtkBonus += (item.baseStats.attackBonus || 0);
            equipDmgBonus += (item.baseStats.damageBonus || 0);
            if (item.enchantment?.effect) {
                equipAtkBonus += (item.enchantment.effect.attackBonus || 0);
                equipDmgBonus += (item.enchantment.effect.damageBonus || 0);
            }
        });

        // Skill mapping based on ability type
        if (abilityDef.effect.type === 'attack') {
            // Weapon-based abilities
            if (abilityDef.role === 'ranger') {
                accuracyBonus = skills.ranged + equipAtkBonus;
                powerBonus = skills.ranged + equipDmgBonus;
            } else {
                // Default to Melee (Fighter, etc)
                accuracyBonus = skills.attack + equipAtkBonus;
                powerBonus = skills.strength + equipDmgBonus;
            }
            if (abilityDef.effect.attackBonus) accuracyBonus += abilityDef.effect.attackBonus;
            if (abilityDef.effect.damageBonus) powerBonus += abilityDef.effect.damageBonus;
        } else if (abilityDef.effect.type === 'damage') {
            // Spells use magic skill + equipment
            powerBonus = skills.magic + equipDmgBonus;
            accuracyBonus = skills.magic + equipAtkBonus;
        } else if (abilityDef.effect.type === 'heal') {
            powerBonus = skills.faith; // Healing doesn't use equipment bonuses
        }

        let roomResolved = false;
        // combatTurn is calculated at the end now
        let usedAction = true;

        if (abilityDef.effect.type === 'damage' || abilityDef.effect.type === 'attack') {
             // Offensive
             if (abilityDef.effect.target === 'all_enemies') {
                 // AOE
                 newEnemies = newEnemies.map(e => {
                     if (e.hp <= 0) return e;
                     const dmg = roll(abilityDef.effect.dice || '1d6', rng).total + powerBonus;
                     return { ...e, hp: Math.max(0, e.hp - dmg) };
                 });
                 newHistory.push(`${actor.name} uses ${abilityDef.name}! AOE Damage!`);
             } else {
                 // Single Target
                 const targetIndex = room.enemies.findIndex(e => e.id === action.targetId);
                 if (targetIndex !== -1) {
                     const target = room.enemies[targetIndex];
                     // Attack Roll if it's an attack, or auto-hit for some spells?
                     // Let's do attack roll for EVERYTHING offensive to keep it consistent with skills
                      const attackRoll = roll('1d20', rng).total + accuracyBonus;
                      if (attackRoll >= target.ac) {
                          let dmg = 0;
                          
                          // Weapon Damage Logic
                          if (abilityDef.effect.useWeaponDamage) {
                               const weapon = actor.equipment?.main_hand;
                               let weaponDice = '1d4';
                               if (weapon) {
                                   const name = weapon.name.toLowerCase();
                                   if (name.includes('sword') || name.includes('axe') || name.includes('mace')) weaponDice = '1d8';
                                   else if (name.includes('dagger')) weaponDice = '1d4';
                                   else if (name.includes('great')) weaponDice = '2d6';
                                   else if (name.includes('bow') || name.includes('cross')) weaponDice = '1d8';
                                   else if (name.includes('staff')) weaponDice = '1d6';
                               }
                               dmg += roll(weaponDice, rng).total;
                          }
                          
                          // Ability Bonus Dice
                          if (abilityDef.effect.dice) {
                              dmg += roll(abilityDef.effect.dice, rng).total;
                          } else if (!abilityDef.effect.useWeaponDamage) {
                              dmg += roll('1d6', rng).total; // Fallback
                          }
                          
                          dmg += powerBonus;
                          
                          newEnemies[targetIndex] = { ...target, hp: Math.max(0, target.hp - dmg) };
                          newHistory.push(`${actor.name} uses ${abilityDef.name} on ${target.name}: [${attackRoll} vs AC] HIT! ${dmg} damage.`);
                      } else {
                         newHistory.push(`${actor.name} uses ${abilityDef.name} on ${target.name}: [${attackRoll} vs AC] MISS!`);
                     }
                 }
             }
        } else if (abilityDef.effect.type === 'heal') {
             const targetId = action.targetId || actor.id;
             const targetIndex = newParty.members.findIndex(m => m.id === targetId);
             if (targetIndex !== -1) {
                 const target = newParty.members[targetIndex];
                 // Heal = dice + level + faith bonus
                 const heal = roll(abilityDef.effect.dice || '1d4', rng).total + actor.level + powerBonus;
                 const newHp = Math.min(target.hp.max, target.hp.current + heal);
                 newParty.members[targetIndex] = { ...target, hp: { ...target.hp, current: newHp } };
                 newHistory.push(`${actor.name} heals ${target.name} for ${heal} HP.`);
             }
        } else if (abilityDef.effect.type === 'buff') {
             if (abilityDef.effect.status) {
                const targetId = action.targetId || actor.id;
                const targetIndex = newParty.members.findIndex(m => m.id === targetId);
                if (targetIndex !== -1) {
                    const target = newParty.members[targetIndex];
                    if (!target.statuses?.includes(abilityDef.effect.status!)) {
                        newParty.members[targetIndex] = {
                            ...target,
                            statuses: [...(target.statuses || []), abilityDef.effect.status!]
                        };
                        newHistory.push(`${target.name} gains ${abilityDef.effect.status}!`);
                        if (abilityDef.effect.status === 'hidden') {
                             newHistory.push(`${target.name} slips into the shadows.`);
                             // If hiding, maybe don't end turn? Or yes? Rogue Cunning Action is bonus action usually.
                             // For now, Cunning Action -> Free Action?
                             if (abilityDef.id === 'camouflage' || abilityDef.id === 'cunning_action') usedAction = false;
                        }
                    }
                }
             }
        }

        // Action Surge special case - grants an extra action
        let extraActionsGranted = 0;
        if (abilityDef.id === 'action_surge') {
            usedAction = false;
            extraActionsGranted = 1;
            newHistory.push(`${actor.name} surges with energy (Action Surge)! Take another action!`);
        }

        // Set cooldown. 'rest' abilities park at the REST_COOLDOWN sentinel
        // until a short/long rest clears them.
        const cooldownToSet = abilityDef.cooldownType === 'rest' ? REST_COOLDOWN : abilityDef.cooldownValue;

        // We need to update the actor in the NEW party array
        const finalActorIndex = newParty.members.findIndex(m => m.id === actor.id);
        if (finalActorIndex !== -1) {
             const updatedActor = newParty.members[finalActorIndex];
             const newAbilities = updatedActor.abilities.map(a =>
                 a.abilityId === action.abilityId ? { ...a, currentCooldown: cooldownToSet } : a
             );
             newParty.members[finalActorIndex] = { ...updatedActor, abilities: newAbilities };
        }
        
        // Remove stealth if offensive
        if (['damage', 'attack'].includes(abilityDef.effect.type)) {
             const sIndex = newParty.members.findIndex(m => m.id === actor.id);
             if (sIndex !== -1) {
                 const sActor = newParty.members[sIndex];
                 if (sActor.statuses?.includes('hidden')) {
                     newParty.members[sIndex] = {
                         ...sActor,
                         statuses: sActor.statuses.filter(s => s !== 'hidden')
                     };
                     newHistory.push(`${actor.name} reveals themselves!`);
                 }
             }
        }

        // Award spoils for anything that died this turn, using the same reward
        // table as a plain attack.
        let newInventory = state.inventory;
        newEnemies.forEach((e, i) => {
            if (e.hp <= 0 && room.enemies[i].hp > 0) {
                const rewards = awardKill(newParty, newInventory, e, rng, newHistory);
                newParty = { ...rewards.party, members: [...rewards.party.members] };
                newInventory = rewards.inventory;
            }
        });

        const aliveEnemies = newEnemies.filter(e => e.hp > 0);
        let justWon = false;
        if (aliveEnemies.length === 0 && room.enemies.length > 0) {
            const goldReward = state.inBossRoom ? rng.int(20, 49) : rng.int(5, 15);
            newParty = { ...newParty, gold: newParty.gold + goldReward };
            newHistory.push(`Victory! All enemies defeated. +${goldReward} gold.`);
            justWon = true;
            // Don't auto-resolve shrines or hazards - let player interact with them
            roomResolved = !(room.type === 'shrine' || room.type === 'hazard');
        }

        // Turn Tracking Logic (Match ATTACK handler behavior)
        const alreadyActed = (state.actedThisRound || []).includes(action.actorId);
        let newExtraActions = state.extraActions + extraActionsGranted;
        let newActedThisRound = [...(state.actedThisRound || [])];

        if (usedAction) {
             if (alreadyActed && state.extraActions > 0 && extraActionsGranted === 0) {
                 // Consumed an existing extra action
                 newExtraActions = (state.extraActions - 1) + extraActionsGranted; // Recalc based on original state
                 newHistory.push(`(Using extra action!)`);
             } else if (extraActionsGranted === 0) {
                 // Normal action consumption (if no surge granted)
                 if (!alreadyActed) newActedThisRound.push(action.actorId);
             }
        }
        
        // Determine Next Turn
        const aliveMemberIds = newParty.members.filter(m => m.isAlive).map(m => m.id);
        const allActed = aliveMemberIds.every(id => newActedThisRound.includes(id));
        
        let nextCombatTurn: 'player' | 'enemy' | null = 'player';

        if (justWon) {
             // Combat is over even in a guarded shrine/hazard, where the room
             // itself stays unresolved so the player can still interact.
             nextCombatTurn = null;
        } else if (allActed && newExtraActions === 0) {
             // If Action Surge was used, extraActions keeps us on the player turn.
             nextCombatTurn = 'enemy';
        }

        let nextState: RunState = {
            ...state,
            history: cappedHistory(newHistory),
            party: newParty,
            inventory: newInventory,
            currentRoom: { ...room, enemies: aliveEnemies },
            roomResolved,
            victory: justWon,
            combatTurn: nextCombatTurn,
            actedThisRound: nextCombatTurn === 'enemy' ? [] : newActedThisRound,
            extraActions: newExtraActions
        };

        if (nextCombatTurn === 'enemy') {
            return resolveEnemyTurn(nextState, rng);
        }
        return nextState;
    }

    case 'RENAME_ITEM': {
        // Find item in inventory OR equipment
        let newInventory = { ...state.inventory };
        let found = false;

        // Check Inventory
        newInventory.items = newInventory.items.map(item => {
            if (item.id === action.itemId) {
                found = true;
                return { ...item, customName: action.newName };
            }
            return item;
        });

        let newParty = { ...state.party };

        if (!found) {
            // Check Equipment for all members
            newParty.members = newParty.members.map(member => {
                const newEquip = { ...member.equipment };
                let equipChanged = false;
                
                Object.keys(newEquip).forEach(key => {
                    const slot = key as keyof typeof newEquip;
                    const item = newEquip[slot];
                    if (item && item.id === action.itemId) {
                         newEquip[slot] = { ...item, customName: action.newName };
                         equipChanged = true;
                         found = true;
                    }
                });
                
                return equipChanged ? { ...member, equipment: newEquip } : member;
            });
        }
        
        if (!found) return state;

        return {
            ...state,
            inventory: newInventory,
            party: newParty,
            history: cappedHistory([...state.history, `Item renamed to "${action.newName}".`])
        };
    }

    case 'SPEND_STAT_POINT': {
        const actorIndex = state.party.members.findIndex(m => m.id === action.actorId);
        if (actorIndex === -1) return state;
        const actor = state.party.members[actorIndex];
        
        if (actor.statPoints <= 0) return state; // Check if points available
        
        const newStats = { ...actor.skills };
        // Increase specific stat
        // Currently action.stat is assumed to be passed. Need to update Action type?
        // Assuming action object: { type: 'SPEND_STAT_POINT', actorId, stat: keyof Skills }
        
        switch(action.stat) {
            case 'strength': newStats.strength++; break;
            case 'attack': newStats.attack++; break;
            case 'defense': newStats.defense++; break;
            case 'magic': newStats.magic++; break;
            case 'ranged': newStats.ranged++; break;
            case 'faith': newStats.faith++; break;
            default: return state;
        }
        
        const newParty = { ...state.party };
        newParty.members = [...state.party.members];
        newParty.members[actorIndex] = {
            ...actor,
            statPoints: actor.statPoints - 1,
            skills: newStats
        };
        
        return {
            ...state,
            party: newParty
        };
    }

    case 'ENTER_BOSS_ROOM': {
        const room = state.currentRoom;
        if (!room || room.type !== 'intermission' || !room.bossRoom) {
            return state;
        }
        
        // Store the intermission room to return to after boss fight
        return {
            ...state,
            parentIntermission: room,
            currentRoom: room.bossRoom,
            inBossRoom: true,
            roomResolved: false,
            combatTurn: 'player',
            combatRound: 1,
            actedThisRound: [],
            history: cappedHistory([...state.history, '⚔️ You enter the Boss Chamber! Prepare for battle!'])
        };
    }

    default:
      return state;
  }
} // End reducer
