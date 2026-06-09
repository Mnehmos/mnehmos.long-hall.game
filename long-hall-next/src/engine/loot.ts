/**
 * @fileoverview Loot System - Item generation and drop mechanics
 * 
 * Provides deterministic loot generation using seeded RNG for:
 * - Rarity rolling with depth-based bonuses
 * - Item generation from content tables
 * - Gold drops based on depth and enemy power
 * - Shop inventory generation
 * - Item enhancement with prefixes/suffixes
 * 
 * ## Rarity Distribution (Base)
 * | Rarity    | Weight | Approx % |
 * |-----------|--------|----------|
 * | common    | 100    | 40%      |
 * | uncommon  | 60     | 24%      |
 * | rare      | 40     | 16%      |
 * | epic      | 25     | 10%      |
 * | legendary | 15     | 6%       |
 * | godly     | 10     | 4%       |
 * 
 * @module engine/loot
 */

import type { Item, Room } from './types';
import { SeededRNG } from '@lib/rng';
import { ITEMS, getItemsByRarity, getItemsByType } from '@content/tables';

// ─────────────────────────────────────────────────────────────
// 📊 Type Definitions
// ─────────────────────────────────────────────────────────────

/** Rarity levels from least to most rare */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'godly';

/** All rarity levels in order of increasing rarity */
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'godly'];

// ─────────────────────────────────────────────────────────────
// 📊 Loot Configuration Constants
// ─────────────────────────────────────────────────────────────

/**
 * Rarity weights (higher = more common)
 * 
 * Weights are used for weighted random selection.
 * The probability of each rarity is: weight / sum(all weights)
 */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 100,
  uncommon: 60,
  rare: 40,
  epic: 25,
  legendary: 15,
  godly: 10,
};

/**
 * Rarity gold value multipliers
 * 
 * Applied to base gold calculations for items of each rarity.
 */
export const RARITY_GOLD_MULTIPLIER: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.0,
  epic: 3.0,
  legendary: 5.0,
  godly: 10.0,
};

/**
 * Depth bonus to rarity rolls
 * 
 * Every 10 depths, rarity weights shift toward rarer items.
 * This is additive to the base weights of rarer items.
 */
const DEPTH_RARITY_BONUS_PER_10 = 5;

/**
 * Base gold drop per depth level
 * 
 * Total gold = BASE_GOLD_PER_DEPTH * depth * random(0.8, 1.2)
 */
export const BASE_GOLD_PER_DEPTH = 5;

/**
 * Enemy power gold multiplier
 * 
 * Gold = base * (1 + enemyPower * ENEMY_POWER_GOLD_MULT)
 */
const ENEMY_POWER_GOLD_MULT = 0.15;

/**
 * Combat loot drop chance (per enemy killed)
 */
const COMBAT_DROP_CHANCE = 0.35;

/**
 * Elite enemy drop chance bonus
 */
const ELITE_DROP_BONUS = 0.25;

/**
 * Hazard room guaranteed loot count range
 */
const HAZARD_LOOT_MIN = 1;
const HAZARD_LOOT_MAX = 2;

/**
 * Default shop inventory size
 */
const DEFAULT_SHOP_SIZE = 4;

// ─────────────────────────────────────────────────────────────
// 🎲 Enchantment Prefixes and Suffixes
// ─────────────────────────────────────────────────────────────

/** Prefixes for enhanced items by rarity tier */
const ITEM_PREFIXES: Record<Rarity, string[]> = {
  common: [''],
  uncommon: ['Fine', 'Quality', 'Sturdy'],
  rare: ['Superior', 'Masterwork', 'Reinforced'],
  epic: ['Enchanted', 'Mystic', 'Blessed'],
  legendary: ['Ancient', 'Heroic', 'Mythical'],
  godly: ['Divine', 'Celestial', 'Eternal'],
};

