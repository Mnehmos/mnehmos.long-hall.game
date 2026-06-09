/**
 * 🎮 Game Reducer - Action Handlers for Preact Signals
 *
 * Ports the original reducer pattern to signal updates.
 * Each action is a function that mutates the gameState signal.
 *
 * ## Action Categories
 * - **Game Flow**: startNewGame, advanceRoom, dismissPopup
 * - **Combat**: attackEnemy, useAbility, attemptFlee
 * - **Room Interaction**: prayAtShrine, disarmTrap, triggerTrap, enterBossRoom
 * - **Rest**: takeShortRest, takeLongRest
 * - **Economy**: buyItem, sellItem, recruitMember
 * - **Equipment**: equipItem, unequipItem
 * - **Progression**: spendStatPoint, renameItem
 *
 * @module engine/reducer
 */

import {
  gameState,
  updateState,
  updateRoom,
  updateParty,
  updatePartyMember,
  addToHistory,
  initGame,
  spendGold,
  addGold,
} from '../state/gameState';
import { generateRoom, calculateEscapeDC, getDifficulty } from '@engine/generateRoom';
import { resolveEnemyTurn, checkGameOver } from '@engine/combatHelpers';
import { calculateAC, isHit, calculateDamage, applyDamage } from '@engine/combat';
import { SeededRNG, roll, hashWithSeed, hashString } from '@lib/index';
import { ITEMS, RECRUITS } from '../content/tables';
import type {
  RunState,
  Room,
  Actor,
  Enemy,
  Item,
  EquipmentSlot,
  Skills,
  RecruitOption,
} from '@engine/types';

// ─────────────────────────────────────────────────────────────
// 📊 Constants
// ─────────────────────────────────────────────────────────────

/** Maximum history entries to prevent memory bloat */
const MAX_HISTORY_LENGTH = 100;

/** XP thresholds for leveling up */
const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000];

// ─────────────────────────────────────────────────────────────
// 🔧 Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Cap history array to prevent memory bloat.
 * UI only shows last 20 entries, keeping 100 for reasonable scroll-back.
 */
function cappedHistory(history: string[]): string[] {
  return history.length > MAX_HISTORY_LENGTH
    ? history.slice(-MAX_HISTORY_LENGTH)
    : history;
}

/**
 * Update weapon mastery stats after an attack.
 */
function updateWeaponStats(
  item: Item,
  damage: number,
  isKill: boolean,
  isCritical: boolean,
  enemyName?: string
): Item {
  const stats = item.stats || {
    kills: 0,
    damageDealt: 0,
    highestHit: 0,
    criticalHits: 0,
    encountersUsed: 0,
  };
  const history = item.history || [];

  const newStats = {
    ...stats,
    damageDealt: stats.damageDealt + damage,
    highestHit: Math.max(stats.highestHit, damage),
    criticalHits: isCritical ? stats.criticalHits + 1 : stats.criticalHits,
    kills: isKill ? stats.kills + 1 : stats.kills,
  };

  const newHistory = [...history];
  if (isKill && enemyName) {
    newHistory.push(`Slew ${enemyName}`);
  }
  if (damage > stats.highestHit && damage >= 10) {
    newHistory.push(`New record hit: ${damage} damage!`);
  }
  if (isCritical) {
    newHistory.push(`Critical strike!`);
  }
  while (newHistory.length > 10) {
    newHistory.shift();
  }

  return {
    ...item,
    stats: newStats,
    history: newHistory,
  };
}

/**
 * Update weapon on an actor.
 */
function updateActorWeapon(actor: Actor, updatedWeapon: Item): Actor {
  return {
    ...actor,
    equipment: {
      ...actor.equipment,
      main_hand: updatedWeapon,
    },
  };
}

/**
 * Increment encounter count on all equipped weapons when entering combat.
 */
function incrementWeaponEncounters(members: Actor[]): Actor[] {
  return members.map((member) => {
    const weapon = member.equipment.main_hand;
    if (!weapon) return member;

    const stats = weapon.stats || {
      kills: 0,
      damageDealt: 0,
      highestHit: 0,
      criticalHits: 0,
      encountersUsed: 0,
    };
    const updatedWeapon: Item = {
      ...weapon,
      stats: {
        ...stats,
        encountersUsed: stats.encountersUsed + 1,
      },
    };

    return {
      ...member,
      equipment: {
        ...member.equipment,
        main_hand: updatedWeapon,
      },
    };
  });
}

/**
 * Create initial run state for a new game.
 */
function createInitialRunState(seed: string, party: Actor[]): RunState {
  return {
    seed,
    depth: 0,
    themeId: 'dungeon_start',
    shortRestsRemaining: 2,
    longRestsTaken: 0,
    party: {
      members: party,
      gold: 50,
    },
    inventory: {
      items: [],
      consumables: [],
    },
    currentRoom: null,
    roomResolved: false,
    inBossRoom: false,
    parentIntermission: null,
    combatTurn: null,
    combatRound: 0,
    actedThisRound: [],
    extraActions: 0,
    gameOver: false,
    victory: false,
    shrineBoon: null,
    pendingBossReward: false,
    mutations: [],
    history: ['A new adventure begins...'],
  };
}

