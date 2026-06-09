/**
 * @fileoverview Room Generation System
 * 
 * Handles room type determination, enemy scaling, and room content generation.
 * This module is the core of dungeon procedural generation.
 * 
 * ## Segment System
 * The dungeon is divided into segments of 10 rooms each:
 * - Segment 1 (rooms 1-10): Beginner difficulty
 * - Segment 2 (rooms 11-20): Early mid-game
 * - Segment 3+ (rooms 21+): Scaling difficulty
 * 
 * ## Room Types
 * - `combat`: Standard enemy encounters
 * - `elite`: Stronger enemies with better loot
 * - `shrine`: Rest points, may be guarded
 * - `hazard`: Traps with treasure
 * - `trader`: Shop opportunities
 * - `intermission`: Segment-end rest/shop/recruit
 * - `boss`: Optional challenging encounters
 * 
 * @module engine/generateRoom
 */

import { SeededRNG } from '@lib/rng';
import type { RunState, Room, RoomType, Enemy, Item, RecruitOption } from './types';
import { getRoomWeights, ENEMIES, ITEMS, RECRUITS } from '../content/tables';
import { getThemeDef } from './generateTheme';

// ============================================================================
// 📊 Segment & Difficulty Constants
// ============================================================================

/** Number of rooms in each dungeon segment (difficulty tier) */
const ROOMS_PER_SEGMENT = 10;

/** Multiplier increment per segment (e.g., seg 1 = 1.0, seg 2 = 1.3, seg 3 = 1.6) */
const SEGMENT_MULTIPLIER_INCREMENT = 0.3;

/** Within-segment difficulty ramp per room (0% at room 1, ~22.5% at room 10) */
const ROOM_RAMP_INCREMENT = 0.025;

/** AC scaling multiplier per segment */
const AC_BONUS_MULTIPLIER = 1.5;

/** Base armor class before segment bonuses */
const BASE_AC = 10;

// ============================================================================
// 🎯 Power Tier Definitions
// ============================================================================

/**
 * Power tier ranges by segment.
 * Each entry defines [minPower, maxPower] for enemy selection.
 */
const POWER_TIERS: ReadonlyArray<[number, number]> = [
  [1, 2],   // Segment 1 (depths 1-10)
  [2, 4],   // Segment 2 (depths 11-20)
  [3, 6],   // Segment 3 (depths 21-30)
  [5, 8],   // Segment 4 (depths 31-40)
  [7, 10],  // Segment 5 (depths 41-50)
  [9, 13],  // Segment 6+ (depths 51+) - Boss tier
];

// ============================================================================
// 🏃 Escape DC Constants
// ============================================================================

/** Base difficulty class for escape attempts */
const ESCAPE_DC_BASE = 10;

/** Minimum escape DC regardless of modifiers */
const ESCAPE_DC_MINIMUM = 5;

/** DC increase per segment after the first */
const ESCAPE_DC_PER_SEGMENT = 2;

/** Additional DC per enemy beyond the first */
const ESCAPE_DC_PER_EXTRA_ENEMY = 1;

/** DC bonus for elite rooms */
const ESCAPE_DC_ELITE_BONUS = 3;

/** DC reduction for having a rogue in the party */
const ESCAPE_DC_ROGUE_BONUS = 2;

// ============================================================================
// ⚔️ Combat Scaling Constants
// ============================================================================

/** Maximum number of enemies in a single encounter */
const MAX_ENEMY_COUNT = 5;

/** HP multiplier for elite enemies */
const ELITE_HP_MULTIPLIER = 1.5;

/** AC bonus for elite enemies */
const ELITE_AC_BONUS = 2;

/** HP multiplier for boss encounters */
const BOSS_HP_MULTIPLIER = 1.5;

/** Power multiplier for boss encounters */
const BOSS_POWER_MULTIPLIER = 1.25;

/** Base AC for boss enemies */
const BOSS_BASE_AC = 12;

/** AC bonus on top of base for bosses */
const BOSS_AC_BONUS = 1;

/** Base XP multiplier for regular enemies */
const ENEMY_XP_BASE_MULTIPLIER = 10;

/** Base XP multiplier for boss enemies */
const BOSS_XP_BASE_MULTIPLIER = 25;

