/**
 * Actor and Enemy test fixtures
 * @module tests/fixtures/actors
 */
import type { Actor, Enemy, Skills, Stats } from '@engine/types';

let actorIdCounter = 0;
let enemyIdCounter = 0;

/**
 * Generate a unique actor ID for testing
 */
function generateActorId(): string {
  return `actor-${++actorIdCounter}-${Date.now()}`;
}

/**
 * Generate a unique enemy ID for testing
 */
function generateEnemyId(): string {
  return `enemy-${++enemyIdCounter}-${Date.now()}`;
}

/**
 * Reset ID counters (useful between test suites)
 */
export function resetActorIdCounters(): void {
  actorIdCounter = 0;
  enemyIdCounter = 0;
}

/**
 * Default skills for a level 1 fighter
 */
const defaultSkills: Skills = {
  strength: 2,
  attack: 1,
  defense: 1,
  magic: 0,
  ranged: 0,
  faith: 0,
  agility: 1,
};

/**
 * Create a mock Actor (party member) with sensible defaults.
 * Use overrides to customize any property for specific test scenarios.
 * 
 * @param overrides - Partial Actor object to override defaults
 * @returns A complete, valid Actor object
 * 
 * @example
 * // Create default fighter
 * const fighter = createMockCharacter();
 * 
 * @example
 * // Create a wounded wizard
 * const woundedWizard = createMockCharacter({
 *   role: 'wizard',
 *   hp: { current: 5, max: 15 }
 * });
 */
export function createMockCharacter(overrides: Partial<Actor> = {}): Actor {
  const defaultActor: Actor = {
    id: generateActorId(),
    name: 'Test Hero',
    role: 'fighter',
    level: 1,
    hp: { current: 20, max: 20 },
    stress: { current: 0, max: 20 },
    hitDice: { current: 1, max: 1, die: 10 },
    xp: 0,
    statPoints: 0,
    skills: { ...defaultSkills },
    isAlive: true,
    spellSlots: {},
    equipment: {},
    abilities: [],
    statuses: [],
  };

  // Deep merge for nested objects
  const merged: Actor = {
    ...defaultActor,
    ...overrides,
    hp: overrides.hp 
      ? { ...defaultActor.hp, ...overrides.hp } 
      : defaultActor.hp,
    stress: overrides.stress 
      ? { ...defaultActor.stress, ...overrides.stress } 
      : defaultActor.stress,
    hitDice: overrides.hitDice 
      ? { ...defaultActor.hitDice, ...overrides.hitDice } 
      : defaultActor.hitDice,
    skills: overrides.skills 
      ? { ...defaultActor.skills, ...overrides.skills } 
      : defaultActor.skills,
    spellSlots: overrides.spellSlots 
      ? { ...defaultActor.spellSlots, ...overrides.spellSlots } 
      : defaultActor.spellSlots,
    equipment: overrides.equipment 
      ? { ...defaultActor.equipment, ...overrides.equipment } 
      : defaultActor.equipment,
    abilities: overrides.abilities ?? defaultActor.abilities,
    statuses: overrides.statuses ?? defaultActor.statuses,
  };

  return merged;
}

/**
 * Create a mock Enemy for combat testing.
 * 
 * @param overrides - Partial Enemy object to override defaults
 * @returns A complete, valid Enemy object
 * 
 * @example
 * // Create default goblin
 * const goblin = createMockEnemy();
 * 
 * @example
 * // Create a tough boss
 * const boss = createMockEnemy({
 *   name: 'Dark Knight',
 *   hp: 50,
 *   maxHp: 50,
 *   ac: 18,
 *   power: 5,
 *   damage: '2d8+3'
 * });
 */
export function createMockEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const defaultEnemy: Enemy = {
    id: generateEnemyId(),
    name: 'Test Goblin',
    hp: 8,
    maxHp: 8,
    power: 2,
    damage: '1d6',
    ac: 12,
    xp: 25,
  };

  return {
    ...defaultEnemy,
    ...overrides,
  };
}

/**
 * Create multiple enemies for group combat testing.
 * 
 * @param count - Number of enemies to create
 * @param overrides - Partial Enemy to apply to all enemies
 * @returns Array of Enemy objects
 * 
 * @example
 * const goblins = createEnemyGroup(3);
 * const skeletons = createEnemyGroup(2, { name: 'Skeleton', ac: 13 });
 */
export function createEnemyGroup(count: number, overrides: Partial<Enemy> = {}): Enemy[] {
  return Array.from({ length: count }, (_, i) => 
    createMockEnemy({
      ...overrides,
      name: overrides.name ? `${overrides.name} ${i + 1}` : `Test Goblin ${i + 1}`,
    })
  );
}