// ─────────────────────────────────────────────────────────────
// 🎮 Game Flow Actions
// ─────────────────────────────────────────────────────────────

/**
 * Start a new game with initial party and seed.
 *
 * @param party - Array of party member actors
 * @param seed - Random seed for deterministic generation
 *
 * @example
 * startNewGame([createActor('hero-1', 'Sir Knight', 'fighter', 1)], 'my-seed');
 */
export function startNewGame(party: Actor[], seed: string): void {
  const initialState = createInitialRunState(seed, party);
  initGame(initialState);

  // Generate starting room (shrine at depth 0)
  const rng = new SeededRNG(hashString(seed));
  const room = generateRoom(initialState, rng);
  updateState({
    currentRoom: room,
    roomResolved: room.type !== 'shrine',
  });
}

/**
 * Advance to the next room.
 * Handles room generation, initiative rolls, and combat setup.
 */
export function advanceRoom(): void {
  const state = gameState.value;
  if (!state) return;

  const newDepth = state.depth + 1;
  const rng = new SeededRNG(hashWithSeed(state.seed, newDepth));

  // Remove dead party members before advancing
  const survivingMembers = state.party.members.filter((m) => m.isAlive);

  // Generate the new room
  const tempState = { ...state, depth: newDepth, party: { ...state.party, members: survivingMembers } };
  const room = generateRoom(tempState, rng);

  // Check if entering combat
  const isCombat =
    room.type === 'combat' ||
    room.type === 'elite' ||
    ((room.type === 'shrine' || room.type === 'hazard') && room.enemies && room.enemies.length > 0);

  // Increment weapon encounter counts if entering combat
  const updatedMembers = isCombat ? incrementWeaponEncounters(survivingMembers) : survivingMembers;

  // Build history
  const newHistory = [...state.history];
  const deadNames = state.party.members.filter((m) => !m.isAlive).map((m) => m.name);
  if (deadNames.length > 0) {
    newHistory.push(`☠️ ${deadNames.join(', ')} left behind forever...`);
  }
  newHistory.push(`Entered room ${newDepth}: ${room.type.toUpperCase()}`);

  // Roll initiative for combat
  let combatTurn: 'player' | 'enemy' | null = isCombat ? 'player' : null;
  if (isCombat && room.enemies.length > 0) {
    const partyAgility = Math.max(
      ...updatedMembers.filter((m) => m.isAlive).map((m) => m.skills?.agility || 0),
      0
    );
    const enemyPower = Math.max(...room.enemies.map((e) => e.power), 0);

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

  let nextState: Partial<RunState> = {
    depth: newDepth,
    currentRoom: room,
    roomResolved:
      room.type !== 'combat' &&
      room.type !== 'elite' &&
      room.type !== 'hazard' &&
      room.type !== 'shrine' &&
      room.type !== 'trader',
    combatTurn,
    combatRound: isCombat ? 1 : 0,
    actedThisRound: [],
    extraActions: 0,
    victory: false,
    party: { ...state.party, members: updatedMembers },
    history: cappedHistory(newHistory),
  };

  updateState(nextState);

  // If enemies won initiative, resolve their turn
  if (combatTurn === 'enemy') {
    const fullState = { ...state, ...nextState } as RunState;
    const afterEnemyTurn = resolveEnemyTurn(fullState, rng);
    updateState({
      party: afterEnemyTurn.party,
      history: afterEnemyTurn.history,
      combatTurn: afterEnemyTurn.combatTurn,
      combatRound: afterEnemyTurn.combatRound,
      actedThisRound: afterEnemyTurn.actedThisRound,
      gameOver: afterEnemyTurn.gameOver,
    });
  }
}

/**
 * Dismiss the victory/shrine popup.
 */
export function dismissPopup(): void {
  updateState({
    victory: false,
    shrineBoon: null,
  });
}

// ─────────────────────────────────────────────────────────────
// ⚔️ Combat Actions
// ─────────────────────────────────────────────────────────────

/**
 * Attack an enemy in combat.
 *
 * @param attackerId - ID of the party member attacking
 * @param targetId - ID of the enemy being attacked
 */
export function attackEnemy(attackerId: string, targetId: string): void {
  const state = gameState.value;
  if (!state || !state.currentRoom || state.combatTurn !== 'player') return;

  const room = state.currentRoom;
  const targetIndex = room.enemies.findIndex((e) => e.id === targetId);
  if (targetIndex === -1) return;

  const target = room.enemies[targetIndex];
  const attacker = state.party.members.find((m) => m.id === attackerId);
  if (!attacker || !attacker.isAlive) return;

  // Determine weapon type
  const weapon = attacker.equipment.main_hand;
  const weaponName = weapon?.name.toLowerCase() || '';
  let type: 'melee' | 'ranged' | 'magic' = 'melee';

  if (weaponName.includes('bow') || weaponName.includes('crossbow') || weaponName.includes('sling')) {
    type = 'ranged';
  } else if (weaponName.includes('staff') || weaponName.includes('wand') || weaponName.includes('tome')) {
    type = 'magic';
  }

  // Calculate bonuses from skills
  const skills = attacker.skills || { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0 };
  let hitSkill = 0;
  let dmgSkill = 0;

  switch (type) {
    case 'melee':
      hitSkill = skills.attack;
      dmgSkill = skills.strength;
      break;
    case 'ranged':
      hitSkill = skills.ranged;
      dmgSkill = skills.ranged;
      break;
    case 'magic':
      hitSkill = skills.magic;
      dmgSkill = skills.magic;
      break;
  }

  let totalAttackBonus = hitSkill;
  let totalDamageBonus = dmgSkill;

  // Sum bonuses from all equipped items
  Object.values(attacker.equipment).forEach((item) => {
    if (!item) return;
    totalAttackBonus += item.baseStats.attackBonus || 0;
    totalDamageBonus += item.baseStats.damageBonus || 0;
    if (item.enchantment?.effect) {
      totalAttackBonus += item.enchantment.effect.attackBonus || 0;
      totalDamageBonus += item.enchantment.effect.damageBonus || 0;
    }
  });

  const attackRoll = roll('1d20').total;
  const hit = attackRoll + totalAttackBonus >= target.ac;

  let newHistory = [...state.history];
  let newEnemies = [...room.enemies];
  let newParty = { ...state.party, members: [...state.party.members] };
  let newInventory = { ...state.inventory };
  let roomResolved = false;

  // Track action usage
  const alreadyActed = (state.actedThisRound || []).includes(attackerId);
  let newExtraActions = state.extraActions || 0;
  let newActedThisRound = [...(state.actedThisRound || [])];

  if (alreadyActed && newExtraActions > 0) {
    newExtraActions -= 1;
    newHistory.push(`(Using extra action! ${newExtraActions > 0 ? newExtraActions + ' remaining' : ''})`);
  } else {
    newActedThisRound.push(attackerId);
  }

  if (hit) {
    const damageRoll = roll('1d8');
    let damage = Math.max(1, damageRoll.total + totalDamageBonus);
    const isCritical = attackRoll === 20;

    // Check for Champion Strike buff
    const attackerStatuses = attacker.statuses || [];
    if (attackerStatuses.includes('champion_strike')) {
      const bonusDice = roll('2d6');
      damage += bonusDice.total;
      newHistory.push(`${attacker.name} consumes Champion Strike! +${bonusDice.total} damage.`);

      // Remove status
      const aIndex = newParty.members.findIndex((m) => m.id === attackerId);
      if (aIndex !== -1) {
        newParty.members[aIndex] = {
          ...newParty.members[aIndex],
          statuses: attackerStatuses.filter((s) => s !== 'champion_strike'),
        };
      }
    }

    newEnemies[targetIndex] = {
      ...target,
      hp: Math.max(0, target.hp - damage),
    };

    const isKill = newEnemies[targetIndex].hp <= 0;

    // Track weapon mastery
    if (weapon) {
      const attackerIndex = newParty.members.findIndex((m) => m.id === attackerId);
      if (attackerIndex !== -1) {
        const updatedWeapon = updateWeaponStats(weapon, damage, isKill, isCritical, isKill ? target.name : undefined);
        newParty.members[attackerIndex] = updateActorWeapon(newParty.members[attackerIndex], updatedWeapon);
      }
    }

    newHistory.push(
      `${attacker.name} attacks ${target.name} (${type}): [${attackRoll}+${totalAttackBonus}=${
        attackRoll + totalAttackBonus
      } vs AC ${target.ac}] ${isCritical ? 'CRITICAL ' : ''}HIT! ${damageRoll.total}+${totalDamageBonus} = ${damage} damage!`
    );

    // Handle kill
    if (isKill) {
      const goldDrop = target.power * 3 + Math.floor(Math.random() * (target.power * 2));
      newParty.gold += goldDrop;

      const xpGain = target.power * 15;
      const aliveMembers = newParty.members.filter((m) => m.isAlive);
      const xpPerMember = Math.floor(xpGain / aliveMembers.length);

      newHistory.push(`${target.name} defeated! +${goldDrop} gold, +${xpGain} XP`);

      // Distribute XP and check for level-ups
      newParty.members = newParty.members.map((m) => {
        if (!m.isAlive) return m;

        // Reveal from stealth if attacking
        let newStatuses = m.statuses || [];
        if (m.id === attackerId && newStatuses.includes('hidden')) {
          newStatuses = newStatuses.filter((s) => s !== 'hidden');
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
          newStatPoints++;
          newHistory.push(`${m.name} leveled up to ${newLevel}! +1 Stat Point!`);

          const hitDieRoll = roll('1d8').total;
          const hpGain = Math.max(1, hitDieRoll + Math.floor(newLevel / 2));
          newMaxHp += hpGain;
          newCurrentHp += hpGain;

          if (newLevel % 2 === 0) {
            newHitDice.max += 1;
            newHitDice.current += 1;
          }
          newHistory.push(`🎉 ${m.name} leveled up to ${newLevel}! +${hpGain} HP`);
        }

        return {
          ...m,
          xp: newXp,
          level: newLevel,
          hp: { current: newCurrentHp, max: newMaxHp },
          hitDice: newHitDice,
          statPoints: newStatPoints,
          statuses: newStatuses,
        };
      });

      newEnemies = newEnemies.filter((e) => e.hp > 0);
    }
  } else {
    newHistory.push(
      `${attacker.name} attacks ${target.name}: [${attackRoll}+${totalAttackBonus}=${
        attackRoll + totalAttackBonus
      } vs AC ${target.ac}] MISS!`
    );
  }

  // Check victory
  if (newEnemies.length === 0) {
    const goldReward = state.inBossRoom ? Math.floor(20 + Math.random() * 30) : Math.floor(5 + Math.random() * 11);
    newHistory.push(`Victory! All enemies defeated. +${goldReward} gold.`);
    roomResolved = room.type === 'combat' || room.type === 'elite';

    updateState({
      currentRoom: { ...room, enemies: newEnemies },
      roomResolved: true,
      combatTurn: null,
      actedThisRound: [],
      victory: true,
      history: cappedHistory(newHistory),
      party: {
        ...newParty,
        gold: newParty.gold + goldReward,
      },
      inventory: newInventory,
    });
    return;
  }

  // Determine if all alive party members have acted
  const aliveMemberIds = newParty.members.filter((m) => m.isAlive).map((m) => m.id);
  const allActed = aliveMemberIds.every((id) => newActedThisRound.includes(id));
  let combatTurn: 'player' | 'enemy' | null = allActed ? 'enemy' : 'player';

  if (combatTurn === 'enemy' && newExtraActions > 0) {
    combatTurn = 'player';
    newHistory.push(`(Extra action available!)`);
  }

  if (combatTurn === 'player' && !allActed) {
    const nextToAct = newParty.members.find((m) => m.isAlive && !newActedThisRound.includes(m.id));
    if (nextToAct) {
      newHistory.push(`→ ${nextToAct.name}'s turn`);
    }
  }

  let nextState: Partial<RunState> = {
    currentRoom: { ...room, enemies: newEnemies },
    roomResolved,
    combatTurn,
    actedThisRound: combatTurn === 'enemy' ? [] : newActedThisRound,
    history: cappedHistory(newHistory),
    party: newParty,
    extraActions: newExtraActions,
    inventory: newInventory,
  };

  updateState(nextState);

  // Enemy turn if combat continues
  if (combatTurn === 'enemy' && newEnemies.length > 0) {
    const fullState = { ...state, ...nextState } as RunState;
    const afterEnemyTurn = resolveEnemyTurn(fullState);
    updateState({
      party: afterEnemyTurn.party,
      history: afterEnemyTurn.history,
      combatTurn: afterEnemyTurn.combatTurn,
      combatRound: afterEnemyTurn.combatRound,
      actedThisRound: afterEnemyTurn.actedThisRound,
      gameOver: afterEnemyTurn.gameOver,
    });
  }
}

/**
 * Use an ability in combat.
 *
 * @param actorId - ID of the party member using the ability
 * @param abilityId - ID of the ability to use
 * @param targetId - Optional target ID for targeted abilities
 */
export function useAbility(actorId: string, abilityId: string, targetId?: string): void {
  const state = gameState.value;
  if (!state || !state.currentRoom || state.combatTurn !== 'player') return;

  // For now, just add a placeholder log entry
  // Full ability implementation requires porting the ability system
  addToHistory(`${actorId} uses ability ${abilityId}${targetId ? ` on ${targetId}` : ''}`);
}

/**
 * Attempt to flee from combat.
 */
export function attemptFlee(): void {
  const state = gameState.value;
  if (!state || !state.currentRoom || state.combatTurn !== 'player') return;

  const room = state.currentRoom;
  if (room.type !== 'combat' && room.type !== 'elite') return;

  const aliveMembers = state.party.members.filter((m) => m.isAlive);
  const partyAgility = Math.max(...aliveMembers.map((m) => m.skills.agility), 0);
  const hasRogue = aliveMembers.some((m) => m.role === 'rogue');
  const enemyCount = room.enemies.filter((e) => e.hp > 0).length;
  const isElite = room.type === 'elite';

  const { dc, breakdown } = calculateEscapeDC(state.depth, enemyCount, isElite, partyAgility, hasRogue);

  const escapeRoll = roll('1d20').total;
  const success = escapeRoll >= dc;

  let newHistory = [...state.history];
  let newParty = { ...state.party, members: [...state.party.members] };

  if (success) {
    newHistory.push(`🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] SUCCESS! (${breakdown})`);

    // Advance to next room
    const rng = new SeededRNG(hashWithSeed(state.seed + 'retreat', state.depth));
    const newDepth = state.depth + 1;
    const tempState = { ...state, depth: newDepth };
    const newRoom = generateRoom(tempState, rng);

    updateState({
      depth: newDepth,
      currentRoom: newRoom,
      roomResolved:
        newRoom.type !== 'combat' &&
        newRoom.type !== 'elite' &&
        newRoom.type !== 'hazard' &&
        newRoom.type !== 'shrine' &&
        newRoom.type !== 'trader',
      combatTurn: newRoom.type === 'combat' || newRoom.type === 'elite' ? 'player' : null,
      combatRound: newRoom.type === 'combat' || newRoom.type === 'elite' ? 1 : 0,
      extraActions: 0,
      history: cappedHistory([...newHistory, `Entered room ${newDepth}: ${newRoom.type.toUpperCase()}`]),
    });
  } else {
    newHistory.push(`🏃 Escape attempt: [${escapeRoll} vs DC ${dc}] FAILED! Enemies attack! (${breakdown})`);

    // Enemies get free attacks
    for (const enemy of room.enemies.filter((e) => e.hp > 0)) {
      const aliveMembersForAttack = newParty.members.filter((m) => m.isAlive);
      if (aliveMembersForAttack.length === 0) break;

      const targetMember = aliveMembersForAttack[Math.floor(Math.random() * aliveMembersForAttack.length)];
      const targetIndex = newParty.members.findIndex((m) => m.id === targetMember.id);

      const enemyAttackRoll = roll('1d20').total;
      let memberAC = 10 + (targetMember.skills?.defense || 0);
      Object.values(targetMember.equipment).forEach((item) => {
        if (!item) return;
        memberAC += item.baseStats.acBonus || 0;
        if (item.enchantment?.effect) {
          memberAC += item.enchantment.effect.acBonus || 0;
        }
      });

      const enemyHit = enemyAttackRoll + enemy.power >= memberAC;

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
    const allDead = newParty.members.every((m) => !m.isAlive);
    if (allDead) {
      updateState({
        party: newParty,
        gameOver: true,
        history: cappedHistory([...newHistory, 'The entire party has fallen! Game Over.']),
      });
      return;
    }

    updateState({
      party: newParty,
      history: cappedHistory(newHistory),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// ⛪ Room Interaction Actions
// ─────────────────────────────────────────────────────────────

/**
 * Pray at a shrine for a blessing.
 */
export function prayAtShrine(): void {
  const state = gameState.value;
  if (!state) return;

  const isBossShrine = !!state.pendingBossReward;
  if (!state.currentRoom || (state.currentRoom.type !== 'shrine' && !isBossShrine)) return;

  const hasCleric = state.party.members.some((m) => m.isAlive && m.role === 'cleric');
  const clericBonus = hasCleric ? 1.5 : 1;

  const hero = state.party.members[0];
  let newParty = { ...state.party, members: [...state.party.members] };
  let newShortRests = state.shortRestsRemaining;

  // Simple boon: heal or gold
  const boonRoll = Math.random();
  let boonMessage: string;

  if (boonRoll < 0.5 && hero.hp.current < hero.hp.max) {
    // Heal boon
    const baseHeal = Math.floor(hero.hp.max * 0.5);
    const healAmount = Math.floor(baseHeal * clericBonus);
    const newHp = Math.min(hero.hp.max, hero.hp.current + healAmount);
    newParty.members = newParty.members.map((m, i) =>
      i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m
    );
    const bonusMsg = hasCleric ? ' (Cleric +50%)' : '';
    boonMessage = `The shrine glows warmly. Healed for ${healAmount} HP!${bonusMsg}`;
  } else {
    // Gold boon
    const goldBonus = 15 + Math.floor(Math.random() * 16);
    newParty.gold += goldBonus;
    boonMessage = `Golden light showers upon you. +${goldBonus} gold!`;
  }

  updateState({
    party: newParty,
    shortRestsRemaining: newShortRests,
    roomResolved: true,
    pendingBossReward: false,
    shrineBoon: boonMessage,
    history: cappedHistory([...state.history, boonMessage]),
  });
}

/**
 * Attempt to disarm a trap in a hazard room.
 */
export function disarmTrap(): void {
  const state = gameState.value;
  if (!state || !state.currentRoom || state.currentRoom.type !== 'hazard') return;

  const hasRogue = state.party.members.some((m) => m.isAlive && m.role === 'rogue');
  const rogueBonus = hasRogue ? 5 : 0;

  const baseRoll = roll('1d20').total;
  const disarmRoll = baseRoll + 2 + rogueBonus;
  const success = disarmRoll >= 12;

  if (success) {
    const goldReward = Math.floor(5 + Math.random() * 11);
    const bonusMsg = hasRogue ? ' (Rogue +5 bonus!)' : '';
    updateState({
      roomResolved: true,
      victory: true,
      party: {
        ...state.party,
        gold: state.party.gold + goldReward,
      },
      history: cappedHistory([
        ...state.history,
        `Trap disarmed! (Rolled ${baseRoll}+${2 + rogueBonus}=${disarmRoll} vs DC 12)${bonusMsg}. +${goldReward} gold.`,
      ]),
    });
  } else {
    const damage = roll('1d6').total;
    const hero = state.party.members[0];
    const newHp = Math.max(0, hero.hp.current - damage);

    const newParty = {
      ...state.party,
      members: state.party.members.map((m, i) => (i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m)),
    };

    if (newHp <= 0) {
      updateState({
        party: newParty,
        roomResolved: true,
        gameOver: true,
        history: cappedHistory([
          ...state.history,
          `Failed to disarm! (Rolled ${disarmRoll}). Trap deals ${damage} damage!`,
          'Hero has fallen! Game Over.',
        ]),
      });
    } else {
      updateState({
        party: newParty,
        roomResolved: true,
        history: cappedHistory([
          ...state.history,
          `Failed to disarm! (Rolled ${disarmRoll}). Trap deals ${damage} damage!`,
        ]),
      });
    }
  }
}

/**
 * Trigger a trap willingly (take damage to proceed).
 */
export function triggerTrap(): void {
  const state = gameState.value;
  if (!state || !state.currentRoom || state.currentRoom.type !== 'hazard') return;

  const damage = roll('2d6').total;
  const hero = state.party.members[0];
  const newHp = Math.max(0, hero.hp.current - damage);

  const newParty = {
    ...state.party,
    members: state.party.members.map((m, i) => (i === 0 ? { ...m, hp: { ...m.hp, current: newHp } } : m)),
  };

  if (newHp <= 0) {
    updateState({
      party: newParty,
      roomResolved: true,
      gameOver: true,
      history: cappedHistory([
        ...state.history,
        `Triggered the trap! Takes ${damage} damage!`,
        'Hero has fallen! Game Over.',
      ]),
    });
  } else {
    updateState({
      party: newParty,
      roomResolved: true,
      history: cappedHistory([...state.history, `Triggered the trap! Takes ${damage} damage!`]),
    });
  }
}

/**
 * Enter the optional boss room from an intermission.
 */
export function enterBossRoom(): void {
  const state = gameState.value;
  if (!state) return;

  const room = state.currentRoom;
  if (!room || room.type !== 'intermission' || !room.bossRoom) return;

  updateState({
    parentIntermission: room,
    currentRoom: room.bossRoom,
    inBossRoom: true,
    roomResolved: false,
    combatTurn: 'player',
    combatRound: 1,
    actedThisRound: [],
    history: cappedHistory([...state.history, '⚔️ You enter the Boss Chamber! Prepare for battle!']),
  });
}

// ─────────────────────────────────────────────────────────────
// 💤 Rest Actions
// ─────────────────────────────────────────────────────────────

/**
 * Take a short rest to heal using hit dice.
 *
 * @param actorIdsToHeal - IDs of party members to heal
 */
export function takeShortRest(actorIdsToHeal: string[]): void {
  const state = gameState.value;
  if (!state || state.shortRestsRemaining <= 0) return;

  let newHistory = [...state.history];
  let newMembers = state.party.members.map((m) => {
    if (!actorIdsToHeal.includes(m.id) || !m.isAlive || m.hitDice.current <= 0) return m;

    const healRoll = roll(`1d${m.hitDice.die}`).total;
    const newHp = Math.min(m.hp.max, m.hp.current + healRoll);

    newHistory.push(`${m.name} spends a hit die and heals for ${healRoll} HP.`);

    return {
      ...m,
      hp: { ...m.hp, current: newHp },
      hitDice: { ...m.hitDice, current: m.hitDice.current - 1 },
    };
  });

  updateState({
    party: { ...state.party, members: newMembers },
    shortRestsRemaining: state.shortRestsRemaining - 1,
    history: cappedHistory(newHistory),
  });
}

/**
 * Take a long rest to fully restore the party.
 */
export function takeLongRest(): void {
  const state = gameState.value;
  if (!state) return;

  const restoredMembers = state.party.members.map((m) => ({
    ...m,
    hp: { ...m.hp, current: m.hp.max },
    stress: { ...m.stress, current: 0 },
    hitDice: { ...m.hitDice, current: m.hitDice.max },
    isAlive: m.hp.current > 0 ? true : m.isAlive,
    abilities: m.abilities?.map((a) => ({ ...a, currentCooldown: 0 })) || [],
  }));

  updateState({
    party: { ...state.party, members: restoredMembers },
    shortRestsRemaining: 2,
    longRestsTaken: state.longRestsTaken + 1,
    history: cappedHistory([...state.history, 'Party takes a long rest. All resources restored!']),
  });
}

// ─────────────────────────────────────────────────────────────
// 💰 Economy Actions
// ─────────────────────────────────────────────────────────────

/**
 * Buy an item from a shop.
 *
 * @param itemId - ID of the item to buy
 * @param cost - Cost of the item
 */
export function buyItem(itemId: string, cost: number): void {
  const state = gameState.value;
  if (!state) return;

  if (state.party.gold < cost) {
    addToHistory('Not enough gold to buy item.');
    return;
  }

  const room = state.currentRoom;
  const item = room?.shopItems?.find((i) => i.id === itemId) || ITEMS.find((i) => i.id === itemId);
  if (!item) return;

  // Remove from shop
  const newRoom =
    room && room.shopItems
      ? {
          ...room,
          shopItems: room.shopItems.filter((i) => i.id !== itemId),
        }
      : room;

  updateState({
    currentRoom: newRoom,
    party: {
      ...state.party,
      gold: state.party.gold - cost,
    },
    inventory: {
      ...state.inventory,
      items: [...state.inventory.items, item],
    },
    history: cappedHistory([...state.history, `Bought ${item.name}`]),
  });
}

/**
 * Sell an item from inventory.
 *
 * @param itemId - ID of the item to sell
 */
export function sellItem(itemId: string): void {
  const state = gameState.value;
  if (!state) return;

  const itemIndex = state.inventory.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    addToHistory('Item not found in inventory.');
    return;
  }

  const item = state.inventory.items[itemIndex];
  const baseSellPrice = Math.floor((item.cost || 10) * 0.25);
  const enchantBonus = item.enchantment ? item.enchantment.tier * 10 : 0;
  const sellPrice = baseSellPrice + enchantBonus;

  const newItems = [...state.inventory.items];
  newItems.splice(itemIndex, 1);

  updateState({
    party: {
      ...state.party,
      gold: state.party.gold + sellPrice,
    },
    inventory: {
      ...state.inventory,
      items: newItems,
    },
    history: cappedHistory([...state.history, `Sold ${item.name} for ${sellPrice} gold`]),
  });
}

/**
 * Recruit a new party member.
 *
 * @param recruitId - ID of the recruit to hire
 */
export function recruitMember(recruitId: string): void {
  const state = gameState.value;
  if (!state) return;

  const room = state.currentRoom;
  const recruit =
    room?.availableRecruits?.find((r) => r.id === recruitId) || RECRUITS.find((r) => r.id === recruitId);
  if (!recruit) return;

  if (state.party.gold < recruit.cost) {
    addToHistory(`Not enough gold to hire ${recruit.name}. Need ${recruit.cost} gold.`);
    return;
  }

  if (state.party.members.length >= 4) {
    addToHistory('Party is full! Max 4 members.');
    return;
  }

  // Create new party member (simplified - would need createActor function)
  const newMember: Actor = {
    id: `party-${state.party.members.length + 1}`,
    name: recruit.name,
    role: recruit.role,
    level: recruit.level || 1,
    hp: { current: 20, max: 20 },
    stress: { current: 0, max: 20 },
    hitDice: { current: 2, max: 2, die: 8 },
    xp: 0,
    statPoints: 0,
    skills: { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 },
    isAlive: true,
    spellSlots: {},
    equipment: {},
    abilities: [],
    statuses: [],
  };

  // Remove from available recruits
  const newRoom =
    room && room.availableRecruits
      ? {
          ...room,
          availableRecruits: room.availableRecruits.filter((r) => r.id !== recruitId),
        }
      : room;

  updateState({
    currentRoom: newRoom,
    party: {
      ...state.party,
      gold: state.party.gold - recruit.cost,
      members: [...state.party.members, newMember],
    },
    history: cappedHistory([...state.history, `${recruit.name} joins the party!`]),
  });
}

// ─────────────────────────────────────────────────────────────
// 🎒 Equipment Actions
// ─────────────────────────────────────────────────────────────

/**
 * Equip an item to a party member.
 *
 * @param actorId - ID of the party member
 * @param itemId - ID of the item to equip
 * @param slot - Optional slot to equip to (auto-detected if not provided)
 */
export function equipItem(actorId: string, itemId: string, slot?: EquipmentSlot): void {
  const state = gameState.value;
  if (!state) return;

  const actorIndex = state.party.members.findIndex((m) => m.id === actorId);
  if (actorIndex === -1) return;

  const actor = state.party.members[actorIndex];
  const itemIndex = state.inventory.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return;

  const item = state.inventory.items[itemIndex];

  // Determine target slot
  let targetSlot: EquipmentSlot | undefined = slot;
  if (!targetSlot) {
    switch (item.type) {
      case 'weapon':
        targetSlot = 'main_hand';
        break;
      case 'shield':
        targetSlot = 'off_hand';
        break;
      case 'head':
        targetSlot = 'head';
        break;
      case 'chest':
        targetSlot = 'chest';
        break;
      case 'legs':
        targetSlot = 'legs';
        break;
      case 'feet':
        targetSlot = 'feet';
        break;
      case 'neck':
        targetSlot = 'neck';
        break;
      case 'ring':
        if (!actor.equipment['ring1']) targetSlot = 'ring1';
        else if (!actor.equipment['ring2']) targetSlot = 'ring2';
        else targetSlot = 'ring1';
        break;
    }
  }

  if (!targetSlot) return;

  // Initialize new inventory
  const newInventoryItems = [...state.inventory.items];
  newInventoryItems.splice(itemIndex, 1);

  // Create new equipment object
  const newEquipment = { ...actor.equipment };
  const oldItem = newEquipment[targetSlot];
  newEquipment[targetSlot] = item;

  // Return old item to inventory
  if (oldItem) {
    newInventoryItems.push(oldItem);
  }

  // Calculate HP difference
  const oldMaxHpBonus = (oldItem?.baseStats?.maxHpBonus || 0) + (oldItem?.enchantment?.effect?.maxHpBonus || 0);
  const newMaxHpBonus = (item.baseStats.maxHpBonus || 0) + (item.enchantment?.effect?.maxHpBonus || 0);
  const hpDiff = newMaxHpBonus - oldMaxHpBonus;

  const newParty = { ...state.party, members: [...state.party.members] };
  newParty.members[actorIndex] = {
    ...actor,
    equipment: newEquipment,
    hp: {
      ...actor.hp,
      max: actor.hp.max + hpDiff,
      current: actor.hp.current + hpDiff,
    },
  };

  updateState({
    party: newParty,
    inventory: { ...state.inventory, items: newInventoryItems },
    history: cappedHistory([...state.history, `Equipped ${item.name} to ${targetSlot}`]),
  });
}

/**
 * Unequip an item from a party member.
 *
 * @param actorId - ID of the party member
 * @param slot - Equipment slot to unequip from
 */
export function unequipItem(actorId: string, slot: EquipmentSlot): void {
  const state = gameState.value;
  if (!state) return;

  const actorIndex = state.party.members.findIndex((m) => m.id === actorId);
  if (actorIndex === -1) return;

  const actor = state.party.members[actorIndex];
  const item = actor.equipment[slot];
  if (!item) return;

  // Remove from equipment
  const newEquipment = { ...actor.equipment };
  newEquipment[slot] = undefined;

  // Add to inventory
  const newInventoryItems = [...state.inventory.items, item];

  // Calculate HP difference
  const removedMaxHpBonus = (item.baseStats.maxHpBonus || 0) + (item.enchantment?.effect?.maxHpBonus || 0);

  const newParty = { ...state.party, members: [...state.party.members] };
  newParty.members[actorIndex] = {
    ...actor,
    equipment: newEquipment,
    hp: {
      ...actor.hp,
      max: actor.hp.max - removedMaxHpBonus,
      current: Math.max(1, actor.hp.current - removedMaxHpBonus),
    },
  };

  updateState({
    party: newParty,
    inventory: { ...state.inventory, items: newInventoryItems },
    history: cappedHistory([...state.history, `Unequipped ${item.name}.`]),
  });
}

// ─────────────────────────────────────────────────────────────
// 📈 Progression Actions
// ─────────────────────────────────────────────────────────────

/**
 * Spend a stat point to increase a skill.
 *
 * @param actorId - ID of the party member
 * @param stat - Skill to increase
 */
export function spendStatPoint(actorId: string, stat: keyof Skills): void {
  const state = gameState.value;
  if (!state) return;

  const actorIndex = state.party.members.findIndex((m) => m.id === actorId);
  if (actorIndex === -1) return;

  const actor = state.party.members[actorIndex];
  if (actor.statPoints <= 0) return;

  const newStats = { ...actor.skills };
  newStats[stat]++;

  const newParty = { ...state.party, members: [...state.party.members] };
  newParty.members[actorIndex] = {
    ...actor,
    statPoints: actor.statPoints - 1,
    skills: newStats,
  };

  updateState({
    party: newParty,
  });
}

/**
 * Rename an item.
 *
 * @param itemId - ID of the item to rename
 * @param newName - New custom name for the item
 */
export function renameItem(itemId: string, newName: string): void {
  const state = gameState.value;
  if (!state) return;

  let found = false;
  let newInventory = { ...state.inventory };

  // Check inventory
  newInventory.items = newInventory.items.map((item) => {
    if (item.id === itemId) {
      found = true;
      return { ...item, customName: newName };
    }
    return item;
  });

  let newParty = { ...state.party, members: [...state.party.members] };

  if (!found) {
    // Check equipment
    newParty.members = newParty.members.map((member) => {
      const newEquip = { ...member.equipment };
      let equipChanged = false;

      (Object.keys(newEquip) as EquipmentSlot[]).forEach((slotKey) => {
        const item = newEquip[slotKey];
        if (item && item.id === itemId) {
          newEquip[slotKey] = { ...item, customName: newName };
          equipChanged = true;
          found = true;
        }
      });

      return equipChanged ? { ...member, equipment: newEquip } : member;
    });
  }

  if (!found) return;

  updateState({
    inventory: newInventory,
    party: newParty,
    history: cappedHistory([...state.history, `Item renamed to "${newName}".`]),
  });
}
