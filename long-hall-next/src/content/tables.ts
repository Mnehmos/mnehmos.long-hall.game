/**
 * @fileoverview Game Content Tables
 * 
 * Contains all game data: enemies, items, recruits, room weights, and drop tables.
 * This is the central content repository for the game's procedural generation.
 * 
 * ## Content Categories
 * - **Enemies**: Monster definitions with power tiers (1-13)
 * - **Items**: Equipment with rarity levels (common → godly)
 * - **Recruits**: Hireable party members at intermissions
 * - **Room Weights**: Probability tables for room type selection
 * 
 * ## Power Tier Overview
 * | Tier | Power | Typical Depth | Enemy Examples              |
 * |------|-------|---------------|----------------------------|
 * | 1    | 1-2   | 1-10          | Rats, Goblins, Slimes      |
 * | 2    | 3-4   | 11-20         | Skeletons, Wolves, Gnolls  |
 * | 3    | 5-6   | 21-30         | Orcs, Ghouls, Trolls       |
 * | 4    | 7-8   | 31-40         | Ogres, Giants, Vampires    |
 * | 5    | 9-10  | 41-50         | Dragons, Mind Flayers      |
 * | 6    | 11+   | 51+           | Liches, Demon Lords        |
 * 
 * @module content/tables
 */

import type { Item, RoomType } from '@engine/types';

// ============================================================================
// 📊 Room Weight Configuration
// ============================================================================

/**
 * Room weight definition for weighted random selection.
 */
export interface RoomWeight {
  /** Type of room this weight applies to */
  type: RoomType;
  /** Relative weight for random selection (higher = more likely) */
  weight: number;
  /** Minimum depth required for this room type (optional) */
  minDepth?: number;
}

// ============================================================================
// 🎲 Room Weight Constants
// ============================================================================

/** Base weight for combat rooms */
const COMBAT_BASE_WEIGHT = 50;

/** Base weight for hazard rooms */
const HAZARD_BASE_WEIGHT = 20;

/** Base weight for shrine rooms */
const SHRINE_BASE_WEIGHT = 10;

/** Base weight for trader rooms */
const TRADER_BASE_WEIGHT = 10;

/** Base weight for elite rooms (before depth scaling) */
const ELITE_BASE_WEIGHT = 10;

/** Weight increase per room for elite encounters */
const ELITE_WEIGHT_PER_ROOM = 2;

/** Room in segment threshold before elites start appearing */
const ELITE_THRESHOLD_ROOM = 5;

// ============================================================================
// 🎯 getRoomWeights - Room type probability table
// ============================================================================

/**
 * Get room type weights based on position in segment.
 * 
 * The weighting system ensures:
 * - Combat is always the most common
 * - Early rooms (1-5) never have elites
 * - Late rooms (6-10) have increasing elite chance
 * - First room of segment is always combat
 * 
 * ## Weight Distribution
 * | Room # | Combat | Hazard | Shrine | Trader | Elite |
 * |--------|--------|--------|--------|--------|-------|
 * | 1      | 100%   | -      | -      | -      | -     |
 * | 2-5    | 56%    | 22%    | 11%    | 11%    | -     |
 * | 6      | 50%    | 20%    | 10%    | 10%    | 22%   |
 * | 10     | 42%    | 17%    | 8%     | 8%     | 25%   |
 * 
 * @param roomInSegment - Room position within segment (1-10)
 * @returns Array of room weights for random selection
 * 
 * @example
 * const weights = getRoomWeights(1);
 * // [{ type: 'combat', weight: 10 }] - First room is always combat
 * 
 * @example
 * const weights = getRoomWeights(8);
 * // Includes elite with weight 26 (10 + 8*2)
 */
export function getRoomWeights(roomInSegment: number): RoomWeight[] {
  // First room of segment is always combat
  if (roomInSegment === 1) {
    return [{ type: 'combat', weight: 10 }];
  }

  const base: RoomWeight[] = [
    { type: 'combat', weight: COMBAT_BASE_WEIGHT },
    { type: 'hazard', weight: HAZARD_BASE_WEIGHT },
    { type: 'shrine', weight: SHRINE_BASE_WEIGHT },
    { type: 'trader', weight: TRADER_BASE_WEIGHT },
  ];

  // Elites appear after room 5 with increasing frequency
  if (roomInSegment > ELITE_THRESHOLD_ROOM) {
    const eliteWeight = ELITE_BASE_WEIGHT + (roomInSegment * ELITE_WEIGHT_PER_ROOM);
    base.push({ type: 'elite', weight: eliteWeight });
  }

  return base;
}