// ============================================================================
// 🛡️ Guard Chance Constants
// ============================================================================

/** Base chance for shrine rooms to be guarded */
const SHRINE_GUARD_BASE_CHANCE = 0.3;

/** Per-depth increase to shrine guard chance */
const SHRINE_GUARD_DEPTH_INCREMENT = 0.01;

/** Maximum guard chance for shrine rooms */
const SHRINE_GUARD_MAX_CHANCE = 0.7;

/** Base chance for hazard rooms to be guarded */
const HAZARD_GUARD_BASE_CHANCE = 0.25;

/** Per-depth increase to hazard guard chance */
const HAZARD_GUARD_DEPTH_INCREMENT = 0.005;

/** Maximum guard chance for hazard rooms */
const HAZARD_GUARD_MAX_CHANCE = 0.5;

/** Chance for bonus enemies to spawn (segment-based) */
const BONUS_ENEMY_SPAWN_CHANCE = 0.5;

// ============================================================================
// 💰 Recruit Scaling Constants
// ============================================================================

/** Cost increase per segment for recruits */
const RECRUIT_COST_PER_SEGMENT = 15;

// ============================================================================
// 📦 Types
// ============================================================================

/**
 * Difficulty information for a given dungeon depth.
 * Used to scale enemies, loot, and encounter complexity.
 */
export interface DifficultyInfo {
  /** Current segment (1-indexed, 1 = depths 1-10) */
  segment: number;
  /** Room position within segment (1-10) */
  roomInSegment: number;
  /** Overall difficulty multiplier for stat scaling */
  multiplier: number;
  /** Minimum enemy power tier for this depth */
  minPower: number;
  /** Maximum enemy power tier for this depth */
  maxPower: number;
  /** AC bonus from segment progression */
  acBonus: number;
  /** Potential extra enemies from segment progression */
  enemyCountBonus: number;
}

// ============================================================================
// 🔧 Helper Functions - Segment Calculations
// ============================================================================

/**
 * Calculate which segment a depth belongs to.
 * 
 * @param depth - Current dungeon depth (1-indexed)
 * @returns Segment number (1-indexed)
 * 
 * @example
 * calculateSegment(1)   // → 1 (rooms 1-10)
 * calculateSegment(10)  // → 1
 * calculateSegment(11)  // → 2 (rooms 11-20)
 * calculateSegment(25)  // → 3 (rooms 21-30)
 */
function calculateSegment(depth: number): number {
  return Math.floor((depth - 1) / ROOMS_PER_SEGMENT) + 1;
}

/**
 * Calculate room position within its segment.
 * 
 * @param depth - Current dungeon depth (1-indexed)
 * @returns Room number within segment (1-10)
 * 
 * @example
 * calculateRoomInSegment(1)   // → 1
 * calculateRoomInSegment(10)  // → 10
 * calculateRoomInSegment(11)  // → 1 (first room of segment 2)
 * calculateRoomInSegment(15)  // → 5
 */
function calculateRoomInSegment(depth: number): number {
  return ((depth - 1) % ROOMS_PER_SEGMENT) + 1;
}

/**
 * Get power tier range for a given segment.
 * 
 * @param segment - Current segment (1-indexed)
 * @returns Tuple of [minPower, maxPower]
 */
function getPowerTier(segment: number): [number, number] {
  const index = Math.min(segment - 1, POWER_TIERS.length - 1);
  return POWER_TIERS[index];
}

// ============================================================================
// 🔧 Helper Functions - Guard Chance
// ============================================================================

/**
 * Calculate chance for a shrine room to be guarded.
 * 
 * @param depth - Current dungeon depth
 * @returns Probability (0.0 to 1.0) of guards being present
 */
function calculateShrineGuardChance(depth: number): number {
  const chance = SHRINE_GUARD_BASE_CHANCE + (depth * SHRINE_GUARD_DEPTH_INCREMENT);
  return Math.min(chance, SHRINE_GUARD_MAX_CHANCE);
}

/**
 * Calculate chance for a hazard room to be guarded.
 * 
 * @param depth - Current dungeon depth
 * @returns Probability (0.0 to 1.0) of guards being present
 */