/** Suffixes for enhanced items by rarity tier */
const ITEM_SUFFIXES: Record<Rarity, string[]> = {
  common: [''],
  uncommon: ['of Might', 'of Vigor', 'of the Bear'],
  rare: ['of Power', 'of the Eagle', 'of Fortitude'],
  epic: ['of the Dragon', 'of Destruction', 'of Protection'],
  legendary: ['of the Titans', 'of Annihilation', 'of Invincibility'],
  godly: ['of the Gods', 'of Creation', 'of Eternity'],
};

// ─────────────────────────────────────────────────────────────
// 🎲 Core Loot Functions
// ─────────────────────────────────────────────────────────────

/**
 * Roll a random rarity based on weights and depth bonus.
 * 
 * Higher depths increase the chance of rarer items by adding
 * bonus weight to non-common rarities.
 * 
 * @param rng - Seeded random number generator
 * @param depth - Current dungeon depth (affects rarity bonus)
 * @returns The rolled rarity level
 * 
 * @example
 * const rng = new SeededRNG(12345);
 * const rarity = rollRarity(rng, 25);
 * // At depth 25, rare+ items are more likely
 */
export function rollRarity(rng: SeededRNG, depth: number): Rarity {
  // Calculate depth bonus (increases every 10 depths)
  const depthBonus = Math.floor(depth / 10) * DEPTH_RARITY_BONUS_PER_10;
  
  // Build weighted array with depth bonuses
  const weights: { rarity: Rarity; weight: number }[] = RARITY_ORDER.map((rarity, index) => {
    let weight = RARITY_WEIGHTS[rarity];
    
    // Apply depth bonus to non-common rarities (index > 0)
    if (index > 0) {
      weight += depthBonus * index; // Higher rarities get more bonus
    }
    
    return { rarity, weight };
  });
  
  // Calculate total weight
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  
  // Roll and find the matching rarity
  let roll = rng.int(1, totalWeight);
  
  for (const { rarity, weight } of weights) {
    roll -= weight;
    if (roll <= 0) {
      return rarity;
    }
  }
  
  // Fallback to common (should never reach here)
  return 'common';
}

/**
 * Generate a random item at the given depth.
 * 
 * Optionally filter by item slot/type. The item's rarity is rolled
 * based on depth, then a matching item is selected from the content tables.
 * 
 * @param rng - Seeded random number generator
 * @param depth - Current dungeon depth
 * @param slot - Optional slot filter (e.g., 'weapon', 'chest', 'ring')
 * @returns A generated item with stats based on rarity
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const weapon = generateItem(rng, 15, 'weapon');
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const anyItem = generateItem(rng, 20);
 */
export function generateItem(rng: SeededRNG, depth: number, slot?: string): Item {
  // Roll rarity based on depth
  const rarity = rollRarity(rng, depth);
  
  // Get items matching the rarity
  let candidates = getItemsByRarity(rarity);
  
  // Further filter by slot if specified
  if (slot && candidates.length > 0) {
    const slotFiltered = candidates.filter(item => item.type === slot);
    if (slotFiltered.length > 0) {
      candidates = slotFiltered;
    }
  }
  
  // If no candidates at this rarity, fall back to all items of that slot
  if (candidates.length === 0) {
    candidates = slot ? getItemsByType(slot) : ITEMS;
    if (candidates.length === 0) {
      candidates = ITEMS; // Ultimate fallback
    }
  }
  
  // Pick a random item from candidates
  const baseItem = rng.pick(candidates);
  
  // Create a copy with unique ID and enhanced name
  const item: Item = {
    ...baseItem,
    id: `${baseItem.id}_${rng.int(10000, 99999)}`,
    rarity, // Apply the rolled rarity
    stats: {
      kills: 0,
      damageDealt: 0,
      highestHit: 0,
      criticalHits: 0,
      encountersUsed: 0,
    },
    history: [],
  };
  
  // Enhance item with prefix/suffix for higher rarities
  if (rarity !== 'common') {
    return enhanceItem(item, rarity, rng);
  }
  
  return item;
}

