/**
 * Islands Barrel Export
 * 
 * Re-exports all Preact island components for convenient imports.
 * Islands are interactive Preact components that hydrate on the client.
 * 
 * Usage in Astro:
 * ```astro
 * ---
 * import { GameEngine, CombatManager, CharacterSprite } from '@islands';
 * // or individual imports for tree-shaking
 * import GameEngine from '@islands/GameEngine';
 * ---
 * <GameEngine client:load initialSeed={seed}>
 *   <CombatManager client:visible />
 * </GameEngine>
 * ```
 * 
 * Hydration Strategies:
 * - GameEngine: client:load (critical path, immediate interactivity)
 * - CharacterSprite: client:visible (renders when in viewport)
 * - CombatManager: client:visible (combat UI, hydrates when visible)
 * - InventoryManager: client:visible (equipment management)
 * - Leaderboard: client:idle (non-critical, loads after main thread idle)
 * - TooltipProvider: client:only (browser-only for hover detection)
 * 
 * @module islands
 */

// ============================================================================
// Island Components
// ============================================================================

// Core game engine (must wrap all other islands)
export { default as GameEngine, GameContext, useGameEngine } from './GameEngine';

// Character sprite with animations
export { default as CharacterSprite } from './CharacterSprite';

// Combat UI
export { default as CombatManager } from './CombatManager';

// Inventory and equipment
export { default as InventoryManager } from './InventoryManager';

// Leaderboard (includes ScoreRow sub-component)
export { default as Leaderboard, ScoreRow } from './Leaderboard';

// Tooltips
export { 
  default as TooltipProvider,
  TooltipContext, 
  useTooltip, 
  useTooltipTrigger,
} from './TooltipProvider';

// ============================================================================
// TypeScript Types
// ============================================================================

// GameEngine types
export type { GameEngineProps, GameContextValue } from './GameEngine';
export type { Action, RunState } from './GameEngine';

// CharacterSprite types
export type { 
  CharacterSpriteProps, 
  CharacterSpriteHandle,
} from './CharacterSprite';
export type {
  CharacterType,
  CharacterName,
  AnimationState,
  PlayOptions,
  UseCharacterAnimationReturn,
} from './CharacterSprite';

// CombatManager types
export type { CombatManagerProps } from './CombatManager';

// InventoryManager types
export type { InventoryManagerProps } from './InventoryManager';

// Leaderboard types
export type { 
  LeaderboardProps, 
  ScoreEntry, 
  ScoreSubmission,
  LeaderboardCategory,
} from './Leaderboard';

// TooltipProvider types
export type { 
  TooltipData, 
  TooltipType, 
  TooltipContextValue,
  TooltipProviderProps,
  SkillInfo,
} from './TooltipProvider';