function calculateHazardGuardChance(depth: number): number {
  const chance = HAZARD_GUARD_BASE_CHANCE + (depth * HAZARD_GUARD_DEPTH_INCREMENT);
  return Math.min(chance, HAZARD_GUARD_MAX_CHANCE);
}

// ============================================================================
// 🔧 Helper Functions - Enemy Generation
// ============================================================================

/**
 * Filter enemies by theme compatibility and power tier.
 * Falls back to power-only filtering if no themed enemies found.
 * 
 * @param themeTags - Enemy tags allowed by current theme
 * @param minPower - Minimum power tier
 * @param maxPower - Maximum power tier
 * @returns Filtered array of enemy definitions
 */
function filterEnemiesByThemeAndPower(
  themeTags: string[],
  minPower: number,
  maxPower: number
): typeof ENEMIES {
  // Try theme + power filtering first
  const themed = ENEMIES.filter(
    (e) =>
      e.tags.some((tag) => themeTags.includes(tag)) &&
      e.power >= minPower &&
      e.power <= maxPower
  );

  if (themed.length > 0) return themed;

  // Fall back to power-only filtering
  const byPower = ENEMIES.filter(
    (e) => e.power >= minPower && e.power <= maxPower
  );

  // Ultimate fallback: all enemies
  return byPower.length > 0 ? byPower : ENEMIES;
}

/**
 * Calculate the number of enemies for an encounter.
 * 
 * @param rng - Seeded random number generator
 * @param isGuardedRoom - Whether this is a guarded non-combat room
 * @param isElite - Whether this is an elite encounter
 * @param enemyCountBonus - Potential bonus enemies from segment
 * @returns Number of enemies to spawn
 */
function calculateEnemyCount(
  rng: SeededRNG,
  isGuardedRoom: boolean,
  isElite: boolean,
  enemyCountBonus: number
): number {
  const baseCount = isGuardedRoom
    ? rng.int(1, 2)
    : isElite
      ? 1
      : rng.int(1, 3);

  const bonusEnemies = isGuardedRoom
    ? 0
    : rng.float() < BONUS_ENEMY_SPAWN_CHANCE
      ? enemyCountBonus
      : 0;

  return Math.min(MAX_ENEMY_COUNT, baseCount + bonusEnemies);
}

/**
 * Create an enemy instance with scaled stats.
 * 
 * @param enemyProto - Base enemy definition
 * @param index - Enemy index in encounter (for ID generation)
 * @param displayName - Display name (may include numbering)
 * @param difficulty - Current difficulty info
 * @param isElite - Whether to apply elite bonuses
 * @returns Fully scaled enemy object
 */
function createScaledEnemy(
  enemyProto: typeof ENEMIES[0],
  index: number,
  displayName: string,
  difficulty: DifficultyInfo,
  isElite: boolean
): Enemy {
  // Base scaling
  const scaledHp = Math.floor(enemyProto.hp * difficulty.multiplier);
  const scaledAc = BASE_AC + difficulty.acBonus;
  const scaledPower = Math.floor(enemyProto.power * difficulty.multiplier);
  const scaledXp = Math.floor(enemyProto.power * ENEMY_XP_BASE_MULTIPLIER * difficulty.multiplier);

  // Elite bonuses
  const eliteMultiplier = isElite ? ELITE_HP_MULTIPLIER : 1;
  const finalHp = Math.floor(scaledHp * eliteMultiplier);
  const finalAc = isElite ? scaledAc + ELITE_AC_BONUS : scaledAc;
  const finalPower = Math.floor(scaledPower * eliteMultiplier);

  return {
    id: `${enemyProto.id}-${index}`,
    name: isElite ? `Elite ${displayName}` : displayName,
    hp: finalHp,
    maxHp: finalHp,
    ac: finalAc,
    power: finalPower,
    damage: enemyProto.damage,
    xp: Math.floor(scaledXp * eliteMultiplier),
  };
}

// ============================================================================
// 📊 getDifficulty - Calculate difficulty scaling based on depth
// ============================================================================

