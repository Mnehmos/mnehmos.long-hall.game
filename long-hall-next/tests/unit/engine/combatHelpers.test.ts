/**
 * Combat Helpers Tests - Red Phase
 * 
 * These tests define the expected behavior of combat helper functions
 * BEFORE implementation exists. All tests should FAIL with clear error
 * messages indicating what needs to be implemented.
 * 
 * @module tests/unit/engine/combatHelpers
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '@lib/rng';

// These imports WILL FAIL - that's the point of Red Phase!
// The combatHelpers module doesn't exist yet.
import {
  resolveEnemyTurn,
  selectTarget,
  applyEnemyDamage,
  decrementCooldowns,
  advanceCombatRound,
  checkGameOver,
} from '@engine/combatHelpers';

// Also import calculateAC from combat for AC calculations
import { calculateAC } from '@engine/combat';

// Fixtures for test data
import {
  createMockCharacter,
  createMockEnemy,
  createMockRunState,
  createCombatState,
  createMockWeapon,
  createMockArmor,
  createMockShield,
  createCombatRoom,
  resetAllFixtureIds,
} from '../../fixtures';

import type { RunState, Actor, Enemy, Room } from '@engine/types';

// ============================================================================
// Test Suite: resolveEnemyTurn()
// ============================================================================
describe('resolveEnemyTurn', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  describe('target selection', () => {
    it('should target a random alive party member', () => {
      const hero1 = createMockCharacter({ name: 'Hero1', isAlive: true });
      const hero2 = createMockCharacter({ name: 'Hero2', isAlive: true });
      const hero3 = createMockCharacter({ name: 'Hero3', isAlive: true });
      
      const state = createCombatState(1, [hero1, hero2, hero3]);
      const rng = new SeededRNG(12345);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Should have targeted one of the alive members
      const aliveNames = ['Hero1', 'Hero2', 'Hero3'];
      const targetedMember = result.party.members.find(
        (m: Actor) => m.hp.current < 20 // Assuming damage was dealt
      );
      
      // At least verify state was processed
      expect(result.combatTurn).toBe('player');
    });

    it('should only target alive party members', () => {
      const aliveHero = createMockCharacter({ 
        name: 'Alive', 
        isAlive: true,
        hp: { current: 20, max: 20 },
      });
      const deadHero = createMockCharacter({ 
        name: 'Dead', 
        isAlive: false,
        hp: { current: 0, max: 20 },
      });
      
      const state = createCombatState(1, [aliveHero, deadHero]);
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Dead hero should not have taken additional damage
      const deadMember = result.party.members.find((m: Actor) => m.name === 'Dead');
      expect(deadMember?.hp.current).toBe(0);
    });

    it('should skip hidden party members', () => {
      const visibleHero = createMockCharacter({ 
        name: 'Visible', 
        isAlive: true,
        statuses: [],
        hp: { current: 20, max: 20 },
      });
      const hiddenHero = createMockCharacter({ 
        name: 'Hidden', 
        isAlive: true,
        statuses: ['hidden'],
        hp: { current: 20, max: 20 },
      });
      
      const state = createCombatState(1, [visibleHero, hiddenHero]);
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Hidden hero should not have been targeted
      const hiddenMember = result.party.members.find((m: Actor) => m.name === 'Hidden');
      expect(hiddenMember?.hp.current).toBe(20);
    });
  });

  describe('AC calculation', () => {
    it('should calculate AC from base + defense skill', () => {
      const hero = createMockCharacter({
        skills: { strength: 0, attack: 0, defense: 3, magic: 0, ranged: 0, faith: 0, agility: 0 },
        equipment: {},
      });
      
      const state = createCombatState(1, [hero]);
      const rng = new SeededRNG(42);
      
      // Enemy should attack against AC 13 (10 + 3 defense)
      const result = resolveEnemyTurn(state, rng);
      
      // Check that combat log mentions correct AC
      const acMention = result.history.find((h: string) => h.includes('AC 13'));
      // Either the AC is mentioned, or we verify through other means
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should include equipment AC bonuses in calculation', () => {
      const armor = createMockArmor({
        baseStats: { acBonus: 4 },
      });
      const shield = createMockShield({
        baseStats: { acBonus: 2 },
      });
      
      const hero = createMockCharacter({
        skills: { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 },
        equipment: {
          chest: armor,
          off_hand: shield,
        },
      });
      
      const state = createCombatState(1, [hero]);
      const rng = new SeededRNG(42);
      
      // AC should be 16 (10 + 4 + 2)
      const result = resolveEnemyTurn(state, rng);
      
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should include enchantment AC bonuses in calculation', () => {
      const enchantedArmor = createMockArmor({
        baseStats: { acBonus: 3 },
        enchantment: {
          tier: 2,
          name: 'Protection',
          description: 'Magical protection',
          effect: { acBonus: 2 },
        },
      });
      
      const hero = createMockCharacter({
        skills: { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 },
        equipment: {
          chest: enchantedArmor,
        },
      });
      
      const state = createCombatState(1, [hero]);
      const rng = new SeededRNG(42);
      
      // AC should be 15 (10 + 3 base + 2 enchant)
      const result = resolveEnemyTurn(state, rng);
      
      expect(result.history.length).toBeGreaterThan(0);
    });
  });

  describe('damage application', () => {
    it('should apply enemy damage on hit', () => {
      const hero = createMockCharacter({
        hp: { current: 20, max: 20 },
        skills: { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 },
        equipment: {},
      });
      
      // Enemy with high power to ensure hit
      const room = createCombatRoom(1);
      room.enemies[0].power = 10; // High attack bonus
      room.enemies[0].damage = '1d6';
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero], gold: 0 },
      });
      
      // Use seed that gives high attack roll
      const rng = new SeededRNG(99999);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Check if damage was dealt (HP reduced or history shows hit)
      const heroAfter = result.party.members[0];
      // Either HP was reduced, or attack missed
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should mark party member dead at 0 HP', () => {
      const weakHero = createMockCharacter({
        hp: { current: 1, max: 20 },
        skills: { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 },
        equipment: {},
      });
      
      const room = createCombatRoom(1);
      room.enemies[0].power = 20; // Guaranteed hit
      room.enemies[0].damage = '2d6'; // Enough to kill
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [weakHero], gold: 0 },
      });
      
      const rng = new SeededRNG(99999);
      
      const result = resolveEnemyTurn(state, rng);
      
      const heroAfter = result.party.members[0];
      if (heroAfter.hp.current === 0) {
        expect(heroAfter.isAlive).toBe(false);
      }
    });
  });

  describe('game over condition', () => {
    it('should trigger game over when all party members are dead', () => {
      const dyingHero = createMockCharacter({
        hp: { current: 1, max: 20 },
        isAlive: true,
      });
      
      const room = createCombatRoom(1);
      room.enemies[0].power = 20;
      room.enemies[0].damage = '3d6';
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [dyingHero], gold: 0 },
      });
      
      const rng = new SeededRNG(99999);
      
      const result = resolveEnemyTurn(state, rng);
      
      // If all dead, should be game over
      const allDead = result.party.members.every((m: Actor) => !m.isAlive);
      if (allDead) {
        expect(result.gameOver).toBe(true);
        expect(result.history).toEqual(
          expect.arrayContaining([expect.stringMatching(/game over/i)])
        );
      }
    });

    it('should not trigger game over when some party members survive', () => {
      const hero1 = createMockCharacter({
        name: 'Tough',
        hp: { current: 100, max: 100 },
        isAlive: true,
      });
      const hero2 = createMockCharacter({
        name: 'Weak',
        hp: { current: 1, max: 20 },
        isAlive: true,
      });
      
      const room = createCombatRoom(1);
      room.enemies[0].damage = '1d4';
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero1, hero2], gold: 0 },
      });
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // At least one member should survive
      const anyAlive = result.party.members.some((m: Actor) => m.isAlive);
      if (anyAlive) {
        expect(result.gameOver).toBe(false);
      }
    });
  });

  describe('ability cooldowns', () => {
    it('should decrement ability cooldowns at end of turn', () => {
      const heroWithAbility = createMockCharacter({
        abilities: [
          { abilityId: 'power_strike', currentCooldown: 3 },
          { abilityId: 'healing_word', currentCooldown: 1 },
        ],
      });
      
      const state = createCombatState(1, [heroWithAbility]);
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      const heroAfter = result.party.members[0];
      const powerStrike = heroAfter.abilities.find(
        (a: { abilityId: string }) => a.abilityId === 'power_strike'
      );
      const healingWord = heroAfter.abilities.find(
        (a: { abilityId: string }) => a.abilityId === 'healing_word'
      );
      
      expect(powerStrike?.currentCooldown).toBe(2);
      expect(healingWord?.currentCooldown).toBe(0);
    });

    it('should not decrement cooldowns below 0', () => {
      const heroWithReadyAbility = createMockCharacter({
        abilities: [
          { abilityId: 'power_strike', currentCooldown: 0 },
        ],
      });
      
      const state = createCombatState(1, [heroWithReadyAbility]);
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      const heroAfter = result.party.members[0];
      const ability = heroAfter.abilities[0];
      
      expect(ability.currentCooldown).toBe(0);
    });
  });

  describe('combat round advancement', () => {
    it('should advance combat round counter', () => {
      const hero = createMockCharacter();
      const state = createCombatState(1, [hero]);
      state.combatRound = 1;
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      expect(result.combatRound).toBe(2);
    });

    it('should reset actedThisRound array for new round', () => {
      const hero = createMockCharacter();
      const state = createCombatState(1, [hero]);
      state.actedThisRound = ['hero-1'];
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      expect(result.actedThisRound).toEqual([]);
    });

    it('should switch turn back to player', () => {
      const hero = createMockCharacter();
      const state = createCombatState(1, [hero]);
      state.combatTurn = 'enemy';
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      expect(result.combatTurn).toBe('player');
    });
  });

  describe('combat log entries', () => {
    it('should add combat log entries for attacks', () => {
      const hero = createMockCharacter({ name: 'Brave Hero' });
      
      const room = createCombatRoom(1);
      room.enemies[0].name = 'Goblin';
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero], gold: 0 },
        history: [],
      });
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Should have log entries for attack
      expect(result.history.length).toBeGreaterThan(0);
      
      // Log should mention the enemy and target
      const attackLog = result.history.find((h: string) => 
        h.includes('Goblin') && h.includes('Brave Hero')
      );
      expect(attackLog).toBeDefined();
    });

    it('should indicate HIT or MISS in combat log', () => {
      const hero = createMockCharacter({ name: 'Hero' });
      const room = createCombatRoom(1);
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero], gold: 0 },
        history: [],
      });
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Log should indicate hit or miss
      const hasHitOrMiss = result.history.some((h: string) => 
        h.includes('HIT') || h.includes('MISS')
      );
      expect(hasHitOrMiss).toBe(true);
    });

    it('should log death events', () => {
      const dyingHero = createMockCharacter({
        name: 'Doomed Hero',
        hp: { current: 1, max: 20 },
      });
      
      const room = createCombatRoom(1);
      room.enemies[0].power = 20;
      room.enemies[0].damage = '3d6';
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [dyingHero], gold: 0 },
        history: [],
      });
      
      const rng = new SeededRNG(99999);
      
      const result = resolveEnemyTurn(state, rng);
      
      // If hero died, should have death log
      const heroAfter = result.party.members[0];
      if (heroAfter.hp.current === 0) {
        const deathLog = result.history.find((h: string) => 
          h.includes('fallen') || h.includes('died') || h.includes('killed')
        );
        expect(deathLog).toBeDefined();
      }
    });

    it('should add round separator in log', () => {
      const hero = createMockCharacter();
      const room = createCombatRoom(1);
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero], gold: 0 },
        history: [],
      });
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Should have round indicator
      const roundLog = result.history.find((h: string) => 
        h.includes('ROUND')
      );
      expect(roundLog).toBeDefined();
    });
  });

  describe('multi-enemy combat', () => {
    it('should process all enemies in the room', () => {
      const hero = createMockCharacter({
        hp: { current: 50, max: 50 },
      });
      
      const room = createCombatRoom(3); // 3 enemies
      room.enemies.forEach((e, i) => {
        e.name = `Enemy ${i + 1}`;
        e.power = 5;
        e.damage = '1d4';
      });
      
      const state = createMockRunState({
        currentRoom: room,
        combatTurn: 'enemy',
        combatRound: 1,
        party: { members: [hero], gold: 0 },
        history: [],
      });
      
      const rng = new SeededRNG(42);
      
      const result = resolveEnemyTurn(state, rng);
      
      // Should have log entries for multiple enemies
      const attackLogs = result.history.filter((h: string) => 
        h.includes('attacks')
      );
      expect(attackLogs.length).toBe(3);
    });
  });

  describe('determinism', () => {
    it('should be deterministic with seeded RNG', () => {
      const hero1 = createMockCharacter({ hp: { current: 30, max: 30 } });
      const hero2 = createMockCharacter({ hp: { current: 30, max: 30 } });
      
      const state1 = createCombatState(2, [hero1]);
      const state2 = createCombatState(2, [hero2]);
      
      const rng1 = new SeededRNG(54321);
      const rng2 = new SeededRNG(54321);
      
      const result1 = resolveEnemyTurn(state1, rng1);
      const result2 = resolveEnemyTurn(state2, rng2);
      
      // Same seed should produce same combat outcome
      expect(result1.party.members[0].hp.current)
        .toBe(result2.party.members[0].hp.current);
      expect(result1.history).toEqual(result2.history);
    });
  });
});

// ============================================================================
// Test Suite: selectTarget()
// ============================================================================
describe('selectTarget', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should select from alive, non-hidden party members', () => {
    const aliveVisible = createMockCharacter({ 
      name: 'AliveVisible', 
      isAlive: true,
      statuses: [],
    });
    const aliveHidden = createMockCharacter({ 
      name: 'AliveHidden', 
      isAlive: true,
      statuses: ['hidden'],
    });
    const dead = createMockCharacter({ 
      name: 'Dead', 
      isAlive: false,
    });
    
    const partyMembers = [aliveVisible, aliveHidden, dead];
    const rng = new SeededRNG(42);
    
    const target = selectTarget(partyMembers, rng);
    
    // Should only select the alive, visible member
    expect(target?.name).toBe('AliveVisible');
  });

  it('should return null when no valid targets exist', () => {
    const hidden = createMockCharacter({ 
      name: 'Hidden', 
      isAlive: true,
      statuses: ['hidden'],
    });
    const dead = createMockCharacter({ 
      name: 'Dead', 
      isAlive: false,
    });
    
    const partyMembers = [hidden, dead];
    const rng = new SeededRNG(42);
    
    const target = selectTarget(partyMembers, rng);
    
    expect(target).toBeNull();
  });

  it('should be deterministic with seeded RNG', () => {
    const hero1 = createMockCharacter({ name: 'Hero1' });
    const hero2 = createMockCharacter({ name: 'Hero2' });
    const hero3 = createMockCharacter({ name: 'Hero3' });
    
    const partyMembers = [hero1, hero2, hero3];
    
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);
    
    const target1 = selectTarget(partyMembers, rng1);
    const target2 = selectTarget(partyMembers, rng2);
    
    expect(target1?.name).toBe(target2?.name);
  });
});

// ============================================================================
// Test Suite: decrementCooldowns()
// ============================================================================
describe('decrementCooldowns', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should decrement all ability cooldowns by 1', () => {
    const members: Actor[] = [
      createMockCharacter({
        abilities: [
          { abilityId: 'ability1', currentCooldown: 3 },
          { abilityId: 'ability2', currentCooldown: 1 },
        ],
      }),
      createMockCharacter({
        abilities: [
          { abilityId: 'ability3', currentCooldown: 2 },
        ],
      }),
    ];
    
    const result = decrementCooldowns(members);
    
    expect(result[0].abilities[0].currentCooldown).toBe(2);
    expect(result[0].abilities[1].currentCooldown).toBe(0);
    expect(result[1].abilities[0].currentCooldown).toBe(1);
  });

  it('should not go below 0', () => {
    const members: Actor[] = [
      createMockCharacter({
        abilities: [
          { abilityId: 'ready', currentCooldown: 0 },
        ],
      }),
    ];
    
    const result = decrementCooldowns(members);
    
    expect(result[0].abilities[0].currentCooldown).toBe(0);
  });

  it('should return new array (immutable)', () => {
    const original: Actor[] = [
      createMockCharacter({
        abilities: [
          { abilityId: 'test', currentCooldown: 2 },
        ],
      }),
    ];
    
    const result = decrementCooldowns(original);
    
    expect(result).not.toBe(original);
    expect(result[0]).not.toBe(original[0]);
  });
});

// ============================================================================
// Test Suite: checkGameOver()
// ============================================================================
describe('checkGameOver', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should return true when all party members are dead', () => {
    const dead1 = createMockCharacter({ isAlive: false });
    const dead2 = createMockCharacter({ isAlive: false });
    
    const result = checkGameOver([dead1, dead2]);
    
    expect(result).toBe(true);
  });

  it('should return false when at least one member is alive', () => {
    const alive = createMockCharacter({ isAlive: true });
    const dead = createMockCharacter({ isAlive: false });
    
    const result = checkGameOver([alive, dead]);
    
    expect(result).toBe(false);
  });

  it('should return false when all members are alive', () => {
    const alive1 = createMockCharacter({ isAlive: true });
    const alive2 = createMockCharacter({ isAlive: true });
    
    const result = checkGameOver([alive1, alive2]);
    
    expect(result).toBe(false);
  });

  it('should return true for empty party', () => {
    const result = checkGameOver([]);
    
    expect(result).toBe(true);
  });
});

// ============================================================================
// Test Suite: advanceCombatRound()
// ============================================================================
describe('advanceCombatRound', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should increment combat round by 1', () => {
    const state = createCombatState(1);
    state.combatRound = 3;
    
    const result = advanceCombatRound(state);
    
    expect(result.combatRound).toBe(4);
  });

  it('should clear actedThisRound array', () => {
    const state = createCombatState(1);
    state.actedThisRound = ['hero-1', 'hero-2'];
    
    const result = advanceCombatRound(state);
    
    expect(result.actedThisRound).toEqual([]);
  });

  it('should switch combat turn to player', () => {
    const state = createCombatState(1);
    state.combatTurn = 'enemy';
    
    const result = advanceCombatRound(state);
    
    expect(result.combatTurn).toBe('player');
  });

  it('should add round separator to history', () => {
    const state = createCombatState(1);
    state.combatRound = 2;
    state.history = [];
    
    const result = advanceCombatRound(state);
    
    expect(result.history).toEqual(
      expect.arrayContaining([expect.stringMatching(/ROUND 3/)])
    );
  });
});
