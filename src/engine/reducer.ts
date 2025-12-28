import type { RunState, Action, EquipmentSlot, Item, Actor } from './types';
import { createInitialRunState, createActor } from './state';
import { SeededRNG } from '../core/rng';
import { resolveRoom } from './resolveRoom';
import { performLongRest, performShortRest } from './rest';
import { hashWithSeed } from '../core/hash';
import { ITEMS, RECRUITS, getDropForEnemy } from '../content/tables';
import { generateRoom, calculateEscapeDC } from './generateRoom';
import { roll } from '../core/dice';
import { getAbilityById } from '../content/abilities';
import { resolveEnemyTurn } from './combatHelpers';

// Helper to cap history array to prevent memory bloat
// UI only shows last 20 entries, keeping 100 for reasonable scroll-back
const MAX_HISTORY_LENGTH = 100;
function cappedHistory(history: string[]): string[] {
    return history.length > MAX_HISTORY_LENGTH
        ? history.slice(-MAX_HISTORY_LENGTH)
        : history;
}

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

// Helper to increment encounter count on all equipped weapons when entering combat
function incrementWeaponEncounters(members: Actor[]): Actor[] {
    return members.map(member => {
        const weapon = member.equipment.main_hand;
        if (!weapon) return member;

        const stats = weapon.stats || { kills: 0, damageDealt: 0, highestHit: 0, criticalHits: 0, encountersUsed: 0 };
        const updatedWeapon: Item = {
            ...weapon,
            stats: {
                ...stats,
                encountersUsed: stats.encountersUsed + 1
            }
        };

        return {
            ...member,
            equipment: {
                ...member.equipment,
                main_hand: updatedWeapon
            }
        };
    });
}

