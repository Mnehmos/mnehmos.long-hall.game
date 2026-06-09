/**
 * Abilities System Tests - Red Phase
 * 
 * Comprehensive tests for class abilities, cooldown management,
 * ability execution, and validation.
 * 
 * @module tests/unit/engine/abilities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockCharacter,
  createMockEnemy,
  resetAllFixtureIds,
} from '../../fixtures';
import { SeededRNG } from '@lib/rng';
import {
  ALL_ABILITIES,
  getClassAbilities,
  getAbility,
  getAbilitiesWithCooldowns,
  initializeAbilityStates,
  canUseAbility,
  getAbilityBlockedReason,
  executeAbility,
  tickCooldowns,
  tickAbilityStates,
  startCooldown,
  startAbilityCooldown,
  isOnCooldown,
  isAbilityOnCooldown,
  getCooldownRemaining,
  getAbilityCooldownRemaining,
  resetCooldowns,
  resetAbilityCooldowns,
  type AbilityResult,
  type AbilityCooldowns,
} from '@engine/abilities';
import type { AbilityState, Role } from '@engine/types';

// ============================================================================
// Test Suite: ALL_ABILITIES Constant
// ============================================================================
describe('ALL_ABILITIES Constant', () => {
  it('should contain exactly 15 abilities', () => {
    expect(ALL_ABILITIES).toHaveLength(15);
  });

  it('should contain 3 fighter abilities', () => {
    const fighterAbilities = ALL_ABILITIES.filter(a => a.role === 'fighter');
    expect(fighterAbilities).toHaveLength(3);
  });

  it('should contain 3 wizard abilities', () => {
    const wizardAbilities = ALL_ABILITIES.filter(a => a.role === 'wizard');
    expect(wizardAbilities).toHaveLength(3);
  });

  it('should contain 3 cleric abilities', () => {
    const clericAbilities = ALL_ABILITIES.filter(a => a.role === 'cleric');
    expect(clericAbilities).toHaveLength(3);
  });

  it('should contain 3 rogue abilities', () => {
    const rogueAbilities = ALL_ABILITIES.filter(a => a.role === 'rogue');
    expect(rogueAbilities).toHaveLength(3);
  });

  it('should contain 3 ranger abilities', () => {
    const rangerAbilities = ALL_ABILITIES.filter(a => a.role === 'ranger');
    expect(rangerAbilities).toHaveLength(3);
  });

  it('should have fighter abilities: second_wind, action_surge, champion_strike', () => {
    const fighterIds = ALL_ABILITIES
      .filter(a => a.role === 'fighter')
      .map(a => a.id);
    expect(fighterIds).toContain('second_wind');
    expect(fighterIds).toContain('action_surge');
    expect(fighterIds).toContain('champion_strike');
  });

  it('should have wizard abilities: magic_missile, fireball, shield', () => {
    const wizardIds = ALL_ABILITIES
      .filter(a => a.role === 'wizard')
      .map(a => a.id);
    expect(wizardIds).toContain('magic_missile');
    expect(wizardIds).toContain('fireball');
    expect(wizardIds).toContain('shield');
  });

  it('should have cleric abilities: healing_word, sacred_flame, turn_undead', () => {
    const clericIds = ALL_ABILITIES
      .filter(a => a.role === 'cleric')
      .map(a => a.id);
    expect(clericIds).toContain('healing_word');
    expect(clericIds).toContain('sacred_flame');
    expect(clericIds).toContain('turn_undead');
  });

  it('should have rogue abilities: sneak_attack, cunning_action, evasion', () => {
    const rogueIds = ALL_ABILITIES
      .filter(a => a.role === 'rogue')
      .map(a => a.id);
    expect(rogueIds).toContain('sneak_attack');
    expect(rogueIds).toContain('cunning_action');
    expect(rogueIds).toContain('evasion');
  });

  it('should have ranger abilities: aimed_shot, volley, camouflage', () => {
    const rangerIds = ALL_ABILITIES
      .filter(a => a.role === 'ranger')
      .map(a => a.id);
    expect(rangerIds).toContain('aimed_shot');
    expect(rangerIds).toContain('volley');
    expect(rangerIds).toContain('camouflage');
  });

  it('should have unique ability IDs', () => {
    const ids = ALL_ABILITIES.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all required ability properties', () => {
    for (const ability of ALL_ABILITIES) {
      expect(ability).toHaveProperty('id');
      expect(ability).toHaveProperty('name');
      expect(ability).toHaveProperty('role');
      expect(ability).toHaveProperty('description');
      expect(ability).toHaveProperty('cooldownType');
      expect(ability).toHaveProperty('cooldownValue');
      expect(ability).toHaveProperty('effect');
      expect(ability.effect).toHaveProperty('type');
      expect(ability.effect).toHaveProperty('target');
    }
  });
});

// ============================================================================
// Test Suite: getClassAbilities()
// ============================================================================
describe('getClassAbilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('fighter abilities', () => {
    it('should return 3 abilities for fighter role', () => {
      const abilities = getClassAbilities('fighter');
      expect(abilities).toHaveLength(3);
    });

    it('should return second_wind ability for fighter', () => {
      const abilities = getClassAbilities('fighter');
      expect(abilities.some(a => a.id === 'second_wind')).toBe(true);
    });

    it('should return action_surge ability for fighter', () => {
      const abilities = getClassAbilities('fighter');
      expect(abilities.some(a => a.id === 'action_surge')).toBe(true);
    });

    it('should return champion_strike ability for fighter', () => {
      const abilities = getClassAbilities('fighter');
      expect(abilities.some(a => a.id === 'champion_strike')).toBe(true);
    });
  });

  describe('wizard abilities', () => {
    it('should return 3 abilities for wizard role', () => {
      const abilities = getClassAbilities('wizard');
      expect(abilities).toHaveLength(3);
    });

    it('should return magic_missile ability for wizard', () => {
      const abilities = getClassAbilities('wizard');
      expect(abilities.some(a => a.id === 'magic_missile')).toBe(true);
    });

    it('should return fireball ability for wizard', () => {
      const abilities = getClassAbilities('wizard');
      expect(abilities.some(a => a.id === 'fireball')).toBe(true);
    });

    it('should return shield ability for wizard', () => {
      const abilities = getClassAbilities('wizard');
      expect(abilities.some(a => a.id === 'shield')).toBe(true);
    });
  });

  describe('cleric abilities', () => {
    it('should return 3 abilities for cleric role', () => {
      const abilities = getClassAbilities('cleric');
      expect(abilities).toHaveLength(3);
    });

    it('should return healing_word ability for cleric', () => {
      const abilities = getClassAbilities('cleric');
      expect(abilities.some(a => a.id === 'healing_word')).toBe(true);
    });

    it('should return sacred_flame ability for cleric', () => {
      const abilities = getClassAbilities('cleric');
      expect(abilities.some(a => a.id === 'sacred_flame')).toBe(true);
    });

    it('should return turn_undead ability for cleric', () => {
      const abilities = getClassAbilities('cleric');
      expect(abilities.some(a => a.id === 'turn_undead')).toBe(true);
    });
  });

  describe('rogue abilities', () => {
    it('should return 3 abilities for rogue role', () => {
      const abilities = getClassAbilities('rogue');
      expect(abilities).toHaveLength(3);
    });

    it('should return sneak_attack ability for rogue', () => {
      const abilities = getClassAbilities('rogue');
      expect(abilities.some(a => a.id === 'sneak_attack')).toBe(true);
    });

    it('should return cunning_action ability for rogue', () => {
      const abilities = getClassAbilities('rogue');
      expect(abilities.some(a => a.id === 'cunning_action')).toBe(true);
    });

    it('should return evasion ability for rogue', () => {
      const abilities = getClassAbilities('rogue');
      expect(abilities.some(a => a.id === 'evasion')).toBe(true);
    });
  });

  describe('ranger abilities', () => {
    it('should return 3 abilities for ranger role', () => {
      const abilities = getClassAbilities('ranger');
      expect(abilities).toHaveLength(3);
    });

    it('should return aimed_shot ability for ranger', () => {
      const abilities = getClassAbilities('ranger');
      expect(abilities.some(a => a.id === 'aimed_shot')).toBe(true);
    });

    it('should return volley ability for ranger', () => {
      const abilities = getClassAbilities('ranger');
      expect(abilities.some(a => a.id === 'volley')).toBe(true);
    });

    it('should return camouflage ability for ranger', () => {
      const abilities = getClassAbilities('ranger');
      expect(abilities.some(a => a.id === 'camouflage')).toBe(true);
    });
  });

  describe('unknown role', () => {
    it('should return empty array for unknown role', () => {
      const abilities = getClassAbilities('unknown' as Role);
      expect(abilities).toEqual([]);
    });
  });
});

// ============================================================================
// Test Suite: getAbility()
// ============================================================================
describe('getAbility', () => {
  it('should return ability definition for existing ID', () => {
    const ability = getAbility('fireball');
    expect(ability).toBeDefined();
    expect(ability?.id).toBe('fireball');
  });

  it('should return undefined for non-existent ID', () => {
    const ability = getAbility('nonexistent_ability');
    expect(ability).toBeUndefined();
  });

  it('should return correct name for magic_missile', () => {
    const ability = getAbility('magic_missile');
    expect(ability?.name).toBe('Magic Missile');
  });

  it('should return correct role for second_wind', () => {
    const ability = getAbility('second_wind');
    expect(ability?.role).toBe('fighter');
  });

  it('should return correct cooldownType for shield', () => {
    const ability = getAbility('shield');
    expect(ability?.cooldownType).toBe('combat');
  });

  it('should return correct effect type for healing_word', () => {
    const ability = getAbility('healing_word');
    expect(ability?.effect.type).toBe('heal');
  });

  it('should return undefined for empty string', () => {
    const ability = getAbility('');
    expect(ability).toBeUndefined();
  });
});

// ============================================================================
// Test Suite: getAbilitiesWithCooldowns()
// ============================================================================
describe('getAbilitiesWithCooldowns', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should merge ability defs with cooldown states', () => {
    const abilityStates: AbilityState[] = [
      { abilityId: 'second_wind', currentCooldown: 0 },
      { abilityId: 'action_surge', currentCooldown: 1 },
      { abilityId: 'champion_strike', currentCooldown: 2 },
    ];

    const abilities = getAbilitiesWithCooldowns('fighter', abilityStates);

    expect(abilities).toHaveLength(3);
    expect(abilities[0].currentCooldown).toBe(0);
    expect(abilities[1].currentCooldown).toBe(1);
    expect(abilities[2].currentCooldown).toBe(2);
  });

  it('should show isReady: true when cooldown is 0', () => {
    const abilityStates: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const abilities = getAbilitiesWithCooldowns('wizard', abilityStates);
    const fireball = abilities.find(a => a.id === 'fireball');

    expect(fireball?.isReady).toBe(true);
  });

  it('should show isReady: false when cooldown > 0', () => {
    const abilityStates: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 3 },
    ];

    const abilities = getAbilitiesWithCooldowns('wizard', abilityStates);
    const fireball = abilities.find(a => a.id === 'fireball');

    expect(fireball?.isReady).toBe(false);
  });

  it('should default to cooldown 0 for missing state', () => {
    const abilityStates: AbilityState[] = []; // No states provided

    const abilities = getAbilitiesWithCooldowns('fighter', abilityStates);

    expect(abilities[0].currentCooldown).toBe(0);
    expect(abilities[0].isReady).toBe(true);
  });

  it('should return all class abilities with cooldown info', () => {
    const abilityStates: AbilityState[] = [
      { abilityId: 'sneak_attack', currentCooldown: 1 },
      { abilityId: 'cunning_action', currentCooldown: 0 },
      { abilityId: 'evasion', currentCooldown: 0 },
    ];

    const abilities = getAbilitiesWithCooldowns('rogue', abilityStates);

    expect(abilities).toHaveLength(3);
    expect(abilities.every(a => 'currentCooldown' in a)).toBe(true);
    expect(abilities.every(a => 'isReady' in a)).toBe(true);
  });
});

// ============================================================================
// Test Suite: initializeAbilityStates()
// ============================================================================
describe('initializeAbilityStates', () => {
  it('should return ability states for all fighter abilities', () => {
    const states = initializeAbilityStates('fighter');
    expect(states).toHaveLength(3);
  });

  it('should initialize all cooldowns to 0', () => {
    const states = initializeAbilityStates('wizard');
    expect(states.every(s => s.currentCooldown === 0)).toBe(true);
  });

  it('should include correct ability IDs for cleric', () => {
    const states = initializeAbilityStates('cleric');
    const abilityIds = states.map(s => s.abilityId);
    
    expect(abilityIds).toContain('healing_word');
    expect(abilityIds).toContain('sacred_flame');
    expect(abilityIds).toContain('turn_undead');
  });

  it('should return empty array for unknown role', () => {
    const states = initializeAbilityStates('unknown' as Role);
    expect(states).toEqual([]);
  });

  it('should return 3 states for rogue', () => {
    const states = initializeAbilityStates('rogue');
    expect(states).toHaveLength(3);
  });

  it('should return 3 states for ranger', () => {
    const states = initializeAbilityStates('ranger');
    expect(states).toHaveLength(3);
  });
});

// ============================================================================
// Test Suite: canUseAbility()
// ============================================================================
describe('canUseAbility', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('actor alive check', () => {
    it('should return false if actor is dead', () => {
      const deadActor = createMockCharacter({
        role: 'wizard',
        isAlive: false,
        abilities: [{ abilityId: 'fireball', currentCooldown: 0 }],
      });
      const ability = getAbility('fireball')!;
      const target = createMockEnemy();

      const result = canUseAbility(deadActor, ability, target);

      expect(result).toBe(false);
    });

    it('should return true if actor is alive and conditions met', () => {
      const aliveActor = createMockCharacter({
        role: 'wizard',
        isAlive: true,
        abilities: [{ abilityId: 'fireball', currentCooldown: 0 }],
      });
      const ability = getAbility('fireball')!;
      const target = createMockEnemy();

      const result = canUseAbility(aliveActor, ability, target);

      expect(result).toBe(true);
    });
  });

  describe('cooldown check', () => {
    it('should return false if ability is on cooldown', () => {
      const actor = createMockCharacter({
        role: 'wizard',
        isAlive: true,
        abilities: [{ abilityId: 'magic_missile', currentCooldown: 2 }],
      });
      const ability = getAbility('magic_missile')!;
      const target = createMockEnemy();

      const result = canUseAbility(actor, ability, target);

      expect(result).toBe(false);
    });

    it('should return true if ability cooldown is 0', () => {
      const actor = createMockCharacter({
        role: 'wizard',
        isAlive: true,
        abilities: [{ abilityId: 'magic_missile', currentCooldown: 0 }],
      });
      const ability = getAbility('magic_missile')!;
      const target = createMockEnemy();

      const result = canUseAbility(actor, ability, target);

      expect(result).toBe(true);
    });
  });

  describe('sneak attack hidden requirement', () => {
    it('should return false for sneak_attack without hidden status', () => {
      const rogue = createMockCharacter({
        role: 'rogue',
        isAlive: true,
        abilities: [{ abilityId: 'sneak_attack', currentCooldown: 0 }],
        statuses: [],
      });
      const ability = getAbility('sneak_attack')!;
      const target = createMockEnemy();

      const result = canUseAbility(rogue, ability, target);

      expect(result).toBe(false);
    });

    it('should return true for sneak_attack with hidden status', () => {
      const rogue = createMockCharacter({
        role: 'rogue',
        isAlive: true,
        abilities: [{ abilityId: 'sneak_attack', currentCooldown: 0 }],
        statuses: ['hidden'],
      });
      const ability = getAbility('sneak_attack')!;
      const target = createMockEnemy();

      const result = canUseAbility(rogue, ability, target);

      expect(result).toBe(true);
    });
  });

  describe('target validation', () => {
    it('should return false for enemy-targeted ability without target', () => {
      const wizard = createMockCharacter({
        role: 'wizard',
        isAlive: true,
        abilities: [{ abilityId: 'magic_missile', currentCooldown: 0 }],
      });
      const ability = getAbility('magic_missile')!;

      const result = canUseAbility(wizard, ability); // No target

      expect(result).toBe(false);
    });

    it('should return false for ally-targeted ability without target', () => {
      const cleric = createMockCharacter({
        role: 'cleric',
        isAlive: true,
        abilities: [{ abilityId: 'healing_word', currentCooldown: 0 }],
      });
      const ability = getAbility('healing_word')!;

      const result = canUseAbility(cleric, ability); // No target

      expect(result).toBe(false);
    });

    it('should return true for self-targeted ability without target', () => {
      const fighter = createMockCharacter({
        role: 'fighter',
        isAlive: true,
        abilities: [{ abilityId: 'second_wind', currentCooldown: 0 }],
      });
      const ability = getAbility('second_wind')!;

      const result = canUseAbility(fighter, ability); // No target needed

      expect(result).toBe(true);
    });
  });

  describe('all conditions met', () => {
    it('should return true when all conditions are met for damage ability', () => {
      const wizard = createMockCharacter({
        role: 'wizard',
        isAlive: true,
        abilities: [{ abilityId: 'fireball', currentCooldown: 0 }],
      });
      const ability = getAbility('fireball')!;
      const target = createMockEnemy();

      const result = canUseAbility(wizard, ability, target);

      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: getAbilityBlockedReason()
// ============================================================================
describe('getAbilityBlockedReason', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return "Actor is dead" if dead', () => {
    const deadActor = createMockCharacter({
      role: 'wizard',
      isAlive: false,
      abilities: [],
    });
    const ability = getAbility('fireball')!;

    const reason = getAbilityBlockedReason(deadActor, ability);

    expect(reason).toBe('Actor is dead');
  });

  it('should return cooldown message if on cooldown', () => {
    const actor = createMockCharacter({
      role: 'wizard',
      isAlive: true,
      abilities: [{ abilityId: 'fireball', currentCooldown: 3 }],
    });
    const ability = getAbility('fireball')!;

    const reason = getAbilityBlockedReason(actor, ability);

    expect(reason).toBe('On cooldown (3 turns remaining)');
  });

  it('should return "Requires hidden status" for sneak_attack without hidden', () => {
    const rogue = createMockCharacter({
      role: 'rogue',
      isAlive: true,
      abilities: [{ abilityId: 'sneak_attack', currentCooldown: 0 }],
      statuses: [],
    });
    const ability = getAbility('sneak_attack')!;

    const reason = getAbilityBlockedReason(rogue, ability);

    expect(reason).toBe('Requires hidden status');
  });

  it('should return null if ability can be used', () => {
    const wizard = createMockCharacter({
      role: 'wizard',
      isAlive: true,
      abilities: [{ abilityId: 'fireball', currentCooldown: 0 }],
    });
    const ability = getAbility('fireball')!;

    const reason = getAbilityBlockedReason(wizard, ability);

    expect(reason).toBeNull();
  });

  it('should check dead status before cooldown', () => {
    const deadActor = createMockCharacter({
      role: 'wizard',
      isAlive: false,
      abilities: [{ abilityId: 'fireball', currentCooldown: 5 }],
    });
    const ability = getAbility('fireball')!;

    const reason = getAbilityBlockedReason(deadActor, ability);

    expect(reason).toBe('Actor is dead');
  });
});

// ============================================================================
// Test Suite: executeAbility() - Damage Abilities
// ============================================================================
describe('executeAbility - Damage Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('magic_missile', () => {
    it('should deal damage with 3d4+3', () => {
      const rng = new SeededRNG(12345);
      const wizard = createMockCharacter({
        role: 'wizard',
        name: 'Test Wizard',
        isAlive: true,
      });
      const ability = getAbility('magic_missile')!;
      const target = createMockEnemy();

      const result = executeAbility(wizard, ability, target, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.damage).toBeGreaterThanOrEqual(6); // 3d4+3 minimum is 6
      expect(result.damage).toBeLessThanOrEqual(15); // 3d4+3 maximum is 15
      expect(result.message).toContain('Magic Missile');
    });

    it('should produce deterministic results with seeded RNG', () => {
      const wizard = createMockCharacter({ role: 'wizard', name: 'Wizard' });
      const ability = getAbility('magic_missile')!;
      const target = createMockEnemy();

      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const result1 = executeAbility(wizard, ability, target, rng1);
      const result2 = executeAbility(wizard, ability, target, rng2);

      expect(result1.damage).toBe(result2.damage);
    });
  });

  describe('fireball', () => {
    it('should deal AOE damage with 6d6', () => {
      const rng = new SeededRNG(12345);
      const wizard = createMockCharacter({
        role: 'wizard',
        name: 'Test Wizard',
      });
      const ability = getAbility('fireball')!;
      const targets = [createMockEnemy(), createMockEnemy()];

      const result = executeAbility(wizard, ability, targets, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(6); // 6d6 min
      expect(result.damage).toBeLessThanOrEqual(36); // 6d6 max
      expect(result.isAoe).toBe(true);
    });
  });

  describe('sacred_flame', () => {
    it('should deal 1d8 radiant damage', () => {
      const rng = new SeededRNG(12345);
      const cleric = createMockCharacter({
        role: 'cleric',
        name: 'Test Cleric',
      });
      const ability = getAbility('sacred_flame')!;
      const target = createMockEnemy();

      const result = executeAbility(cleric, ability, target, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(1);
      expect(result.damage).toBeLessThanOrEqual(8);
      expect(result.message).toContain('Sacred Flame');
    });
  });

  describe('sneak_attack', () => {
    it('should deal 2d6 bonus damage', () => {
      const rng = new SeededRNG(12345);
      const rogue = createMockCharacter({
        role: 'rogue',
        name: 'Test Rogue',
      });
      const ability = getAbility('sneak_attack')!;
      const target = createMockEnemy();

      const result = executeAbility(rogue, ability, target, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(2);
      expect(result.damage).toBeLessThanOrEqual(12);
    });
  });
});

// ============================================================================
// Test Suite: executeAbility() - Heal Abilities
// ============================================================================
describe('executeAbility - Heal Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('second_wind', () => {
    it('should heal for 1d10 + level', () => {
      const rng = new SeededRNG(12345);
      const fighter = createMockCharacter({
        role: 'fighter',
        name: 'Test Fighter',
        level: 3,
      });
      const ability = getAbility('second_wind')!;

      const result = executeAbility(fighter, ability, fighter, rng);

      expect(result.success).toBe(true);
      expect(result.healing).toBeGreaterThanOrEqual(4); // 1d10+3 min
      expect(result.healing).toBeLessThanOrEqual(13); // 1d10+3 max
      expect(result.message).toContain('Second Wind');
      expect(result.message).toContain('heal');
    });

    it('should include level bonus in healing', () => {
      const rng = new SeededRNG(42);
      const fighter = createMockCharacter({
        role: 'fighter',
        level: 5,
      });
      const ability = getAbility('second_wind')!;

      const result = executeAbility(fighter, ability, fighter, rng);

      // Level 5 should add +5 to healing
      expect(result.healing).toBeGreaterThanOrEqual(6); // 1d10+5 min
      expect(result.healing).toBeLessThanOrEqual(15); // 1d10+5 max
    });
  });

  describe('healing_word', () => {
    it('should heal ally for 1d8 + level', () => {
      const rng = new SeededRNG(12345);
      const cleric = createMockCharacter({
        role: 'cleric',
        name: 'Test Cleric',
        level: 2,
      });
      const ally = createMockCharacter({ name: 'Wounded Ally' });
      const ability = getAbility('healing_word')!;

      const result = executeAbility(cleric, ability, ally, rng);

      expect(result.success).toBe(true);
      expect(result.healing).toBeGreaterThanOrEqual(3); // 1d8+2 min
      expect(result.healing).toBeLessThanOrEqual(10); // 1d8+2 max
      expect(result.message).toContain('Healing Word');
      expect(result.message).toContain('Wounded Ally');
    });
  });
});

// ============================================================================
// Test Suite: executeAbility() - Buff Abilities
// ============================================================================
describe('executeAbility - Buff Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('shield', () => {
    it('should grant +5 AC', () => {
      const rng = new SeededRNG(12345);
      const wizard = createMockCharacter({
        role: 'wizard',
        name: 'Test Wizard',
      });
      const ability = getAbility('shield')!;

      const result = executeAbility(wizard, ability, wizard, rng);

      expect(result.success).toBe(true);
      expect(result.effect).toBe('+5 AC');
      expect(result.message).toContain('Shield');
      expect(result.message).toContain('+5 AC');
    });
  });

  describe('camouflage', () => {
    it('should apply hidden status', () => {
      const rng = new SeededRNG(12345);
      const ranger = createMockCharacter({
        role: 'ranger',
        name: 'Test Ranger',
      });
      const ability = getAbility('camouflage')!;

      const result = executeAbility(ranger, ability, ranger, rng);

      expect(result.success).toBe(true);
      expect(result.statusApplied).toBe('hidden');
      expect(result.message).toContain('Camouflage');
    });
  });
});

// ============================================================================
// Test Suite: executeAbility() - Debuff Abilities
// ============================================================================
describe('executeAbility - Debuff Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('turn_undead', () => {
    it('should apply debuff effect', () => {
      const rng = new SeededRNG(12345);
      const cleric = createMockCharacter({
        role: 'cleric',
        name: 'Test Cleric',
      });
      const ability = getAbility('turn_undead')!;
      const targets = [createMockEnemy(), createMockEnemy()];

      const result = executeAbility(cleric, ability, targets, rng);

      expect(result.success).toBe(true);
      expect(result.effect).toBe('debuff');
      expect(result.isAoe).toBe(true);
      expect(result.message).toContain('Turn Undead');
    });
  });
});

// ============================================================================
// Test Suite: executeAbility() - Attack Abilities
// ============================================================================
describe('executeAbility - Attack Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('champion_strike', () => {
    it('should deal weapon + 2d6 bonus damage', () => {
      const rng = new SeededRNG(12345);
      const fighter = createMockCharacter({
        role: 'fighter',
        name: 'Test Fighter',
      });
      const ability = getAbility('champion_strike')!;
      const target = createMockEnemy();

      const result = executeAbility(fighter, ability, target, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(2); // 2d6 min
      expect(result.damage).toBeLessThanOrEqual(12); // 2d6 max
      expect(result.message).toContain('Champion Strike');
      expect(result.effect).toBe('add_weapon_damage');
    });
  });

  describe('aimed_shot', () => {
    it('should deal +2 damage with +5 attack bonus', () => {
      const rng = new SeededRNG(12345);
      const ranger = createMockCharacter({
        role: 'ranger',
        name: 'Test Ranger',
      });
      const ability = getAbility('aimed_shot')!;
      const target = createMockEnemy();

      const result = executeAbility(ranger, ability, target, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBe(2); // Just the +2 damage bonus
      expect(result.message).toContain('Aimed Shot');
    });
  });
});

// ============================================================================
// Test Suite: executeAbility() - Special Abilities
// ============================================================================
describe('executeAbility - Special Abilities', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('action_surge', () => {
    it('should grant extra attack', () => {
      const rng = new SeededRNG(12345);
      const fighter = createMockCharacter({
        role: 'fighter',
        name: 'Test Fighter',
      });
      const ability = getAbility('action_surge')!;

      const result = executeAbility(fighter, ability, fighter, rng);

      expect(result.success).toBe(true);
      expect(result.extraAttacks).toBe(1);
      expect(result.message).toContain('Action Surge');
      expect(result.message).toContain('Extra attack');
    });
  });

  describe('cunning_action', () => {
    it('should apply hidden status', () => {
      const rng = new SeededRNG(12345);
      const rogue = createMockCharacter({
        role: 'rogue',
        name: 'Test Rogue',
      });
      const ability = getAbility('cunning_action')!;

      const result = executeAbility(rogue, ability, rogue, rng);

      expect(result.success).toBe(true);
      expect(result.statusApplied).toBe('hidden');
      expect(result.effect).toBe('hidden');
      expect(result.message).toContain('Cunning Action');
      expect(result.message).toContain('hide');
    });
  });

  describe('evasion', () => {
    it('should apply evasion effect', () => {
      const rng = new SeededRNG(12345);
      const rogue = createMockCharacter({
        role: 'rogue',
        name: 'Test Rogue',
      });
      const ability = getAbility('evasion')!;

      const result = executeAbility(rogue, ability, rogue, rng);

      expect(result.success).toBe(true);
      expect(result.effect).toBe('evasion');
      expect(result.message).toContain('Evasion');
      expect(result.message).toContain('dodge');
    });
  });

  describe('volley', () => {
    it('should deal AOE ranged damage', () => {
      const rng = new SeededRNG(12345);
      const ranger = createMockCharacter({
        role: 'ranger',
        name: 'Test Ranger',
      });
      const ability = getAbility('volley')!;
      const targets = [createMockEnemy(), createMockEnemy()];

      const result = executeAbility(ranger, ability, targets, rng);

      expect(result.success).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(1); // 1d6 min
      expect(result.damage).toBeLessThanOrEqual(6); // 1d6 max
      expect(result.isAoe).toBe(true);
      expect(result.message).toContain('Volley');
    });
  });
});

// ============================================================================
// Test Suite: tickCooldowns() - Record-based
// ============================================================================
describe('tickCooldowns', () => {
  it('should decrement all cooldowns by 1', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 3,
      shield: 1,
      magic_missile: 2,
    };

    const result = tickCooldowns(cooldowns);

    expect(result.fireball).toBe(2);
    expect(result.shield).toBe(0);
    expect(result.magic_missile).toBe(1);
  });

  it('should not go below 0', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 0,
      shield: 1,
    };

    const result = tickCooldowns(cooldowns);

    expect(result.fireball).toBe(0);
    expect(result.shield).toBe(0);
  });

  it('should handle empty cooldowns', () => {
    const cooldowns: AbilityCooldowns = {};

    const result = tickCooldowns(cooldowns);

    expect(result).toEqual({});
  });

  it('should return new object (immutability)', () => {
    const cooldowns: AbilityCooldowns = { fireball: 3 };

    const result = tickCooldowns(cooldowns);

    expect(result).not.toBe(cooldowns);
    expect(cooldowns.fireball).toBe(3); // Original unchanged
  });
});

// ============================================================================
// Test Suite: tickAbilityStates() - Array-based
// ============================================================================
describe('tickAbilityStates', () => {
  it('should decrement all currentCooldown values by 1', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 3 },
      { abilityId: 'shield', currentCooldown: 1 },
    ];

    const result = tickAbilityStates(abilities);

    expect(result[0].currentCooldown).toBe(2);
    expect(result[1].currentCooldown).toBe(0);
  });

  it('should not go below 0', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = tickAbilityStates(abilities);

    expect(result[0].currentCooldown).toBe(0);
  });

  it('should handle empty array', () => {
    const abilities: AbilityState[] = [];

    const result = tickAbilityStates(abilities);

    expect(result).toEqual([]);
  });

  it('should return new array (immutability)', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 3 },
    ];

    const result = tickAbilityStates(abilities);

    expect(result).not.toBe(abilities);
    expect(abilities[0].currentCooldown).toBe(3); // Original unchanged
  });
});

// ============================================================================
// Test Suite: startCooldown() - Record-based
// ============================================================================
describe('startCooldown', () => {
  it('should set cooldown to ability cooldownValue', () => {
    const cooldowns: AbilityCooldowns = {};

    const result = startCooldown('fireball', cooldowns);

    // Fireball has cooldownValue of 1 (rest type)
    expect(result.fireball).toBe(1);
  });

  it('should update existing cooldown', () => {
    const cooldowns: AbilityCooldowns = {
      magic_missile: 0,
    };

    const result = startCooldown('magic_missile', cooldowns);

    // Magic Missile has cooldownValue of 2
    expect(result.magic_missile).toBe(2);
  });

  it('should return unchanged if ability not found', () => {
    const cooldowns: AbilityCooldowns = { fireball: 0 };

    const result = startCooldown('nonexistent', cooldowns);

    expect(result).toEqual(cooldowns);
  });

  it('should preserve other cooldowns', () => {
    const cooldowns: AbilityCooldowns = {
      shield: 1,
    };

    const result = startCooldown('fireball', cooldowns);

    expect(result.shield).toBe(1);
    expect(result.fireball).toBe(1);
  });
});

// ============================================================================
// Test Suite: startAbilityCooldown() - Array-based
// ============================================================================
describe('startAbilityCooldown', () => {
  it('should set cooldown to ability cooldownValue for existing state', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = startAbilityCooldown('fireball', abilities);

    expect(result[0].currentCooldown).toBe(1); // Fireball cooldownValue
  });

  it('should add new state if ability not in array', () => {
    const abilities: AbilityState[] = [];

    const result = startAbilityCooldown('magic_missile', abilities);

    expect(result).toHaveLength(1);
    expect(result[0].abilityId).toBe('magic_missile');
    expect(result[0].currentCooldown).toBe(2);
  });

  it('should return unchanged if ability not found', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = startAbilityCooldown('nonexistent', abilities);

    expect(result).toEqual(abilities);
  });

  it('should preserve other ability states', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'shield', currentCooldown: 0 },
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = startAbilityCooldown('fireball', abilities);

    expect(result[0].abilityId).toBe('shield');
    expect(result[0].currentCooldown).toBe(0);
    expect(result[1].currentCooldown).toBe(1);
  });
});

// ============================================================================
// Test Suite: isOnCooldown() - Record-based
// ============================================================================
describe('isOnCooldown', () => {
  it('should return true if cooldown > 0', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 3,
    };

    const result = isOnCooldown('fireball', cooldowns);

    expect(result).toBe(true);
  });

  it('should return false if cooldown is 0', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 0,
    };

    const result = isOnCooldown('fireball', cooldowns);

    expect(result).toBe(false);
  });

  it('should return false if ability not in cooldowns', () => {
    const cooldowns: AbilityCooldowns = {};

    const result = isOnCooldown('fireball', cooldowns);

    expect(result).toBe(false);
  });
});

// ============================================================================
// Test Suite: isAbilityOnCooldown() - Array-based
// ============================================================================
describe('isAbilityOnCooldown', () => {
  it('should return true if currentCooldown > 0', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 3 },
    ];

    const result = isAbilityOnCooldown('fireball', abilities);

    expect(result).toBe(true);
  });

  it('should return false if currentCooldown is 0', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = isAbilityOnCooldown('fireball', abilities);

    expect(result).toBe(false);
  });

  it('should return false if ability not in array', () => {
    const abilities: AbilityState[] = [];

    const result = isAbilityOnCooldown('fireball', abilities);

    expect(result).toBe(false);
  });
});

// ============================================================================
// Test Suite: getCooldownRemaining() - Record-based
// ============================================================================
describe('getCooldownRemaining', () => {
  it('should return remaining turns', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 5,
    };

    const result = getCooldownRemaining('fireball', cooldowns);

    expect(result).toBe(5);
  });

  it('should return 0 if cooldown is 0', () => {
    const cooldowns: AbilityCooldowns = {
      fireball: 0,
    };

    const result = getCooldownRemaining('fireball', cooldowns);

    expect(result).toBe(0);
  });

  it('should return 0 if ability not found', () => {
    const cooldowns: AbilityCooldowns = {};

    const result = getCooldownRemaining('fireball', cooldowns);

    expect(result).toBe(0);
  });
});

// ============================================================================
// Test Suite: getAbilityCooldownRemaining() - Array-based
// ============================================================================
describe('getAbilityCooldownRemaining', () => {
  it('should return remaining turns', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 5 },
    ];

    const result = getAbilityCooldownRemaining('fireball', abilities);

    expect(result).toBe(5);
  });

  it('should return 0 if currentCooldown is 0', () => {
    const abilities: AbilityState[] = [
      { abilityId: 'fireball', currentCooldown: 0 },
    ];

    const result = getAbilityCooldownRemaining('fireball', abilities);

    expect(result).toBe(0);
  });

  it('should return 0 if ability not found', () => {
    const abilities: AbilityState[] = [];

    const result = getAbilityCooldownRemaining('fireball', abilities);

    expect(result).toBe(0);
  });
});

// ============================================================================
// Test Suite: resetCooldowns() - Record-based
// ============================================================================
describe('resetCooldowns', () => {
  describe('rest type reset', () => {
    it('should reset all cooldowns', () => {
      const cooldowns: AbilityCooldowns = {
        fireball: 3, // rest type
        shield: 1,   // combat type
        magic_missile: 2, // turns type
      };

      const result = resetCooldowns(cooldowns, 'rest');

      expect(result).toEqual({});
    });
  });

  describe('combat type reset', () => {
    it('should only reset combat-type cooldowns', () => {
      const cooldowns: AbilityCooldowns = {
        shield: 1,        // combat type - should be reset
        sneak_attack: 1,  // combat type - should be reset
        fireball: 1,      // rest type - should remain
        magic_missile: 2, // turns type - should remain
      };

      const result = resetCooldowns(cooldowns, 'combat');

      // Combat cooldowns are removed (reset)
      expect(result.shield).toBeUndefined();
      expect(result.sneak_attack).toBeUndefined();
      // Non-combat cooldowns remain
      expect(result.fireball).toBe(1);
      expect(result.magic_missile).toBe(2);
    });

    it('should preserve rest-type cooldowns', () => {
      const cooldowns: AbilityCooldowns = {
        second_wind: 1, // rest type
        fireball: 1,    // rest type
      };

      const result = resetCooldowns(cooldowns, 'combat');

      expect(result.second_wind).toBe(1);
      expect(result.fireball).toBe(1);
    });

    it('should preserve turns-type cooldowns', () => {
      const cooldowns: AbilityCooldowns = {
        magic_missile: 2,   // turns type
        champion_strike: 3, // turns type
      };

      const result = resetCooldowns(cooldowns, 'combat');

      expect(result.magic_missile).toBe(2);
      expect(result.champion_strike).toBe(3);
    });
  });
});

// ============================================================================
// Test Suite: resetAbilityCooldowns() - Array-based
// ============================================================================
describe('resetAbilityCooldowns', () => {
  describe('rest type reset', () => {
    it('should reset all cooldowns to 0', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'fireball', currentCooldown: 3 },
        { abilityId: 'shield', currentCooldown: 1 },
        { abilityId: 'magic_missile', currentCooldown: 2 },
      ];

      const result = resetAbilityCooldowns(abilities, 'rest');

      expect(result[0].currentCooldown).toBe(0);
      expect(result[1].currentCooldown).toBe(0);
      expect(result[2].currentCooldown).toBe(0);
    });

    it('should preserve ability IDs', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'fireball', currentCooldown: 3 },
      ];

      const result = resetAbilityCooldowns(abilities, 'rest');

      expect(result[0].abilityId).toBe('fireball');
    });
  });

  describe('combat type reset', () => {
    it('should only reset combat-type cooldowns', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'shield', currentCooldown: 1 },        // combat type
        { abilityId: 'sneak_attack', currentCooldown: 1 },  // combat type
        { abilityId: 'fireball', currentCooldown: 1 },      // rest type
        { abilityId: 'magic_missile', currentCooldown: 2 }, // turns type
      ];

      const result = resetAbilityCooldowns(abilities, 'combat');

      const shieldState = result.find(a => a.abilityId === 'shield');
      const sneakState = result.find(a => a.abilityId === 'sneak_attack');
      const fireballState = result.find(a => a.abilityId === 'fireball');
      const missileState = result.find(a => a.abilityId === 'magic_missile');

      expect(shieldState?.currentCooldown).toBe(0);
      expect(sneakState?.currentCooldown).toBe(0);
      expect(fireballState?.currentCooldown).toBe(1);
      expect(missileState?.currentCooldown).toBe(2);
    });

    it('should preserve camouflage cooldown (combat type)', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'camouflage', currentCooldown: 1 }, // combat type
      ];

      const result = resetAbilityCooldowns(abilities, 'combat');

      expect(result[0].currentCooldown).toBe(0);
    });
  });

  describe('immutability', () => {
    it('should return new array', () => {
      const abilities: AbilityState[] = [
        { abilityId: 'fireball', currentCooldown: 3 },
      ];

      const result = resetAbilityCooldowns(abilities, 'rest');

      expect(result).not.toBe(abilities);
      expect(abilities[0].currentCooldown).toBe(3);
    });
  });
});

// ============================================================================
// Test Suite: Edge Cases and Integration
// ============================================================================
describe('Edge Cases and Integration', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('ability with missing dice', () => {
    it('should handle ability without dice gracefully', () => {
      const rng = new SeededRNG(12345);
      const ranger = createMockCharacter({ role: 'ranger' });
      // aimed_shot has no dice, only damage bonus
      const ability = getAbility('aimed_shot')!;
      const target = createMockEnemy();

      const result = executeAbility(ranger, ability, target, rng);

      expect(result.success).toBe(true);
    });
  });

  describe('multiple ability state operations', () => {
    it('should handle complex cooldown workflow', () => {
      // Initialize
      let abilities = initializeAbilityStates('wizard');
      expect(abilities.every(a => a.currentCooldown === 0)).toBe(true);

      // Use fireball
      abilities = startAbilityCooldown('fireball', abilities);
      expect(isAbilityOnCooldown('fireball', abilities)).toBe(true);

      // Tick cooldown
      abilities = tickAbilityStates(abilities);
      expect(getAbilityCooldownRemaining('fireball', abilities)).toBe(0);

      // Reset after rest
      abilities = startAbilityCooldown('fireball', abilities);
      abilities = resetAbilityCooldowns(abilities, 'rest');
      expect(abilities.every(a => a.currentCooldown === 0)).toBe(true);
    });
  });

  describe('deterministic RNG across multiple calls', () => {
    it('should produce consistent sequence', () => {
      const rng1 = new SeededRNG(99999);
      const rng2 = new SeededRNG(99999);
      const wizard = createMockCharacter({ role: 'wizard', level: 5 });
      const fireball = getAbility('fireball')!;
      const magicMissile = getAbility('magic_missile')!;
      const targets = [createMockEnemy()];

      const result1a = executeAbility(wizard, fireball, targets, rng1);
      const result1b = executeAbility(wizard, magicMissile, targets[0], rng1);

      const result2a = executeAbility(wizard, fireball, targets, rng2);
      const result2b = executeAbility(wizard, magicMissile, targets[0], rng2);

      expect(result1a.damage).toBe(result2a.damage);
      expect(result1b.damage).toBe(result2b.damage);
    });
  });
});