/**
 * Generate gold amount based on depth and enemy power.
 * 
 * Gold scales with depth and is multiplied by enemy power.
 * A random variance of ±20% is applied.
 * 
 * @param rng - Seeded random number generator
 * @param depth - Current dungeon depth
 * @param enemyPower - Optional average enemy power for bonus gold
 * @returns Gold amount to drop
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const gold = generateGold(rng, 15, 5);
 * // ~75 base + 56% power bonus = ~117 gold ± 20%
 */
export function generateGold(rng: SeededRNG, depth: number, enemyPower: number = 1): number {
  // Base gold from depth
  const baseGold = BASE_GOLD_PER_DEPTH * Math.max(1, depth);
  
  // Power multiplier
  const powerMult = 1 + (enemyPower * ENEMY_POWER_GOLD_MULT);
  
  // Random variance (0.8 to 1.2)
  const variance = 0.8 + (rng.float() * 0.4);
  
  // Calculate final gold and round
  return Math.floor(baseGold * powerMult * variance);
}

/**
 * Generate loot for a combat room.
 * 
 * Loot is based on:
 * - Number and power of enemies
 * - Elite status (higher drop rates)
 * - Depth-based rarity scaling
 * 
 * @param rng - Seeded random number generator
 * @param room - The combat room with enemies
 * @param depth - Current dungeon depth
 * @returns Array of dropped items
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const loot = generateCombatLoot(rng, room, 20);
 */
export function generateCombatLoot(rng: SeededRNG, room: Room, depth: number): Item[] {
  const loot: Item[] = [];
  
  // Determine if this is an elite room
  const isElite = room.type === 'elite' || room.type === 'boss';
  const dropChance = COMBAT_DROP_CHANCE + (isElite ? ELITE_DROP_BONUS : 0);
  
  // Each enemy has a chance to drop loot
  for (const enemy of room.enemies) {
    if (rng.float() < dropChance) {
      // Roll item with power-based rarity bonus
      const powerBonus = Math.floor(enemy.power / 3);
      const item = generateItem(rng, depth + powerBonus);
      loot.push(item);
    }
  }
  
  // Elite/Boss rooms guarantee at least one drop
  if (isElite && loot.length === 0) {
    loot.push(generateItem(rng, depth + 5)); // Bonus depth for guaranteed drop
  }
  
  // Boss rooms drop extra loot
  if (room.type === 'boss') {
    loot.push(generateItem(rng, depth + 10));
    // Small chance for additional legendary+ item
    if (rng.float() < 0.2) {
      const bonusItem = generateItem(rng, depth + 20);
      loot.push(bonusItem);
    }
  }
  
  return loot;
}

/**
 * Generate loot for a hazard room.
 * 
 * Hazard rooms provide guaranteed loot as a reward for
 * navigating the danger. Loot quality scales with depth.
 * 
 * @param rng - Seeded random number generator
 * @param depth - Current dungeon depth
 * @returns Array of 1-2 items
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const loot = generateHazardLoot(rng, 15);
 */
export function generateHazardLoot(rng: SeededRNG, depth: number): Item[] {
  const loot: Item[] = [];
  
  // Random count between min and max
  const count = rng.int(HAZARD_LOOT_MIN, HAZARD_LOOT_MAX);
  
  for (let i = 0; i < count; i++) {
    // Hazards give slightly better loot (+3 effective depth)
    loot.push(generateItem(rng, depth + 3));
  }
  
  return loot;
}

/**
 * Generate shop inventory for trader rooms.
 * 
 * Shop items are slightly better quality than random drops
 * to incentivize spending gold. The shop always has variety
 * across different item types.
 * 
 * @param rng - Seeded random number generator
 * @param depth - Current dungeon depth
 * @param count - Number of items to stock (default: 4)
 * @returns Array of items for sale
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const shopItems = generateShopInventory(rng, 20, 6);
 */
