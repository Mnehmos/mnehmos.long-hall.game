/**
 * Room test fixtures
 * @module tests/fixtures/rooms
 */
import type { Room, RoomType, Enemy, Item, RecruitOption } from '@engine/types';
import { createMockEnemy, createEnemyGroup } from './actors';
import { createLootTable } from './items';

let roomIdCounter = 0;

/**
 * Generate a unique room ID for testing
 */
function generateRoomId(): string {
  return `room-${++roomIdCounter}-${Date.now()}`;
}

/**
 * Reset room ID counter (useful between test suites)
 */
export function resetRoomIdCounter(): void {
  roomIdCounter = 0;
}

/**
 * Create a mock Room for dungeon exploration testing.
 * 
 * @param overrides - Partial Room object to override defaults
 * @returns A complete, valid Room object
 * 
 * @example
 * // Create default combat room
 * const room = createMockRoom();
 * 
 * @example
 * // Create a shrine room
 * const shrine = createMockRoom({
 *   type: 'shrine',
 *   enemies: [],
 * });
 */
export function createMockRoom(overrides: Partial<Room> = {}): Room {
  const defaultRoom: Room = {
    id: generateRoomId(),
    type: 'combat',
    themeId: 'dungeon_start',
    enemies: [],
    loot: [],
  };

  return {
    ...defaultRoom,
    ...overrides,
    // Ensure arrays are new instances
    enemies: overrides.enemies ?? [...defaultRoom.enemies],
    loot: overrides.loot ?? [...defaultRoom.loot],
  };
}

/**
 * Create a combat room with enemies pre-populated.
 * 
 * @param enemyCount - Number of enemies to spawn
 * @param overrides - Additional Room overrides
 * @returns A combat Room with enemies
 * 
 * @example
 * const encounter = createCombatRoom(3);
 */
export function createCombatRoom(
  enemyCount: number = 1,
  overrides: Partial<Room> = {}
): Room {
  return createMockRoom({
    type: 'combat',
    enemies: createEnemyGroup(enemyCount),
    ...overrides,
  });
}

/**
 * Create an elite combat room with a stronger enemy.
 * 
 * @param overrides - Additional Room overrides
 * @returns An elite Room with a tough enemy
 */
export function createEliteRoom(overrides: Partial<Room> = {}): Room {
  const eliteEnemy = createMockEnemy({
    name: 'Elite Orc',
    hp: 25,
    maxHp: 25,
    ac: 15,
    power: 4,
    damage: '1d10+2',
    xp: 100,
  });

  return createMockRoom({
    type: 'elite',
    enemies: [eliteEnemy],
    loot: createLootTable(1, 'uncommon'),
    ...overrides,
  });
}

/**
 * Create a boss room with a powerful enemy.
 * 
 * @param overrides - Additional Room overrides
 * @returns A boss Room
 */
export function createBossRoom(overrides: Partial<Room> = {}): Room {
  const bossEnemy = createMockEnemy({
    name: 'Dark Knight',
    hp: 50,
    maxHp: 50,
    ac: 18,
    power: 6,
    damage: '2d8+4',
    xp: 500,
  });

  return createMockRoom({
    type: 'boss',
    enemies: [bossEnemy],
    loot: createLootTable(3, 'rare'),
    ...overrides,
  });
}

/**
 * Create a trader room with shop items.
 * 
 * @param itemCount - Number of items for sale
 * @param overrides - Additional Room overrides
 * @returns A trader Room with shop inventory
 */
export function createTraderRoom(
  itemCount: number = 3,
  overrides: Partial<Room> = {}
): Room {
  return createMockRoom({
    type: 'trader',
    enemies: [],
    shopItems: createLootTable(itemCount),
    ...overrides,
  });
}

/**
 * Create a shrine room.
 * 
 * @param overrides - Additional Room overrides
 * @returns A shrine Room
 */
export function createShrineRoom(overrides: Partial<Room> = {}): Room {
  return createMockRoom({
    type: 'shrine',
    enemies: [],
    loot: [],
    ...overrides,
  });
}

/**
 * Create a hazard/trap room.
 * 
 * @param overrides - Additional Room overrides
 * @returns A hazard Room
 */
export function createHazardRoom(overrides: Partial<Room> = {}): Room {
  return createMockRoom({
    type: 'hazard',
    enemies: [],
    loot: createLootTable(1),
    ...overrides,
  });
}

/**
 * Create an intermission room with recruit options.
 * 
 * @param overrides - Additional Room overrides
 * @returns An intermission Room
 */
export function createIntermissionRoom(overrides: Partial<Room> = {}): Room {
  const recruits: RecruitOption[] = [
    {
      id: 'recruit-1',
      name: 'Veteran Fighter',
      role: 'fighter',
      cost: 100,
      description: 'A seasoned warrior',
      level: 2,
    },
    {
      id: 'recruit-2',
      name: 'Apprentice Wizard',
      role: 'wizard',
      cost: 120,
      description: 'A promising spellcaster',
      level: 2,
    },
  ];

  return createMockRoom({
    type: 'intermission',
    enemies: [],
    shopItems: createLootTable(5, 'uncommon'),
    availableRecruits: recruits,
    ...overrides,
  });
}

/**
 * Create an ally room.
 * 
 * @param overrides - Additional Room overrides
 * @returns An ally Room
 */
export function createAllyRoom(overrides: Partial<Room> = {}): Room {
  return createMockRoom({
    type: 'ally',
    enemies: [],
    loot: [],
    ...overrides,
  });
}

/**
 * Create a sequence of rooms for dungeon progression testing.
 * 
 * @param count - Number of rooms
 * @param pattern - Room type pattern (cycles through)
 * @returns Array of Room objects
 */
export function createRoomSequence(
  count: number,
  pattern: RoomType[] = ['combat', 'combat', 'shrine']
): Room[] {
  return Array.from({ length: count }, (_, i) => {
    const type = pattern[i % pattern.length];
    switch (type) {
      case 'combat':
        return createCombatRoom(Math.ceil((i + 1) / 2));
      case 'elite':
        return createEliteRoom();
      case 'boss':
        return createBossRoom();
      case 'shrine':
        return createShrineRoom();
      case 'trader':
        return createTraderRoom();
      case 'hazard':
        return createHazardRoom();
      case 'intermission':
        return createIntermissionRoom();
      case 'ally':
        return createAllyRoom();
      default:
        return createMockRoom({ type });
    }
  });
}