/**
 * Calculate difficulty scaling based on dungeon depth.
 * 
 * The difficulty system uses a segment-based approach where each segment
 * (10 rooms) represents a tier of difficulty. Within each segment, there's
 * a gradual ramp-up from room 1 to room 10.
 * 
 * ## Segment Scaling
 * | Segment | Depths  | Power Range | Base Multiplier |
 * |---------|---------|-------------|-----------------|
 * | 1       | 1-10    | 1-2         | 1.0             |
 * | 2       | 11-20   | 2-4         | 1.3             |
 * | 3       | 21-30   | 3-6         | 1.6             |
 * | 4       | 31-40   | 5-8         | 1.9             |
 * | 5       | 41-50   | 7-10        | 2.2             |
 * | 6+      | 51+     | 9-13        | 2.5+            |
 * 
 * @param depth - Current dungeon depth (1-indexed)
 * @returns Difficulty info object with all scaling parameters
 * 
 * @example
 * const diff = getDifficulty(1);
 * // { segment: 1, roomInSegment: 1, multiplier: 1.0, minPower: 1, maxPower: 2, ... }
 * 
 * const diff2 = getDifficulty(15);
 * // { segment: 2, roomInSegment: 5, multiplier: ~1.43, minPower: 2, maxPower: 4, ... }
 */
export function getDifficulty(depth: number): DifficultyInfo {
  // Handle edge case for depth 0 or negative
  if (depth <= 0) {
    return {
      segment: 1,
      roomInSegment: 0,
      multiplier: 1.0,
      minPower: 1,
      maxPower: 2,
      acBonus: 0,
      enemyCountBonus: 0,
    };
  }

  const segment = calculateSegment(depth);
  const roomInSegment = calculateRoomInSegment(depth);

  // Base multiplier increases per segment (1.0, 1.3, 1.6, 1.9, 2.2, 2.5...)
  const segmentMultiplier = 1 + (segment - 1) * SEGMENT_MULTIPLIER_INCREMENT;

  // Within segment, slight ramp (0% at room 1, ~22.5% at room 10)
  const roomRamp = 1 + (roomInSegment - 1) * ROOM_RAMP_INCREMENT;

  const multiplier = segmentMultiplier * roomRamp;

  // Get power tier for this segment
  const [minPower, maxPower] = getPowerTier(segment);

  // AC bonus: Math.floor((segment - 1) * 1.5)
  // Seg 1: 0, Seg 2: 1, Seg 3: 3, Seg 4: 4, Seg 5: 6...
  const acBonus = Math.floor((segment - 1) * AC_BONUS_MULTIPLIER);

  // Extra enemies: Math.floor((segment - 1) / 2)
  // Seg 1-2: 0, Seg 3-4: 1, Seg 5-6: 2...
  const enemyCountBonus = Math.floor((segment - 1) / 2);

  return {
    segment,
    roomInSegment,
    multiplier,
    minPower,
    maxPower,
    acBonus,
    enemyCountBonus,
  };
}

// ============================================================================
// 🏃 calculateEscapeDC - Calculate escape difficulty class
// ============================================================================

/**
 * Calculate the Escape DC for fleeing combat.
 * 
 * The escape DC represents the difficulty of successfully fleeing an encounter.
 * It considers dungeon depth, number of enemies, room type, and party composition.
 * 
 * ## DC Calculation
 * - **Base**: 10
 * - **+2** per segment after first
 * - **+1** per enemy beyond first
 * - **+3** for elite rooms
 * - **-agility** (best party agility score)
 * - **-2** if party has rogue
 * - **Minimum**: 5
 * 
 * @param depth - Current dungeon depth
 * @param enemyCount - Number of enemies in room
 * @param isElite - Whether this is an elite room
 * @param partyAgility - Best agility score in party
 * @param hasRogue - Whether party has a rogue
 * @returns Object with final DC and human-readable breakdown
 * 
 * @example
 * const escape = calculateEscapeDC(15, 3, false, 2, true);
 * // { dc: 10, breakdown: "Base: 10, Segment 2: +2, Enemies (3): +2, Agility: -2, Rogue: -2" }
 */