export function generateShopInventory(rng: SeededRNG, depth: number, count: number = DEFAULT_SHOP_SIZE): Item[] {
  const inventory: Item[] = [];
  
  // Item types to ensure variety
  const itemTypes = ['weapon', 'chest', 'head', 'shield', 'ring', 'feet', 'legs', 'neck'];
  rng.shuffle(itemTypes);
  
  for (let i = 0; i < count; i++) {
    // Use item type cycling for variety
    const preferredType = itemTypes[i % itemTypes.length];
    
    // Shops have better quality items (+5 effective depth)
    const item = generateItem(rng, depth + 5, preferredType);
    
    // Adjust cost based on actual rarity
    const rarityMult = RARITY_GOLD_MULTIPLIER[item.rarity];
    item.cost = Math.floor(item.cost * rarityMult * (1 + depth * 0.02));
    
    inventory.push(item);
  }
  
  return inventory;
}

/**
 * Apply item prefixes/suffixes based on rarity.
 * 
 * Enhances an item's name and potentially its stats based
 * on the rarity tier. Higher rarities get better enhancements.
 * 
 * @param item - The item to enhance (modified in place and returned)
 * @param rarity - The rarity tier to apply
 * @param rng - Seeded random number generator for prefix/suffix selection
 * @returns The enhanced item
 * 
 * @example
 * const rng = new SeededRNG(42);
 * const item = { ...baseItem };
 * const enhanced = enhanceItem(item, 'epic', rng);
 * // "Enchanted Iron Sword of the Dragon"
 */
export function enhanceItem(item: Item, rarity: Rarity, rng: SeededRNG): Item {
  // Get available prefixes and suffixes
  const prefixes = ITEM_PREFIXES[rarity];
  const suffixes = ITEM_SUFFIXES[rarity];
  
  // Pick random prefix and suffix
  const prefix = rng.pick(prefixes);
  const suffix = rng.pick(suffixes);
  
  // Build enhanced name
  let enhancedName = item.name;
  if (prefix) {
    enhancedName = `${prefix} ${enhancedName}`;
  }
  if (suffix) {
    enhancedName = `${enhancedName} ${suffix}`;
  }
  
  // Apply name and update rarity
  item.name = enhancedName;
  item.rarity = rarity;
  
  // Calculate stat bonuses based on rarity tier
  const rarityIndex = RARITY_ORDER.indexOf(rarity);
  if (rarityIndex > 0) {
    // Clone baseStats to avoid mutation issues
    item.baseStats = { ...item.baseStats };
    
    // Bonus scaling: uncommon=1, rare=2, epic=3, legendary=4, godly=6
    const bonus = rarityIndex === 5 ? 6 : rarityIndex;
    
    // Apply bonuses to existing stats
    if (item.baseStats.attackBonus !== undefined) {
      item.baseStats.attackBonus += bonus;
    }
    if (item.baseStats.damageBonus !== undefined) {
      item.baseStats.damageBonus += bonus;
    }
    if (item.baseStats.acBonus !== undefined) {
      item.baseStats.acBonus += Math.ceil(bonus / 2);
    }
    if (item.baseStats.maxHpBonus !== undefined) {
      item.baseStats.maxHpBonus += bonus * 2;
    }
  }
  
  return item;
}

// ─────────────────────────────────────────────────────────────
// 🔧 Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get the numeric index of a rarity (for comparisons).
 * 
 * @param rarity - The rarity to get index for
 * @returns Numeric index (0 = common, 5 = godly)
 */
export function getRarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/**
 * Compare two rarities.
 * 
 * @param a - First rarity
 * @param b - Second rarity
 * @returns Negative if a < b, 0 if equal, positive if a > b
 */
export function compareRarity(a: Rarity, b: Rarity): number {
  return getRarityIndex(a) - getRarityIndex(b);
}

/**
 * Check if rarity meets a minimum threshold.
 * 
 * @param rarity - The rarity to check
 * @param minimum - The minimum required rarity
 * @returns True if rarity >= minimum
 * 
 * @example
 * meetsRarityThreshold('epic', 'rare'); // true
 * meetsRarityThreshold('common', 'rare'); // false
 */
export function meetsRarityThreshold(rarity: Rarity, minimum: Rarity): boolean {
  return compareRarity(rarity, minimum) >= 0;
}
