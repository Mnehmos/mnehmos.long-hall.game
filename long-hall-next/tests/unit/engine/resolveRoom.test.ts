/**
 * Room Resolution Tests - Red Phase
 * 
 * These tests define the expected behavior of the room resolution system
 * BEFORE implementation changes. Tests should pass with the current implementation.
 * 
 * @module tests/unit/engine/resolveRoom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '@lib/rng';

import {
  canResolveRoom,
  areAllEnemiesDead,
  countLivingEnemies,
  resolveCombatRoom,
  resolveHazardRoom,
  resolveShrineRoom,
  resolveIntermissionRoom,
  resolveTraderRoom,
  resolveAllyRoom,
  resolveRoom,
  canAdvanceRoom,
  getRoomTransitionMessage,
  calculateRoomXp,
  getXpForNextLevel,
  canLevelUp,
  type RoomResolutionResult,
} from '@engine/resolveRoom';

import {
  createMockRoom,
  createMockRunState,
  createMockCharacter,
  createMockEnemy,
  createCombatRoom,
  createEliteRoom,
  createBossRoom,
  createShrineRoom,
  createTraderRoom,
  createHazardRoom,
  createIntermissionRoom,
  createAllyRoom,
  createEnemyGroup,
  resetAllFixtureIds,
} from '../../fixtures';

// ============================================================================
// Test Suite: areAllEnemiesDead()
// ============================================================================
describe('areAllEnemiesDead', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('empty enemy array', () => {
    it('should return true when enemies array is empty', () => {
      expect(areAllEnemiesDead([])).toBe(true);
    });

    it('should return true when enemies is undefined-like', () => {
      // The function checks for !enemies, so null-ish values should return true
      expect(areAllEnemiesDead(undefined as any)).toBe(true);
    });
  });

  describe('all enemies dead', () => {
    it('should return true when single enemy has HP <= 0', () => {
      const enemies = [createMockEnemy({ hp: 0 })];
      expect(areAllEnemiesDead(enemies)).toBe(true);
    });

    it('should return true when single enemy has negative HP', () => {
      const enemies = [createMockEnemy({ hp: -5 })];
      expect(areAllEnemiesDead(enemies)).toBe(true);
    });

    it('should return true when all enemies have HP = 0', () => {
      const enemies = [
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 0 }),
      ];
      expect(areAllEnemiesDead(enemies)).toBe(true);
    });

    it('should return true when all enemies have negative HP', () => {
      const enemies = [
        createMockEnemy({ hp: -10 }),
        createMockEnemy({ hp: -2 }),
        createMockEnemy({ hp: -1 }),
      ];
      expect(areAllEnemiesDead(enemies)).toBe(true);
    });
  });

  describe('some enemies alive', () => {
    it('should return false when single enemy has HP > 0', () => {
      const enemies = [createMockEnemy({ hp: 1 })];
      expect(areAllEnemiesDead(enemies)).toBe(false);
    });

    it('should return false when any enemy has HP > 0', () => {
      const enemies = [
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 5 }),
        createMockEnemy({ hp: 0 }),
      ];
      expect(areAllEnemiesDead(enemies)).toBe(false);
    });

    it('should return false when last enemy has HP > 0', () => {
      const enemies = [
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 1 }),
      ];
      expect(areAllEnemiesDead(enemies)).toBe(false);
    });

    it('should return false when first enemy has HP > 0', () => {
      const enemies = [
        createMockEnemy({ hp: 10 }),
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 0 }),
      ];
      expect(areAllEnemiesDead(enemies)).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: countLivingEnemies()
// ============================================================================
describe('countLivingEnemies', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('empty and null cases', () => {
    it('should return 0 for empty array', () => {
      expect(countLivingEnemies([])).toBe(0);
    });

    it('should return 0 for undefined enemies', () => {
      expect(countLivingEnemies(undefined as any)).toBe(0);
    });
  });

  describe('counting living enemies', () => {
    it('should return 1 when one enemy is alive', () => {
      const enemies = [createMockEnemy({ hp: 5 })];
      expect(countLivingEnemies(enemies)).toBe(1);
    });

    it('should return correct count for mixed HP enemies', () => {
      const enemies = [
        createMockEnemy({ hp: 10 }),
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: 5 }),
        createMockEnemy({ hp: -2 }),
        createMockEnemy({ hp: 1 }),
      ];
      expect(countLivingEnemies(enemies)).toBe(3);
    });

    it('should return 0 when all enemies are dead', () => {
      const enemies = [
        createMockEnemy({ hp: 0 }),
        createMockEnemy({ hp: -5 }),
        createMockEnemy({ hp: 0 }),
      ];
      expect(countLivingEnemies(enemies)).toBe(0);
    });

    it('should return total count when all enemies are alive', () => {
      const enemies = createEnemyGroup(5);
      expect(countLivingEnemies(enemies)).toBe(5);
    });
  });
});

// ============================================================================
// Test Suite: canResolveRoom()
// ============================================================================
describe('canResolveRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('combat rooms', () => {
    it('should return true when combat room has no enemies', () => {
      const room = createCombatRoom(0);
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return true when all enemies in combat room are dead', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [
          createMockEnemy({ hp: 0 }),
          createMockEnemy({ hp: 0 }),
        ],
      });
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return false when enemies in combat room are alive', () => {
      const room = createCombatRoom(2);
      expect(canResolveRoom(room)).toBe(false);
    });

    it('should return false when any enemy in combat room is alive', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [
          createMockEnemy({ hp: 0 }),
          createMockEnemy({ hp: 5 }),
        ],
      });
      expect(canResolveRoom(room)).toBe(false);
    });
  });

  describe('elite rooms', () => {
    it('should return true when elite room enemies are dead', () => {
      const room = createMockRoom({
        type: 'elite',
        enemies: [createMockEnemy({ hp: 0 })],
      });
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return false when elite room enemies are alive', () => {
      const room = createEliteRoom();
      expect(canResolveRoom(room)).toBe(false);
    });
  });

  describe('boss rooms', () => {
    it('should return true when boss room enemies are dead', () => {
      const room = createMockRoom({
        type: 'boss',
        enemies: [createMockEnemy({ hp: 0 })],
      });
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return false when boss room enemies are alive', () => {
      const room = createBossRoom();
      expect(canResolveRoom(room)).toBe(false);
    });
  });

  describe('non-combat rooms', () => {
    it('should return true for hazard rooms', () => {
      const room = createHazardRoom();
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return true for shrine rooms', () => {
      const room = createShrineRoom();
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return true for trader rooms', () => {
      const room = createTraderRoom();
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return true for ally rooms', () => {
      const room = createAllyRoom();
      expect(canResolveRoom(room)).toBe(true);
    });

    it('should return true for intermission rooms', () => {
      const room = createIntermissionRoom();
      expect(canResolveRoom(room)).toBe(true);
    });
  });

  describe('unknown room types', () => {
    it('should return false for unknown room types', () => {
      const room = createMockRoom({ type: 'unknown_type' as any });
      expect(canResolveRoom(room)).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: resolveCombatRoom()
// ============================================================================
describe('resolveCombatRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('when enemies are alive', () => {
    it('should return resolved: false when enemies are alive', () => {
      const room = createCombatRoom(2);
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.resolved).toBe(false);
      expect(result.canAdvance).toBe(false);
    });

    it('should return 0 rewards when enemies are alive', () => {
      const room = createCombatRoom(2);
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.goldEarned).toBe(0);
      expect(result.xpEarned).toBe(0);
      expect(result.lootDropped).toEqual([]);
    });

    it('should return appropriate message when combat not complete', () => {
      const room = createCombatRoom(1);
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.message).toContain('Combat is not yet complete');
    });
  });

  describe('when enemies are dead', () => {
    it('should return resolved: true when all enemies are dead', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ hp: 0, power: 2 })],
      });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.canAdvance).toBe(true);
    });

    it('should calculate XP based on room and depth', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ hp: 0, power: 5, xp: 50 })],
      });
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.xpEarned).toBeGreaterThan(0);
    });

    it('should generate gold from defeated enemies', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [
          createMockEnemy({ hp: 0, power: 3 }),
          createMockEnemy({ hp: 0, power: 3 }),
        ],
      });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.goldEarned).toBeGreaterThan(0);
    });

    it('should be deterministic with seeded RNG', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ hp: 0, power: 3 })],
      });
      const state = createMockRunState({ depth: 10 });

      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const result1 = resolveCombatRoom(room, state, rng1);
      const result2 = resolveCombatRoom(room, state, rng2);

      expect(result1.goldEarned).toBe(result2.goldEarned);
      expect(result1.xpEarned).toBe(result2.xpEarned);
      expect(result1.lootDropped.length).toBe(result2.lootDropped.length);
    });

    it('should include enemy count in victory message', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [
          createMockEnemy({ hp: 0 }),
          createMockEnemy({ hp: 0 }),
          createMockEnemy({ hp: 0 }),
        ],
      });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.message).toContain('3');
      expect(result.message).toContain('Victory');
    });
  });

  describe('elite rooms', () => {
    it('should include elite label in message', () => {
      const room = createMockRoom({
        type: 'elite',
        enemies: [createMockEnemy({ hp: 0, power: 5 })],
      });
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.message).toContain('elite');
    });
  });

  describe('boss rooms', () => {
    it('should include boss label in message', () => {
      const room = createMockRoom({
        type: 'boss',
        enemies: [createMockEnemy({ hp: 0, power: 8 })],
      });
      const state = createMockRunState({ depth: 20 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.message).toContain('boss');
    });
  });

  describe('empty combat rooms', () => {
    it('should handle combat room with no enemies', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [],
      });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveCombatRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.canAdvance).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: resolveHazardRoom()
// ============================================================================
describe('resolveHazardRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic resolution', () => {
    it('should always return resolved: true', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveHazardRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.canAdvance).toBe(true);
    });

    it('should generate loot', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveHazardRoom(room, state, rng);

      expect(Array.isArray(result.lootDropped)).toBe(true);
    });

    it('should generate gold', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveHazardRoom(room, state, rng);

      expect(result.goldEarned).toBeGreaterThan(0);
    });

    it('should generate XP based on hazard multiplier (0.5)', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveHazardRoom(room, state, rng);

      // Hazard XP formula: BASE_XP_PER_POWER * 0.5 * (1 + depth * 0.1)
      // At depth 10: 10 * 0.5 * 2 = 10 XP (floored)
      expect(result.xpEarned).toBeGreaterThan(0);
    });
  });

  describe('determinism', () => {
    it('should be deterministic with seeded RNG', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 15 });

      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const result1 = resolveHazardRoom(room, state, rng1);
      const result2 = resolveHazardRoom(room, state, rng2);

      expect(result1.goldEarned).toBe(result2.goldEarned);
      expect(result1.xpEarned).toBe(result2.xpEarned);
      expect(result1.lootDropped.length).toBe(result2.lootDropped.length);
    });
  });

  describe('message', () => {
    it('should include navigation success in message', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveHazardRoom(room, state, rng);

      expect(result.message).toContain('hazard');
    });
  });
});

// ============================================================================
// Test Suite: resolveShrineRoom()
// ============================================================================
describe('resolveShrineRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic resolution', () => {
    it('should always return resolved: true', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room);

      expect(result.resolved).toBe(true);
      expect(result.canAdvance).toBe(true);
    });

    it('should return 0 gold by default', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room);

      expect(result.goldEarned).toBe(0);
    });

    it('should return empty loot array', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room);

      expect(result.lootDropped).toEqual([]);
    });
  });

  describe('no boon specified', () => {
    it('should return default message when no boon is specified', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room);

      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should not set boonApplied when no boon specified', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room);

      expect(result.boonApplied).toBeUndefined();
    });
  });

  describe('healing boon', () => {
    it('should set hpRestored to 20 for healing boon', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'healing');

      expect(result.hpRestored).toBe(20);
    });

    it('should set boonApplied to healing', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'healing');

      expect(result.boonApplied).toBe('healing');
    });

    it('should include healing message', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'healing');

      expect(result.message).toContain('wounds');
    });
  });

  describe('calm boon', () => {
    it('should set stressReduced to 5 for calm boon', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'calm');

      expect(result.stressReduced).toBe(5);
    });

    it('should set boonApplied to calm', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'calm');

      expect(result.boonApplied).toBe('calm');
    });
  });

  describe('peace boon', () => {
    it('should set stressReduced to 5 for peace boon', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'peace');

      expect(result.stressReduced).toBe(5);
    });

    it('should set boonApplied to peace', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'peace');

      expect(result.boonApplied).toBe('peace');
    });
  });

  describe('blessing boon', () => {
    it('should set xpEarned to 50 for blessing boon', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'blessing');

      expect(result.xpEarned).toBe(50);
    });

    it('should set boonApplied to blessing', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'blessing');

      expect(result.boonApplied).toBe('blessing');
    });

    it('should include blessing message', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'blessing');

      expect(result.message).toContain('Divine');
    });
  });

  describe('fortune boon', () => {
    it('should set goldEarned to 100 for fortune boon', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'fortune');

      expect(result.goldEarned).toBe(100);
    });

    it('should set boonApplied to fortune', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'fortune');

      expect(result.boonApplied).toBe('fortune');
    });

    it('should include fortune message', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'fortune');

      expect(result.message).toContain('gods');
    });
  });

  describe('unknown boon', () => {
    it('should set boonApplied for unknown boon types', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'mystery');

      expect(result.boonApplied).toBe('mystery');
    });

    it('should return default message for unknown boon types', () => {
      const room = createShrineRoom();

      const result = resolveShrineRoom(room, 'unknown_boon');

      expect(result.message).toBeDefined();
    });
  });
});

// ============================================================================
// Test Suite: resolveIntermissionRoom()
// ============================================================================
describe('resolveIntermissionRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return resolved: true', () => {
    const room = createIntermissionRoom();

    const result = resolveIntermissionRoom(room);

    expect(result.resolved).toBe(true);
    expect(result.canAdvance).toBe(true);
  });

  it('should return 0 gold', () => {
    const room = createIntermissionRoom();

    const result = resolveIntermissionRoom(room);

    expect(result.goldEarned).toBe(0);
  });

  it('should return 0 XP', () => {
    const room = createIntermissionRoom();

    const result = resolveIntermissionRoom(room);

    expect(result.xpEarned).toBe(0);
  });

  it('should return empty loot array', () => {
    const room = createIntermissionRoom();

    const result = resolveIntermissionRoom(room);

    expect(result.lootDropped).toEqual([]);
  });

  it('should return appropriate message', () => {
    const room = createIntermissionRoom();

    const result = resolveIntermissionRoom(room);

    expect(result.message).toContain('trading post');
  });
});

// ============================================================================
// Test Suite: resolveTraderRoom()
// ============================================================================
describe('resolveTraderRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return resolved: true', () => {
    const room = createTraderRoom();

    const result = resolveTraderRoom(room);

    expect(result.resolved).toBe(true);
    expect(result.canAdvance).toBe(true);
  });

  it('should return 0 gold', () => {
    const room = createTraderRoom();

    const result = resolveTraderRoom(room);

    expect(result.goldEarned).toBe(0);
  });

  it('should return 0 XP', () => {
    const room = createTraderRoom();

    const result = resolveTraderRoom(room);

    expect(result.xpEarned).toBe(0);
  });

  it('should return empty loot array', () => {
    const room = createTraderRoom();

    const result = resolveTraderRoom(room);

    expect(result.lootDropped).toEqual([]);
  });

  it('should return appropriate message', () => {
    const room = createTraderRoom();

    const result = resolveTraderRoom(room);

    expect(result.message).toContain('merchant');
  });
});

// ============================================================================
// Test Suite: resolveAllyRoom()
// ============================================================================
describe('resolveAllyRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return resolved: true', () => {
    const room = createAllyRoom();

    const result = resolveAllyRoom(room);

    expect(result.resolved).toBe(true);
    expect(result.canAdvance).toBe(true);
  });

  it('should return 0 gold', () => {
    const room = createAllyRoom();

    const result = resolveAllyRoom(room);

    expect(result.goldEarned).toBe(0);
  });

  it('should return 25 XP for social encounter', () => {
    const room = createAllyRoom();

    const result = resolveAllyRoom(room);

    expect(result.xpEarned).toBe(25);
  });

  it('should return empty loot array', () => {
    const room = createAllyRoom();

    const result = resolveAllyRoom(room);

    expect(result.lootDropped).toEqual([]);
  });

  it('should return appropriate message', () => {
    const room = createAllyRoom();

    const result = resolveAllyRoom(room);

    expect(result.message).toContain('encounter');
  });
});

// ============================================================================
// Test Suite: resolveRoom() - Generic Router
// ============================================================================
describe('resolveRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('room not resolvable', () => {
    it('should return resolved: false when room cannot be resolved', () => {
      const room = createCombatRoom(2); // Has living enemies
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(false);
      expect(result.canAdvance).toBe(false);
    });

    it('should return appropriate message when room not resolvable', () => {
      const room = createCombatRoom(1);
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.message).toContain('cannot be resolved');
    });
  });

  describe('routing to combat handler', () => {
    it('should route combat rooms to resolveCombatRoom', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ hp: 0, power: 2 })],
      });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.message).toContain('Victory');
    });

    it('should route elite rooms to resolveCombatRoom', () => {
      const room = createMockRoom({
        type: 'elite',
        enemies: [createMockEnemy({ hp: 0, power: 4 })],
      });
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
    });

    it('should route boss rooms to resolveCombatRoom', () => {
      const room = createMockRoom({
        type: 'boss',
        enemies: [createMockEnemy({ hp: 0, power: 6 })],
      });
      const state = createMockRunState({ depth: 20 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
    });
  });

  describe('routing to hazard handler', () => {
    it('should route hazard rooms to resolveHazardRoom', () => {
      const room = createHazardRoom();
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.message).toContain('hazard');
    });
  });

  describe('routing to shrine handler', () => {
    it('should route shrine rooms to resolveShrineRoom', () => {
      const room = createShrineRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
    });

    it('should pass boonId to shrine handler', () => {
      const room = createShrineRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng, { boonId: 'healing' });

      expect(result.hpRestored).toBe(20);
      expect(result.boonApplied).toBe('healing');
    });
  });

  describe('routing to trader handler', () => {
    it('should route trader rooms to resolveTraderRoom', () => {
      const room = createTraderRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.message).toContain('merchant');
    });
  });

  describe('routing to intermission handler', () => {
    it('should route intermission rooms to resolveIntermissionRoom', () => {
      const room = createIntermissionRoom();
      const state = createMockRunState({ depth: 10 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.message).toContain('trading post');
    });
  });

  describe('routing to ally handler', () => {
    it('should route ally rooms to resolveAllyRoom', () => {
      const room = createAllyRoom();
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.resolved).toBe(true);
      expect(result.xpEarned).toBe(25);
    });
  });

  describe('unknown room types', () => {
    it('should return resolved: false for unknown room types (canResolveRoom returns false)', () => {
      const room = createMockRoom({ type: 'mystery' as any });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      // Unknown types fail canResolveRoom check, so never reach fallback
      expect(result.resolved).toBe(false);
      expect(result.canAdvance).toBe(false);
    });

    it('should return "cannot be resolved" message for unknown room types', () => {
      const room = createMockRoom({ type: 'mystery' as any });
      const state = createMockRunState({ depth: 5 });
      const rng = new SeededRNG(42);

      const result = resolveRoom(room, state, rng);

      expect(result.message).toContain('cannot be resolved');
    });
  });
});

// ============================================================================
// Test Suite: canAdvanceRoom()
// ============================================================================
describe('canAdvanceRoom', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('when room not resolved', () => {
    it('should return false when roomResolved is false', () => {
      const room = createShrineRoom();
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: false,
      });

      expect(canAdvanceRoom(room, state)).toBe(false);
    });
  });

  describe('when party is dead', () => {
    it('should return false when all party members have 0 HP', () => {
      const room = createShrineRoom();
      const deadMember = createMockCharacter({
        hp: { current: 0, max: 20 },
      });
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
        party: { members: [deadMember], gold: 0 },
      });

      expect(canAdvanceRoom(room, state)).toBe(false);
    });

    it('should return false when all party members are dead', () => {
      const room = createShrineRoom();
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
        party: {
          members: [
            createMockCharacter({ hp: { current: 0, max: 20 } }),
            createMockCharacter({ hp: { current: 0, max: 15 } }),
          ],
          gold: 0,
        },
      });

      expect(canAdvanceRoom(room, state)).toBe(false);
    });
  });

  describe('when room resolved and party alive', () => {
    it('should return true for non-combat rooms', () => {
      const room = createShrineRoom();
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
      });

      expect(canAdvanceRoom(room, state)).toBe(true);
    });

    it('should return true for combat room with dead enemies', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ hp: 0 })],
      });
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
      });

      expect(canAdvanceRoom(room, state)).toBe(true);
    });

    it('should return false for combat room with living enemies', () => {
      const room = createCombatRoom(2);
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true, // Even if marked resolved, enemies alive = can't advance
      });

      expect(canAdvanceRoom(room, state)).toBe(false);
    });

    it('should return true when at least one party member is alive', () => {
      const room = createShrineRoom();
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
        party: {
          members: [
            createMockCharacter({ hp: { current: 0, max: 20 } }),
            createMockCharacter({ hp: { current: 5, max: 20 } }),
          ],
          gold: 0,
        },
      });

      expect(canAdvanceRoom(room, state)).toBe(true);
    });
  });

  describe('elite and boss rooms', () => {
    it('should return true for elite room with dead enemies', () => {
      const room = createMockRoom({
        type: 'elite',
        enemies: [createMockEnemy({ hp: 0 })],
      });
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
      });

      expect(canAdvanceRoom(room, state)).toBe(true);
    });

    it('should return false for boss room with living enemies', () => {
      const room = createBossRoom();
      const state = createMockRunState({
        currentRoom: room,
        roomResolved: true,
      });

      expect(canAdvanceRoom(room, state)).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: getRoomTransitionMessage()
// ============================================================================
describe('getRoomTransitionMessage', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('known transition pairs', () => {
    it('should return message for combat to shrine transition', () => {
      const message = getRoomTransitionMessage('combat', 'shrine');

      expect(message).toContain('peaceful');
    });

    it('should return message for combat to trader transition', () => {
      const message = getRoomTransitionMessage('combat', 'trader');

      expect(message).toContain('merchant');
    });

    it('should return message for combat to hazard transition', () => {
      const message = getRoomTransitionMessage('combat', 'hazard');

      expect(message).toContain('cautiously');
    });

    it('should return message for combat to combat transition', () => {
      const message = getRoomTransitionMessage('combat', 'combat');

      expect(message).toContain('enemies');
    });

    it('should return message for combat to elite transition', () => {
      const message = getRoomTransitionMessage('combat', 'elite');

      expect(message).toContain('powerful');
    });

    it('should return message for combat to boss transition', () => {
      const message = getRoomTransitionMessage('combat', 'boss');

      expect(message).toContain('dread');
    });

    it('should return message for shrine to combat transition', () => {
      const message = getRoomTransitionMessage('shrine', 'combat');

      expect(message).toContain('Blessed');
    });

    it('should return message for hazard to shrine transition', () => {
      const message = getRoomTransitionMessage('hazard', 'shrine');

      expect(message).toContain('calming');
    });

    it('should return message for intermission to combat transition', () => {
      const message = getRoomTransitionMessage('intermission', 'combat');

      expect(message).toContain('Rested');
    });

    it('should return message for boss to intermission transition', () => {
      const message = getRoomTransitionMessage('boss', 'intermission');

      expect(message).toContain('Victory');
    });
  });

  describe('unknown transition pairs', () => {
    it('should return generic message for unknown transitions', () => {
      const message = getRoomTransitionMessage('shrine', 'trader');

      expect(message).toContain('leave');
      expect(message).toContain('shrine');
      expect(message).toContain('trader');
    });

    it('should return generic message for ally to hazard', () => {
      const message = getRoomTransitionMessage('ally', 'hazard');

      expect(message).toContain('ally');
      expect(message).toContain('hazard');
    });
  });

  describe('message format', () => {
    it('should return a non-empty string', () => {
      const message = getRoomTransitionMessage('combat', 'shrine');

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Test Suite: calculateRoomXp()
// ============================================================================
describe('calculateRoomXp', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('non-combat rooms', () => {
    it('should return 0 for shrine rooms', () => {
      const room = createShrineRoom();
      expect(calculateRoomXp(room)).toBe(0);
    });

    it('should return 0 for trader rooms', () => {
      const room = createTraderRoom();
      expect(calculateRoomXp(room)).toBe(0);
    });

    it('should return 0 for hazard rooms via calculateRoomXp', () => {
      const room = createHazardRoom();
      expect(calculateRoomXp(room)).toBe(0);
    });

    it('should return 0 for intermission rooms', () => {
      const room = createIntermissionRoom();
      expect(calculateRoomXp(room)).toBe(0);
    });

    it('should return 0 for ally rooms via calculateRoomXp', () => {
      const room = createAllyRoom();
      expect(calculateRoomXp(room)).toBe(0);
    });
  });

  describe('combat rooms with enemy xp', () => {
    it('should use enemy xp values when > 0', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 50, power: 2 })],
      });

      const xp = calculateRoomXp(room, 0);

      // Base XP = 50 (from enemy.xp), multiplier = 1.0 for combat, no depth bonus
      expect(xp).toBe(50);
    });

    it('should sum xp from multiple enemies', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [
          createMockEnemy({ xp: 25 }),
          createMockEnemy({ xp: 35 }),
          createMockEnemy({ xp: 40 }),
        ],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBe(100); // 25 + 35 + 40
    });
  });

  describe('combat rooms using power calculation', () => {
    it('should use power * 10 when enemy xp is 0', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 0, power: 5 })],
      });

      const xp = calculateRoomXp(room, 0);

      // Power 5 * 10 = 50 XP
      expect(xp).toBe(50);
    });

    it('should use power * 10 when enemy xp is negative', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: -10, power: 3 })],
      });

      const xp = calculateRoomXp(room, 0);

      // Power 3 * 10 = 30 XP
      expect(xp).toBe(30);
    });
  });

  describe('room type multipliers', () => {
    it('should apply 1.0x multiplier for combat rooms', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 100 })],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBe(100);
    });

    it('should apply 1.5x multiplier for elite rooms', () => {
      const room = createMockRoom({
        type: 'elite',
        enemies: [createMockEnemy({ xp: 100 })],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBe(150); // 100 * 1.5
    });

    it('should apply 3.0x multiplier for boss rooms', () => {
      const room = createMockRoom({
        type: 'boss',
        enemies: [createMockEnemy({ xp: 100 })],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBe(300); // 100 * 3.0
    });
  });

  describe('depth bonus', () => {
    it('should add depth * 2 bonus XP', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 50 })],
      });

      const xpDepth0 = calculateRoomXp(room, 0);
      const xpDepth10 = calculateRoomXp(room, 10);

      expect(xpDepth10 - xpDepth0).toBe(20); // 10 * 2
    });

    it('should use depth 0 as default', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 50 })],
      });

      const xpNoDepth = calculateRoomXp(room);
      const xpDepth0 = calculateRoomXp(room, 0);

      expect(xpNoDepth).toBe(xpDepth0);
    });
  });

  describe('minimum XP', () => {
    it('should return at least 1 XP', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [createMockEnemy({ xp: 0, power: 0 })],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBeGreaterThanOrEqual(1);
    });
  });

  describe('empty rooms', () => {
    it('should return minimum XP for combat room with no enemies', () => {
      const room = createMockRoom({
        type: 'combat',
        enemies: [],
      });

      const xp = calculateRoomXp(room, 0);

      expect(xp).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// Test Suite: getXpForNextLevel()
// ============================================================================
describe('getXpForNextLevel', () => {
  describe('XP formula: level * 100 * level', () => {
    it('should return 100 for level 1', () => {
      expect(getXpForNextLevel(1)).toBe(100);
    });

    it('should return 400 for level 2', () => {
      expect(getXpForNextLevel(2)).toBe(400);
    });

    it('should return 900 for level 3', () => {
      expect(getXpForNextLevel(3)).toBe(900);
    });

    it('should return 1600 for level 4', () => {
      expect(getXpForNextLevel(4)).toBe(1600);
    });

    it('should return 2500 for level 5', () => {
      expect(getXpForNextLevel(5)).toBe(2500);
    });

    it('should return 10000 for level 10', () => {
      expect(getXpForNextLevel(10)).toBe(10000);
    });
  });

  describe('quadratic progression', () => {
    it('should follow quadratic curve', () => {
      for (let level = 1; level <= 20; level++) {
        const expected = level * 100 * level;
        expect(getXpForNextLevel(level)).toBe(expected);
      }
    });

    it('should increase faster at higher levels', () => {
      const xp1to2 = getXpForNextLevel(2) - getXpForNextLevel(1);
      const xp5to6 = getXpForNextLevel(6) - getXpForNextLevel(5);
      const xp10to11 = getXpForNextLevel(11) - getXpForNextLevel(10);

      expect(xp5to6).toBeGreaterThan(xp1to2);
      expect(xp10to11).toBeGreaterThan(xp5to6);
    });
  });
});

// ============================================================================
// Test Suite: canLevelUp()
// ============================================================================
describe('canLevelUp', () => {
  describe('when XP >= threshold', () => {
    it('should return true when XP equals threshold', () => {
      expect(canLevelUp(1, 100)).toBe(true);
    });

    it('should return true when XP exceeds threshold', () => {
      expect(canLevelUp(1, 150)).toBe(true);
    });

    it('should return true at level 5 with 2500+ XP', () => {
      expect(canLevelUp(5, 2500)).toBe(true);
      expect(canLevelUp(5, 3000)).toBe(true);
    });
  });

  describe('when XP < threshold', () => {
    it('should return false when XP is 0', () => {
      expect(canLevelUp(1, 0)).toBe(false);
    });

    it('should return false when XP is 1 below threshold', () => {
      expect(canLevelUp(1, 99)).toBe(false);
      expect(canLevelUp(2, 399)).toBe(false);
      expect(canLevelUp(5, 2499)).toBe(false);
    });

    it('should return false at level 10 with insufficient XP', () => {
      expect(canLevelUp(10, 9999)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle level 0 edge case', () => {
      // Level 0 would need 0 XP
      expect(canLevelUp(0, 0)).toBe(true);
    });

    it('should handle very high levels', () => {
      // Level 100: 100 * 100 * 100 = 1,000,000 XP
      expect(canLevelUp(100, 1000000)).toBe(true);
      expect(canLevelUp(100, 999999)).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: RoomResolutionResult Type Validation
// ============================================================================
describe('RoomResolutionResult type', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should include all required properties', () => {
    const room = createShrineRoom();
    const result = resolveShrineRoom(room);

    expect(result).toHaveProperty('resolved');
    expect(result).toHaveProperty('goldEarned');
    expect(result).toHaveProperty('xpEarned');
    expect(result).toHaveProperty('lootDropped');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('canAdvance');
  });

  it('should include optional properties when applicable', () => {
    const room = createShrineRoom();
    const healingResult = resolveShrineRoom(room, 'healing');
    const calmResult = resolveShrineRoom(room, 'calm');

    expect(healingResult.hpRestored).toBe(20);
    expect(calmResult.stressReduced).toBe(5);
  });

  it('should include boonApplied when shrine boon is selected', () => {
    const room = createShrineRoom();
    const result = resolveShrineRoom(room, 'fortune');

    expect(result.boonApplied).toBe('fortune');
  });
});
