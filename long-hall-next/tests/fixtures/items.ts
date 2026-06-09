/**
 * Item test fixtures
 * @module tests/fixtures/items
 */
import type { Item } from '@engine/types';

let itemIdCounter = 0;

/**
 * Generate a unique item ID for testing
 */
function generateItemId(): string {
  return `item-${++itemIdCounter}-${Date.now()}`;
}

/**
 * Reset item ID counter (useful between test suites)
 */
export function resetItemIdCounter(): void {
  itemIdCounter = 0;
}

/**
 * Create a mock Item for inventory/equipment testing.
 * 
 * @param overrides - Partial Item object to override defaults
 * @returns A complete, valid Item object
 * 
 * @example
 * // Create default weapon
 * const sword = createMockItem();
 * 
 * @example
 * // Create a rare ring
 * const ring = createMockItem({
 *   name: 'Ring of Power',
 *   type: 'ring',
 *   rarity: 'rare',
 *   baseStats: { maxHpBonus: 5 }
 * });
 */
export function createMockItem(overrides: Partial<Item> = {}): Item {
  const defaultItem: Item = {
    id: generateItemId(),
    name: 'Test Sword',
    type: 'weapon',
    rarity: 'common',
    cost: 10,
    baseStats: {
      attackBonus: 1,
      damageBonus: 1,
    },
  };

  // Deep merge for baseStats
  const merged: Item = {
    ...defaultItem,
    ...overrides,
    baseStats: overrides.baseStats
      ? { ...defaultItem.baseStats, ...overrides.baseStats }
      : defaultItem.baseStats,
  };

  // Handle optional enchantment merge if provided
  if (overrides.enchantment) {
    merged.enchantment = {
      ...overrides.enchantment,
      effect: overrides.enchantment.effect 
        ? { ...overrides.enchantment.effect }
        : {},
    };
  }

  // Handle optional stats merge if provided
  if (overrides.stats) {
    merged.stats = { ...overrides.stats };
  }

  // Handle optional history array if provided
  if (overrides.history) {
    merged.history = [...overrides.history];
  }

  return merged;
}

/**
 * Create a mock weapon with combat-focused stats.
 * 
 * @param overrides - Partial Item to override defaults
 * @returns A weapon Item
 */
export function createMockWeapon(overrides: Partial<Item> = {}): Item {
  return createMockItem({
    name: 'Test Longsword',
    type: 'weapon',
    baseStats: {
      attackBonus: 2,
      damageBonus: 2,
    },
    ...overrides,
  });
}

/**
 * Create a mock armor piece.
 * 
 * @param overrides - Partial Item to override defaults
 * @returns An armor Item
 */
export function createMockArmor(overrides: Partial<Item> = {}): Item {
  return createMockItem({
    name: 'Test Chainmail',
    type: 'armor',
    baseStats: {
      acBonus: 2,
    },
    ...overrides,
  });
}

/**
 * Create a mock shield.
 * 
 * @param overrides - Partial Item to override defaults
 * @returns A shield Item
 */
export function createMockShield(overrides: Partial<Item> = {}): Item {
  return createMockItem({
    name: 'Test Shield',
    type: 'shield',
    baseStats: {
      acBonus: 1,
    },
    ...overrides,
  });
}

/**
 * Create a mock ring with utility enchantment.
 * 
 * @param overrides - Partial Item to override defaults
 * @returns A ring Item
 */
export function createMockRing(overrides: Partial<Item> = {}): Item {
  return createMockItem({
    name: 'Test Ring',
    type: 'ring',
    baseStats: {},
    ...overrides,
  });
}

/**
 * Create an enchanted item for testing enchantment effects.
 * 
 * @param baseType - Type of item to create
 * @param tier - Enchantment tier (1-6)
 * @returns An enchanted Item
 */
export function createEnchantedItem(
  baseType: Item['type'] = 'weapon',
  tier: 1 | 2 | 3 | 4 | 5 | 6 = 2
): Item {
  const tierNames = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Godly'];
  const rarityMap: Record<number, Item['rarity']> = {
    1: 'common',
    2: 'uncommon',
    3: 'rare',
    4: 'epic',
    5: 'legendary',
    6: 'godly',
  };

  return createMockItem({
    type: baseType,
    rarity: rarityMap[tier],
    enchantment: {
      tier,
      name: `${tierNames[tier - 1]} Enchantment`,
      description: `A ${tierNames[tier - 1].toLowerCase()} magical effect`,
      effect: {
        attackBonus: tier,
        damageBonus: tier,
      },
    },
  });
}

/**
 * Create a loot table for room rewards.
 * 
 * @param count - Number of items to create
 * @param rarity - Minimum rarity for all items
 * @returns Array of Item objects
 */
export function createLootTable(
  count: number,
  rarity: Item['rarity'] = 'common'
): Item[] {
  const types: Item['type'][] = ['weapon', 'armor', 'ring', 'shield'];
  
  return Array.from({ length: count }, (_, i) => 
    createMockItem({
      name: `Loot Item ${i + 1}`,
      type: types[i % types.length],
      rarity,
    })
  );
}
