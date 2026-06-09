/**
 * RunState test fixtures
 * @module tests/fixtures/state
 */
import type { 
  RunState, 
  PartyState, 
  InventoryState, 
  Room,
  Actor,
  Item 
} from '@engine/types';
import { createMockCharacter } from './actors';
import { createMockRoom, createCombatRoom } from './rooms';

/**
 * Deterministic seed for reproducible test runs
 */
export const DETERMINISTIC_SEED = 'test-seed-12345';

/**
 * Create a mock PartyState for testing.
 * 
 * @param overrides - Partial PartyState to override defaults
 * @returns A complete PartyState
 */
export function createMockPartyState(overrides: Partial<PartyState> = {}): PartyState {
  const defaultParty: PartyState = {
    members: [createMockCharacter()],
    gold: 0,
  };

  return {
    ...defaultParty,
    ...overrides,
    members: overrides.members ?? [...defaultParty.members],
  };
}

/**
 * Create a mock InventoryState for testing.
 * 
 * @param overrides - Partial InventoryState to override defaults
 * @returns A complete InventoryState
 */
export function createMockInventoryState(
  overrides: Partial<InventoryState> = {}
): InventoryState {
  const defaultInventory: InventoryState = {
    items: [],
    consumables: [],
  };

  return {
    ...defaultInventory,
    ...overrides,
    items: overrides.items ?? [...defaultInventory.items],
    consumables: overrides.consumables ?? [...defaultInventory.consumables],
  };
}

/**
 * Create a mock RunState for complete game state testing.
 * 
 * This is the primary fixture for reducer tests, providing a valid
 * starting state that can be modified via overrides.
 * 
 * @param overrides - Partial RunState to override defaults
 * @returns A complete, valid RunState object
 * 
 * @example
 * // Create default starting state
 * const state = createMockRunState();
 * 
 * @example
 * // Create mid-game state
 * const midGame = createMockRunState({
 *   depth: 5,
 *   party: { members: [hero1, hero2], gold: 150 },
 * });
 */
export function createMockRunState(overrides: Partial<RunState> = {}): RunState {
  const defaultState: RunState = {
    seed: DETERMINISTIC_SEED,
    depth: 0,
    themeId: 'dungeon_start',
    shortRestsRemaining: 2,
    longRestsTaken: 0,
    party: createMockPartyState(),
    inventory: createMockInventoryState(),
    currentRoom: null,
    roomResolved: false,
    inBossRoom: false,
    parentIntermission: null,
    combatTurn: null,
    combatRound: 0,
    actedThisRound: [],
    extraActions: 0,
    gameOver: false,
    victory: false,
    shrineBoon: null,
    mutations: [],
    history: [],
  };

  // Build the merged state with proper deep merging
  const merged: RunState = {
    ...defaultState,
    ...overrides,
    // Deep merge party
    party: overrides.party
      ? {
          ...defaultState.party,
          ...overrides.party,
          members: overrides.party.members ?? [...defaultState.party.members],
        }
      : defaultState.party,
    // Deep merge inventory
    inventory: overrides.inventory
      ? {
          ...defaultState.inventory,
          ...overrides.inventory,
          items: overrides.inventory.items ?? [...defaultState.inventory.items],
          consumables: overrides.inventory.consumables ?? [...defaultState.inventory.consumables],
        }
      : defaultState.inventory,
    // Ensure arrays are new instances
    actedThisRound: overrides.actedThisRound ?? [...defaultState.actedThisRound],
    mutations: overrides.mutations ?? [...defaultState.mutations],
    history: overrides.history ?? [...defaultState.history],
  };

  return merged;
}

/**
 * Create a RunState ready for combat testing.
 * 
 * @param enemyCount - Number of enemies in the combat room
 * @param partyMembers - Party members to include
 * @returns A RunState in active combat
 */
export function createCombatState(
  enemyCount: number = 1,
  partyMembers: Actor[] = [createMockCharacter()]
): RunState {
  const combatRoom = createCombatRoom(enemyCount);

  return createMockRunState({
    currentRoom: combatRoom,
    roomResolved: false,
    combatTurn: 'player',
    combatRound: 1,
    party: {
      members: partyMembers,
      gold: 0,
    },
  });
}

/**
 * Create a RunState at a specific dungeon depth.
 * 
 * @param depth - Current room depth
 * @param partyGold - Current gold amount
 * @returns A RunState at the specified depth
 */
export function createStateAtDepth(
  depth: number,
  partyGold: number = 0
): RunState {
  return createMockRunState({
    depth,
    party: {
      members: [createMockCharacter()],
      gold: partyGold,
    },
    // After first segment, long rest should have been used
    longRestsTaken: Math.floor(depth / 10),
  });
}

/**
 * Create a RunState in intermission (between segments).
 * 
 * @param segmentIndex - Which segment was just completed (0-indexed)
 * @returns A RunState in intermission
 */
export function createIntermissionState(segmentIndex: number = 0): RunState {
  const depth = (segmentIndex + 1) * 10;
  
  return createMockRunState({
    depth,
    currentRoom: createMockRoom({ type: 'intermission' }),
    roomResolved: false,
  });
}

/**
 * Create a RunState with game over condition.
 * 
 * @param reason - Why the game ended
 * @returns A game over RunState
 */
export function createGameOverState(reason: string = 'All party members died'): RunState {
  const deadHero = createMockCharacter({
    hp: { current: 0, max: 20 },
    isAlive: false,
  });

  return createMockRunState({
    gameOver: true,
    victory: false,
    party: {
      members: [deadHero],
      gold: 0,
    },
    history: [reason],
  });
}

/**
 * Create a RunState with victory condition (after combat win).
 * 
 * @param loot - Items won from combat
 * @returns A victory RunState
 */
export function createVictoryState(loot: Item[] = []): RunState {
  return createMockRunState({
    victory: true,
    roomResolved: true,
    currentRoom: createMockRoom({
      type: 'combat',
      enemies: [], // All enemies defeated
      loot,
    }),
  });
}

/**
 * Create a RunState at a shrine room.
 * 
 * @returns A RunState at a shrine
 */
export function createShrineState(): RunState {
  return createMockRunState({
    currentRoom: createMockRoom({ type: 'shrine' }),
    roomResolved: false,
  });
}

/**
 * Create a RunState in a boss room.
 * 
 * @returns A RunState in an optional boss encounter
 */
export function createBossRoomState(): RunState {
  const intermission = createMockRoom({ type: 'intermission' });
  const bossRoom = createMockRoom({ type: 'boss' });

  return createMockRunState({
    inBossRoom: true,
    parentIntermission: intermission,
    currentRoom: bossRoom,
    combatTurn: 'player',
    combatRound: 1,
  });
}

/**
 * Reset all fixture ID counters.
 * Call this in beforeEach() blocks to ensure test isolation.
 */
export function resetAllIdCounters(): void {
  // Import resetters from other fixtures
  // These are called through the index.ts re-exports
}
