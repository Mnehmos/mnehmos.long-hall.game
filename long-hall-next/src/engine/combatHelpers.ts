/**
 * Combat Helpers - State Management Functions
 *
 * Implements helper functions for managing combat state including:
 * - 🎯 Enemy turn resolution
 * - 👤 Target selection
 * - ⏰ Cooldown management
 * - 💀 Game over detection
 * - 🔄 Combat round advancement
 *
 * @module engine/combatHelpers
 */
import { SeededRNG } from '@lib/rng';
import { calculateAC, isHit, calculateDamage, applyDamage } from '@engine/combat';
import type { Actor, Enemy, RunState } from '@engine/types';

// ============================================================================
// Constants
// ============================================================================

/** 🎲 Number of sides on a standard attack die */
const D20_SIDES = 20;

// ============================================================================
// Target Selection
// ============================================================================

/**
 * Select a valid target from party members.
 *
 * Valid targets are:
 * - Alive (isAlive === true)
 * - Not hidden (no 'hidden' status)
 *
 * Selection is random among valid targets using provided RNG.
 *
 * @param members - Array of party members to select from
 * @param rng - Seeded RNG for deterministic selection
 * @returns A valid target, or null if no valid targets exist
 *
 * @example
 * // Select from a party with two alive members
 * selectTarget([aliveHero1, aliveHero2, deadHero], rng)
 * // → aliveHero1 or aliveHero2 (randomly)
 *
 * @example
 * // No valid targets (all dead)
 * selectTarget([deadHero1, deadHero2], rng)
 * // → null
 *
 * @example
 * // Hidden members are not valid targets
 * selectTarget([{ ...hero, statuses: ['hidden'] }], rng)
 * // → null
 */
export function selectTarget(members: Actor[], rng: SeededRNG): Actor | null {
  // Filter to alive, non-hidden members
  const validTargets = members.filter(
    (m) => m.isAlive && !m.statuses?.includes('hidden')
  );

  if (validTargets.length === 0) {
    return null;
  }

  // Pick a random target
  return rng.pick(validTargets);
}

// ============================================================================
// Game State Checks
// ============================================================================

/**
 * Check if the game is over (all party members dead or party is empty).
 *
 * Game over conditions:
 * - Empty party (no members)
 * - All members have isAlive === false
 *
 * @param members - Array of party members to check
 * @returns true if game is over, false otherwise
 *
 * @example
 * // Empty party
 * checkGameOver([])
 * // → true
 *
 * @example
 * // All dead
 * checkGameOver([{ isAlive: false }, { isAlive: false }])
 * // → true
 *
 * @example
 * // At least one alive
 * checkGameOver([{ isAlive: true }, { isAlive: false }])
 * // → false
 */
export function checkGameOver(members: Actor[]): boolean {
  if (members.length === 0) {
    return true;
  }

  return members.every((m) => !m.isAlive);
}

// ============================================================================
// Cooldown Management
// ============================================================================

/**
 * Decrement all ability cooldowns for party members by 1.
 *
 * This is typically called at the end of a combat round.
 * Cooldowns are clamped to minimum of 0 (can't go negative).
 *
 * @param members - Array of party members with abilities
 * @returns New array with updated cooldowns (immutable operation)
 *
 * @example
 * // Decrement cooldowns
 * decrementCooldowns([{
 *   abilities: [{ currentCooldown: 2 }, { currentCooldown: 0 }]
 * }])
 * // → [{ abilities: [{ currentCooldown: 1 }, { currentCooldown: 0 }] }]
 *
 * @example
 * // Cooldowns don't go below 0
 * decrementCooldowns([{
 *   abilities: [{ currentCooldown: 0 }]
 * }])
 * // → [{ abilities: [{ currentCooldown: 0 }] }]
 */
export function decrementCooldowns(members: Actor[]): Actor[] {
  return members.map((member) => ({
    ...member,
    abilities: member.abilities.map((ability) => ({
      ...ability,
      currentCooldown: Math.max(0, ability.currentCooldown - 1),
    })),
  }));
}

// ============================================================================
// Round Management
// ============================================================================

/**
 * Advance combat to the next round.
 *
 * Performs the following state updates:
 * - Increments round counter
 * - Clears actedThisRound array
 * - Switches to player turn
 * - Adds round separator to history
 *
 * @param state - Current run state
 * @returns Updated run state with new round
 *
 * @example
 * // Advance from round 1 to round 2
 * advanceCombatRound({ combatRound: 1, actedThisRound: ['hero1'], ... })
 * // → { combatRound: 2, actedThisRound: [], combatTurn: 'player', ... }
 */
export function advanceCombatRound(state: RunState): RunState {
  const newRound = state.combatRound + 1;

  return {
    ...state,
    combatRound: newRound,
    actedThisRound: [],
    combatTurn: 'player',
    history: [...state.history, `--- ROUND ${newRound} ---`],
  };
}

// ============================================================================
// Damage Application
// ============================================================================