// ============================================================================
// 👹 Enemy Definitions
// ============================================================================

/**
 * Enemy definition from the content database.
 * Used as a prototype for spawning scaled enemy instances.
 */
export interface EnemyDef {
  /** Unique identifier for the enemy type */
  id: string;
  /** Display name */
  name: string;
  /** Tags for theme filtering (e.g., 'undead', 'beast', 'humanoid') */
  tags: string[];
  /** Power tier (1-13) - determines which depths this enemy appears */
  power: number;
  /** Base HP before difficulty scaling */
  hp: number;
  /** Damage dice expression (e.g., '1d6+2') */
  damage: string;
}

/**
 * Complete enemy database.
 * 
 * Organized by power tier:
 * - **Tier 1** (Power 1-2): Vermin, basic humanoids
 * - **Tier 2** (Power 3-4): Lesser undead, predators
 * - **Tier 3** (Power 5-6): Mid-tier threats
 * - **Tier 4** (Power 7-8): Giants, powerful monsters
 * - **Tier 5** (Power 9-10): Dragons, aberrations
 * - **Tier 6** (Power 11+): Bosses, legendary foes
 */
export const ENEMIES: EnemyDef[] = [
  // ========================================
  // 🐀 TIER 1 - Power 1-2: Early floors
  // ========================================
  { id: 'rat_swarm', name: 'Rat Swarm', tags: ['vermin', 'beast'], power: 1, hp: 8, damage: '1d4' },
  { id: 'giant_rat', name: 'Giant Rat', tags: ['vermin', 'beast'], power: 1, hp: 6, damage: '1d4' },
  { id: 'kobold', name: 'Kobold', tags: ['humanoid', 'kobold'], power: 1, hp: 6, damage: '1d4+1' },
  { id: 'goblin', name: 'Goblin', tags: ['humanoid', 'goblin'], power: 1, hp: 7, damage: '1d4+1' },
  { id: 'slime', name: 'Green Slime', tags: ['slime', 'ooze'], power: 2, hp: 12, damage: '1d6' },
  { id: 'giant_spider', name: 'Giant Spider', tags: ['vermin', 'beast'], power: 2, hp: 10, damage: '1d6' },
  { id: 'stirge', name: 'Stirge', tags: ['vermin', 'beast'], power: 1, hp: 4, damage: '1d4' },
  { id: 'bandit', name: 'Bandit', tags: ['humanoid'], power: 2, hp: 11, damage: '1d6' },

  // ========================================
  // 💀 TIER 2 - Power 3-4: Mid-early floors
  // ========================================
  { id: 'skeleton', name: 'Skeleton Warrior', tags: ['undead', 'skeleton'], power: 3, hp: 12, damage: '1d6+1' },
  { id: 'zombie', name: 'Rotting Zombie', tags: ['undead', 'zombie'], power: 3, hp: 14, damage: '1d6' },
  { id: 'dire_wolf', name: 'Dire Wolf', tags: ['beast'], power: 3, hp: 15, damage: '1d6+2' },
  { id: 'hobgoblin', name: 'Hobgoblin', tags: ['humanoid', 'goblin'], power: 3, hp: 14, damage: '1d8' },
  { id: 'gnoll', name: 'Gnoll Hunter', tags: ['humanoid', 'gnoll'], power: 3, hp: 16, damage: '1d8' },
  { id: 'cultist', name: 'Dark Cultist', tags: ['humanoid', 'magic'], power: 3, hp: 10, damage: '1d8' },
  { id: 'bugbear', name: 'Bugbear', tags: ['humanoid', 'goblin'], power: 4, hp: 18, damage: '1d8+1' },
  { id: 'harpy', name: 'Harpy', tags: ['monstrosity', 'flying'], power: 4, hp: 14, damage: '1d6+2' },

  // ========================================
  // ⚔️ TIER 3 - Power 5-6: Mid floors
  // ========================================
  { id: 'orc', name: 'Orc Berserker', tags: ['humanoid', 'orc'], power: 5, hp: 18, damage: '1d8+2' },
  { id: 'ghoul', name: 'Ghoul', tags: ['undead'], power: 5, hp: 16, damage: '1d8+1' },
  { id: 'wight', name: 'Wight', tags: ['undead'], power: 5, hp: 20, damage: '1d10' },
  { id: 'owlbear', name: 'Owlbear', tags: ['beast', 'monstrosity'], power: 5, hp: 22, damage: '1d10+2' },
  { id: 'minotaur', name: 'Minotaur', tags: ['monstrosity'], power: 6, hp: 28, damage: '2d6' },
  { id: 'werewolf', name: 'Werewolf', tags: ['humanoid', 'shapechanger'], power: 6, hp: 24, damage: '1d10+2' },
  { id: 'troll', name: 'Troll', tags: ['giant'], power: 6, hp: 30, damage: '2d6+2' },
  { id: 'wraith', name: 'Wraith', tags: ['undead', 'incorporeal'], power: 6, hp: 18, damage: '1d10+2' },

  // ========================================
  // 🏔️ TIER 4 - Power 7-8: Deep floors
  // ========================================
  { id: 'ogre', name: 'Ogre', tags: ['giant'], power: 7, hp: 32, damage: '2d6+2' },
  { id: 'ettin', name: 'Ettin', tags: ['giant'], power: 7, hp: 36, damage: '2d8' },
  { id: 'vampire_spawn', name: 'Vampire Spawn', tags: ['undead', 'vampire'], power: 7, hp: 28, damage: '1d10+3' },
  { id: 'manticore', name: 'Manticore', tags: ['monstrosity', 'flying'], power: 7, hp: 30, damage: '2d6+2' },
  { id: 'hill_giant', name: 'Hill Giant', tags: ['giant'], power: 8, hp: 45, damage: '2d8+3' },
  { id: 'flesh_golem', name: 'Flesh Golem', tags: ['construct'], power: 8, hp: 40, damage: '2d8+2' },
  { id: 'chimera', name: 'Chimera', tags: ['monstrosity', 'flying'], power: 8, hp: 38, damage: '2d8+2' },
  { id: 'oni', name: 'Oni', tags: ['giant', 'magic'], power: 8, hp: 35, damage: '2d8+3' },

  // ========================================
  // 🐉 TIER 5 - Power 9-10: Late floors
  // ========================================
  { id: 'frost_giant', name: 'Frost Giant', tags: ['giant'], power: 9, hp: 55, damage: '3d6+4' },
  { id: 'fire_giant', name: 'Fire Giant', tags: ['giant'], power: 9, hp: 50, damage: '3d6+4' },
  { id: 'young_dragon', name: 'Young Dragon', tags: ['dragon', 'flying'], power: 9, hp: 48, damage: '2d10+3' },
  { id: 'beholder_zombie', name: 'Beholder Zombie', tags: ['undead', 'aberration'], power: 9, hp: 40, damage: '2d10' },
  { id: 'mind_flayer', name: 'Mind Flayer', tags: ['aberration', 'magic'], power: 10, hp: 42, damage: '2d10+4' },
  { id: 'death_knight', name: 'Death Knight', tags: ['undead', 'knight'], power: 10, hp: 60, damage: '2d10+5' },
  { id: 'stone_giant', name: 'Stone Giant', tags: ['giant'], power: 10, hp: 65, damage: '3d8+4' },

  // ========================================
  // 👑 TIER 6 - Power 11+: Boss tier
  // ========================================
  { id: 'adult_dragon', name: 'Adult Dragon', tags: ['dragon', 'flying', 'boss'], power: 12, hp: 120, damage: '3d10+6' },
  { id: 'lich', name: 'Lich', tags: ['undead', 'magic', 'boss'], power: 12, hp: 80, damage: '3d8+6' },
  { id: 'vampire_lord', name: 'Vampire Lord', tags: ['undead', 'vampire', 'boss'], power: 11, hp: 85, damage: '2d12+5' },
  { id: 'beholder', name: 'Beholder', tags: ['aberration', 'boss'], power: 11, hp: 75, damage: '2d10+5' },
  { id: 'demon_lord', name: 'Demon Lord', tags: ['fiend', 'demon', 'boss'], power: 13, hp: 100, damage: '3d10+8' },
  { id: 'storm_giant', name: 'Storm Giant', tags: ['giant', 'boss'], power: 12, hp: 110, damage: '3d10+6' },
];

