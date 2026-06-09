/**
 * 🗄️ State Module Exports
 *
 * Barrel export for game state management via Preact Signals.
 *
 * @example
 * ```ts
 * import { gameState, currentRoom, initGame } from '@state';
 * import { partyHealth, availableActions, showGameOver } from '@state';
 * import { initAllEffects, loadSavedGame, hasSavedGame } from '@state';
 * ```
 */

export * from './gameState';
export * from './derived';
export * from './effects';