export function calculateEscapeDC(
  depth: number,
  enemyCount: number,
  isElite: boolean,
  partyAgility: number,
  hasRogue: boolean
): { dc: number; breakdown: string } {
  const difficulty = getDifficulty(depth);

  let dc = ESCAPE_DC_BASE;
  const parts: string[] = [`Base: ${ESCAPE_DC_BASE}`];

  // Segment scaling (+2 per segment after first)
  const segmentBonus = (difficulty.segment - 1) * ESCAPE_DC_PER_SEGMENT;
  if (segmentBonus > 0) {
    dc += segmentBonus;
    parts.push(`Segment ${difficulty.segment}: +${segmentBonus}`);
  }

  // Enemy count (+1 per enemy beyond first)
  const enemyBonus = Math.max(0, enemyCount - 1) * ESCAPE_DC_PER_EXTRA_ENEMY;
  if (enemyBonus > 0) {
    dc += enemyBonus;
    parts.push(`Enemies (${enemyCount}): +${enemyBonus}`);
  }

  // Elite room bonus
  if (isElite) {
    dc += ESCAPE_DC_ELITE_BONUS;
    parts.push(`Elite: +${ESCAPE_DC_ELITE_BONUS}`);
  }

  // Party agility reduction
  if (partyAgility > 0) {
    dc -= partyAgility;
    parts.push(`Agility: -${partyAgility}`);
  }

  // Rogue bonus
  if (hasRogue) {
    dc -= ESCAPE_DC_ROGUE_BONUS;
    parts.push(`Rogue: -${ESCAPE_DC_ROGUE_BONUS}`);
  }

  // Apply minimum DC
  dc = Math.max(ESCAPE_DC_MINIMUM, dc);

  return {
    dc,
    breakdown: parts.join(', '),
  };
}

// ============================================================================
// 🎲 Room Type Determination
// ============================================================================

/**
 * Determine room type and guard status based on depth and RNG.
 * 
 * @param state - Current run state
 * @param rng - Seeded random number generator
 * @returns Tuple of [roomType, isGuardedRoom]
 */
function determineRoomType(
  state: RunState,
  rng: SeededRNG
): [RoomType, boolean] {
  const roomInSegment = state.depth % ROOMS_PER_SEGMENT === 0 
    ? ROOMS_PER_SEGMENT 
    : state.depth % ROOMS_PER_SEGMENT;

  let type: RoomType = 'combat';
  let isGuardedRoom = false;

  // Room 10, 20, 30... = Intermission
  if (state.depth % ROOMS_PER_SEGMENT === 0 && state.depth > 0) {
    type = 'intermission';
  }
  // Room 0, 5, 15, 25... = Shrine
  else if (state.depth === 0 || state.depth % 5 === 0) {
    type = 'shrine';
    // Shrines after room 0 may be guarded
    if (state.depth > 0) {
      isGuardedRoom = rng.float() < calculateShrineGuardChance(state.depth);
    }
  }
  // Weighted random selection
  else {
    const weights = getRoomWeights(roomInSegment);
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng.int(1, totalWeight);

    for (const w of weights) {
      roll -= w.weight;
      if (roll <= 0) {
        type = w.type;
        break;
      }
    }

    // Hazard rooms may be guarded
    if (type === 'hazard') {
      isGuardedRoom = rng.float() < calculateHazardGuardChance(state.depth);
    }
  }

  return [type, isGuardedRoom];
}

// ============================================================================
// ⚔️ Enemy Generation for Rooms
// ============================================================================

/**
 * Generate enemies for a combat encounter.
 * 
 * @param state - Current run state
 * @param rng - Seeded random number generator
 * @param roomType - Type of room being generated
 * @param isGuardedRoom - Whether this is a guarded non-combat room
 * @returns Array of scaled enemy objects
 */
function generateEnemies(
  state: RunState,
  rng: SeededRNG,
  roomType: RoomType,
  isGuardedRoom: boolean
): Enemy[] {
  const difficulty = getDifficulty(state.depth);
  const theme = getThemeDef(state.themeId);
  const isElite = roomType === 'elite';

  // Get filtered enemy pool
  const pool = filterEnemiesByThemeAndPower(
    theme.enemyTags,
    difficulty.minPower,
    difficulty.maxPower
  );

  // Calculate encounter size
  const count = calculateEnemyCount(rng, isGuardedRoom, isElite, difficulty.enemyCountBonus);

  // Track name counts for numbering duplicates
  const nameCounts: Record<string, number> = {};
  const enemies: Enemy[] = [];

  for (let i = 0; i < count; i++) {
    const enemyProto = rng.pick(pool);

    // Track duplicate names for numbering
    nameCounts[enemyProto.name] = (nameCounts[enemyProto.name] || 0) + 1;
    const nameNum = nameCounts[enemyProto.name];

    // Only add number suffix if there will be multiple enemies
    const displayName = count > 1 ? `${enemyProto.name} ${nameNum}` : enemyProto.name;

    enemies.push(createScaledEnemy(enemyProto, i, displayName, difficulty, isElite));
  }

  return enemies;
}

