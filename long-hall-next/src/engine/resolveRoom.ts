/**
 * 🚪 Room Resolution - Handle room completion and transitions
 *
 * Implements room completion logic for all room types:
 * - ⚔️ Combat rooms: XP/gold/loot distribution after defeating enemies
 * - 🔥 Hazard rooms: Trap resolution and loot
 * - ⛩️ Shrine rooms: Blessing selection and boon effects
 * - 🏪 Intermission rooms: Trading post completion
 *
 * @module engine/resolveRoom
 */

import type { Room, RunState, RoomType, Item, Enemy } from './types';
import { SeededRNG } from '@lib/rng';
import { generateCombatLoot, generateHazardLoot, generateGold } from './loot';

// ─────────────────────────────────────────────────────────────
// 📊 Resolution Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of resolving a room - contains all rewards and state changes
 */
export interface RoomResolutionResult {
  /** Whether the room was successfully resolved */
  resolved: boolean;
  /** Gold earned from the room */
  goldEarned: number;
  /** Experience points earned */
  xpEarned: number;
  /** Items dropped from the room */
  lootDropped: Item[];
  /** Human-readable message describing the resolution */
  message: string;
  /** Whether player can advance to the next room */
  canAdvance: boolean;
  /** Optional stress reduction (from shrines/rest) */
  stressReduced?: number;
  /** Optional HP restored (from shrines/fountains) */
  hpRestored?: number;
  /** Optional boon ID if shrine was used */
  boonApplied?: string;
}

/**
 * Room transition messages by type pairing
 */
interface TransitionMessages {
  [key: string]: string;
}

// ─────────────────────────────────────────────────────────────
// 🔧 Constants
// ─────────────────────────────────────────────────────────────

/** Base XP multiplier for room type */
const ROOM_XP_MULTIPLIER: Record<RoomType, number> = {
  combat: 1.0,
  elite: 1.5,
  boss: 3.0,
  hazard: 0.5,
  trader: 0,
  ally: 0.25,
  shrine: 0.1,
  intermission: 0,
};

/** Base XP per enemy power point */
const BASE_XP_PER_POWER = 10;

/** Bonus XP per depth level */
const DEPTH_XP_BONUS = 2;

/** Shrine blessing message templates */
const SHRINE_MESSAGES: Record<string, string> = {
  healing: 'The shrine glows with warm light. Your wounds mend.',
  blessing: 'Divine energy flows through you. You feel stronger.',
  protection: 'A protective ward surrounds the party.',
  fortune: 'The gods smile upon you. Lucky finds await.',
  default: 'You feel a mystical presence acknowledge your prayer.',
};

// ─────────────────────────────────────────────────────────────
// 🎯 Room Resolution Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a room can be resolved (all enemies dead, traps dealt with, etc.)
 *
 * @param room - The room to check
 * @returns True if the room can be resolved
 *
 * @example
 * if (canResolveRoom(currentRoom)) {
 *   const result = resolveRoom(currentRoom, state, rng);
 * }
 */