/**
 * Apply enemy damage to a target actor.
 *
 * This helper wraps the core damage functions for enemy attacks:
 * 1. Rolls damage using enemy's damage dice
 * 2. Applies damage to target
 * 3. Returns updated actor with new HP
 *
 * @param target - The actor receiving damage
 * @param enemy - The enemy dealing damage
 * @param rng - Seeded RNG for damage roll
 * @returns Object containing updated actor, damage dealt, and death status
 *
 * @example
 * // Enemy deals damage to hero
 * applyEnemyDamage(hero, goblin, rng)
 * // → { actor: updatedHero, damageDealt: 5, isDead: false }
 *
 * @example
 * // Fatal damage
 * applyEnemyDamage(lowHpHero, dragon, rng)
 * // → { actor: updatedHero, damageDealt: 100, isDead: true }
 */
export function applyEnemyDamage(
  target: Actor,
  enemy: Enemy,
  rng: SeededRNG
): { actor: Actor; damageDealt: number; isDead: boolean } {
  // Roll damage using enemy's damage expression
  const damageResult = calculateDamage({
    diceExpression: enemy.damage,
    damageBonus: 0,
    rng,
  });

  // Apply damage to target
  const applyResult = applyDamage({
    target,
    damage: damageResult.total,
  });

  // Create updated actor with new HP
  const updatedActor: Actor = {
    ...target,
    hp: {
      ...target.hp,
      current: applyResult.newHp,
    },
    isAlive: !applyResult.isDead,
  };

  return {
    actor: updatedActor,
    damageDealt: applyResult.damageDealt,
    isDead: applyResult.isDead,
  };
}

// ============================================================================
// Enemy Turn Resolution
// ============================================================================

/**
 * Resolve all enemy attacks for a turn.
 *
 * This is the main enemy AI function that:
 * 1. Iterates through all alive enemies
 * 2. Selects a valid target for each enemy
 * 3. Rolls attack (d20 + power vs target AC)
 * 4. On hit: rolls and applies damage, logs result
 * 5. On miss: logs the miss
 * 6. Decrements all party cooldowns
 * 7. Checks for game over
 * 8. Advances to next round
 *
 * @param state - Current run state
 * @param rng - Optional seeded RNG (defaults to Date.now() seed)
 * @returns Updated run state after enemy turn
 *
 * @example
 * // Resolve enemy turn in combat
 * resolveEnemyTurn(gameState, combatRng)
 * // → Updated state with:
 * //   - Party members may have taken damage
 * //   - History updated with attack logs
 * //   - Cooldowns decremented
 * //   - Round advanced
 *
 * @example
 * // No enemies in room
 * resolveEnemyTurn({ currentRoom: { enemies: [] }, ... }, rng)
 * // → State unchanged except combatTurn set to 'player'
 */
export function resolveEnemyTurn(state: RunState, rng?: SeededRNG): RunState {
  // Use provided RNG or create one from current timestamp
  const combatRng = rng ?? new SeededRNG(Date.now());

  // Ensure we have a room with enemies
  if (!state.currentRoom || state.currentRoom.enemies.length === 0) {
    return {
      ...state,
      combatTurn: 'player',
    };
  }

  // Copy party members for mutation
  let members = [...state.party.members];
  const history = [...state.history];

  // Process each alive enemy
  const aliveEnemies = state.currentRoom.enemies.filter((e) => e.hp > 0);

  for (const enemy of aliveEnemies) {
    // Select a valid target
    const target = selectTarget(members, combatRng);

    if (!target) {
      // No valid targets - skip this enemy
      continue;
    }

    // Calculate target's AC
    const targetAC = calculateAC(target);

    // Roll attack (1d20 + power)
    const attackRoll = combatRng.int(1, D20_SIDES);
    const attackTotal = attackRoll + enemy.power;

    // Determine hit using standard rules
    const hitResult = isHit({
      roll: attackRoll,
      attackBonus: enemy.power,
      targetAC,
    });

    if (hitResult.hits) {
      // Roll and apply damage
      const { actor: updatedTarget, damageDealt, isDead } = applyEnemyDamage(
        target,
        enemy,
        combatRng
      );

      // Update the member in the array
      members = members.map((m) => (m.id === target.id ? updatedTarget : m));

      // Log the hit with full combat details
      history.push(
        `${enemy.name} attacks ${target.name} (${attackRoll}+${enemy.power}=${attackTotal} vs AC ${targetAC}) - HIT for ${damageDealt} damage!`
      );

      // Log death if applicable
      if (isDead) {
        history.push(`${target.name} has fallen!`);
      }
    } else {
      // Log the miss with full combat details
      history.push(
        `${enemy.name} attacks ${target.name} (${attackRoll}+${enemy.power}=${attackTotal} vs AC ${targetAC}) - MISS`
      );
    }
  }

  // Decrement all ability cooldowns
  members = decrementCooldowns(members);

  // Check for game over condition
  const isGameOver = checkGameOver(members);

  if (isGameOver) {
    history.push('All party members have fallen. Game Over!');
  }

  // Advance to next round
  const newRound = state.combatRound + 1;
  history.push(`--- ROUND ${newRound} ---`);

  return {
    ...state,
    party: {
      ...state.party,
      members,
    },
    history,
    combatTurn: 'player',
    combatRound: newRound,
    actedThisRound: [],
    gameOver: isGameOver,
  };
}
