/**
 * Rest System Tests - Red Phase
 * 
 * Comprehensive tests for short and long rest mechanics.
 * Tests define expected behavior for HP recovery, cooldown resets,
 * hit dice restoration, stress reduction, and cost calculations.
 * 
 * @module tests/unit/engine/rest
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockCharacter,
  resetAllFixtureIds,
} from '../../fixtures';
import {
  calculateShortRestHealing,
  calculateLongRestHealing,
  applyShortRest,
  applyLongRest,
  shortRestParty,
  longRestParty,
  calculateLongRestCost,
  canAffordLongRest,
  getRestOptions,
  SHORT_REST_HEAL_PERCENT,
  LONG_REST_HEAL_PERCENT,
  LONG_REST_GOLD_COST,
} from '@engine/rest';
import type { Actor, AbilityState } from '@engine/types';

// ============================================================================
// Test Suite: Constants
// ============================================================================
describe('Rest Constants', () => {
  it('should have SHORT_REST_HEAL_PERCENT equal to 0.25', () => {
    expect(SHORT_REST_HEAL_PERCENT).toBe(0.25);
  });

  it('should have LONG_REST_HEAL_PERCENT equal to 0.50', () => {
    expect(LONG_REST_HEAL_PERCENT).toBe(0.50);
  });

  it('should have LONG_REST_GOLD_COST equal to 10', () => {
    expect(LONG_REST_GOLD_COST).toBe(10);
  });
});

// ============================================================================
// Test Suite: calculateShortRestHealing()
// ============================================================================
describe('calculateShortRestHealing', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic healing calculation', () => {
    it('should return floor of 25% of max HP for standard character', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 20 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 20 * 0.25 = 5
      expect(healing).toBe(5);
    });

    it('should return floor of 25% for max HP of 100', () => {
      const character = createMockCharacter({
        hp: { current: 50, max: 100 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 100 * 0.25 = 25
      expect(healing).toBe(25);
    });

    it('should floor the result for odd max HP values', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 17 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 17 * 0.25 = 4.25 -> floor to 4
      expect(healing).toBe(4);
    });

    it('should return 0 for max HP of 0', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 0 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      expect(healing).toBe(0);
    });

    it('should return 0 for max HP of 1', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 1 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 1 * 0.25 = 0.25 -> floor to 0
      expect(healing).toBe(0);
    });

    it('should return 0 for max HP of 2', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 2 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 2 * 0.25 = 0.5 -> floor to 0
      expect(healing).toBe(0);
    });

    it('should return 0 for max HP of 3', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 3 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 3 * 0.25 = 0.75 -> floor to 0
      expect(healing).toBe(0);
    });

    it('should return 1 for max HP of 4', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 4 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 4 * 0.25 = 1
      expect(healing).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very large max HP values', () => {
      const character = createMockCharacter({
        hp: { current: 100, max: 999 },
      });
      
      const healing = calculateShortRestHealing(character);
      
      // 999 * 0.25 = 249.75 -> floor to 249
      expect(healing).toBe(249);
    });

    it('should not depend on current HP value', () => {
      const fullHealth = createMockCharacter({
        hp: { current: 40, max: 40 },
      });
      const lowHealth = createMockCharacter({
        hp: { current: 1, max: 40 },
      });
      
      expect(calculateShortRestHealing(fullHealth)).toBe(10);
      expect(calculateShortRestHealing(lowHealth)).toBe(10);
    });
  });
});

// ============================================================================
// Test Suite: calculateLongRestHealing()
// ============================================================================
describe('calculateLongRestHealing', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('basic healing calculation', () => {
    it('should return floor of 50% of max HP for standard character', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 20 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 20 * 0.50 = 10
      expect(healing).toBe(10);
    });

    it('should return floor of 50% for max HP of 100', () => {
      const character = createMockCharacter({
        hp: { current: 50, max: 100 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 100 * 0.50 = 50
      expect(healing).toBe(50);
    });

    it('should floor the result for odd max HP values', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 17 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 17 * 0.50 = 8.5 -> floor to 8
      expect(healing).toBe(8);
    });

    it('should return 0 for max HP of 0', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 0 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      expect(healing).toBe(0);
    });

    it('should return 0 for max HP of 1', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 1 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 1 * 0.50 = 0.5 -> floor to 0
      expect(healing).toBe(0);
    });

    it('should return 1 for max HP of 2', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 2 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 2 * 0.50 = 1
      expect(healing).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very large max HP values', () => {
      const character = createMockCharacter({
        hp: { current: 100, max: 999 },
      });
      
      const healing = calculateLongRestHealing(character);
      
      // 999 * 0.50 = 499.5 -> floor to 499
      expect(healing).toBe(499);
    });

    it('should not depend on current HP value', () => {
      const fullHealth = createMockCharacter({
        hp: { current: 40, max: 40 },
      });
      const lowHealth = createMockCharacter({
        hp: { current: 1, max: 40 },
      });
      
      expect(calculateLongRestHealing(fullHealth)).toBe(20);
      expect(calculateLongRestHealing(lowHealth)).toBe(20);
    });
  });
});

// ============================================================================
// Test Suite: applyShortRest()
// ============================================================================
describe('applyShortRest', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('HP healing', () => {
    it('should heal actor by 25% of max HP', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 40 },
      });
      
      const rested = applyShortRest(character);
      
      // 40 * 0.25 = 10, so 10 + 10 = 20
      expect(rested.hp.current).toBe(20);
    });

    it('should not overheal past max HP', () => {
      const character = createMockCharacter({
        hp: { current: 38, max: 40 },
      });
      
      const rested = applyShortRest(character);
      
      // Would be 38 + 10 = 48, but capped at 40
      expect(rested.hp.current).toBe(40);
    });

    it('should not overheal when already at full HP', () => {
      const character = createMockCharacter({
        hp: { current: 40, max: 40 },
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.hp.current).toBe(40);
    });

    it('should heal from 0 HP', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 20 },
      });
      
      const rested = applyShortRest(character);
      
      // 20 * 0.25 = 5
      expect(rested.hp.current).toBe(5);
    });

    it('should preserve max HP value', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 40 },
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.hp.max).toBe(40);
    });
  });

  describe('ability cooldown reset', () => {
    it('should reset rest-based ability cooldowns (cooldown >= 999)', () => {
      const restAbility: AbilityState = {
        abilityId: 'second_wind',
        currentCooldown: 999,
      };
      const character = createMockCharacter({
        abilities: [restAbility],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
    });

    it('should reset abilities with cooldown exactly 999', () => {
      const ability: AbilityState = {
        abilityId: 'healing_surge',
        currentCooldown: 999,
      };
      const character = createMockCharacter({
        abilities: [ability],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
    });

    it('should reset abilities with cooldown greater than 999', () => {
      const ability: AbilityState = {
        abilityId: 'greater_ability',
        currentCooldown: 1000,
      };
      const character = createMockCharacter({
        abilities: [ability],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
    });

    it('should NOT reset turn-based cooldowns (cooldown < 999)', () => {
      const turnAbility: AbilityState = {
        abilityId: 'power_attack',
        currentCooldown: 3,
      };
      const character = createMockCharacter({
        abilities: [turnAbility],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(3);
    });

    it('should NOT reset cooldown of 998', () => {
      const ability: AbilityState = {
        abilityId: 'borderline_ability',
        currentCooldown: 998,
      };
      const character = createMockCharacter({
        abilities: [ability],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(998);
    });

    it('should handle mixed cooldown abilities', () => {
      const restAbility: AbilityState = {
        abilityId: 'rest_ability',
        currentCooldown: 999,
      };
      const turnAbility: AbilityState = {
        abilityId: 'turn_ability',
        currentCooldown: 2,
      };
      const character = createMockCharacter({
        abilities: [restAbility, turnAbility],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0); // Rest ability reset
      expect(rested.abilities[1].currentCooldown).toBe(2); // Turn ability unchanged
    });

    it('should not affect ready abilities (cooldown 0)', () => {
      const readyAbility: AbilityState = {
        abilityId: 'ready_skill',
        currentCooldown: 0,
      };
      const character = createMockCharacter({
        abilities: [readyAbility],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
    });
  });

  describe('property preservation', () => {
    it('should preserve actor id', () => {
      const character = createMockCharacter({ name: 'Test Hero' });
      
      const rested = applyShortRest(character);
      
      expect(rested.id).toBe(character.id);
    });

    it('should preserve actor name', () => {
      const character = createMockCharacter({ name: 'Brave Knight' });
      
      const rested = applyShortRest(character);
      
      expect(rested.name).toBe('Brave Knight');
    });

    it('should preserve actor level', () => {
      const character = createMockCharacter({ level: 5 });
      
      const rested = applyShortRest(character);
      
      expect(rested.level).toBe(5);
    });

    it('should preserve actor role', () => {
      const character = createMockCharacter({ role: 'wizard' });
      
      const rested = applyShortRest(character);
      
      expect(rested.role).toBe('wizard');
    });

    it('should preserve stress values (short rest does not affect stress)', () => {
      const character = createMockCharacter({
        stress: { current: 10, max: 20 },
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.stress.current).toBe(10);
      expect(rested.stress.max).toBe(20);
    });

    it('should preserve hit dice (short rest does not affect hit dice)', () => {
      const character = createMockCharacter({
        hitDice: { current: 2, max: 5, die: 10 },
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.hitDice.current).toBe(2);
      expect(rested.hitDice.max).toBe(5);
      expect(rested.hitDice.die).toBe(10);
    });

    it('should preserve equipment', () => {
      const character = createMockCharacter({
        equipment: {},
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.equipment).toBeDefined();
    });

    it('should preserve statuses', () => {
      const character = createMockCharacter({
        statuses: ['blessed', 'hidden'],
      });
      
      const rested = applyShortRest(character);
      
      expect(rested.statuses).toEqual(['blessed', 'hidden']);
    });
  });

  describe('immutability', () => {
    it('should return a new actor object, not mutate the original', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 40 },
      });
      const originalHp = character.hp.current;
      
      const rested = applyShortRest(character);
      
      expect(character.hp.current).toBe(originalHp);
      expect(rested).not.toBe(character);
    });

    it('should not mutate original abilities array', () => {
      const ability: AbilityState = {
        abilityId: 'test',
        currentCooldown: 999,
      };
      const character = createMockCharacter({
        abilities: [ability],
      });
      
      applyShortRest(character);
      
      expect(character.abilities[0].currentCooldown).toBe(999);
    });
  });
});

// ============================================================================
// Test Suite: applyLongRest()
// ============================================================================
describe('applyLongRest', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('HP healing', () => {
    it('should heal actor by 50% of max HP', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 40 },
      });
      
      const rested = applyLongRest(character);
      
      // 40 * 0.50 = 20, so 10 + 20 = 30
      expect(rested.hp.current).toBe(30);
    });

    it('should not overheal past max HP', () => {
      const character = createMockCharacter({
        hp: { current: 35, max: 40 },
      });
      
      const rested = applyLongRest(character);
      
      // Would be 35 + 20 = 55, but capped at 40
      expect(rested.hp.current).toBe(40);
    });

    it('should not overheal when already at full HP', () => {
      const character = createMockCharacter({
        hp: { current: 40, max: 40 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.hp.current).toBe(40);
    });

    it('should heal from 0 HP', () => {
      const character = createMockCharacter({
        hp: { current: 0, max: 20 },
      });
      
      const rested = applyLongRest(character);
      
      // 20 * 0.50 = 10
      expect(rested.hp.current).toBe(10);
    });
  });

  describe('ability cooldown reset', () => {
    it('should reset ALL ability cooldowns to 0', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'ability1', currentCooldown: 5 },
        { abilityId: 'ability2', currentCooldown: 999 },
        { abilityId: 'ability3', currentCooldown: 2 },
      ];
      const character = createMockCharacter({ abilities });
      
      const rested = applyLongRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
      expect(rested.abilities[1].currentCooldown).toBe(0);
      expect(rested.abilities[2].currentCooldown).toBe(0);
    });

    it('should reset turn-based cooldowns (unlike short rest)', () => {
      const turnAbility: AbilityState = {
        abilityId: 'power_attack',
        currentCooldown: 3,
      };
      const character = createMockCharacter({
        abilities: [turnAbility],
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.abilities[0].currentCooldown).toBe(0);
    });

    it('should handle empty abilities array', () => {
      const character = createMockCharacter({
        abilities: [],
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.abilities).toEqual([]);
    });
  });

  describe('hit dice restoration', () => {
    it('should restore half of max hit dice rounded up', () => {
      const character = createMockCharacter({
        hitDice: { current: 0, max: 5, die: 10 },
      });
      
      const rested = applyLongRest(character);
      
      // 5 / 2 = 2.5 -> floor to 2, but min 1 so 2
      // 0 + 2 = 2
      expect(rested.hitDice.current).toBe(2);
    });

    it('should restore minimum 1 hit die', () => {
      const character = createMockCharacter({
        hitDice: { current: 0, max: 1, die: 10 },
      });
      
      const rested = applyLongRest(character);
      
      // 1 / 2 = 0.5 -> floor to 0, but min 1, so add 1
      // 0 + 1 = 1
      expect(rested.hitDice.current).toBe(1);
    });

    it('should not exceed max hit dice', () => {
      const character = createMockCharacter({
        hitDice: { current: 4, max: 5, die: 10 },
      });
      
      const rested = applyLongRest(character);
      
      // 5 / 2 = 2.5 -> floor to 2
      // 4 + 2 = 6, but capped at max 5
      expect(rested.hitDice.current).toBe(5);
    });

    it('should remain at max when already at max hit dice', () => {
      const character = createMockCharacter({
        hitDice: { current: 5, max: 5, die: 10 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.hitDice.current).toBe(5);
    });

    it('should handle 0 max hit dice', () => {
      const character = createMockCharacter({
        hitDice: { current: 0, max: 0, die: 10 },
      });
      
      const rested = applyLongRest(character);
      
      // 0 / 2 = 0, but min 1 -> add 1, then cap at 0
      // Result should be capped at max (0)
      expect(rested.hitDice.current).toBe(0);
    });

    it('should preserve hit die type', () => {
      const character = createMockCharacter({
        hitDice: { current: 0, max: 5, die: 8 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.hitDice.die).toBe(8);
    });
  });

  describe('stress reduction', () => {
    it('should reduce stress by 5', () => {
      const character = createMockCharacter({
        stress: { current: 15, max: 20 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.stress.current).toBe(10);
    });

    it('should not reduce stress below 0', () => {
      const character = createMockCharacter({
        stress: { current: 3, max: 20 },
      });
      
      const rested = applyLongRest(character);
      
      // 3 - 5 = -2, but capped at 0
      expect(rested.stress.current).toBe(0);
    });

    it('should reduce stress exactly to 0 when stress equals 5', () => {
      const character = createMockCharacter({
        stress: { current: 5, max: 20 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.stress.current).toBe(0);
    });

    it('should not affect stress when already at 0', () => {
      const character = createMockCharacter({
        stress: { current: 0, max: 20 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.stress.current).toBe(0);
    });

    it('should preserve max stress value', () => {
      const character = createMockCharacter({
        stress: { current: 10, max: 25 },
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.stress.max).toBe(25);
    });
  });

  describe('property preservation', () => {
    it('should preserve actor id', () => {
      const character = createMockCharacter();
      
      const rested = applyLongRest(character);
      
      expect(rested.id).toBe(character.id);
    });

    it('should preserve actor name and role', () => {
      const character = createMockCharacter({
        name: 'Brave Knight',
        role: 'fighter',
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.name).toBe('Brave Knight');
      expect(rested.role).toBe('fighter');
    });

    it('should preserve equipment', () => {
      const character = createMockCharacter({
        equipment: {},
      });
      
      const rested = applyLongRest(character);
      
      expect(rested.equipment).toBeDefined();
    });
  });

  describe('immutability', () => {
    it('should return a new actor object, not mutate the original', () => {
      const character = createMockCharacter({
        hp: { current: 10, max: 40 },
        stress: { current: 15, max: 20 },
      });
      const originalHp = character.hp.current;
      const originalStress = character.stress.current;
      
      const rested = applyLongRest(character);
      
      expect(character.hp.current).toBe(originalHp);
      expect(character.stress.current).toBe(originalStress);
      expect(rested).not.toBe(character);
    });
  });
});

// ============================================================================
// Test Suite: shortRestParty()
// ============================================================================
describe('shortRestParty', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('living member filtering', () => {
    it('should apply short rest to all living members', () => {
      const member1 = createMockCharacter({
        hp: { current: 10, max: 40 },
        isAlive: true,
      });
      const member2 = createMockCharacter({
        hp: { current: 15, max: 40 },
        isAlive: true,
      });
      const party = [member1, member2];
      
      const restedParty = shortRestParty(party);
      
      // Both should be healed by 10 (40 * 0.25)
      expect(restedParty[0].hp.current).toBe(20);
      expect(restedParty[1].hp.current).toBe(25);
    });

    it('should NOT modify dead members', () => {
      const deadMember = createMockCharacter({
        hp: { current: 0, max: 40 },
        isAlive: false,
      });
      const party = [deadMember];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty[0].hp.current).toBe(0);
      expect(restedParty[0].isAlive).toBe(false);
    });

    it('should handle mixed living and dead members', () => {
      const livingMember = createMockCharacter({
        hp: { current: 10, max: 40 },
        isAlive: true,
      });
      const deadMember = createMockCharacter({
        hp: { current: 0, max: 40 },
        isAlive: false,
      });
      const party = [livingMember, deadMember];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty[0].hp.current).toBe(20); // Living healed
      expect(restedParty[1].hp.current).toBe(0);  // Dead unchanged
    });

    it('should handle empty party', () => {
      const party: Actor[] = [];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty).toEqual([]);
    });

    it('should handle party with all dead members', () => {
      const dead1 = createMockCharacter({
        hp: { current: 0, max: 40 },
        isAlive: false,
      });
      const dead2 = createMockCharacter({
        hp: { current: 0, max: 40 },
        isAlive: false,
      });
      const party = [dead1, dead2];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty[0].hp.current).toBe(0);
      expect(restedParty[1].hp.current).toBe(0);
    });
  });

  describe('array handling', () => {
    it('should preserve party order', () => {
      const member1 = createMockCharacter({ name: 'First', isAlive: true });
      const member2 = createMockCharacter({ name: 'Second', isAlive: true });
      const member3 = createMockCharacter({ name: 'Third', isAlive: true });
      const party = [member1, member2, member3];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty[0].name).toBe('First');
      expect(restedParty[1].name).toBe('Second');
      expect(restedParty[2].name).toBe('Third');
    });

    it('should return new array without mutating original', () => {
      const member = createMockCharacter({
        hp: { current: 10, max: 40 },
        isAlive: true,
      });
      const party = [member];
      
      const restedParty = shortRestParty(party);
      
      expect(restedParty).not.toBe(party);
      expect(party[0].hp.current).toBe(10);
    });
  });
});

// ============================================================================
// Test Suite: longRestParty()
// ============================================================================
describe('longRestParty', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('living member filtering', () => {
    it('should apply long rest to all living members', () => {
      const member1 = createMockCharacter({
        hp: { current: 10, max: 40 },
        stress: { current: 10, max: 20 },
        isAlive: true,
      });
      const member2 = createMockCharacter({
        hp: { current: 15, max: 40 },
        stress: { current: 15, max: 20 },
        isAlive: true,
      });
      const party = [member1, member2];
      
      const restedParty = longRestParty(party);
      
      // Both should be healed by 20 (40 * 0.50) and stress reduced by 5
      expect(restedParty[0].hp.current).toBe(30);
      expect(restedParty[0].stress.current).toBe(5);
      expect(restedParty[1].hp.current).toBe(35);
      expect(restedParty[1].stress.current).toBe(10);
    });

    it('should NOT modify dead members', () => {
      const deadMember = createMockCharacter({
        hp: { current: 0, max: 40 },
        stress: { current: 10, max: 20 },
        isAlive: false,
      });
      const party = [deadMember];
      
      const restedParty = longRestParty(party);
      
      expect(restedParty[0].hp.current).toBe(0);
      expect(restedParty[0].stress.current).toBe(10);
      expect(restedParty[0].isAlive).toBe(false);
    });

    it('should handle mixed living and dead members', () => {
      const livingMember = createMockCharacter({
        hp: { current: 10, max: 40 },
        isAlive: true,
      });
      const deadMember = createMockCharacter({
        hp: { current: 0, max: 40 },
        isAlive: false,
      });
      const party = [livingMember, deadMember];
      
      const restedParty = longRestParty(party);
      
      expect(restedParty[0].hp.current).toBe(30); // Living healed
      expect(restedParty[1].hp.current).toBe(0);  // Dead unchanged
    });

    it('should handle empty party', () => {
      const party: Actor[] = [];
      
      const restedParty = longRestParty(party);
      
      expect(restedParty).toEqual([]);
    });
  });

  describe('array handling', () => {
    it('should preserve party order', () => {
      const member1 = createMockCharacter({ name: 'First', isAlive: true });
      const member2 = createMockCharacter({ name: 'Second', isAlive: true });
      const party = [member1, member2];
      
      const restedParty = longRestParty(party);
      
      expect(restedParty[0].name).toBe('First');
      expect(restedParty[1].name).toBe('Second');
    });

    it('should return new array without mutating original', () => {
      const member = createMockCharacter({
        hp: { current: 10, max: 40 },
        stress: { current: 15, max: 20 },
        isAlive: true,
      });
      const party = [member];
      
      const restedParty = longRestParty(party);
      
      expect(restedParty).not.toBe(party);
      expect(party[0].hp.current).toBe(10);
      expect(party[0].stress.current).toBe(15);
    });
  });
});

// ============================================================================
// Test Suite: calculateLongRestCost()
// ============================================================================
describe('calculateLongRestCost', () => {
  it('should return partySize × 10 for party of 1', () => {
    const cost = calculateLongRestCost(1);
    expect(cost).toBe(10);
  });

  it('should return partySize × 10 for party of 3', () => {
    const cost = calculateLongRestCost(3);
    expect(cost).toBe(30);
  });

  it('should return partySize × 10 for party of 4', () => {
    const cost = calculateLongRestCost(4);
    expect(cost).toBe(40);
  });

  it('should return partySize × 10 for large party', () => {
    const cost = calculateLongRestCost(10);
    expect(cost).toBe(100);
  });

  it('should return 0 for party size of 0', () => {
    const cost = calculateLongRestCost(0);
    expect(cost).toBe(0);
  });
});

// ============================================================================
// Test Suite: canAffordLongRest()
// ============================================================================
describe('canAffordLongRest', () => {
  describe('affordability checks', () => {
    it('should return true when gold exactly equals cost', () => {
      // Party of 3 = 30 gold cost
      const result = canAffordLongRest(30, 3);
      expect(result).toBe(true);
    });

    it('should return true when gold exceeds cost', () => {
      // Party of 2 = 20 gold cost
      const result = canAffordLongRest(50, 2);
      expect(result).toBe(true);
    });

    it('should return false when gold is less than cost', () => {
      // Party of 4 = 40 gold cost
      const result = canAffordLongRest(30, 4);
      expect(result).toBe(false);
    });

    it('should return false when gold is 0', () => {
      const result = canAffordLongRest(0, 1);
      expect(result).toBe(false);
    });

    it('should return true when party size is 0 (no cost)', () => {
      const result = canAffordLongRest(0, 0);
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle large gold amounts', () => {
      const result = canAffordLongRest(10000, 100);
      // 100 * 10 = 1000, should be true
      expect(result).toBe(true);
    });

    it('should handle being exactly 1 gold short', () => {
      // Party of 3 = 30 gold cost
      const result = canAffordLongRest(29, 3);
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: getRestOptions()
// ============================================================================
describe('getRestOptions', () => {
  describe('return structure', () => {
    it('should return exactly two options', () => {
      const options = getRestOptions(50, 3);
      expect(options).toHaveLength(2);
    });

    it('should return short rest as first option', () => {
      const options = getRestOptions(50, 3);
      expect(options[0].type).toBe('short');
    });

    it('should return long rest as second option', () => {
      const options = getRestOptions(50, 3);
      expect(options[1].type).toBe('long');
    });
  });

  describe('short rest option', () => {
    it('should have healPercent of 25', () => {
      const options = getRestOptions(50, 3);
      expect(options[0].healPercent).toBe(25);
    });

    it('should have cost of 0', () => {
      const options = getRestOptions(50, 3);
      expect(options[0].cost).toBe(0);
    });

    it('should always have canAfford: true', () => {
      const options = getRestOptions(0, 3); // Even with 0 gold
      expect(options[0].canAfford).toBe(true);
    });
  });

  describe('long rest option', () => {
    it('should have healPercent of 50', () => {
      const options = getRestOptions(50, 3);
      expect(options[1].healPercent).toBe(50);
    });

    it('should have cost equal to partySize × 10', () => {
      const options = getRestOptions(50, 3);
      expect(options[1].cost).toBe(30);
    });

    it('should have canAfford: true when gold >= cost', () => {
      const options = getRestOptions(50, 3); // 50 >= 30
      expect(options[1].canAfford).toBe(true);
    });

    it('should have canAfford: false when gold < cost', () => {
      const options = getRestOptions(20, 3); // 20 < 30
      expect(options[1].canAfford).toBe(false);
    });

    it('should have canAfford: true when gold exactly equals cost', () => {
      const options = getRestOptions(30, 3); // 30 == 30
      expect(options[1].canAfford).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle 0 gold and 0 party size', () => {
      const options = getRestOptions(0, 0);
      
      expect(options[0].canAfford).toBe(true);
      expect(options[1].cost).toBe(0);
      expect(options[1].canAfford).toBe(true);
    });

    it('should handle single party member', () => {
      const options = getRestOptions(10, 1);
      
      expect(options[1].cost).toBe(10);
      expect(options[1].canAfford).toBe(true);
    });

    it('should handle large party with insufficient gold', () => {
      const options = getRestOptions(50, 10); // Cost = 100
      
      expect(options[1].cost).toBe(100);
      expect(options[1].canAfford).toBe(false);
    });
  });
});
