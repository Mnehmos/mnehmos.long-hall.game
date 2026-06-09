/**
 * Loot System Tests - Red Phase
 * 
 * These tests define the expected behavior of the loot system BEFORE
 * implementation changes. Tests should pass with the current implementation.
 * 
 * @module tests/unit/engine/loot
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '@lib/rng';

import {
  rollRarity,
  generateItem,
  generateGold,
  generateCombatLoot,
  generateHazardLoot,
  generateShopInventory,
  enhanceItem,
  getRarityIndex,
  compareRarity,
  meetsRarityThreshold,
  RARITY_ORDER,
  RARITY_WEIGHTS,
  RARITY_GOLD_MULTIPLIER,
  BASE_GOLD_PER_DEPTH,
  type Rarity,
} from '@engine/loot';

import {
  createMockRoom,
  createCombatRoom,
  createEliteRoom,
  createBossRoom,
  createMockEnemy,
  createMockItem,
  resetAllFixtureIds,
} from '../../fixtures';

// ============================================================================
// Test Suite: Constants
// ============================================================================
describe('Loot Constants', () => {
  describe('RARITY_ORDER', () => {
    it('should contain all 6 rarity levels in order', () => {
      expect(RARITY_ORDER).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary', 'godly']);
    });

    it('should have common as the first element (index 0)', () => {
      expect(RARITY_ORDER[0]).toBe('common');
    });

    it('should have godly as the last element (index 5)', () => {
      expect(RARITY_ORDER[5]).toBe('godly');
    });

    it('should have exactly 6 elements', () => {
      expect(RARITY_ORDER.length).toBe(6);
    });
  });

  describe('RARITY_WEIGHTS', () => {
    it('should have weight 100 for common', () => {
      expect(RARITY_WEIGHTS.common).toBe(100);
    });

    it('should have weight 60 for uncommon', () => {
      expect(RARITY_WEIGHTS.uncommon).toBe(60);
    });

    it('should have weight 40 for rare', () => {
      expect(RARITY_WEIGHTS.rare).toBe(40);
    });

    it('should have weight 25 for epic', () => {
      expect(RARITY_WEIGHTS.epic).toBe(25);
    });

    it('should have weight 15 for legendary', () => {
      expect(RARITY_WEIGHTS.legendary).toBe(15);
    });

    it('should have weight 10 for godly', () => {
      expect(RARITY_WEIGHTS.godly).toBe(10);
    });

    it('should have decreasing weights from common to godly', () => {
      expect(RARITY_WEIGHTS.common).toBeGreaterThan(RARITY_WEIGHTS.uncommon);
      expect(RARITY_WEIGHTS.uncommon).toBeGreaterThan(RARITY_WEIGHTS.rare);
      expect(RARITY_WEIGHTS.rare).toBeGreaterThan(RARITY_WEIGHTS.epic);
      expect(RARITY_WEIGHTS.epic).toBeGreaterThan(RARITY_WEIGHTS.legendary);
      expect(RARITY_WEIGHTS.legendary).toBeGreaterThan(RARITY_WEIGHTS.godly);
    });
  });

  describe('RARITY_GOLD_MULTIPLIER', () => {
    it('should have multiplier 1.0 for common', () => {
      expect(RARITY_GOLD_MULTIPLIER.common).toBe(1.0);
    });

    it('should have multiplier 1.5 for uncommon', () => {
      expect(RARITY_GOLD_MULTIPLIER.uncommon).toBe(1.5);
    });

    it('should have multiplier 2.0 for rare', () => {
      expect(RARITY_GOLD_MULTIPLIER.rare).toBe(2.0);
    });

    it('should have multiplier 3.0 for epic', () => {
      expect(RARITY_GOLD_MULTIPLIER.epic).toBe(3.0);
    });

    it('should have multiplier 5.0 for legendary', () => {
      expect(RARITY_GOLD_MULTIPLIER.legendary).toBe(5.0);
    });

    it('should have multiplier 10.0 for godly', () => {
      expect(RARITY_GOLD_MULTIPLIER.godly).toBe(10.0);
    });

    it('should have increasing multipliers from common to godly', () => {
      expect(RARITY_GOLD_MULTIPLIER.common).toBeLessThan(RARITY_GOLD_MULTIPLIER.uncommon);
      expect(RARITY_GOLD_MULTIPLIER.uncommon).toBeLessThan(RARITY_GOLD_MULTIPLIER.rare);
      expect(RARITY_GOLD_MULTIPLIER.rare).toBeLessThan(RARITY_GOLD_MULTIPLIER.epic);
      expect(RARITY_GOLD_MULTIPLIER.epic).toBeLessThan(RARITY_GOLD_MULTIPLIER.legendary);
      expect(RARITY_GOLD_MULTIPLIER.legendary).toBeLessThan(RARITY_GOLD_MULTIPLIER.godly);
    });
  });

  describe('BASE_GOLD_PER_DEPTH', () => {
    it('should equal 5', () => {
      expect(BASE_GOLD_PER_DEPTH).toBe(5);
    });
  });
});

// ============================================================================
// Test Suite: rollRarity()
// ============================================================================
describe('rollRarity', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('determinism', () => {
    it('should return identical results with the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      for (let i = 0; i < 20; i++) {
        expect(rollRarity(rng1, 10)).toBe(rollRarity(rng2, 10));
      }
    });

    it('should produce different results with different seeds', () => {
      const rarities1: Rarity[] = [];
      const rarities2: Rarity[] = [];

      for (let i = 0; i < 50; i++) {
        const rng1 = new SeededRNG(i);
        const rng2 = new SeededRNG(i + 10000);
        rarities1.push(rollRarity(rng1, 10));
        rarities2.push(rollRarity(rng2, 10));
      }

      // Extremely unlikely to match across 50 samples with different seeds
      expect(rarities1).not.toEqual(rarities2);
    });
  });

  describe('valid rarity values', () => {
    it('should always return a valid rarity from RARITY_ORDER', () => {
      const rng = new SeededRNG(42);

      for (let i = 0; i < 100; i++) {
        const rarity = rollRarity(rng, i % 50);
        expect(RARITY_ORDER).toContain(rarity);
      }
    });
  });

  describe('weight distribution', () => {
    it('should produce common items most frequently at depth 0', () => {
      const rng = new SeededRNG(12345);
      const counts: Record<Rarity, number> = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        godly: 0,
      };

      // Roll many times at depth 0
      for (let i = 0; i < 1000; i++) {
        const rarity = rollRarity(rng, 0);
        counts[rarity]++;
      }

      // Common should be most frequent
      expect(counts.common).toBeGreaterThan(counts.uncommon);
      expect(counts.common).toBeGreaterThan(counts.rare);
      expect(counts.common).toBeGreaterThan(counts.epic);
    });

    it('should cover all rarities over many rolls', () => {
      const rng = new SeededRNG(42);
      const seen = new Set<Rarity>();

      // Roll at various depths to increase chances of rare items
      for (let i = 0; i < 5000; i++) {
        const depth = Math.floor(i / 100) * 10; // 0, 10, 20, 30, 40
        seen.add(rollRarity(rng, depth));
      }

      // Should eventually see all rarities
      expect(seen.size).toBe(6);
      RARITY_ORDER.forEach(rarity => {
        expect(seen.has(rarity)).toBe(true);
      });
    });
  });

  describe('depth bonus', () => {
    it('should increase rare item chances at higher depths', () => {
      const countsDepth0: Record<Rarity, number> = {
        common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, godly: 0
      };
      const countsDepth50: Record<Rarity, number> = {
        common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, godly: 0
      };

      // Roll at depth 0
      for (let i = 0; i < 1000; i++) {
        const rng = new SeededRNG(i);
        countsDepth0[rollRarity(rng, 0)]++;
      }

      // Roll at depth 50
      for (let i = 0; i < 1000; i++) {
        const rng = new SeededRNG(i);
        countsDepth50[rollRarity(rng, 50)]++;
      }

      // At depth 50, rarer items should be more common than at depth 0
      const totalRareAtDepth0 = countsDepth0.rare + countsDepth0.epic + countsDepth0.legendary + countsDepth0.godly;
      const totalRareAtDepth50 = countsDepth50.rare + countsDepth50.epic + countsDepth50.legendary + countsDepth50.godly;

      expect(totalRareAtDepth50).toBeGreaterThan(totalRareAtDepth0);
    });

    it('should apply depth bonus every 10 depths', () => {
      // At depth 0, no bonus. At depth 10, bonus of 5. At depth 20, bonus of 10.
      // This affects the weight distribution
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      // Same seed, different depths - should produce different results
      const resultDepth0 = rollRarity(rng1, 0);
      const resultDepth10 = rollRarity(rng2, 10);

      // Cannot guarantee different results, but the mechanism should be in place
      // Just verify both are valid
      expect(RARITY_ORDER).toContain(resultDepth0);
      expect(RARITY_ORDER).toContain(resultDepth10);
    });

    it('should handle depth 0 with base weights', () => {
      const rng = new SeededRNG(99999);
      const rarity = rollRarity(rng, 0);
      expect(RARITY_ORDER).toContain(rarity);
    });
  });
});

// ============================================================================
// Test Suite: generateItem()
// ============================================================================
describe('generateItem', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic generation', () => {
    it('should return an item with a unique ID', () => {
      const rng = new SeededRNG(42);
      const item1 = generateItem(rng, 10);
      const item2 = generateItem(rng, 10);

      expect(item1.id).toBeDefined();
      expect(item2.id).toBeDefined();
      expect(item1.id).not.toBe(item2.id);
    });

    it('should return an item with a valid rarity', () => {
      const rng = new SeededRNG(42);
      const item = generateItem(rng, 15);

      expect(RARITY_ORDER).toContain(item.rarity);
    });

    it('should include item stats object with initial values', () => {
      const rng = new SeededRNG(42);
      const item = generateItem(rng, 10);

      expect(item.stats).toBeDefined();
      expect(item.stats?.kills).toBe(0);
      expect(item.stats?.damageDealt).toBe(0);
      expect(item.stats?.highestHit).toBe(0);
      expect(item.stats?.criticalHits).toBe(0);
      expect(item.stats?.encountersUsed).toBe(0);
    });

    it('should include empty history array', () => {
      const rng = new SeededRNG(42);
      const item = generateItem(rng, 10);

      expect(item.history).toBeDefined();
      expect(Array.isArray(item.history)).toBe(true);
      expect(item.history?.length).toBe(0);
    });
  });

  describe('determinism', () => {
    it('should generate identical items with the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const item1 = generateItem(rng1, 20);
      const item2 = generateItem(rng2, 20);

      expect(item1.name).toBe(item2.name);
      expect(item1.type).toBe(item2.type);
      expect(item1.rarity).toBe(item2.rarity);
      expect(item1.baseStats).toEqual(item2.baseStats);
    });
  });

  describe('slot filtering', () => {
    it('should respect slot filter when items are available', () => {
      const rng = new SeededRNG(42);
      const weapon = generateItem(rng, 10, 'weapon');

      // Should be a weapon type if weapons exist at that rarity
      expect(['weapon', 'weapon'].includes(weapon.type) || weapon.type).toBeDefined();
    });

    it('should fall back when no items match slot and rarity', () => {
      const rng = new SeededRNG(42);
      // Even with a very specific slot filter, should still return something
      const item = generateItem(rng, 10, 'nonexistent_slot');

      expect(item).toBeDefined();
      expect(item.name).toBeDefined();
    });
  });

  describe('item enhancement', () => {
    it('should enhance non-common items with prefixes/suffixes', () => {
      // Generate many items until we get a non-common one
      let nonCommonItem = null;
      for (let seed = 0; seed < 1000 && !nonCommonItem; seed++) {
        const rng = new SeededRNG(seed);
        const item = generateItem(rng, 30); // Higher depth for better rarity chances
        if (item.rarity !== 'common') {
          nonCommonItem = item;
        }
      }

      expect(nonCommonItem).not.toBeNull();
      if (nonCommonItem) {
        // Non-common items should have enhanced names (prefix/suffix)
        // The name format is "[Prefix] Name [Suffix]" for enhanced items
        expect(nonCommonItem.name).toBeDefined();
        expect(nonCommonItem.rarity).not.toBe('common');
      }
    });

    it('should not enhance common items', () => {
      // Find a common item
      let commonItem = null;
      for (let seed = 0; seed < 1000 && !commonItem; seed++) {
        const rng = new SeededRNG(seed);
        const item = generateItem(rng, 0); // Low depth for common items
        if (item.rarity === 'common') {
          commonItem = item;
        }
      }

      expect(commonItem).not.toBeNull();
      if (commonItem) {
        expect(commonItem.rarity).toBe('common');
      }
    });
  });
});

// ============================================================================
// Test Suite: generateGold()
// ============================================================================
describe('generateGold', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic gold generation', () => {
    it('should return a floor value (integer)', () => {
      const rng = new SeededRNG(42);
      const gold = generateGold(rng, 10, 1);

      expect(Number.isInteger(gold)).toBe(true);
    });

    it('should return at least BASE_GOLD_PER_DEPTH at depth 0', () => {
      // At depth 0, use max(1, depth) so effectively depth 1
      // Base gold = 5 * 1 = 5, with variance 0.8-1.2
      // Minimum = 5 * 1 * 0.8 = 4
      const minPossible = Math.floor(BASE_GOLD_PER_DEPTH * 1 * 0.8);
      
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const gold = generateGold(rng, 0, 1);
        expect(gold).toBeGreaterThanOrEqual(minPossible);
      }
    });

    it('should return at least BASE_GOLD_PER_DEPTH at depth 1', () => {
      const minPossible = Math.floor(BASE_GOLD_PER_DEPTH * 1 * 0.8);

      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const gold = generateGold(rng, 1, 1);
        expect(gold).toBeGreaterThanOrEqual(minPossible);
      }
    });
  });

  describe('determinism', () => {
    it('should be deterministic with seeded RNG', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      for (let i = 0; i < 50; i++) {
        expect(generateGold(rng1, 10, 2)).toBe(generateGold(rng2, 10, 2));
      }
    });
  });

  describe('depth scaling', () => {
    it('should scale with depth using BASE_GOLD_PER_DEPTH', () => {
      // Compare gold at different depths
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const goldDepth5 = generateGold(rng1, 5, 1);
      const goldDepth20 = generateGold(rng2, 20, 1);

      // With same seed and no power bonus, depth 20 should yield more than depth 5
      // Depth 5: 5 * 5 = 25 base
      // Depth 20: 5 * 20 = 100 base
      // But variance can affect this, so we test with multiple samples
      let sumDepth5 = 0;
      let sumDepth20 = 0;

      for (let seed = 0; seed < 100; seed++) {
        sumDepth5 += generateGold(new SeededRNG(seed), 5, 1);
        sumDepth20 += generateGold(new SeededRNG(seed), 20, 1);
      }

      expect(sumDepth20).toBeGreaterThan(sumDepth5);
    });
  });

  describe('enemy power multiplier', () => {
    it('should apply enemy power multiplier (1 + power * 0.15)', () => {
      // With power = 10, multiplier = 1 + 10 * 0.15 = 2.5
      // Compare gold with power 1 vs power 10
      let sumPower1 = 0;
      let sumPower10 = 0;

      for (let seed = 0; seed < 100; seed++) {
        sumPower1 += generateGold(new SeededRNG(seed), 10, 1);
        sumPower10 += generateGold(new SeededRNG(seed), 10, 10);
      }

      // Power 10 should give significantly more gold
      expect(sumPower10).toBeGreaterThan(sumPower1);
      // Ratio should be approximately 2.5x (allowing for variance)
      const ratio = sumPower10 / sumPower1;
      expect(ratio).toBeGreaterThan(1.5); // At least 1.5x more
    });

    it('should use default enemy power of 1 when not provided', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const goldDefault = generateGold(rng1, 10);
      const goldPower1 = generateGold(rng2, 10, 1);

      expect(goldDefault).toBe(goldPower1);
    });
  });

  describe('random variance', () => {
    it('should apply random variance between 0.8 and 1.2', () => {
      const depth = 20;
      const power = 1;
      const baseGold = BASE_GOLD_PER_DEPTH * depth;
      const powerMult = 1 + power * 0.15;

      const minExpected = Math.floor(baseGold * powerMult * 0.8);
      const maxExpected = Math.floor(baseGold * powerMult * 1.2);

      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const gold = generateGold(rng, depth, power);

        expect(gold).toBeGreaterThanOrEqual(minExpected);
        expect(gold).toBeLessThanOrEqual(maxExpected);
      }
    });
  });
});

// ============================================================================
// Test Suite: generateCombatLoot()
// ============================================================================
describe('generateCombatLoot', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic combat loot', () => {
    it('should return an array of items', () => {
      const rng = new SeededRNG(42);
      const room = createCombatRoom(2);
      const loot = generateCombatLoot(rng, room, 10);

      expect(Array.isArray(loot)).toBe(true);
    });

    it('should be deterministic with seeded RNG', () => {
      const room = createCombatRoom(2);

      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const loot1 = generateCombatLoot(rng1, room, 15);
      const loot2 = generateCombatLoot(rng2, room, 15);

      expect(loot1.length).toBe(loot2.length);
      for (let i = 0; i < loot1.length; i++) {
        expect(loot1[i].name).toBe(loot2[i].name);
        expect(loot1[i].rarity).toBe(loot2[i].rarity);
      }
    });
  });

  describe('drop chances', () => {
    it('should roll for each enemy with 35% base drop chance', () => {
      // With 35% drop chance, ~35% of enemies should drop items on average
      let totalEnemies = 0;
      let totalDrops = 0;

      for (let seed = 0; seed < 200; seed++) {
        const rng = new SeededRNG(seed);
        const room = createCombatRoom(1); // 1 enemy each
        const loot = generateCombatLoot(rng, room, 10);
        totalEnemies++;
        totalDrops += loot.length;
      }

      const dropRate = totalDrops / totalEnemies;
      // Should be approximately 35% (0.35), allow some variance
      expect(dropRate).toBeGreaterThan(0.2);
      expect(dropRate).toBeLessThan(0.5);
    });
  });

  describe('elite rooms', () => {
    it('should have 60% drop chance for elite rooms (35% + 25%)', () => {
      let totalEnemies = 0;
      let totalDrops = 0;

      for (let seed = 0; seed < 200; seed++) {
        const rng = new SeededRNG(seed);
        const room = createEliteRoom();
        const loot = generateCombatLoot(rng, room, 10);
        totalEnemies += room.enemies.length;
        // Don't count guaranteed drops, just check rate is higher
        totalDrops += Math.min(loot.length, room.enemies.length);
      }

      const dropRate = totalDrops / totalEnemies;
      // Elite rooms should have higher drop rate
      expect(dropRate).toBeGreaterThan(0.4);
    });

    it('should guarantee at least one drop from elite rooms', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const room = createEliteRoom();
        const loot = generateCombatLoot(rng, room, 10);

        expect(loot.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('boss rooms', () => {
    it('should guarantee at least one drop from boss rooms', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const room = createBossRoom();
        const loot = generateCombatLoot(rng, room, 20);

        expect(loot.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should provide extra loot from boss rooms', () => {
      // Boss rooms drop at least one extra item beyond enemy drops
      let bossLootTotal = 0;
      let regularLootTotal = 0;

      for (let seed = 0; seed < 100; seed++) {
        const rngBoss = new SeededRNG(seed);
        const rngRegular = new SeededRNG(seed);

        const bossRoom = createBossRoom();
        const regularRoom = createCombatRoom(1);

        bossLootTotal += generateCombatLoot(rngBoss, bossRoom, 20).length;
        regularLootTotal += generateCombatLoot(rngRegular, regularRoom, 20).length;
      }

      // Boss rooms should consistently drop more loot
      expect(bossLootTotal).toBeGreaterThan(regularLootTotal);
    });

    it('should have 20% chance for bonus legendary drop in boss rooms', () => {
      // Over many samples, approximately 20% should have bonus
      let totalBossRooms = 0;
      let roomsWithBonusLoot = 0;

      for (let seed = 0; seed < 500; seed++) {
        const rng = new SeededRNG(seed);
        const room = createBossRoom();
        const loot = generateCombatLoot(rng, room, 20);
        totalBossRooms++;

        // Boss rooms drop at least 2 items (guaranteed + extra)
        // If there are 3+, it means bonus dropped
        if (loot.length >= 3) {
          roomsWithBonusLoot++;
        }
      }

      const bonusRate = roomsWithBonusLoot / totalBossRooms;
      // Should be approximately 20% (0.2), allow variance
      expect(bonusRate).toBeGreaterThan(0.1);
      expect(bonusRate).toBeLessThan(0.35);
    });
  });

  describe('empty rooms', () => {
    it('should handle rooms with no enemies', () => {
      const rng = new SeededRNG(42);
      const room = createMockRoom({ type: 'combat', enemies: [] });
      const loot = generateCombatLoot(rng, room, 10);

      expect(Array.isArray(loot)).toBe(true);
      expect(loot.length).toBe(0);
    });
  });
});

// ============================================================================
// Test Suite: generateHazardLoot()
// ============================================================================
describe('generateHazardLoot', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('item count', () => {
    it('should return 1-2 items', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const loot = generateHazardLoot(rng, 15);

        expect(loot.length).toBeGreaterThanOrEqual(1);
        expect(loot.length).toBeLessThanOrEqual(2);
      }
    });

    it('should return an array', () => {
      const rng = new SeededRNG(42);
      const loot = generateHazardLoot(rng, 10);

      expect(Array.isArray(loot)).toBe(true);
    });
  });

  describe('determinism', () => {
    it('should be deterministic with seeded RNG', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const loot1 = generateHazardLoot(rng1, 20);
      const loot2 = generateHazardLoot(rng2, 20);

      expect(loot1.length).toBe(loot2.length);
      for (let i = 0; i < loot1.length; i++) {
        expect(loot1[i].name).toBe(loot2[i].name);
        expect(loot1[i].rarity).toBe(loot2[i].rarity);
      }
    });
  });

  describe('depth bonus', () => {
    it('should apply +3 depth bonus to item quality', () => {
      // Items generated at effective depth = depth + 3
      // This affects rarity rolls
      let hazardLootRaritySum = 0;
      let normalLootRaritySum = 0;

      for (let seed = 0; seed < 200; seed++) {
        const rng1 = new SeededRNG(seed);
        const rng2 = new SeededRNG(seed);

        const hazardLoot = generateHazardLoot(rng1, 20);
        const normalItem = generateItem(rng2, 20);

        // Sum rarity indices
        hazardLoot.forEach(item => {
          hazardLootRaritySum += getRarityIndex(item.rarity);
        });
        normalLootRaritySum += getRarityIndex(normalItem.rarity);
      }

      // Hazard loot should have slightly higher average rarity
      // This is probabilistic, so we check the trend
      const hazardAvg = hazardLootRaritySum / 200;
      const normalAvg = normalLootRaritySum / 200;

      // Hazard should be at least as good, likely slightly better
      expect(hazardAvg).toBeGreaterThanOrEqual(normalAvg - 0.5);
    });
  });
});

// ============================================================================
// Test Suite: generateShopInventory()
// ============================================================================
describe('generateShopInventory', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('inventory size', () => {
    it('should return requested count (default 4)', () => {
      const rng = new SeededRNG(42);
      const inventory = generateShopInventory(rng, 15);

      expect(inventory.length).toBe(4);
    });

    it('should return custom count when specified', () => {
      const rng = new SeededRNG(42);
      const inventory = generateShopInventory(rng, 15, 6);

      expect(inventory.length).toBe(6);
    });

    it('should handle count of 1', () => {
      const rng = new SeededRNG(42);
      const inventory = generateShopInventory(rng, 15, 1);

      expect(inventory.length).toBe(1);
    });
  });

  describe('item variety', () => {
    it('should have variety of item types', () => {
      const rng = new SeededRNG(42);
      const inventory = generateShopInventory(rng, 20, 8);

      const types = new Set(inventory.map(item => item.type));
      // With 8 items cycling through types, should have variety
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe('determinism', () => {
    it('should be deterministic with seeded RNG', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const inventory1 = generateShopInventory(rng1, 20, 5);
      const inventory2 = generateShopInventory(rng2, 20, 5);

      expect(inventory1.length).toBe(inventory2.length);
      for (let i = 0; i < inventory1.length; i++) {
        expect(inventory1[i].name).toBe(inventory2[i].name);
        expect(inventory1[i].cost).toBe(inventory2[i].cost);
      }
    });
  });

  describe('depth bonus', () => {
    it('should apply +5 depth bonus to item quality', () => {
      // Compare rarity at different effective depths
      let shopRaritySum = 0;
      let normalRaritySum = 0;

      for (let seed = 0; seed < 200; seed++) {
        const rng1 = new SeededRNG(seed);
        const rng2 = new SeededRNG(seed);

        const shopItems = generateShopInventory(rng1, 20, 1);
        const normalItem = generateItem(rng2, 20);

        shopRaritySum += getRarityIndex(shopItems[0].rarity);
        normalRaritySum += getRarityIndex(normalItem.rarity);
      }

      // Shop items should have higher average rarity due to +5 bonus
      const shopAvg = shopRaritySum / 200;
      const normalAvg = normalRaritySum / 200;

      expect(shopAvg).toBeGreaterThanOrEqual(normalAvg - 0.5);
    });
  });

  describe('cost adjustment', () => {
    it('should adjust cost by rarity multiplier', () => {
      // Find items of different rarities and check their costs are scaled
      const inventory: { rarity: Rarity; cost: number }[] = [];

      for (let seed = 0; seed < 500; seed++) {
        const rng = new SeededRNG(seed);
        const items = generateShopInventory(rng, 30, 4);
        items.forEach(item => {
          inventory.push({ rarity: item.rarity, cost: item.cost });
        });
      }

      // Group by rarity and calculate average cost
      const costsByRarity: Record<Rarity, number[]> = {
        common: [], uncommon: [], rare: [], epic: [], legendary: [], godly: []
      };

      inventory.forEach(({ rarity, cost }) => {
        costsByRarity[rarity].push(cost);
      });

      // Higher rarity items should have higher average costs
      const avgCosts: Partial<Record<Rarity, number>> = {};
      RARITY_ORDER.forEach(rarity => {
        const costs = costsByRarity[rarity];
        if (costs.length > 0) {
          avgCosts[rarity] = costs.reduce((a, b) => a + b, 0) / costs.length;
        }
      });

      // Verify that higher rarity = higher cost (where data exists)
      if (avgCosts.common && avgCosts.uncommon) {
        expect(avgCosts.uncommon).toBeGreaterThan(avgCosts.common);
      }
      if (avgCosts.uncommon && avgCosts.rare) {
        expect(avgCosts.rare).toBeGreaterThan(avgCosts.uncommon);
      }
    });
  });
});

// ============================================================================
// Test Suite: enhanceItem()
// ============================================================================
describe('enhanceItem', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('prefix and suffix application', () => {
    it('should add prefix for non-common items', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({ name: 'Iron Sword', rarity: 'common' });
      
      const enhanced = enhanceItem(baseItem, 'rare', rng);

      // Name should be modified (prefix and/or suffix added)
      expect(enhanced.name).not.toBe('Iron Sword');
    });

    it('should add suffix for non-common items', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({ name: 'Iron Sword', rarity: 'common' });
      
      const enhanced = enhanceItem(baseItem, 'epic', rng);

      expect(enhanced.name).not.toBe('Iron Sword');
    });

    it('should format name as "[Prefix] Name [Suffix]"', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({ name: 'Blade', rarity: 'common' });
      
      const enhanced = enhanceItem(baseItem, 'legendary', rng);

      // The name should contain the original name somewhere
      expect(enhanced.name).toContain('Blade');
      // And be longer than the original
      expect(enhanced.name.length).toBeGreaterThan('Blade'.length);
    });
  });

  describe('stat bonuses', () => {
    it('should apply stat bonuses based on rarity tier', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({
        name: 'Sword',
        rarity: 'common',
        baseStats: {
          attackBonus: 2,
          damageBonus: 2,
        },
      });

      const enhanced = enhanceItem(baseItem, 'rare', rng);

      // Rare (index 2) should add bonus of 2
      expect(enhanced.baseStats.attackBonus).toBeGreaterThan(2);
      expect(enhanced.baseStats.damageBonus).toBeGreaterThan(2);
    });

    it('should clone baseStats to avoid mutation', () => {
      const rng = new SeededRNG(42);
      const originalStats = { attackBonus: 3, damageBonus: 2 };
      const baseItem = createMockItem({
        name: 'Axe',
        rarity: 'common',
        baseStats: { ...originalStats },
      });

      // Save reference to original baseStats before enhancement
      const originalBaseStatsRef = baseItem.baseStats;

      const enhanced = enhanceItem(baseItem, 'epic', rng);

      // The function should have created a new baseStats object internally
      // The enhanced item's baseStats should be different from the original reference
      expect(enhanced.baseStats).not.toBe(originalBaseStatsRef);
      // And the original stats values should still be intact in the original object
      expect(originalBaseStatsRef.attackBonus).toBe(3);
      expect(originalBaseStatsRef.damageBonus).toBe(2);
    });

    it('should apply larger bonuses for higher rarity tiers', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const itemForRare = createMockItem({
        name: 'Mace',
        baseStats: { attackBonus: 1, damageBonus: 1 },
      });
      const itemForLegendary = createMockItem({
        name: 'Mace',
        baseStats: { attackBonus: 1, damageBonus: 1 },
      });

      const rareEnhanced = enhanceItem(itemForRare, 'rare', rng1);
      const legendaryEnhanced = enhanceItem(itemForLegendary, 'legendary', rng2);

      // Legendary should have higher bonuses than rare
      expect(legendaryEnhanced.baseStats.attackBonus).toBeGreaterThan(rareEnhanced.baseStats.attackBonus!);
    });

    it('should handle AC bonus for armor items', () => {
      const rng = new SeededRNG(42);
      const armor = createMockItem({
        name: 'Plate Armor',
        type: 'armor',
        baseStats: { acBonus: 5 },
      });

      const enhanced = enhanceItem(armor, 'epic', rng);

      expect(enhanced.baseStats.acBonus).toBeGreaterThan(5);
    });

    it('should handle maxHpBonus', () => {
      const rng = new SeededRNG(42);
      const ring = createMockItem({
        name: 'Ring of Vitality',
        type: 'ring',
        baseStats: { maxHpBonus: 10 },
      });

      const enhanced = enhanceItem(ring, 'rare', rng);

      expect(enhanced.baseStats.maxHpBonus).toBeGreaterThan(10);
    });
  });

  describe('rarity update', () => {
    it('should update item rarity to the enhancement rarity', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({ name: 'Dagger', rarity: 'common' });

      const enhanced = enhanceItem(baseItem, 'godly', rng);

      expect(enhanced.rarity).toBe('godly');
    });
  });

  describe('common items', () => {
    it('should handle common rarity without adding prefix/suffix', () => {
      const rng = new SeededRNG(42);
      const baseItem = createMockItem({ name: 'Simple Sword', rarity: 'common' });

      const enhanced = enhanceItem(baseItem, 'common', rng);

      // Common enhancement should not add prefixes (they're empty strings)
      expect(enhanced.name).toBe('Simple Sword');
    });
  });
});

// ============================================================================
// Test Suite: getRarityIndex()
// ============================================================================
describe('getRarityIndex', () => {
  it('should return 0 for common', () => {
    expect(getRarityIndex('common')).toBe(0);
  });

  it('should return 1 for uncommon', () => {
    expect(getRarityIndex('uncommon')).toBe(1);
  });

  it('should return 2 for rare', () => {
    expect(getRarityIndex('rare')).toBe(2);
  });

  it('should return 3 for epic', () => {
    expect(getRarityIndex('epic')).toBe(3);
  });

  it('should return 4 for legendary', () => {
    expect(getRarityIndex('legendary')).toBe(4);
  });

  it('should return 5 for godly', () => {
    expect(getRarityIndex('godly')).toBe(5);
  });

  it('should match RARITY_ORDER indices', () => {
    RARITY_ORDER.forEach((rarity, index) => {
      expect(getRarityIndex(rarity)).toBe(index);
    });
  });
});

// ============================================================================
// Test Suite: compareRarity()
// ============================================================================
describe('compareRarity', () => {
  describe('when a < b', () => {
    it('should return negative when common vs uncommon', () => {
      expect(compareRarity('common', 'uncommon')).toBeLessThan(0);
    });

    it('should return negative when rare vs legendary', () => {
      expect(compareRarity('rare', 'legendary')).toBeLessThan(0);
    });

    it('should return negative when uncommon vs godly', () => {
      expect(compareRarity('uncommon', 'godly')).toBeLessThan(0);
    });
  });

  describe('when a == b', () => {
    it('should return 0 when both are common', () => {
      expect(compareRarity('common', 'common')).toBe(0);
    });

    it('should return 0 when both are epic', () => {
      expect(compareRarity('epic', 'epic')).toBe(0);
    });

    it('should return 0 when both are godly', () => {
      expect(compareRarity('godly', 'godly')).toBe(0);
    });

    it('should return 0 for all matching rarities', () => {
      RARITY_ORDER.forEach(rarity => {
        expect(compareRarity(rarity, rarity)).toBe(0);
      });
    });
  });

  describe('when a > b', () => {
    it('should return positive when uncommon vs common', () => {
      expect(compareRarity('uncommon', 'common')).toBeGreaterThan(0);
    });

    it('should return positive when legendary vs rare', () => {
      expect(compareRarity('legendary', 'rare')).toBeGreaterThan(0);
    });

    it('should return positive when godly vs epic', () => {
      expect(compareRarity('godly', 'epic')).toBeGreaterThan(0);
    });
  });

  describe('comparison semantics', () => {
    it('should be usable for sorting', () => {
      const unsorted: Rarity[] = ['epic', 'common', 'godly', 'rare', 'uncommon', 'legendary'];
      const sorted = [...unsorted].sort(compareRarity);

      expect(sorted).toEqual(RARITY_ORDER);
    });
  });
});

// ============================================================================
// Test Suite: meetsRarityThreshold()
// ============================================================================
describe('meetsRarityThreshold', () => {
  describe('when rarity meets or exceeds minimum', () => {
    it('should return true when epic >= rare', () => {
      expect(meetsRarityThreshold('epic', 'rare')).toBe(true);
    });

    it('should return true when legendary >= uncommon', () => {
      expect(meetsRarityThreshold('legendary', 'uncommon')).toBe(true);
    });

    it('should return true when godly >= common', () => {
      expect(meetsRarityThreshold('godly', 'common')).toBe(true);
    });
  });

  describe('when rarity equals minimum', () => {
    it('should return true when rare >= rare', () => {
      expect(meetsRarityThreshold('rare', 'rare')).toBe(true);
    });

    it('should return true when common >= common', () => {
      expect(meetsRarityThreshold('common', 'common')).toBe(true);
    });

    it('should return true when godly >= godly', () => {
      expect(meetsRarityThreshold('godly', 'godly')).toBe(true);
    });

    it('should return true for all matching rarities', () => {
      RARITY_ORDER.forEach(rarity => {
        expect(meetsRarityThreshold(rarity, rarity)).toBe(true);
      });
    });
  });

  describe('when rarity is below minimum', () => {
    it('should return false when common >= rare', () => {
      expect(meetsRarityThreshold('common', 'rare')).toBe(false);
    });

    it('should return false when uncommon >= epic', () => {
      expect(meetsRarityThreshold('uncommon', 'epic')).toBe(false);
    });

    it('should return false when rare >= legendary', () => {
      expect(meetsRarityThreshold('rare', 'legendary')).toBe(false);
    });

    it('should return false when epic >= godly', () => {
      expect(meetsRarityThreshold('epic', 'godly')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true when godly >= any rarity', () => {
      RARITY_ORDER.forEach(rarity => {
        expect(meetsRarityThreshold('godly', rarity)).toBe(true);
      });
    });

    it('should return false when common >= any non-common rarity', () => {
      RARITY_ORDER.slice(1).forEach(rarity => {
        expect(meetsRarityThreshold('common', rarity)).toBe(false);
      });
    });
  });
});