export function gameReducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case 'START_RUN':
      return createInitialRunState(action.seed);

    case 'ADVANCE_ROOM': {
        const newDepth = state.depth + 1;
        const rng = new SeededRNG(hashWithSeed(state.seed, newDepth));
        
        // Remove dead party members before advancing (they're gone forever)
        const survivingMembers = state.party.members.filter(m => m.isAlive);
        
        // Generate the room immediately and store it
        const room = generateRoom({ ...state, depth: newDepth, party: { ...state.party, members: survivingMembers } }, rng);
        
        // Increment weapon encounter counts if entering combat
        // Check if room has enemies (combat, elite, or guarded shrine/hazard)
        const isCombat = (room.type === 'combat' || room.type === 'elite') || 
                        ((room.type === 'shrine' || room.type === 'hazard') && room.enemies && room.enemies.length > 0);
        const updatedMembers = isCombat
            ? incrementWeaponEncounters(survivingMembers)
            : survivingMembers;

        // Build history
        const newHistory = [...state.history];
        const deadNames = state.party.members.filter(m => !m.isAlive).map(m => m.name);
        if (deadNames.length > 0) {
            newHistory.push(`☠️ ${deadNames.join(', ')} left behind forever...`);
        }
        newHistory.push(`Entered room ${newDepth}: ${room.type.toUpperCase()}`);

        // Roll initiative for combat
        let combatTurn: 'player' | 'enemy' | null = isCombat ? 'player' : null;
        if (isCombat && room.enemies.length > 0) {
            // Roll initiative: party uses highest agility member, enemies use highest power
            const partyAgility = Math.max(...updatedMembers.filter(m => m.isAlive).map(m => m.skills?.agility || 0), 0);
            const enemyPower = Math.max(...room.enemies.map(e => e.power), 0);

            const partyInit = roll('1d20').total + partyAgility;
            const enemyInit = roll('1d20').total + Math.floor(enemyPower / 2);

            newHistory.push(`⚔️ Initiative: Party ${partyInit} vs Enemies ${enemyInit}`);

            if (enemyInit > partyInit) {
                combatTurn = 'enemy';
                newHistory.push(`Enemies act first!`);
            } else {
                newHistory.push(`Party acts first!`);
            }
            newHistory.push('━━━ ROUND 1 ━━━');
        }

        let nextState: RunState = {
          ...state,
          depth: newDepth,
          currentRoom: room,
          roomResolved: room.type !== 'combat' && room.type !== 'elite' && room.type !== 'hazard' && room.type !== 'shrine' && room.type !== 'trader',
          combatTurn,
          combatRound: isCombat ? 1 : 0,
          actedThisRound: [], // Reset for new combat
          extraActions: 0, // Reset extra actions on room enter
          victory: false, // Reset victory flag on room enter
          party: { ...state.party, members: updatedMembers },
          history: cappedHistory(newHistory),
        };

        // Long rest at segment boundaries
        if (newDepth > 0 && newDepth % 10 === 0) {
             nextState = performLongRest(nextState, rng);
        }

        // If enemies won initiative, resolve their turn immediately
        if (combatTurn === 'enemy') {
            nextState = resolveEnemyTurn(nextState);
        }

        return nextState;
    }

    case 'RESOLVE_ROOM': {
        const nextState = resolveRoom(state, action);
        return {
            ...nextState,
            roomResolved: true
        };
    }

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

        const attackRoll = roll('1d20').total;
        const hit = (attackRoll + totalAttackBonus) >= target.ac;
        
        let newHistory = [...state.history];
        let newEnemies = [...room.enemies];
        let newParty = { ...state.party };
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
            const damageRoll = roll('1d8');
            let damage = Math.max(1, damageRoll.total + totalDamageBonus);
            const isCritical = attackRoll === 20; // Natural 20 is a critical hit

            // Check for Champion Strike (Empowered)
            if (attacker.statuses?.includes('champion_strike')) {
                 const bonusDice = roll('2d6'); // Match the ability dice
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
                // Per-enemy loot: gold based on power
                const goldDrop = target.power * 3 + Math.floor(Math.random() * (target.power * 2));
                newParty.gold += goldDrop;
                
                // Item drop chance based on enemy power tier
                const droppedItem = getDropForEnemy(target.power, Math.random);
                if (droppedItem) {
                    newInventory = {
                        ...newInventory,
                        items: [...newInventory.items, droppedItem]
                    };
                    newHistory.push(`🎁 ${target.name} dropped ${droppedItem.name}!`);
                }
                
                // Award XP to alive party members
                const xpGain = target.power * 15; // XP = enemy power * 15
                const aliveMembers = newParty.members.filter(m => m.isAlive);
                const xpPerMember = Math.floor(xpGain / aliveMembers.length);
                
                newHistory.push(`${target.name} defeated! +${goldDrop} gold, +${xpGain} XP`);
                
                // Distribute XP and check for level-ups
                const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000]; 
                
                newParty.members = newParty.members.map(m => {
                    if (!m.isAlive) return m;
                    
                    // Reveal from stealth if attacking
                    let newStatuses = m.statuses || [];
                    if (m.id === action.attackerId && newStatuses.includes('hidden')) {
                         newStatuses = newStatuses.filter(s => s !== 'hidden');
                         newHistory.push(`${m.name} reveals themselves from the shadows!`);
                    }
                    
                    const newXp = m.xp + xpPerMember;
                    let newLevel = m.level;
                    let newMaxHp = m.hp.max;
                    let newCurrentHp = m.hp.current;
                    let newHitDice = { ...m.hitDice };
                    let newStatPoints = m.statPoints || 0;
                    
                    // Check for level up
                    while (newLevel < XP_THRESHOLDS.length - 1 && newXp >= XP_THRESHOLDS[newLevel]) {
                        newLevel++;
                        newStatPoints++; // Gain 1 stat point per level
                        newHistory.push(`${m.name} leveled up to ${newLevel}! +1 Stat Point!`);

                        // Roll hit dice for HP: 1d8 + level bonus (min 1)
                        const hitDieRoll = roll('1d8').total;
                        const hpGain = Math.max(1, hitDieRoll + Math.floor(newLevel / 2));
                        newMaxHp += hpGain;
                        newCurrentHp += hpGain; // Heal on level up
                        // Gain extra hit dice every 2 levels
                        if (newLevel % 2 === 0) {
                            newHitDice.max += 1;
                            newHitDice.current += 1;
                        }
                        newHistory.push(`🎉 ${m.name} leveled up to ${newLevel}! +${hpGain} HP (rolled ${hitDieRoll}), +1 ATK, +1 DMG`);
                    }
                    return {
                        ...m,
                        xp: newXp,
                        level: newLevel,
                        hp: { current: newCurrentHp, max: newMaxHp },
                        hitDice: newHitDice,
                        statPoints: newStatPoints,
                        statuses: newStatuses
                    };
                });
                
                newEnemies = newEnemies.filter(e => e.hp > 0);
            }
        } else {
            newHistory.push(`${attacker.name} attacks ${target.name}: [${attackRoll}+${totalAttackBonus}=${attackRoll+totalAttackBonus} vs AC ${target.ac}] MISS!`);
        }
        
        // Check victory
        if (newEnemies.length === 0) {
            // Calculate gold reward (5-15 gold, more for bosses)
            const goldReward = state.inBossRoom ? Math.floor(20 + Math.random() * 30) : Math.floor(5 + Math.random() * 11);
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
                const tierRoll = Math.random() * 100;
                let tierName: string;
                if (tierRoll < 60) { tierName = 'Greater'; }
                else if (tierRoll < 90) { tierName = 'Epic'; }
                else { tierName = 'Legendary'; }
                
                return {
                    ...state,
                    currentRoom: state.parentIntermission,
                    parentIntermission: null,
                    inBossRoom: false,
                    roomResolved: false, // Allow long rest at intermission
                    combatTurn: null,
                    actedThisRound: [],
                    victory: true,
                    shrineBoon: `🏆 ${tierName} Boss Blessing! Your weapon glows with power!`,
                    history: cappedHistory(newHistory),
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
            return resolveEnemyTurn(nextState);
        }

        return nextState;
    }

    case 'BUY_ITEM': {
        // Validation: has gold?
        if (state.party.gold < action.cost) {
            return {
                ...state, 
                history: cappedHistory([...state.history, "Not enough gold to buy item."])
            };
        }
        
        // Find Item from room's shop first, fallback to ITEMS
        const room = state.currentRoom;
        const item = room?.shopItems?.find(i => i.id === action.itemId) || ITEMS.find(i => i.id === action.itemId);
        if (!item) return state;
        
        // Remove from room's shop items
        const newRoom = room && room.shopItems ? {
            ...room,
            shopItems: room.shopItems.filter(i => i.id !== action.itemId)
        } : room;

        return {
            ...state,
            currentRoom: newRoom,
            party: {
                ...state.party,
                gold: state.party.gold - action.cost
            },
            inventory: {
                ...state.inventory,
                items: [...state.inventory.items, item]
            },
            history: cappedHistory([...state.history, `Bought ${item.name}`])
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
        const sellPrice = 10; // Flat rate for all items
        
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
        
        // Calculate HP Difference
        const oldMaxHpBonus = (oldItem?.baseStats?.maxHpBonus || 0) + (oldItem?.enchantment?.effect?.maxHpBonus || 0);
        const newMaxHpBonus = (item.baseStats.maxHpBonus || 0) + (item.enchantment?.effect?.maxHpBonus || 0);
        const hpDiff = newMaxHpBonus - oldMaxHpBonus;

        newParty.members[actorIndex] = {
            ...actor,
            equipment: newEquipment,
            hp: {
                ...actor.hp,
                max: actor.hp.max + hpDiff,
                current: actor.hp.current + hpDiff
            }
        };

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
        
        // Calculate HP Difference (Negative)
        const removedMaxHpBonus = (item.baseStats.maxHpBonus || 0) + (item.enchantment?.effect?.maxHpBonus || 0);
        
        newParty.members[actorIndex] = {
            ...actor,
            equipment: newEquipment,
            hp: {
                ...actor.hp,
                max: actor.hp.max - removedMaxHpBonus,
                current: Math.max(1, actor.hp.current - removedMaxHpBonus) // Don't kill on unequip? Or allow it? simplified: min 1
            }
        };
        
        return {
            ...state,
            party: newParty,
            inventory: { ...state.inventory, items: newInventoryItems },
            history: cappedHistory([...state.history, `Unequipped ${item.name}.`])
        };
    }

    case 'DISARM_TRAP': {
        if (!state.currentRoom || state.currentRoom.type !== 'hazard') return state;
        
        // Check for rogue in party (trap bonus)
        const hasRogue = state.party.members.some(m => m.isAlive && m.role === 'rogue');
        const rogueBonus = hasRogue ? 5 : 0; // +5 bonus with rogue
        
        // Roll dexterity check (d20 + 2 + rogue bonus vs DC 12)
        const baseRoll = roll('1d20').total;
        const disarmRoll = baseRoll + 2 + rogueBonus;
        const success = disarmRoll >= 12;
        
        if (success) {
            const goldReward = Math.floor(5 + Math.random() * 11); // 5-15 gold
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
        } else {
            // Failed disarm triggers the trap
            const damage = roll('1d6').total;
            const hero = state.party.members[0];
            const newHp = Math.max(0, hero.hp.current - damage);
            
            let nextState: RunState = {
                ...state,
                party: {
                    ...state.party,
                    members: state.party.members.map((m, i) => 
                        i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m
                    )
                },
                roomResolved: true,
                history: cappedHistory([...state.history, `Failed to disarm! (Rolled ${disarmRoll}). Trap deals ${damage} damage!`])
            };
            
            if (newHp <= 0) {
                nextState = { ...nextState, gameOver: true, history: cappedHistory([...nextState.history, 'Hero has fallen! Game Over.']) };
            }
            
            return nextState;
        }
    }
    
    case 'TRIGGER_TRAP': {
        if (!state.currentRoom || state.currentRoom.type !== 'hazard') return state;
        
        // Just take the damage
        const damage = roll('2d6').total;
        const hero = state.party.members[0];
        const newHp = Math.max(0, hero.hp.current - damage);
        
        let nextState: RunState = {
            ...state,
            party: {
                ...state.party,
                members: state.party.members.map((m, i) => 
                    i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m
                )
            },
            roomResolved: true,
            history: cappedHistory([...state.history, `Triggered the trap! Takes ${damage} damage!`])
        };
        
        if (newHp <= 0) {
            nextState = { ...nextState, gameOver: true, history: cappedHistory([...nextState.history, 'Hero has fallen! Game Over.']) };
        }
        
        return nextState;
    }
    
    case 'PRAY_AT_SHRINE': {
        if (!state.currentRoom || state.currentRoom.type !== 'shrine') return state;
        
        // Check for cleric in party (shrine bonus)
        const hasCleric = state.party.members.some(m => m.isAlive && m.role === 'cleric');
        const clericBonus = hasCleric ? 1.5 : 1; // 50% bonus with cleric
        
        const hero = state.party.members[0];
        let newParty = { ...state.party };
        let newShortRests = state.shortRestsRemaining;
        
        // Build list of useful boons
        const boons: { type: string; apply: () => string }[] = [];
        
        // Heal if not at full HP (cleric boosts heal amount)
        if (hero.hp.current < hero.hp.max) {
            boons.push({
                type: 'heal',
                apply: () => {
                    const baseHeal = Math.floor(hero.hp.max * 0.5);
                    const healAmount = Math.floor(baseHeal * clericBonus);
                    const newHp = Math.min(hero.hp.max, hero.hp.current + healAmount);
                    newParty.members = state.party.members.map((m, i) => 
                        i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m
                    );
                    const bonusMsg = hasCleric ? ' (Cleric +50%)' : '';
                    return `The shrine glows warmly. Healed for ${healAmount} HP!${bonusMsg}`;
                }
            });
        }
        
        // Restore rest if not at max
        if (state.shortRestsRemaining < 2) {
            boons.push({
                type: 'rest',
                apply: () => {
                    newShortRests = state.shortRestsRemaining + 1;
                    return `The shrine restores your vitality. +1 Short Rest!`;
                }
            });
        }
        
        // Gold is always useful
        boons.push({
            type: 'gold',
            apply: () => {
                const goldBonus = 15 + Math.floor(Math.random() * 16); // 15-30 gold
                newParty.gold = state.party.gold + goldBonus;
                return `Golden light showers upon you. +${goldBonus} gold!`;
            }
        });
        
        // Full heal if damaged
        if (hero.hp.current < hero.hp.max) {
            boons.push({
                type: 'fullheal',
                apply: () => {
                    newParty.members = state.party.members.map((m, i) => 
                        i === 0 ? { ...m, hp: { ...m.hp, current: m.hp.max } } : m
                    );
                    return `Divine energy surges through you. Fully healed!`;
                }
            });
        }
        
        // ENCHANT EQUIPMENT - the core run differentiator!
        // Find all equipped items in party
        const equippedItems: { member: typeof hero; item: Item; slot: EquipmentSlot }[] = [];
        for (const member of state.party.members) {
            Object.entries(member.equipment).forEach(([slot, item]) => {
                if (item) equippedItems.push({ member, item: item as Item, slot: slot as EquipmentSlot });
            });
        }

        // Enchantment suffix tables by tier and type
        const WEAPON_SUFFIXES: Record<number, string[]> = {
            1: ['of Striking', 'of the Blade', 'of Sharpness'],
            2: ['of Might', 'of Slaying', 'of the Warrior'],
            3: ['of Fury', 'of Destruction', 'of the Champion'],
            4: ['of Annihilation', 'of the Titan', 'of Doom'],
            5: ['of the Gods', 'of Legends', 'Godslayer']
        };
        const ARMOR_SUFFIXES: Record<number, string[]> = {
            1: ['of Protection', 'of Warding', 'of the Guard'],
            2: ['of Defense', 'of the Sentinel', 'of Resilience'],
            3: ['of Fortitude', 'of the Bulwark', 'of Endurance'],
            4: ['of Invincibility', 'of the Immortal', 'of Iron Will'],
            5: ['of the Divine', 'of Eternity', 'Godshield']
        };
        const JEWELRY_SUFFIXES: Record<number, string[]> = {
            1: ['of Minor Power', 'of the Apprentice', 'of Focus'],
            2: ['of Enhancement', 'of the Adept', 'of Clarity'],
            3: ['of Mastery', 'of the Sage', 'of Potency'],
            4: ['of Supremacy', 'of the Archmage', 'of Domination'],
            5: ['of Omnipotence', 'of the Infinite', 'Godstone']
        };

        if (equippedItems.length > 0) {
            boons.push({
                type: 'enchant',
                apply: () => {
                    // Pick random equipped item
                    const target = equippedItems[Math.floor(Math.random() * equippedItems.length)];

                    // Roll tier (weighted by Faith)
                    const faith = target.member.skills?.faith || 0;
                    const faithBonus = faith * 5; // +5% chance per faith point for better tiers

                    // If item already enchanted, 50% chance to upgrade tier instead
                    const existingTier = target.item.enchantment?.tier || 0;
                    const isUpgrade = existingTier > 0 && Math.random() < 0.5;

                    const tierRoll = Math.random() * 100 + faithBonus;
                    let baseTier: 1 | 2 | 3 | 4 | 5;
                    let tierName: string;
                    if (tierRoll < 50) { baseTier = 1; tierName = 'Minor'; }
                    else if (tierRoll < 75) { baseTier = 2; tierName = 'Lesser'; }
                    else if (tierRoll < 90) { baseTier = 3; tierName = 'Greater'; }
                    else if (tierRoll < 98) { baseTier = 4; tierName = 'Epic'; }
                    else { baseTier = 5; tierName = 'Legendary'; }

                    // If upgrading, ensure new tier is at least +1 (capped at 5)
                    const tier = isUpgrade
                        ? Math.min(5, Math.max(baseTier, existingTier + 1)) as 1 | 2 | 3 | 4 | 5
                        : baseTier;
                    if (tier > baseTier) {
                        tierName = ['Minor', 'Lesser', 'Greater', 'Epic', 'Legendary'][tier - 1];
                    }

                    // Generate enchantment based on slot
                    const bonusValue = tier + Math.floor(Math.random() * tier); // tier to tier*2

                    // Pick suffix based on item slot type
                    let suffixTable = JEWELRY_SUFFIXES;
                    if (target.slot === 'main_hand' || target.slot === 'off_hand') {
                        suffixTable = target.item.type === 'shield' ? ARMOR_SUFFIXES : WEAPON_SUFFIXES;
                    } else if (['chest', 'legs', 'head', 'feet'].includes(target.slot)) {
                        suffixTable = ARMOR_SUFFIXES;
                    }
                    const suffix = suffixTable[tier][Math.floor(Math.random() * suffixTable[tier].length)];

                    // Create enchantment effect based on slot type
                    const effect: { attackBonus?: number; damageBonus?: number; acBonus?: number; maxHpBonus?: number } = {};

                    // Weapon slots
                    if (target.slot === 'main_hand' || target.slot === 'off_hand') {
                        if (target.item.type === 'shield') {
                             effect.acBonus = bonusValue;
                             if (tier >= 3) effect.maxHpBonus = tier;
                        } else {
                             effect.attackBonus = Math.floor(bonusValue / 2) || 1;
                             effect.damageBonus = bonusValue;
                        }
                    } else if (['chest', 'legs', 'head', 'feet'].includes(target.slot)) {
                        effect.acBonus = bonusValue;
                        if (tier >= 3) effect.maxHpBonus = tier * 2;
                    } else {
                        // Jewelry (neck, rings) - random bonus type
                        const roll = Math.random();
                        if (roll < 0.33) {
                            effect.attackBonus = bonusValue;
                        } else if (roll < 0.66) {
                            effect.damageBonus = bonusValue;
                        } else {
                            effect.maxHpBonus = bonusValue * 2;
                        }
                    }

                    // MERGE / STACK LOGIC
                    // If upgrading, stack the stats on top of existing ones
                    if (isUpgrade && target.item.enchantment) {
                        const oldEffect = target.item.enchantment.effect;
                        
                        // Add new bonuses to old bonuses
                        if (effect.attackBonus) effect.attackBonus = (oldEffect.attackBonus || 0) + effect.attackBonus;
                        if (effect.damageBonus) effect.damageBonus = (oldEffect.damageBonus || 0) + effect.damageBonus;
                        if (effect.acBonus) effect.acBonus = (oldEffect.acBonus || 0) + effect.acBonus;
                        if (effect.maxHpBonus) effect.maxHpBonus = (oldEffect.maxHpBonus || 0) + effect.maxHpBonus;
                        
                        // Keep the highest tier for coloring purposes, or upgrades tier
                        // Use calculated 'tier' from above which is already max(old+1, new)
                    }

                    // Get base item name (remove old suffix if upgrading)
                    // Use customName if player renamed the item, otherwise use original name
                    const originalBaseName = target.item.enchantment
                        ? target.item.name.replace(/ of .*$/, '').replace(/ God.*$/, '')
                        : target.item.name;
                    // For stacked blessings, we keep the new suffix as the "primary" name descriptor
                    // but the stats are stacked.
                    
                    const displayBaseName = target.item.customName || originalBaseName;

                    // Add to item history
                    const itemHistory = [...(target.item.history || [])];
                    if (isUpgrade && target.item.enchantment) {
                         // Describe stacking
                         itemHistory.push(`Stacked with ${tierName} enchantment (Total Tier ${tier})`);
                    } else if (isUpgrade) {
                        itemHistory.push(`Upgraded to ${tierName} at shrine`);
                    } else {
                        itemHistory.push(`Blessed with ${tierName} enchantment`);
                    }
                    while (itemHistory.length > 10) itemHistory.shift();

                    // Apply enchantment to item
                    const enchantedItem: Item = {
                        ...target.item,
                        name: `${originalBaseName} ${suffix}`,
                        enchantment: { tier, name: suffix, effect, description: `${tierName} Boon` },
                        history: itemHistory
                    };

                    // Update party member's equipment
                    newParty.members = state.party.members.map(m => {
                        if (m.id !== target.member.id) return m;
                        const newEquipment = { ...m.equipment };
                        newEquipment[target.slot] = enchantedItem;
                        return { ...m, equipment: newEquipment };
                    });

                    const upgradeText = isUpgrade ? ' (UPGRADED!)' : '';
                    return `✨ ${tierName} Boon${upgradeText}! ${target.member.name}'s ${displayBaseName} becomes ${enchantedItem.customName || enchantedItem.name}! (+${bonusValue} power)`;
                }
            });
        }
        
        // Pick a boon - Room 0 (starting shrine) always enchants the WEAPON specifically
        let chosenBoon;
        if (state.depth === 0) {
            // Starting shrine ONLY enchants the main weapon
            const hero = state.party.members[0];
            const weapon = hero.equipment.main_hand;
            
            if (weapon) {
                // Create a special weapon-only enchant boon
                chosenBoon = {
                    type: 'enchant_weapon',
                    apply: () => {
                        // Same enchantment logic but forced to main_hand weapon
                        const faith = hero.skills?.faith || 0;
                        const faithBonus = faith * 5;
                        const existingTier = weapon.enchantment?.tier || 0;
                        const isUpgrade = existingTier > 0 && Math.random() < 0.5;

                        const tierRoll = Math.random() * 100 + faithBonus;
                        let baseTier: 1 | 2 | 3 | 4 | 5;
                        let tierName: string;
                        if (tierRoll < 50) { baseTier = 1; tierName = 'Minor'; }
                        else if (tierRoll < 75) { baseTier = 2; tierName = 'Lesser'; }
                        else if (tierRoll < 90) { baseTier = 3; tierName = 'Greater'; }
                        else if (tierRoll < 98) { baseTier = 4; tierName = 'Epic'; }
                        else { baseTier = 5; tierName = 'Legendary'; }

                        const tier = isUpgrade
                            ? Math.min(5, Math.max(baseTier, existingTier + 1)) as 1 | 2 | 3 | 4 | 5
                            : baseTier;
                        if (tier > baseTier) {
                            tierName = ['Minor', 'Lesser', 'Greater', 'Epic', 'Legendary'][tier - 1];
                        }

                        const bonusValue = tier + Math.floor(Math.random() * tier);
                        const suffix = WEAPON_SUFFIXES[tier][Math.floor(Math.random() * WEAPON_SUFFIXES[tier].length)];

                        const effect = {
                            attackBonus: Math.floor(bonusValue / 2) || 1,
                            damageBonus: bonusValue
                        };

                        const originalBaseName = weapon.enchantment
                            ? weapon.name.replace(/ of .*$/, '').replace(/ God.*$/, '')
                            : weapon.name;
                        const displayBaseName = weapon.customName || originalBaseName;

                        const itemHistory = [...(weapon.history || [])];
                        itemHistory.push(`Blessed with ${tierName} enchantment at starting shrine`);
                        while (itemHistory.length > 10) itemHistory.shift();

                        const enchantedItem: Item = {
                            ...weapon,
                            name: `${originalBaseName} ${suffix}`,
                            enchantment: { tier, name: suffix, effect, description: `${tierName} Boon` },
                            history: itemHistory
                        };

                        // Update hero's equipment
                        newParty.members = state.party.members.map((m, i) => {
                            if (i !== 0) return m;
                            return { ...m, equipment: { ...m.equipment, main_hand: enchantedItem } };
                        });

                        const upgradeText = isUpgrade ? ' (UPGRADED!)' : '';
                        return `⚔️ ${tierName} Weapon Blessing${upgradeText}! Your ${displayBaseName} becomes ${enchantedItem.customName || enchantedItem.name}! (+${bonusValue} power)`;
                    }
                };
            } else {
                // No weapon? Fall back to gold
                chosenBoon = boons.find(b => b.type === 'gold') || boons[0];
            }
        } else {
            chosenBoon = boons[Math.floor(Math.random() * boons.length)];
        }
        const boonMessage = chosenBoon.apply();
        
        return {
            ...state,
            party: newParty,
            shortRestsRemaining: newShortRests,
            roomResolved: true,
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

        // Check party size (max 4)
        if (state.party.members.length >= 4) {
            return {
                ...state,
                history: cappedHistory([...state.history, 'Party is full! Max 4 members.'])
            };
        }

        // Create new party member at recruit's scaled level with starter equipment
        const newMember = createActor(
            `party-${state.party.members.length + 1}`,
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
        const escapeRoll = roll('1d20').total;
        const success = escapeRoll >= dc;

        let newHistory = [...state.history];
        let newParty = { ...state.party };

        if (success) {
            newHistory.push(`🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] SUCCESS! (${breakdown})`);
            
            // Advance to next room - generate new room
            const rng = new SeededRNG(hashWithSeed(state.seed + 'retreat', state.depth));
            const newDepth = state.depth + 1;
            const newRoom = generateRoom({ ...state, depth: newDepth }, rng);
            
            return {
                ...state,
                depth: newDepth,
                currentRoom: newRoom,
                roomResolved: newRoom.type !== 'combat' && newRoom.type !== 'elite' && newRoom.type !== 'hazard' && newRoom.type !== 'shrine' && newRoom.type !== 'trader',
                combatTurn: (newRoom.type === 'combat' || newRoom.type === 'elite') ? 'player' : null,
                combatRound: (newRoom.type === 'combat' || newRoom.type === 'elite') ? 1 : 0,
                extraActions: 0, // Reset extra actions on room enter
                history: cappedHistory([...newHistory, `Entered room ${newDepth}: ${newRoom.type.toUpperCase()}`])
            };
        } else {
            // Failed - enemies get free attacks
            newHistory.push(`🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] FAILED! Enemies attack! (${breakdown})`);

            // All alive enemies attack once
            for (const enemy of room.enemies.filter(e => e.hp > 0)) {
                const aliveMembersForAttack = newParty.members.filter(m => m.isAlive);
                if (aliveMembersForAttack.length === 0) break;

                const targetMember = aliveMembersForAttack[Math.floor(Math.random() * aliveMembersForAttack.length)];
                const targetIndex = newParty.members.findIndex(m => m.id === targetMember.id);
                
                const enemyAttackRoll = roll('1d20').total;
                // Calculate AC from defense skill + equipped items (including enchantments)
                let memberAC = 10 + (targetMember.skills?.defense || 0);
                Object.values(targetMember.equipment).forEach(item => {
                    if (!item) return;
                    memberAC += (item.baseStats.acBonus || 0);
                    if (item.enchantment?.effect) {
                        memberAC += (item.enchantment.effect.acBonus || 0);
                    }
                });
                const enemyHit = (enemyAttackRoll + enemy.power) >= memberAC;
                
                if (enemyHit) {
                    const enemyDamageRoll = roll(enemy.damage);
                    const newHp = Math.max(0, targetMember.hp.current - enemyDamageRoll.total);
                    const isNowDead = newHp <= 0;
                    
                    newParty.members = newParty.members.map((m, i) => 
                        i === targetIndex ? { ...m, hp: { ...m.hp, current: newHp }, isAlive: !isNowDead } : m
                    );
                    
                    newHistory.push(`💥 ${enemy.name} attacks ${targetMember.name}: HIT! ${enemyDamageRoll.total} damage!`);
                    if (isNowDead) {
                        newHistory.push(`☠️ ${targetMember.name} has fallen!`);
                    }
                } else {
                    newHistory.push(`💨 ${enemy.name} attacks ${targetMember.name}: MISS!`);
                }
            }
            
            // Check game over
            const allDead = newParty.members.every(m => !m.isAlive);
            if (allDead) {
                return {
                    ...state,
                    party: newParty,
                    gameOver: true,
                    history: cappedHistory([...newHistory, 'The entire party has fallen! Game Over.'])
                };
            }
            
            // Stay in combat, player turn
            return {
                ...state,
                party: newParty,
                history: cappedHistory(newHistory)
            };
        }
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
        let newParty = { ...state.party };
        
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
            // Weapon-based abilities (like Aimed Shot) use ranged skill + equipment
            accuracyBonus = skills.ranged + equipAtkBonus;
            powerBonus = skills.ranged + equipDmgBonus;
        } else if (abilityDef.effect.type === 'damage') {
            // Spells use magic skill + equipment
            powerBonus = skills.magic + equipDmgBonus;
            accuracyBonus = skills.magic + equipAtkBonus;
        } else if (abilityDef.effect.type === 'heal') {
            powerBonus = skills.faith; // Healing doesn't use equipment bonuses
        }

        let roomResolved = false;
        let combatTurn: 'player' | 'enemy' | null = 'enemy';
        let usedAction = true;

        if (abilityDef.effect.type === 'damage' || abilityDef.effect.type === 'attack') {
             // Offensive
             if (abilityDef.effect.target === 'all_enemies') {
                 // AOE
                 newEnemies = newEnemies.map(e => {
                     if (e.hp <= 0) return e;
                     const dmg = roll(abilityDef.effect.dice || '1d6').total + powerBonus;
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
                     const attackRoll = roll('1d20').total + accuracyBonus;
                     if (attackRoll >= target.ac) {
                         const dmg = roll(abilityDef.effect.dice || '1d6').total + powerBonus;
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
                 const heal = roll(abilityDef.effect.dice || '1d4').total + actor.level + powerBonus;
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
            combatTurn = 'player'; // Keep it player's turn
            extraActionsGranted = 1;
            newHistory.push(`${actor.name} surges with energy (Action Surge)! Take another action!`);
        }

        // Set cooldown
        // For 'rest' cooldown abilities, use a large number (999) to indicate "until rest"
        // For 'turns' cooldown, use the defined value
        const cooldownToSet = abilityDef.cooldownType === 'rest' ? 999 : abilityDef.cooldownValue;

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

        // Check deaths
        newEnemies.forEach((e, i) => {
             if (e.hp <= 0 && room.enemies[i].hp > 0) {
                 // Died this turn
                  const goldDrop = e.power * 2;
                  newParty.gold += goldDrop;
                  newHistory.push(`${e.name} defeated! +${goldDrop} Gold`);
             }
         });
         
        const aliveEnemies = newEnemies.filter(e => e.hp > 0);
        if (aliveEnemies.length === 0 && room.enemies.length > 0) {
            newHistory.push("Victory! All enemies defeated.");
            roomResolved = true;
            combatTurn = null;
        }

        let nextState = {
            ...state,
            history: cappedHistory(newHistory),
            party: newParty,
            currentRoom: { ...room, enemies: aliveEnemies },
            roomResolved,
            combatTurn,
            extraActions: state.extraActions + extraActionsGranted
        };

        if (usedAction && !roomResolved) {
            return resolveEnemyTurn(nextState);
        } else {
            return nextState;
        }
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