export function canResolveRoom(room: Room): boolean {
  // Combat rooms require all enemies defeated
  if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
    return areAllEnemiesDead(room.enemies);
  }

  // Hazard rooms are always resolvable (trap either triggered or disarmed)
  if (room.type === 'hazard') {
    return true;
  }

  // Shrine, trader, ally, and intermission rooms are always resolvable
  if (
    room.type === 'shrine' ||
    room.type === 'trader' ||
    room.type === 'ally' ||
    room.type === 'intermission'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if all enemies in an array are dead (HP <= 0)
 *
 * @param enemies - Array of enemies to check
 * @returns True if all enemies have 0 or less HP
 */
export function areAllEnemiesDead(enemies: Enemy[]): boolean {
  if (!enemies || enemies.length === 0) {
    return true;
  }
  return enemies.every((enemy) => enemy.hp <= 0);
}

/**
 * Count living enemies in the room
 *
 * @param enemies - Array of enemies to check
 * @returns Number of enemies with HP > 0
 */
export function countLivingEnemies(enemies: Enemy[]): number {
  if (!enemies) return 0;
  return enemies.filter((enemy) => enemy.hp > 0).length;
}

// ─────────────────────────────────────────────────────────────
// ⚔️ Combat Room Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a combat room - distribute loot, XP, and gold
 *
 * Called after all enemies are defeated. Calculates rewards based on:
 * - Total enemy power (affects gold and XP)
 * - Room depth (affects loot quality)
 * - Room type (elite/boss give better rewards)
 *
 * @param room - The combat room to resolve
 * @param state - Current run state (for depth info)
 * @param rng - Seeded RNG for deterministic loot
 * @returns Resolution result with rewards
 *
 * @example
 * const result = resolveCombatRoom(room, state, rng);
 * console.log(`Earned ${result.goldEarned} gold and ${result.xpEarned} XP`);
 */
export function resolveCombatRoom(
  room: Room,
  state: RunState,
  rng: SeededRNG
): RoomResolutionResult {
  // Verify all enemies are dead
  if (!areAllEnemiesDead(room.enemies)) {
    return {
      resolved: false,
      goldEarned: 0,
      xpEarned: 0,
      lootDropped: [],
      message: 'Combat is not yet complete!',
      canAdvance: false,
    };
  }

  // Calculate XP from defeated enemies
  const xpEarned = calculateRoomXp(room, state.depth);

  // Calculate gold from enemies
  const avgEnemyPower =
    room.enemies.length > 0
      ? room.enemies.reduce((sum, e) => sum + e.power, 0) / room.enemies.length
      : 1;
  const goldEarned = generateGold(rng, state.depth, avgEnemyPower);

  // Generate loot drops
  const lootDropped = generateCombatLoot(rng, room, state.depth);

  // Build victory message
  const enemyCount = room.enemies.length;
  const roomTypeLabel = room.type === 'elite' ? 'elite' : room.type === 'boss' ? 'boss' : '';
  const message =
    lootDropped.length > 0
      ? `Victory! Defeated ${enemyCount} ${roomTypeLabel} enemies. Found ${lootDropped.length} items and ${goldEarned} gold.`
      : `Victory! Defeated ${enemyCount} ${roomTypeLabel} enemies. Earned ${goldEarned} gold.`;

  return {
    resolved: true,
    goldEarned,
    xpEarned,
    lootDropped,
    message: message.replace('  ', ' ').trim(),
    canAdvance: true,
  };
}

// ─────────────────────────────────────────────────────────────
// 🔥 Hazard Room Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a hazard room - grant loot for surviving/disarming
 *
 * Hazard rooms provide guaranteed loot as a reward for
 * navigating the danger. The trap outcome (triggered/disarmed)
 * is handled separately in the reducer.
 *
 * @param room - The hazard room to resolve
 * @param state - Current run state
 * @param rng - Seeded RNG for loot generation
 * @returns Resolution result with rewards
 *
 * @example
 * const result = resolveHazardRoom(room, state, rng);
 */
export function resolveHazardRoom(
  room: Room,
  state: RunState,
  rng: SeededRNG
): RoomResolutionResult {
  // Hazard rooms give loot but no direct XP (XP comes from surviving)
  const lootDropped = generateHazardLoot(rng, state.depth);
  const goldEarned = generateGold(rng, state.depth, 1);

  // Small XP reward for hazard rooms
  const xpEarned = Math.floor(BASE_XP_PER_POWER * ROOM_XP_MULTIPLIER.hazard * (1 + state.depth * 0.1));

  return {
    resolved: true,
    goldEarned,
    xpEarned,
    lootDropped,
    message: `You navigate the hazard safely. Found ${lootDropped.length} items and ${goldEarned} gold.`,
    canAdvance: true,
  };
}

// ─────────────────────────────────────────────────────────────
// ⛩️ Shrine Room Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a shrine room - apply blessing effects
 *
 * Shrine rooms provide various blessings when prayed at.
 * The specific blessing is determined by the boonId parameter.
 *
 * @param room - The shrine room to resolve
 * @param boonId - Optional ID of the blessing to apply
 * @returns Resolution result with boon effects
 *
 * @example
 * const result = resolveShrineRoom(room, 'healing');
 * if (result.hpRestored) {
 *   // Apply healing to party
 * }
 */
export function resolveShrineRoom(room: Room, boonId?: string): RoomResolutionResult {
  // Base result - shrines don't give gold or loot directly
  const result: RoomResolutionResult = {
    resolved: true,
    goldEarned: 0,
    xpEarned: 0,
    lootDropped: [],
    message: SHRINE_MESSAGES[boonId || 'default'] || SHRINE_MESSAGES.default,
    canAdvance: true,
  };

  // Apply specific boon effects
  if (boonId) {
    result.boonApplied = boonId;

    switch (boonId) {
      case 'healing':
        // Healing shrine - restores HP (actual value applied by reducer)
        result.hpRestored = 20; // Base healing amount
        break;
      case 'calm':
      case 'peace':
        // Calming shrine - reduces stress
        result.stressReduced = 5;
        break;
      case 'blessing':
        // General blessing - small XP bonus
        result.xpEarned = 50;
        break;
      case 'fortune':
        // Fortune shrine - bonus gold
        result.goldEarned = 100;
        break;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// 🏪 Intermission/Trader Room Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve an intermission/trader room
 *
 * Intermission rooms are resolved when the player chooses to
 * leave. They don't provide direct rewards (trading is separate).
 *
 * @param room - The intermission room to resolve
 * @returns Resolution result
 *
 * @example
 * const result = resolveIntermissionRoom(room);
 */
export function resolveIntermissionRoom(room: Room): RoomResolutionResult {
  return {
    resolved: true,
    goldEarned: 0,
    xpEarned: 0,
    lootDropped: [],
    message: 'You leave the trading post and continue your journey.',
    canAdvance: true,
  };
}

/**
 * Resolve a trader room (alias for intermission)
 *
 * @param room - The trader room to resolve
 * @returns Resolution result
 */
export function resolveTraderRoom(room: Room): RoomResolutionResult {
  return {
    resolved: true,
    goldEarned: 0,
    xpEarned: 0,
    lootDropped: [],
    message: 'You thank the merchant and prepare to move on.',
    canAdvance: true,
  };
}

/**
 * Resolve an ally room
 *
 * @param room - The ally room to resolve
 * @returns Resolution result
 */
export function resolveAllyRoom(room: Room): RoomResolutionResult {
  return {
    resolved: true,
    goldEarned: 0,
    xpEarned: 25, // Small XP for social encounter
    lootDropped: [],
    message: 'The encounter concludes. You prepare to continue.',
    canAdvance: true,
  };
}

// ─────────────────────────────────────────────────────────────
// 🎮 Generic Room Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Generic room resolution - routes to type-specific handlers
 *
 * Main entry point for room resolution. Determines the room type
 * and calls the appropriate resolution function.
 *
 * @param room - The room to resolve
 * @param state - Current run state
 * @param rng - Seeded RNG for deterministic resolution
 * @param options - Optional parameters (boonId for shrines, etc.)
 * @returns Resolution result with all rewards
 *
 * @example
 * const result = resolveRoom(currentRoom, state, rng);
 * if (result.resolved) {
 *   state.party.gold += result.goldEarned;
 *   state.inventory.items.push(...result.lootDropped);
 * }
 */
export function resolveRoom(
  room: Room,
  state: RunState,
  rng: SeededRNG,
  options: { boonId?: string } = {}
): RoomResolutionResult {
  // Check if room can be resolved first
  if (!canResolveRoom(room)) {
    return {
      resolved: false,
      goldEarned: 0,
      xpEarned: 0,
      lootDropped: [],
      message: 'This room cannot be resolved yet.',
      canAdvance: false,
    };
  }

  // Route to type-specific handler
  switch (room.type) {
    case 'combat':
    case 'elite':
    case 'boss':
      return resolveCombatRoom(room, state, rng);

    case 'hazard':
      return resolveHazardRoom(room, state, rng);

    case 'shrine':
      return resolveShrineRoom(room, options.boonId);

    case 'trader':
      return resolveTraderRoom(room);

    case 'intermission':
      return resolveIntermissionRoom(room);

    case 'ally':
      return resolveAllyRoom(room);

    default:
      // Unknown room type - safe fallback
      return {
        resolved: true,
        goldEarned: 0,
        xpEarned: 0,
        lootDropped: [],
        message: `Completed ${room.type} room.`,
        canAdvance: true,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// 🔄 Room Transitions
// ─────────────────────────────────────────────────────────────

/**
 * Check if player can advance to the next room
 *
 * Validates that the current room is resolved and the party
 * can proceed (not dead, etc.)
 *
 * @param room - Current room
 * @param state - Current run state
 * @returns True if player can advance
 *
 * @example
 * if (canAdvanceRoom(currentRoom, state)) {
 *   dispatch({ type: 'ADVANCE_ROOM' });
 * }
 */
export function canAdvanceRoom(room: Room, state: RunState): boolean {
  // Can't advance if room not resolved
  if (!state.roomResolved) {
    return false;
  }

  // Can't advance if party is dead
  const aliveMembers = state.party.members.filter((m) => m.hp.current > 0);
  if (aliveMembers.length === 0) {
    return false;
  }

  // Room-specific checks
  if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
    return areAllEnemiesDead(room.enemies);
  }

  return true;
}

/**
 * Get a transition message when moving between room types
 *
 * Provides flavor text based on the room types being transitioned.
 *
 * @param fromType - The type of room being left
 * @param toType - The type of room being entered
 * @returns Transition message string
 *
 * @example
 * const msg = getRoomTransitionMessage('combat', 'shrine');
 * // "After the battle, you find a peaceful shrine..."
 */
export function getRoomTransitionMessage(fromType: RoomType, toType: RoomType): string {
  // Transition message lookup
  const transitions: TransitionMessages = {
    'combat_shrine': 'After the battle, you find a peaceful shrine...',
    'combat_trader': 'With enemies defeated, you discover a hidden merchant.',
    'combat_hazard': 'You proceed cautiously. Something feels wrong...',
    'combat_combat': 'More enemies await in the next chamber.',
    'combat_elite': 'A powerful presence looms ahead.',
    'combat_boss': 'The air grows thick with dread. A great enemy awaits.',
    'combat_intermission': 'A moment of respite. A trading post appears ahead.',
    'shrine_combat': 'Blessed and ready, you face new challenges.',
    'shrine_hazard': 'The blessing fades as danger approaches.',
    'hazard_combat': 'You survived the trap, but enemies lurk nearby.',
    'hazard_shrine': 'Past the danger, a calming presence beckons.',
    'trader_combat': 'Supplies restocked, you face the dungeon once more.',
    'intermission_combat': 'Rested and ready, you venture deeper.',
    'intermission_boss': 'You choose to face the optional challenge.',
    'elite_shrine': 'The elite foes vanquished, you find sanctuary.',
    'boss_intermission': 'Victory! A moment to savor your triumph.',
  };

  const key = `${fromType}_${toType}`;
  return (
    transitions[key] ||
    `You leave the ${fromType} and enter a ${toType} room.`
  );
}

// ─────────────────────────────────────────────────────────────
// 📊 XP Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate XP for defeating enemies in a room
 *
 * XP is based on:
 * - Sum of enemy power values
 * - Room type multiplier (elite/boss give more)
 * - Depth bonus (deeper = more XP)
 *
 * @param room - The room with defeated enemies
 * @param depth - Current dungeon depth
 * @returns Total XP earned
 *
 * @example
 * const xp = calculateRoomXp(room, state.depth);
 * // Apply to party members
 */
export function calculateRoomXp(room: Room, depth: number = 0): number {
  // No XP for non-combat rooms
  if (room.type !== 'combat' && room.type !== 'elite' && room.type !== 'boss') {
    return 0;
  }

  // Sum enemy XP values if available, otherwise calculate from power
  let baseXp = 0;
  for (const enemy of room.enemies) {
    if (enemy.xp > 0) {
      baseXp += enemy.xp;
    } else {
      baseXp += enemy.power * BASE_XP_PER_POWER;
    }
  }

  // Apply room type multiplier
  const roomMultiplier = ROOM_XP_MULTIPLIER[room.type] || 1.0;
  baseXp = Math.floor(baseXp * roomMultiplier);

  // Apply depth bonus
  const depthBonus = depth * DEPTH_XP_BONUS;
  baseXp += depthBonus;

  return Math.max(1, baseXp);
}

/**
 * Calculate XP needed for next level
 *
 * Uses a standard D&D-style progression curve.
 *
 * @param currentLevel - Current character level
 * @returns XP required to reach next level
 *
 * @example
 * const xpNeeded = getXpForNextLevel(3);
 * // 900 XP needed for level 4
 */
export function getXpForNextLevel(currentLevel: number): number {
  // Simple quadratic progression: level * 100 * level
  return currentLevel * 100 * currentLevel;
}

/**
 * Check if a character has enough XP to level up
 *
 * @param currentLevel - Current character level
 * @param currentXp - Current XP total
 * @returns True if character can level up
 */
export function canLevelUp(currentLevel: number, currentXp: number): boolean {
  return currentXp >= getXpForNextLevel(currentLevel);
}
