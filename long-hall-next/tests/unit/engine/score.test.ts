/**
 * Score System Tests - Red Phase
 * 
 * Comprehensive tests for run scoring, ranking, and formatting.
 * Tests define expected behavior for score calculation, component scoring,
 * rank thresholds, and display formatting.
 * 
 * @module tests/unit/engine/score
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockCharacter,
  createMockItem,
  createMockRunState,
  resetAllFixtureIds,
} from '../../fixtures';
import {
  calculateScore,
  getScore,
  calculateRoomScore,
  calculateEnemyScore,
  calculateGoldScore,
  calculateSurvivorBonus,
  calculateInventoryScore,
  calculateXpScore,
  getScoreRank,
  getScoreRankWithEmoji,
  getNextRankThreshold,
  formatScore,
  formatScoreCompact,
  formatBreakdown,
  POINTS_PER_ROOM,
  POINTS_PER_GOLD,
  POINTS_PER_XP,
  POINTS_PER_LEVEL,
  INVENTORY_VALUE_PERCENT,
  POINTS_PER_SURVIVOR,
  VICTORY_BONUS,
  type ScoreBreakdown,
} from '@engine/score';
import type { Actor, Item } from '@engine/types';

// ============================================================================
// Test Suite: Constants
// ============================================================================
describe('Score Constants', () => {
  it('should have POINTS_PER_ROOM equal to 100', () => {
    expect(POINTS_PER_ROOM).toBe(100);
  });

  it('should have POINTS_PER_GOLD equal to 1', () => {
    expect(POINTS_PER_GOLD).toBe(1);
  });

  it('should have POINTS_PER_XP equal to 1', () => {
    expect(POINTS_PER_XP).toBe(1);
  });

  it('should have POINTS_PER_LEVEL equal to 500', () => {
    expect(POINTS_PER_LEVEL).toBe(500);
  });

  it('should have INVENTORY_VALUE_PERCENT equal to 0.1', () => {
    expect(INVENTORY_VALUE_PERCENT).toBe(0.1);
  });

  it('should have POINTS_PER_SURVIVOR equal to 200', () => {
    expect(POINTS_PER_SURVIVOR).toBe(200);
  });

  it('should have VICTORY_BONUS equal to 5000', () => {
    expect(VICTORY_BONUS).toBe(5000);
  });
});

// ============================================================================
// Test Suite: calculateScore()
// ============================================================================
describe('calculateScore', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('depth/room points', () => {
    it('should calculate depth points as depth × 100', () => {
      const state = createMockRunState({
        depth: 5,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.roomsCleared).toBe(5);
      expect(breakdown.roomPoints).toBe(500); // 5 × 100
    });

    it('should return 0 room points when depth is 0', () => {
      const state = createMockRunState({
        depth: 0,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.roomsCleared).toBe(0);
      expect(breakdown.roomPoints).toBe(0);
    });

    it('should handle large depth values', () => {
      const state = createMockRunState({
        depth: 100,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.roomPoints).toBe(10000); // 100 × 100
    });
  });

  describe('gold points', () => {
    it('should include gold earned at 1:1 ratio', () => {
      const state = createMockRunState({
        party: {
          members: [createMockCharacter()],
          gold: 250,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.goldEarned).toBe(250);
      expect(breakdown.goldPoints).toBe(250); // 1:1 ratio
    });

    it('should return 0 gold points when gold is 0', () => {
      const state = createMockRunState({
        party: {
          members: [createMockCharacter()],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.goldEarned).toBe(0);
      expect(breakdown.goldPoints).toBe(0);
    });
  });

  describe('XP and level points', () => {
    it('should include XP earned at 1:1 ratio', () => {
      const state = createMockRunState({
        party: {
          members: [createMockCharacter({ xp: 150, level: 1 })],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.xpEarned).toBe(150);
      expect(breakdown.xpPoints).toBe(150);
    });

    it('should include level bonus as (level-1) × 500 per member', () => {
      const state = createMockRunState({
        party: {
          members: [createMockCharacter({ level: 3, xp: 0 })],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      // (3 - 1) × 500 = 1000
      expect(breakdown.levelPoints).toBe(1000);
    });

    it('should return 0 level points for level 1 character', () => {
      const state = createMockRunState({
        party: {
          members: [createMockCharacter({ level: 1, xp: 0 })],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.levelPoints).toBe(0); // (1 - 1) × 500 = 0
    });

    it('should sum XP and level bonuses from all party members', () => {
      const member1 = createMockCharacter({ level: 2, xp: 100 }); // (2-1)×500 = 500, xp = 100
      const member2 = createMockCharacter({ level: 3, xp: 200 }); // (3-1)×500 = 1000, xp = 200
      const state = createMockRunState({
        party: {
          members: [member1, member2],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.xpEarned).toBe(300); // 100 + 200
      expect(breakdown.xpPoints).toBe(300);
      expect(breakdown.levelPoints).toBe(1500); // 500 + 1000
    });
  });

  describe('inventory points', () => {
    it('should include inventory value as 10% of item costs', () => {
      const item = createMockItem({ cost: 100 });
      const state = createMockRunState({
        inventory: {
          items: [item],
          consumables: [],
        },
      });

      const breakdown = calculateScore(state);

      // 100 × 0.1 = 10
      expect(breakdown.inventoryValue).toBe(10);
      expect(breakdown.inventoryPoints).toBe(10);
    });

    it('should floor the inventory value for each item', () => {
      const item = createMockItem({ cost: 15 }); // 15 × 0.1 = 1.5 -> floor to 1
      const state = createMockRunState({
        inventory: {
          items: [item],
          consumables: [],
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.inventoryValue).toBe(1);
    });

    it('should include equipped items in inventory value', () => {
      const weapon = createMockItem({ cost: 100, type: 'weapon' });
      const character = createMockCharacter({
        equipment: { main_hand: weapon },
      });
      const state = createMockRunState({
        party: {
          members: [character],
          gold: 0,
        },
        inventory: {
          items: [],
          consumables: [],
        },
      });

      const breakdown = calculateScore(state);

      // 100 × 0.1 = 10
      expect(breakdown.inventoryValue).toBe(10);
    });

    it('should sum inventory and equipped item values', () => {
      const inventoryItem = createMockItem({ cost: 100 }); // 10 points
      const equippedItem = createMockItem({ cost: 200, type: 'weapon' }); // 20 points
      const character = createMockCharacter({
        equipment: { main_hand: equippedItem },
      });
      const state = createMockRunState({
        party: {
          members: [character],
          gold: 0,
        },
        inventory: {
          items: [inventoryItem],
          consumables: [],
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.inventoryValue).toBe(30); // 10 + 20
    });

    it('should handle empty inventory', () => {
      const state = createMockRunState({
        inventory: {
          items: [],
          consumables: [],
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.inventoryValue).toBe(0);
      expect(breakdown.inventoryPoints).toBe(0);
    });
  });

  describe('survivor count', () => {
    it('should count living party members', () => {
      const living = createMockCharacter({ isAlive: true });
      const dead = createMockCharacter({ isAlive: false });
      const state = createMockRunState({
        party: {
          members: [living, dead],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.survivors).toBe(1);
    });

    it('should count all members when all are alive', () => {
      const member1 = createMockCharacter({ isAlive: true });
      const member2 = createMockCharacter({ isAlive: true });
      const member3 = createMockCharacter({ isAlive: true });
      const state = createMockRunState({
        party: {
          members: [member1, member2, member3],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.survivors).toBe(3);
    });

    it('should return 0 survivors when all are dead', () => {
      const dead1 = createMockCharacter({ isAlive: false });
      const dead2 = createMockCharacter({ isAlive: false });
      const state = createMockRunState({
        party: {
          members: [dead1, dead2],
          gold: 0,
        },
      });

      const breakdown = calculateScore(state);

      expect(breakdown.survivors).toBe(0);
    });
  });

  describe('victory bonus', () => {
    it('should include victory bonus (5000) when victory AND gameOver are true', () => {
      const state = createMockRunState({
        victory: true,
        gameOver: true,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.victoryBonus).toBe(5000);
    });

    it('should NOT include victory bonus when victory is false', () => {
      const state = createMockRunState({
        victory: false,
        gameOver: true,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.victoryBonus).toBe(0);
    });

    it('should NOT include victory bonus when gameOver is false', () => {
      const state = createMockRunState({
        victory: true,
        gameOver: false,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.victoryBonus).toBe(0);
    });

    it('should NOT include victory bonus when both are false', () => {
      const state = createMockRunState({
        victory: false,
        gameOver: false,
      });

      const breakdown = calculateScore(state);

      expect(breakdown.victoryBonus).toBe(0);
    });
  });

  describe('total score calculation', () => {
    it('should sum all components correctly', () => {
      const character = createMockCharacter({
        level: 2,
        xp: 100,
        isAlive: true,
      });
      const item = createMockItem({ cost: 100 });
      const state = createMockRunState({
        depth: 5, // 500 room points
        party: {
          members: [character],
          gold: 200, // 200 gold points
        },
        inventory: {
          items: [item], // 10 inventory points
          consumables: [],
        },
        victory: true,
        gameOver: true, // 5000 victory bonus
      });

      const breakdown = calculateScore(state);

      // 500 (rooms) + 200 (gold) + 100 (xp) + 500 (level) + 10 (inventory) + 5000 (victory) = 6310
      expect(breakdown.totalScore).toBe(6310);
    });

    it('should match sum of all component scores', () => {
      const state = createMockRunState({
        depth: 10,
        party: {
          members: [createMockCharacter({ level: 3, xp: 250 })],
          gold: 500,
        },
        inventory: {
          items: [createMockItem({ cost: 150 })],
          consumables: [],
        },
        victory: false,
        gameOver: true,
      });

      const breakdown = calculateScore(state);

      const expectedTotal = 
        breakdown.roomPoints + 
        breakdown.goldPoints + 
        breakdown.xpPoints + 
        breakdown.levelPoints + 
        breakdown.inventoryPoints + 
        breakdown.victoryBonus;

      expect(breakdown.totalScore).toBe(expectedTotal);
    });
  });
});

// ============================================================================
// Test Suite: getScore()
// ============================================================================
describe('getScore', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return just the total from calculateScore', () => {
    const state = createMockRunState({
      depth: 5,
      party: {
        members: [createMockCharacter({ level: 2, xp: 100 })],
        gold: 200,
      },
    });

    const score = getScore(state);
    const breakdown = calculateScore(state);

    expect(score).toBe(breakdown.totalScore);
  });

  it('should return a number', () => {
    const state = createMockRunState();

    const score = getScore(state);

    expect(typeof score).toBe('number');
  });
});

// ============================================================================
// Test Suite: calculateRoomScore()
// ============================================================================
describe('calculateRoomScore', () => {
  it('should return depth × 100', () => {
    expect(calculateRoomScore(5)).toBe(500);
    expect(calculateRoomScore(10)).toBe(1000);
    expect(calculateRoomScore(25)).toBe(2500);
  });

  it('should handle depth 0', () => {
    expect(calculateRoomScore(0)).toBe(0);
  });

  it('should handle large depth values', () => {
    expect(calculateRoomScore(100)).toBe(10000);
  });
});

// ============================================================================
// Test Suite: calculateEnemyScore()
// ============================================================================
describe('calculateEnemyScore', () => {
  it('should multiply enemies by default points (50)', () => {
    expect(calculateEnemyScore(3)).toBe(150); // 3 × 50
    expect(calculateEnemyScore(10)).toBe(500); // 10 × 50
  });

  it('should use custom pointsPerEnemy when provided', () => {
    expect(calculateEnemyScore(3, 100)).toBe(300); // 3 × 100
    expect(calculateEnemyScore(5, 25)).toBe(125); // 5 × 25
  });

  it('should return 0 for 0 enemies', () => {
    expect(calculateEnemyScore(0)).toBe(0);
    expect(calculateEnemyScore(0, 100)).toBe(0);
  });
});

// ============================================================================
// Test Suite: calculateGoldScore()
// ============================================================================
describe('calculateGoldScore', () => {
  it('should return gold × 1', () => {
    expect(calculateGoldScore(100)).toBe(100);
    expect(calculateGoldScore(500)).toBe(500);
  });

  it('should return 0 for 0 gold', () => {
    expect(calculateGoldScore(0)).toBe(0);
  });

  it('should handle large gold values', () => {
    expect(calculateGoldScore(10000)).toBe(10000);
  });
});

// ============================================================================
// Test Suite: calculateSurvivorBonus()
// ============================================================================
describe('calculateSurvivorBonus', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return living members × 200', () => {
    const member1 = createMockCharacter({ isAlive: true });
    const member2 = createMockCharacter({ isAlive: true });
    const party = [member1, member2];

    expect(calculateSurvivorBonus(party)).toBe(400); // 2 × 200
  });

  it('should exclude dead members', () => {
    const living = createMockCharacter({ isAlive: true });
    const dead = createMockCharacter({ isAlive: false });
    const party = [living, dead];

    expect(calculateSurvivorBonus(party)).toBe(200); // 1 × 200
  });

  it('should return 0 when all members are dead', () => {
    const dead1 = createMockCharacter({ isAlive: false });
    const dead2 = createMockCharacter({ isAlive: false });
    const party = [dead1, dead2];

    expect(calculateSurvivorBonus(party)).toBe(0);
  });

  it('should handle empty party', () => {
    expect(calculateSurvivorBonus([])).toBe(0);
  });
});

// ============================================================================
// Test Suite: calculateInventoryScore()
// ============================================================================
describe('calculateInventoryScore', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return 10% of total item costs', () => {
    const item1 = createMockItem({ cost: 100 }); // 10
    const item2 = createMockItem({ cost: 200 }); // 20
    const items = [item1, item2];

    expect(calculateInventoryScore(items)).toBe(30);
  });

  it('should floor the result for each item', () => {
    const item = createMockItem({ cost: 15 }); // 15 × 0.1 = 1.5 -> 1

    expect(calculateInventoryScore([item])).toBe(1);
  });

  it('should handle empty inventory', () => {
    expect(calculateInventoryScore([])).toBe(0);
  });

  it('should return 0 for items with 0 cost', () => {
    const item = createMockItem({ cost: 0 });

    expect(calculateInventoryScore([item])).toBe(0);
  });

  it('should return 0 for items with cost less than 10', () => {
    const item = createMockItem({ cost: 5 }); // 5 × 0.1 = 0.5 -> 0

    expect(calculateInventoryScore([item])).toBe(0);
  });
});

// ============================================================================
// Test Suite: calculateXpScore()
// ============================================================================
describe('calculateXpScore', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should sum XP from all party members', () => {
    const member1 = createMockCharacter({ xp: 100, level: 1 });
    const member2 = createMockCharacter({ xp: 200, level: 1 });
    const party = [member1, member2];

    expect(calculateXpScore(party)).toBe(300);
  });

  it('should add level bonus ((level-1) × 500)', () => {
    const member = createMockCharacter({ xp: 100, level: 3 });
    const party = [member];

    // 100 (xp) + (3-1) × 500 (level) = 100 + 1000 = 1100
    expect(calculateXpScore(party)).toBe(1100);
  });

  it('should combine XP and level bonuses from all members', () => {
    const member1 = createMockCharacter({ xp: 50, level: 2 }); // 50 + 500 = 550
    const member2 = createMockCharacter({ xp: 150, level: 4 }); // 150 + 1500 = 1650
    const party = [member1, member2];

    expect(calculateXpScore(party)).toBe(2200);
  });

  it('should handle level 1 members (no level bonus)', () => {
    const member = createMockCharacter({ xp: 100, level: 1 });
    const party = [member];

    expect(calculateXpScore(party)).toBe(100);
  });

  it('should handle empty party', () => {
    expect(calculateXpScore([])).toBe(0);
  });
});

// ============================================================================
// Test Suite: getScoreRank()
// ============================================================================
describe('getScoreRank', () => {
  it('should return "Legendary Hero" for 50000+', () => {
    expect(getScoreRank(50000)).toBe('Legendary Hero');
    expect(getScoreRank(75000)).toBe('Legendary Hero');
    expect(getScoreRank(100000)).toBe('Legendary Hero');
  });

  it('should return "Champion" for 25000-49999', () => {
    expect(getScoreRank(25000)).toBe('Champion');
    expect(getScoreRank(35000)).toBe('Champion');
    expect(getScoreRank(49999)).toBe('Champion');
  });

  it('should return "Master" for 15000-24999', () => {
    expect(getScoreRank(15000)).toBe('Master');
    expect(getScoreRank(20000)).toBe('Master');
    expect(getScoreRank(24999)).toBe('Master');
  });

  it('should return "Veteran" for 10000-14999', () => {
    expect(getScoreRank(10000)).toBe('Veteran');
    expect(getScoreRank(12500)).toBe('Veteran');
    expect(getScoreRank(14999)).toBe('Veteran');
  });

  it('should return "Adventurer" for 5000-9999', () => {
    expect(getScoreRank(5000)).toBe('Adventurer');
    expect(getScoreRank(7500)).toBe('Adventurer');
    expect(getScoreRank(9999)).toBe('Adventurer');
  });

  it('should return "Explorer" for 2500-4999', () => {
    expect(getScoreRank(2500)).toBe('Explorer');
    expect(getScoreRank(3750)).toBe('Explorer');
    expect(getScoreRank(4999)).toBe('Explorer');
  });

  it('should return "Apprentice" for 1000-2499', () => {
    expect(getScoreRank(1000)).toBe('Apprentice');
    expect(getScoreRank(1750)).toBe('Apprentice');
    expect(getScoreRank(2499)).toBe('Apprentice');
  });

  it('should return "Novice" for 500-999', () => {
    expect(getScoreRank(500)).toBe('Novice');
    expect(getScoreRank(750)).toBe('Novice');
    expect(getScoreRank(999)).toBe('Novice');
  });

  it('should return "Beginner" for 0-499', () => {
    expect(getScoreRank(0)).toBe('Beginner');
    expect(getScoreRank(250)).toBe('Beginner');
    expect(getScoreRank(499)).toBe('Beginner');
  });
});

// ============================================================================
// Test Suite: getScoreRankWithEmoji()
// ============================================================================
describe('getScoreRankWithEmoji', () => {
  it('should return "👑 Legendary Hero" for 50000+', () => {
    expect(getScoreRankWithEmoji(50000)).toBe('👑 Legendary Hero');
  });

  it('should return "🏆 Champion" for 25000-49999', () => {
    expect(getScoreRankWithEmoji(25000)).toBe('🏆 Champion');
  });

  it('should return "⭐ Master" for 15000-24999', () => {
    expect(getScoreRankWithEmoji(15000)).toBe('⭐ Master');
  });

  it('should return "🛡️ Veteran" for 10000-14999', () => {
    expect(getScoreRankWithEmoji(10000)).toBe('🛡️ Veteran');
  });

  it('should return "⚔️ Adventurer" for 5000-9999', () => {
    expect(getScoreRankWithEmoji(5000)).toBe('⚔️ Adventurer');
  });

  it('should return "🗺️ Explorer" for 2500-4999', () => {
    expect(getScoreRankWithEmoji(2500)).toBe('🗺️ Explorer');
  });

  it('should return "📜 Apprentice" for 1000-2499', () => {
    expect(getScoreRankWithEmoji(1000)).toBe('📜 Apprentice');
  });

  it('should return "🌱 Novice" for 500-999', () => {
    expect(getScoreRankWithEmoji(500)).toBe('🌱 Novice');
  });

  it('should return "👤 Beginner" for 0-499', () => {
    expect(getScoreRankWithEmoji(0)).toBe('👤 Beginner');
  });
});

// ============================================================================
// Test Suite: getNextRankThreshold()
// ============================================================================
describe('getNextRankThreshold', () => {
  it('should return 500 for Beginner (score < 500)', () => {
    expect(getNextRankThreshold(0)).toBe(500);
    expect(getNextRankThreshold(250)).toBe(500);
    expect(getNextRankThreshold(499)).toBe(500);
  });

  it('should return 1000 for Novice (500-999)', () => {
    expect(getNextRankThreshold(500)).toBe(1000);
    expect(getNextRankThreshold(750)).toBe(1000);
    expect(getNextRankThreshold(999)).toBe(1000);
  });

  it('should return 2500 for Apprentice (1000-2499)', () => {
    expect(getNextRankThreshold(1000)).toBe(2500);
    expect(getNextRankThreshold(2000)).toBe(2500);
    expect(getNextRankThreshold(2499)).toBe(2500);
  });

  it('should return 5000 for Explorer (2500-4999)', () => {
    expect(getNextRankThreshold(2500)).toBe(5000);
    expect(getNextRankThreshold(4000)).toBe(5000);
    expect(getNextRankThreshold(4999)).toBe(5000);
  });

  it('should return 10000 for Adventurer (5000-9999)', () => {
    expect(getNextRankThreshold(5000)).toBe(10000);
    expect(getNextRankThreshold(7500)).toBe(10000);
    expect(getNextRankThreshold(9999)).toBe(10000);
  });

  it('should return 15000 for Veteran (10000-14999)', () => {
    expect(getNextRankThreshold(10000)).toBe(15000);
    expect(getNextRankThreshold(12500)).toBe(15000);
    expect(getNextRankThreshold(14999)).toBe(15000);
  });

  it('should return 25000 for Master (15000-24999)', () => {
    expect(getNextRankThreshold(15000)).toBe(25000);
    expect(getNextRankThreshold(20000)).toBe(25000);
    expect(getNextRankThreshold(24999)).toBe(25000);
  });

  it('should return 50000 for Champion (25000-49999)', () => {
    expect(getNextRankThreshold(25000)).toBe(50000);
    expect(getNextRankThreshold(40000)).toBe(50000);
    expect(getNextRankThreshold(49999)).toBe(50000);
  });

  it('should return null for Legendary Hero (50000+)', () => {
    expect(getNextRankThreshold(50000)).toBeNull();
    expect(getNextRankThreshold(75000)).toBeNull();
    expect(getNextRankThreshold(100000)).toBeNull();
  });
});

// ============================================================================
// Test Suite: formatScore()
// ============================================================================
describe('formatScore', () => {
  it('should add thousands separators', () => {
    expect(formatScore(1000)).toBe('1,000');
    expect(formatScore(10000)).toBe('10,000');
    expect(formatScore(100000)).toBe('100,000');
    expect(formatScore(1000000)).toBe('1,000,000');
  });

  it('should format small numbers without separator', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
  });

  it('should handle intermediate values', () => {
    expect(formatScore(12345)).toBe('12,345');
    expect(formatScore(123456)).toBe('123,456');
  });
});

// ============================================================================
// Test Suite: formatScoreCompact()
// ============================================================================
describe('formatScoreCompact', () => {
  describe('millions abbreviation', () => {
    it('should abbreviate millions as "M"', () => {
      expect(formatScoreCompact(1000000)).toBe('1.0M');
      expect(formatScoreCompact(1500000)).toBe('1.5M');
      expect(formatScoreCompact(10000000)).toBe('10.0M');
    });
  });

  describe('thousands abbreviation', () => {
    it('should abbreviate thousands (10000+) as "K"', () => {
      expect(formatScoreCompact(10000)).toBe('10.0K');
      expect(formatScoreCompact(15000)).toBe('15.0K');
      expect(formatScoreCompact(100000)).toBe('100.0K');
      expect(formatScoreCompact(999999)).toBe('1000.0K');
    });

    it('should NOT abbreviate values below 10000', () => {
      expect(formatScoreCompact(9999)).toBe('9,999');
      expect(formatScoreCompact(5000)).toBe('5,000');
    });
  });

  describe('small numbers', () => {
    it('should format normally for smaller numbers', () => {
      expect(formatScoreCompact(0)).toBe('0');
      expect(formatScoreCompact(100)).toBe('100');
      expect(formatScoreCompact(1000)).toBe('1,000');
      expect(formatScoreCompact(9999)).toBe('9,999');
    });
  });
});

// ============================================================================
// Test Suite: formatBreakdown()
// ============================================================================
describe('formatBreakdown', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should format all breakdown fields with labels', () => {
    const breakdown: ScoreBreakdown = {
      roomsCleared: 10,
      roomPoints: 1000,
      goldEarned: 500,
      goldPoints: 500,
      xpEarned: 250,
      xpPoints: 250,
      levelPoints: 1000,
      inventoryValue: 50,
      inventoryPoints: 50,
      survivors: 2,
      victoryBonus: 0,
      totalScore: 2800,
    };

    const formatted = formatBreakdown(breakdown);

    expect(formatted.roomsCleared).toBe('10 rooms');
    expect(formatted.roomPoints).toBe('+1,000');
    expect(formatted.goldEarned).toBe('500 gold');
    expect(formatted.goldPoints).toBe('+500');
    expect(formatted.xpEarned).toBe('250 XP');
    expect(formatted.xpPoints).toBe('+250');
    expect(formatted.levelPoints).toBe('+1,000');
    expect(formatted.inventoryValue).toBe('50 value');
    expect(formatted.inventoryPoints).toBe('+50');
    expect(formatted.survivors).toBe('2 alive');
    expect(formatted.victoryBonus).toBe('—');
    expect(formatted.totalScore).toBe('2,800');
  });

  it('should format victory bonus with trophy emoji when > 0', () => {
    const breakdown: ScoreBreakdown = {
      roomsCleared: 20,
      roomPoints: 2000,
      goldEarned: 1000,
      goldPoints: 1000,
      xpEarned: 500,
      xpPoints: 500,
      levelPoints: 2000,
      inventoryValue: 100,
      inventoryPoints: 100,
      survivors: 3,
      victoryBonus: 5000,
      totalScore: 10600,
    };

    const formatted = formatBreakdown(breakdown);

    expect(formatted.victoryBonus).toBe('+5,000 🏆');
  });

  it('should show "—" for 0 victory bonus', () => {
    const breakdown: ScoreBreakdown = {
      roomsCleared: 5,
      roomPoints: 500,
      goldEarned: 100,
      goldPoints: 100,
      xpEarned: 50,
      xpPoints: 50,
      levelPoints: 0,
      inventoryValue: 10,
      inventoryPoints: 10,
      survivors: 1,
      victoryBonus: 0,
      totalScore: 660,
    };

    const formatted = formatBreakdown(breakdown);

    expect(formatted.victoryBonus).toBe('—');
  });

  it('should format large values with thousands separators', () => {
    const breakdown: ScoreBreakdown = {
      roomsCleared: 100,
      roomPoints: 10000,
      goldEarned: 50000,
      goldPoints: 50000,
      xpEarned: 25000,
      xpPoints: 25000,
      levelPoints: 10000,
      inventoryValue: 5000,
      inventoryPoints: 5000,
      survivors: 4,
      victoryBonus: 5000,
      totalScore: 105000,
    };

    const formatted = formatBreakdown(breakdown);

    expect(formatted.roomPoints).toBe('+10,000');
    expect(formatted.goldEarned).toBe('50,000 gold');
    expect(formatted.totalScore).toBe('105,000');
  });
});