// ============================================================================
// 💎 Loot Generation
// ============================================================================

/**
 * Generate treasure for hazard rooms.
 * 
 * @param rng - Seeded random number generator
 * @param isGuardedRoom - Whether room has guards (better loot if guarded)
 * @returns Array of item drops
 */
function generateHazardLoot(rng: SeededRNG, isGuardedRoom: boolean): Item[] {
  const rarityFilter = isGuardedRoom
    ? ['uncommon', 'rare', 'epic']
    : ['common', 'uncommon'];

  const lootPool = ITEMS.filter((i) => rarityFilter.includes(i.rarity));
  const shuffledLoot = rng.shuffle([...lootPool]);

  const lootCount = isGuardedRoom ? rng.int(2, 3) : 1;
  return shuffledLoot.slice(0, lootCount);
}

/**
 * Generate shop inventory for trader/intermission rooms.
 * 
 * @param rng - Seeded random number generator
 * @returns Array of 4 items available for purchase
 */
function generateShopItems(rng: SeededRNG): Item[] {
  const shuffled = rng.shuffle([...ITEMS]);
  return shuffled.slice(0, 4);
}

/**
 * Generate recruits available at intermission.
 * 
 * @param rng - Seeded random number generator
 * @param segment - Current segment for cost scaling
 * @returns Array of 2 recruit options
 */
function generateRecruits(rng: SeededRNG, segment: number): RecruitOption[] {
  const scaledRecruits: RecruitOption[] = RECRUITS.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    cost: r.cost + (segment - 1) * RECRUIT_COST_PER_SEGMENT,
    description: `${r.description} (Level ${segment})`,
    level: segment,
  }));

  const shuffledRecruits = rng.shuffle([...scaledRecruits]);
  return shuffledRecruits.slice(0, 2);
}

// ============================================================================
// 🐉 Boss Room Generation
// ============================================================================

/**
 * Generate an optional boss room for intermission.
 * 
 * Boss rooms feature:
 * - A single powerful boss enemy (1.5x HP, 1.25x Power)
 * - 1-2 minion enemies
 * - Rare+ loot drops
 * 
 * @param state - Current run state
 * @param rng - Seeded random number generator
 * @returns Generated boss room
 */