// ============================================================================
// 🎒 Item Definitions
// ============================================================================

/**
 * Rarity levels from least to most rare.
 * 
 * | Rarity    | Typical Cost | Drop Rate |
 * |-----------|--------------|-----------|
 * | common    | 12-20        | 40%       |
 * | uncommon  | 30-45        | 25%       |
 * | rare      | 65-90        | 18%       |
 * | epic      | 130-180      | 10%       |
 * | legendary | 260-350      | 5%        |
 * | godly     | 550-700      | 2%        |
 */
export const RARITY_LEVELS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'godly'] as const;

/**
 * Complete item database.
 * 
 * Item categories:
 * - **Weapons**: Attack and damage bonuses (class-specific)
 * - **Armor**: AC and HP bonuses (chest, legs)
 * - **Accessories**: Mixed bonuses (head, feet, neck, ring, shield)
 */
export const ITEMS: Item[] = [
  // ========================================
  // ⚔️ FIGHTER EQUIPMENT
  // ========================================
  { id: 'fighter_sword_common', name: 'Iron Sword', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
  { id: 'fighter_sword_uncommon', name: 'Steel Longsword', type: 'weapon', rarity: 'uncommon', cost: 35, baseStats: { attackBonus: 2, damageBonus: 2 } },
  { id: 'fighter_sword_rare', name: "Knight's Blade", type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 3, damageBonus: 3 } },
  { id: 'fighter_sword_epic', name: 'Dragonslayer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 4, damageBonus: 4 } },
  { id: 'fighter_sword_legendary', name: 'Excalibur', type: 'weapon', rarity: 'legendary', cost: 280, baseStats: { attackBonus: 5, damageBonus: 5 } },
  { id: 'fighter_sword_godly', name: 'Godsteel Blade', type: 'weapon', rarity: 'godly', cost: 600, baseStats: { attackBonus: 7, damageBonus: 7 } },
  { id: 'fighter_armor_common', name: 'Chainmail', type: 'chest', rarity: 'common', cost: 20, baseStats: { acBonus: 1 } },
  { id: 'fighter_armor_uncommon', name: 'Plate Armor', type: 'chest', rarity: 'uncommon', cost: 45, baseStats: { acBonus: 2, maxHpBonus: 2 } },
  { id: 'fighter_armor_rare', name: 'Crusader Plate', type: 'chest', rarity: 'rare', cost: 90, baseStats: { acBonus: 3, maxHpBonus: 4 } },
  { id: 'fighter_armor_epic', name: 'Dragon Scale', type: 'chest', rarity: 'epic', cost: 180, baseStats: { acBonus: 4, maxHpBonus: 6 } },
  { id: 'fighter_armor_legendary', name: "Titan's Aegis", type: 'chest', rarity: 'legendary', cost: 350, baseStats: { acBonus: 5, maxHpBonus: 8 } },
  { id: 'fighter_armor_godly', name: 'Armor of the Valkyrie', type: 'chest', rarity: 'godly', cost: 700, baseStats: { acBonus: 7, maxHpBonus: 12 } },

  // ========================================
  // 🧙 WIZARD EQUIPMENT
  // ========================================
  { id: 'wizard_staff_common', name: 'Oak Staff', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 2 } },
  { id: 'wizard_staff_uncommon', name: 'Arcane Staff', type: 'weapon', rarity: 'uncommon', cost: 30, baseStats: { attackBonus: 3, damageBonus: 1 } },
  { id: 'wizard_staff_rare', name: 'Staff of Flames', type: 'weapon', rarity: 'rare', cost: 65, baseStats: { attackBonus: 4, damageBonus: 2 } },
  { id: 'wizard_staff_epic', name: 'Voidwalker Staff', type: 'weapon', rarity: 'epic', cost: 130, baseStats: { attackBonus: 5, damageBonus: 3 } },
  { id: 'wizard_staff_legendary', name: 'Staff of Infinite Power', type: 'weapon', rarity: 'legendary', cost: 260, baseStats: { attackBonus: 6, damageBonus: 4 } },
  { id: 'wizard_staff_godly', name: 'Cosmic Conduit', type: 'weapon', rarity: 'godly', cost: 550, baseStats: { attackBonus: 8, damageBonus: 6 } },

  // ========================================
  // 🗡️ ROGUE EQUIPMENT
  // ========================================
  { id: 'rogue_dagger_common', name: 'Sharp Dagger', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 1, damageBonus: 1 } },
  { id: 'rogue_dagger_uncommon', name: 'Assassin Blade', type: 'weapon', rarity: 'uncommon', cost: 32, baseStats: { attackBonus: 2, damageBonus: 2 } },
  { id: 'rogue_dagger_rare', name: 'Shadowstrike', type: 'weapon', rarity: 'rare', cost: 68, baseStats: { attackBonus: 3, damageBonus: 3 } },
  { id: 'rogue_dagger_epic', name: 'Venom Fang', type: 'weapon', rarity: 'epic', cost: 135, baseStats: { attackBonus: 4, damageBonus: 4 } },
  { id: 'rogue_dagger_legendary', name: 'Deathwhisper', type: 'weapon', rarity: 'legendary', cost: 270, baseStats: { attackBonus: 5, damageBonus: 5 } },
  { id: 'rogue_dagger_godly', name: 'Midnight Edge', type: 'weapon', rarity: 'godly', cost: 580, baseStats: { attackBonus: 7, damageBonus: 7 } },
  { id: 'rogue_armor_common', name: 'Leather Vest', type: 'chest', rarity: 'common', cost: 18, baseStats: { acBonus: 1 } },

  // ========================================
  // ✝️ CLERIC EQUIPMENT
  // ========================================
  { id: 'cleric_mace_common', name: 'Holy Mace', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
  { id: 'cleric_mace_rare', name: 'Divine Scepter', type: 'weapon', rarity: 'rare', cost: 72, baseStats: { attackBonus: 3, damageBonus: 3 } },
  { id: 'cleric_mace_epic', name: 'Judgment', type: 'weapon', rarity: 'epic', cost: 145, baseStats: { attackBonus: 4, damageBonus: 4 } },

  // ========================================
  // 🏹 RANGER EQUIPMENT
  // ========================================
  { id: 'ranger_bow_common', name: 'Short Bow', type: 'weapon', rarity: 'common', cost: 14, baseStats: { attackBonus: 2 } },
  { id: 'ranger_bow_rare', name: 'Elven Bow', type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 4, damageBonus: 2 } },
  { id: 'ranger_bow_epic', name: 'Windpiercer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 5, damageBonus: 3 } },

  // ========================================
  // 🪖 UNIVERSAL - HEAD
  // ========================================
  { id: 'helm_common', name: 'Iron Helm', type: 'head', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
  { id: 'helm_uncommon', name: 'Steel Helm', type: 'head', rarity: 'uncommon', cost: 35, baseStats: { acBonus: 2 } },
  { id: 'helm_rare', name: "Knight's Helm", type: 'head', rarity: 'rare', cost: 70, baseStats: { acBonus: 3 } },
  { id: 'helm_epic', name: 'Dragon Helm', type: 'head', rarity: 'epic', cost: 140, baseStats: { acBonus: 4, maxHpBonus: 4 } },
  { id: 'helm_legendary', name: 'Crown of Kings', type: 'head', rarity: 'legendary', cost: 280, baseStats: { acBonus: 5, maxHpBonus: 6 } },
  { id: 'helm_godly', name: 'Halo of Divinity', type: 'head', rarity: 'godly', cost: 580, baseStats: { acBonus: 7, maxHpBonus: 10 } },

  // ========================================
  // 🛡️ UNIVERSAL - SHIELD
  // ========================================
  { id: 'shield_common', name: 'Wooden Shield', type: 'shield', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
  { id: 'shield_uncommon', name: 'Iron Shield', type: 'shield', rarity: 'uncommon', cost: 35, baseStats: { acBonus: 2 } },
  { id: 'shield_rare', name: 'Tower Shield', type: 'shield', rarity: 'rare', cost: 72, baseStats: { acBonus: 3, maxHpBonus: 2 } },
  { id: 'shield_epic', name: 'Aegis', type: 'shield', rarity: 'epic', cost: 145, baseStats: { acBonus: 4, maxHpBonus: 4 } },
  { id: 'shield_legendary', name: 'Bulwark', type: 'shield', rarity: 'legendary', cost: 290, baseStats: { acBonus: 5, maxHpBonus: 6 } },
  { id: 'shield_godly', name: 'Shield of the Gods', type: 'shield', rarity: 'godly', cost: 600, baseStats: { acBonus: 7, maxHpBonus: 10 } },

  // ========================================
  // 💍 UNIVERSAL - RING
  // ========================================
  { id: 'ring_common', name: 'Ring of Vigor', type: 'ring', rarity: 'common', cost: 18, baseStats: { maxHpBonus: 2 } },
  { id: 'ring_uncommon', name: 'Ring of Power', type: 'ring', rarity: 'uncommon', cost: 40, baseStats: { maxHpBonus: 4, damageBonus: 1 } },
  { id: 'ring_rare', name: 'Ring of Mastery', type: 'ring', rarity: 'rare', cost: 85, baseStats: { maxHpBonus: 6, damageBonus: 2 } },
  { id: 'ring_epic', name: 'Ring of Legends', type: 'ring', rarity: 'epic', cost: 170, baseStats: { maxHpBonus: 8, damageBonus: 3, attackBonus: 1 } },
  { id: 'ring_legendary', name: 'Ring of Eternity', type: 'ring', rarity: 'legendary', cost: 340, baseStats: { maxHpBonus: 10, damageBonus: 4, attackBonus: 2 } },
  { id: 'ring_godly', name: 'Godring', type: 'ring', rarity: 'godly', cost: 700, baseStats: { maxHpBonus: 15, damageBonus: 6, attackBonus: 4 } },

  // ========================================
  // 🥾 UNIVERSAL - BOOTS
  // ========================================
  { id: 'boots_common', name: 'Leather Boots', type: 'feet', rarity: 'common', cost: 12, baseStats: { maxHpBonus: 2 } },
  { id: 'boots_uncommon', name: 'Iron Boots', type: 'feet', rarity: 'uncommon', cost: 30, baseStats: { maxHpBonus: 4 } },
  { id: 'boots_rare', name: 'Boots of Speed', type: 'feet', rarity: 'rare', cost: 65, baseStats: { maxHpBonus: 6, attackBonus: 1 } },
  { id: 'boots_epic', name: 'Boots of Flight', type: 'feet', rarity: 'epic', cost: 130, baseStats: { maxHpBonus: 8, attackBonus: 2 } },
  { id: 'boots_legendary', name: 'Winged Boots', type: 'feet', rarity: 'legendary', cost: 260, baseStats: { maxHpBonus: 10, attackBonus: 3 } },
  { id: 'boots_godly', name: 'Boots of the Cosmos', type: 'feet', rarity: 'godly', cost: 550, baseStats: { maxHpBonus: 15, attackBonus: 5 } },

  // ========================================
  // 🦵 UNIVERSAL - LEGS
  // ========================================
  { id: 'legs_common', name: 'Leather Leggings', type: 'legs', rarity: 'common', cost: 14, baseStats: { acBonus: 1 } },
  { id: 'legs_uncommon', name: 'Chain Leggings', type: 'legs', rarity: 'uncommon', cost: 32, baseStats: { acBonus: 2 } },
  { id: 'legs_rare', name: 'Plated Greaves', type: 'legs', rarity: 'rare', cost: 68, baseStats: { acBonus: 3, maxHpBonus: 2 } },
  { id: 'legs_epic', name: 'Dragon Greaves', type: 'legs', rarity: 'epic', cost: 135, baseStats: { acBonus: 4, maxHpBonus: 4 } },
  { id: 'legs_legendary', name: "Titan's Legguards", type: 'legs', rarity: 'legendary', cost: 270, baseStats: { acBonus: 5, maxHpBonus: 6 } },
  { id: 'legs_godly', name: 'Celestial Greaves', type: 'legs', rarity: 'godly', cost: 580, baseStats: { acBonus: 7, maxHpBonus: 10 } },

  // ========================================
  // 📿 UNIVERSAL - NECK
  // ========================================
  { id: 'neck_common', name: 'Lucky Charm', type: 'neck', rarity: 'common', cost: 15, baseStats: { attackBonus: 1 } },
  { id: 'neck_uncommon', name: 'Amulet of Strength', type: 'neck', rarity: 'uncommon', cost: 38, baseStats: { attackBonus: 1, damageBonus: 2 } },
  { id: 'neck_rare', name: 'Amulet of Power', type: 'neck', rarity: 'rare', cost: 78, baseStats: { attackBonus: 2, damageBonus: 3 } },
  { id: 'neck_epic', name: 'Heart of the Dragon', type: 'neck', rarity: 'epic', cost: 160, baseStats: { attackBonus: 3, damageBonus: 4, maxHpBonus: 4 } },
  { id: 'neck_legendary', name: 'Star of Souls', type: 'neck', rarity: 'legendary', cost: 320, baseStats: { attackBonus: 4, damageBonus: 5, maxHpBonus: 6 } },
  { id: 'neck_godly', name: 'Divine Pendant', type: 'neck', rarity: 'godly', cost: 680, baseStats: { attackBonus: 6, damageBonus: 7, maxHpBonus: 10 } },
];

// ============================================================================
// 👥 Recruit Definitions
// ============================================================================

/**
 * Recruit definition for hireable party members.
 */
export interface RecruitDef {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Character class/role */
  role: 'fighter' | 'wizard' | 'rogue' | 'cleric';
  /** Base hiring cost (scales with segment) */
  cost: number;
  /** Flavor description */
  description: string;
  /** Level (set at runtime based on segment) */
  level?: number;
}

/**
 * Available recruits at intermission rooms.
 * 
 * Cost scaling: base cost + (segment - 1) × 15
 * 
 * @example
 * // At segment 3:
 * // Sir Roland costs 30 + (3-1) × 15 = 60 gold
 */
export const RECRUITS: RecruitDef[] = [
  { id: 'recruit_fighter', name: 'Sir Roland', role: 'fighter', cost: 30, description: 'A veteran knight seeking glory.' },
  { id: 'recruit_wizard', name: 'Elara the Wise', role: 'wizard', cost: 40, description: 'A scholar of the arcane arts.' },
  { id: 'recruit_rogue', name: 'Shadow', role: 'rogue', cost: 25, description: 'A thief with quick reflexes.' },
  { id: 'recruit_cleric', name: 'Brother Marcus', role: 'cleric', cost: 35, description: 'A holy man with healing touch.' },
  { id: 'recruit_fighter2', name: 'Greta the Strong', role: 'fighter', cost: 30, description: 'A barbarian from the north.' },
  { id: 'recruit_wizard2', name: 'Merlin Jr.', role: 'wizard', cost: 45, description: 'A prodigy of magical talent.' },
];

// ============================================================================
// 🔧 Helper Functions
// ============================================================================

/**
 * Get enemies filtered by power tier.
 * 
 * @param minPower - Minimum power level (inclusive)
 * @param maxPower - Maximum power level (inclusive)
 * @returns Filtered array of enemies
 * 
 * @example
 * const earlyEnemies = getEnemiesByPower(1, 2);
 * // Returns rats, goblins, slimes, etc.
 */
export function getEnemiesByPower(minPower: number, maxPower: number): EnemyDef[] {
  return ENEMIES.filter(e => e.power >= minPower && e.power <= maxPower);
}

/**
 * Get enemies filtered by tag.
 * 
 * @param tag - Tag to filter by (e.g., 'undead', 'beast')
 * @returns Array of enemies with matching tag
 * 
 * @example
 * const undead = getEnemiesByTag('undead');
 * // Returns skeletons, zombies, ghouls, etc.
 */
export function getEnemiesByTag(tag: string): EnemyDef[] {
  return ENEMIES.filter(e => e.tags.includes(tag));
}

/**
 * Get items filtered by rarity.
 * 
 * @param rarity - Rarity level to filter by
 * @returns Array of items with matching rarity
 * 
 * @example
 * const rareItems = getItemsByRarity('rare');
 */
export function getItemsByRarity(rarity: string): Item[] {
  return ITEMS.filter(i => i.rarity === rarity);
}

/**
 * Get items filtered by type.
 * 
 * @param type - Item type to filter by (e.g., 'weapon', 'chest')
 * @returns Array of items with matching type
 * 
 * @example
 * const weapons = getItemsByType('weapon');
 */
export function getItemsByType(type: string): Item[] {
  return ITEMS.filter(i => i.type === type);
}
