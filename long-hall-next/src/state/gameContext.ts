/**
 * Game Context - Shared context for game engine
 * 
 * Extracted to separate file to avoid circular dependencies
 * between GameEngine and child components that use the context.
 * 
 * @module state/gameContext
 */

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Action, RunState } from '../engine/types';

// ============================================================================
// Types
// ============================================================================

export interface GameContextValue {
  /** Dispatch a game action */
  dispatchAction: (action: Action) => void;
  /** Get current game state (snapshot) */
  getState: () => RunState | null;
  /** Get current game phase */
  getPhase: () => string;
  /** Check if game is in combat */
  isInCombat: () => boolean;
  /** Check if it's the player's turn */
  isPlayerTurn: () => boolean;
}

// ============================================================================
// Context
// ============================================================================

/**
 * GameContext provides game engine functions to child components.
 * Use the `useGameEngine` hook to consume this context.
 */
export const GameContext = createContext<GameContextValue | null>(null);

/**
 * Hook to access the game engine from child components.
 * Must be used within a GameEngine provider.
 * 
 * @throws Error if used outside of GameEngine
 * 
 * @example
 * ```tsx
 * const { dispatchAction, getState } = useGameEngine();
 * 
 * function handleAttack() {
 *   dispatchAction({ type: 'ATTACK', attackerId: 'hero-1', targetId: 'goblin-1' });
 * }
 * ```
 */
export function useGameEngine(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('[GameEngine] useGameEngine must be used within a GameEngine component');
  }
  return ctx;
}