function generateBossRoom(state: RunState, rng: SeededRNG): Room {
  const difficulty = getDifficulty(state.depth);

  const bossRoom: Room = {
    id: `boss-room-${state.depth}`,
    type: 'boss',
    themeId: state.themeId,
    enemies: [],
    loot: [],
  };

  // Find suitable boss (power >= maxPower + 1)
  let potentialBosses = ENEMIES.filter(
    (e) => e.power >= difficulty.maxPower + 1 && e.power <= difficulty.maxPower + 3
  );

  if (potentialBosses.length === 0) {
    potentialBosses = ENEMIES.filter(
      (e) => e.power >= difficulty.maxPower && e.power <= difficulty.maxPower + 3
    );
  }

  // Prefer boss/elite tagged enemies
  const preferredBosses = potentialBosses.filter(
    (e) => e.tags.includes('boss') || e.tags.includes('elite')
  );
  const finalBossPool = preferredBosses.length > 0 ? preferredBosses : potentialBosses;

  const bossProto =
    finalBossPool.length > 0
      ? rng.pick(finalBossPool)
      : ENEMIES.find((e) => e.power === difficulty.maxPower) || ENEMIES[0];

  // Boss scaled: 1.5x HP, 1.25x Power
  const bossMultiplier = difficulty.multiplier;
  const bossHp = Math.floor(bossProto.hp * bossMultiplier * BOSS_HP_MULTIPLIER);
  const bossAc = BOSS_BASE_AC + difficulty.acBonus + BOSS_AC_BONUS;
  const bossPower = Math.floor(bossProto.power * bossMultiplier * BOSS_POWER_MULTIPLIER);

  bossRoom.enemies.push({
    id: `${bossProto.id}-boss`,
    name: `${bossProto.name} (BOSS)`,
    hp: bossHp,
    maxHp: bossHp,
    ac: bossAc,
    power: bossPower,
    damage: bossProto.damage,
    xp: Math.floor(bossProto.power * BOSS_XP_BASE_MULTIPLIER * difficulty.multiplier),
  });

  // Add 1-2 minions
  const minionPool = ENEMIES.filter(
    (e) =>
      !e.tags.includes('boss') &&
      e.power >= difficulty.minPower &&
      e.power <= difficulty.maxPower
  );

  const minionCount = rng.int(1, 2);
  for (let i = 0; i < minionCount && minionPool.length > 0; i++) {
    const minionProto = rng.pick(minionPool);
    const minionHp = Math.floor(minionProto.hp * difficulty.multiplier);

    bossRoom.enemies.push({
      id: `${minionProto.id}-minion-${i}`,
      name: minionProto.name,
      hp: minionHp,
      maxHp: minionHp,
      ac: BASE_AC + difficulty.acBonus,
      power: Math.floor(minionProto.power * difficulty.multiplier),
      damage: minionProto.damage,
      xp: Math.floor(minionProto.power * ENEMY_XP_BASE_MULTIPLIER * difficulty.multiplier),
    });
  }

  // Boss loot: rare+ only, scaling with depth
  const maxRarityIndex = state.depth < 10 ? 2 : state.depth < 30 ? 3 : 5;
  const allowedRarities = ['rare', 'epic', 'legendary', 'godly'].slice(0, maxRarityIndex);

  const rareLootPool = ITEMS.filter((i) => allowedRarities.includes(i.rarity));
  const shuffledBossLoot = rng.shuffle([...rareLootPool]);
  bossRoom.loot = shuffledBossLoot.slice(0, rng.int(1, 2));

  return bossRoom;
}

// ============================================================================
// 🏠 generateRoom - Main room generation function
// ============================================================================

/**
 * Generate a room based on current game state.
 * 
 * This is the main entry point for room generation. It determines room type,
 * generates appropriate content (enemies, loot, shop items, recruits), and
 * returns a fully populated room object.
 * 
 * ## Room Type Determination
 * | Depth Pattern | Room Type    | Notes                          |
 * |---------------|--------------|--------------------------------|
 * | 0             | shrine       | Starting room                  |
 * | 10, 20, 30... | intermission | Rest/shop/recruit opportunity  |
 * | 5, 15, 25...  | shrine       | May be guarded after depth 0   |
 * | Other         | weighted RNG | combat, hazard, elite, etc.    |
 * 
 * @param state - Current run state with depth, theme, etc.
 * @param rng - Seeded random number generator for deterministic generation
 * @returns Generated room with all content populated
 * 
 * @example
 * const rng = new SeededRNG('my-seed');
 * const room = generateRoom({ depth: 5, themeId: 'dungeon_start', ... }, rng);
 * console.log(room.type); // 'shrine'
 * console.log(room.enemies); // May have guards if guarded shrine
 */
export function generateRoom(state: RunState, rng: SeededRNG): Room {
  const theme = getThemeDef(state.themeId);

  // Determine room type and guard status
  const [type, isGuardedRoom] = determineRoomType(state, rng);

  // Build base room structure
  const room: Room = {
    id: `room-${state.depth}`,
    type,
    themeId: state.themeId,
    enemies: [],
    loot: [],
  };

  // Generate enemies for combat encounters
  if (type === 'combat' || type === 'elite' || isGuardedRoom) {
    room.enemies = generateEnemies(state, rng, type, isGuardedRoom);
  }

  // Generate treasure for hazard rooms
  if (type === 'hazard') {
    room.loot = generateHazardLoot(rng, isGuardedRoom);
  }

  // Generate shop items for trader and intermission
  if (type === 'trader' || type === 'intermission') {
    room.shopItems = generateShopItems(rng);
  }

  // Generate recruits and boss room for intermission
  if (type === 'intermission') {
    const difficulty = getDifficulty(state.depth);
    room.availableRecruits = generateRecruits(rng, difficulty.segment);
    room.bossRoom = generateBossRoom(state, rng);
  }

  return room;
}
