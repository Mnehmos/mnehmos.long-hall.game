/**
 * Test Fixtures - Main Export Module
 * 
 * This module provides factory functions for creating test data objects.
 * All fixtures return complete, valid typed objects that can be customized
 * via override parameters.
 * 
 * @module tests/fixtures
 * 
 * @example
 * import { 
 *   createMockCharacter, 
 *   createMockEnemy, 
 *   createMockRunState,
 *   resetAllFixtureIds 
 * } from '../fixtures';
 * 
 * describe('Combat', () => {
 *   beforeEach(() => {
 *     resetAllFixtureIds();
 *   });
 * 
 *   it('handles attack action', () => {
 *     const state = createMockRunState({
 *       currentRoom: createCombatRoom(1),
 *       combatTurn: 'player',
 *     });
 *     // ...test logic
 *   });
 * });
 */

// ============================================================================
// Actor Fixtures (Characters, Enemies)
// ============================================================================
export {
  createMockCharacter,
  createMockEnemy,
  createEnemyGroup,
  resetActorIdCounters,
} from './actors';

// ============================================================================
// Item Fixtures (Weapons, Armor, Rings, etc.)
// ============================================================================
export {
  createMockItem,
  createMockWeapon,
  createMockArmor,
  createMockShield,
  createMockRing,
  createEnchantedItem,
  createLootTable,
  resetItemIdCounter,
} from './items';

// ============================================================================
// Room Fixtures (Combat, Shrine, Trader, etc.)
// ============================================================================
export {
  createMockRoom,
  createCombatRoom,
  createEliteRoom,
  createBossRoom,
  createTraderRoom,
  createShrineRoom,
  createHazardRoom,
  createIntermissionRoom,
  createAllyRoom,
  createRoomSequence,
  resetRoomIdCounter,
} from './rooms';

// ============================================================================
// State Fixtures (RunState, PartyState, InventoryState)
// ============================================================================
export {
  createMockRunState,
  createMockPartyState,
  createMockInventoryState,
  createCombatState,
  createStateAtDepth,
  createIntermissionState,
  createGameOverState,
  createVictoryState,
  createShrineState,
  createBossRoomState,
  DETERMINISTIC_SEED,
} from './state';

// ============================================================================
// Utility Functions
// ============================================================================

import { resetActorIdCounters } from './actors';
import { resetItemIdCounter } from './items';
import { resetRoomIdCounter } from './rooms';

/**
 * Reset all fixture ID counters to ensure test isolation.
 * Call this in beforeEach() blocks to guarantee unique IDs across tests.
 * 
 * @example
 * beforeEach(() => {
 *   resetAllFixtureIds();
 * });
 */
export function resetAllFixtureIds(): void {
  resetActorIdCounters();
  resetItemIdCounter();
  resetRoomIdCounter();
}
