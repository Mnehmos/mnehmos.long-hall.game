/**
 * GameEngine Island Component
 *
 * Main game controller that initializes state, handles keyboard shortcuts,
 * dispatches actions, and coordinates the game loop. This is the "brain"
 * of the game that other islands depend on.
 *
 * Hydration: client:load (critical path, immediate interactivity)
 *
 * @module islands/GameEngine
 * @see {@link file://./../state/gameState.ts} for state management
 * @see {@link file://./../state/effects.ts} for side effects
 * @see {@link file://./../engine/reducer.ts} for action handlers
 */

import { useEffect, useMemo, useCallback, useRef, useState } from 'preact/hooks';
import type { FunctionalComponent, ComponentChildren, JSX } from 'preact';

// Context (extracted to avoid circular deps with GameUI)
import { GameContext } from '../state/gameContext';
import type { GameContextValue } from '../state/gameContext';

// State management
import {
  gameState,
  updateState,
  isInCombat,
  alivePartyMembers,
} from '../state/gameState';
import {
  gamePhase,
  isPlayerTurn,
  showGameOver,
  shortRestsRemaining,
  aliveEnemies,
} from '../state/derived';
import {
  initAllEffects,
  loadSavedGame,
  hasSavedGame,
  clearSavedGame,
} from '../state/effects';

// Reducer action handlers
import {
  startNewGame,
  advanceRoom,
  dismissPopup,
  attackEnemy,
  useAbility,
  attemptFlee,
  prayAtShrine,
  disarmTrap,
  triggerTrap,
  enterBossRoom,
  takeShortRest,
  takeLongRest,
  buyItem,
  sellItem,
  recruitMember,
  equipItem,
  unequipItem,
  spendStatPoint,
  renameItem,
} from '../engine/reducer';

// Types
import type { Action, Actor } from '../engine/types';

// ============================================================================
// Types
// ============================================================================

export interface GameEngineProps {
  /** Initial seed from URL param or provided */
  initialSeed?: string;
  /** Auto-start game on mount */
  autoStart?: boolean;
  /** Children components (slotted via Astro) */
  children?: ComponentChildren;
}

// ============================================================================
// Lazy GameUI Import (breaks circular dependency)
// ============================================================================

// We dynamically import GameUI to avoid circular imports
// GameUI imports useGameEngine from gameContext.ts (not from here)
let GameUIComponent: FunctionalComponent | null = null;
const loadGameUI = async () => {
  if (!GameUIComponent) {
    const module = await import('./GameUI');
    GameUIComponent = module.default;
  }
  return GameUIComponent;
};

// ============================================================================
// Default Party Creation
// ============================================================================

/**
 * Create default starting party for a new game
 */
function createDefaultParty(seed: string): Actor[] {
  // Simple fighter to start
  const fighter: Actor = {
    id: 'hero-1',
    name: 'Knight',
    role: 'fighter',
    level: 1,
    hp: { current: 25, max: 25 },
    stress: { current: 0, max: 20 },
    hitDice: { current: 2, max: 2, die: 10 },
    xp: 0,
    statPoints: 0,
    skills: {
      strength: 3,
      attack: 2,
      defense: 2,
      magic: 0,
      ranged: 0,
      faith: 0,
      agility: 1,
    },
    isAlive: true,
    spellSlots: {},
    equipment: {},
    abilities: [
      { abilityId: 'champion_strike', currentCooldown: 0 },
      { abilityId: 'action_surge', currentCooldown: 0 },
    ],
    statuses: [],
  };

  return [fighter];
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * GameEngine - Main game controller island
 *
 * This Preact island component serves as the central game controller,
 * managing state initialization, keyboard shortcuts, and action dispatch.
 *
 * @example Usage in Astro
 * ```astro
 * ---
 * import GameEngine from '@islands/GameEngine';
 * const seed = Astro.url.searchParams.get('seed') ?? crypto.randomUUID();
 * ---
 * <GameEngine client:load initialSeed={seed} autoStart={true} />
 * ```
 */
const GameEngine: FunctionalComponent<GameEngineProps> = ({
  initialSeed,
  autoStart = true,
  children,
}) => {
  // Track if effects have been initialized
  const effectsCleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);
  
  // GameUI lazy load state
  const [GameUI, setGameUI] = useState<FunctionalComponent | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Load GameUI component
  // ─────────────────────────────────────────────────────────────
  
  useEffect(() => {
    loadGameUI().then(component => {
      setGameUI(() => component);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Action Dispatch
  // ─────────────────────────────────────────────────────────────

  /**
   * Dispatch a game action to update state.
   * Routes to appropriate reducer functions.
   */
  const dispatchAction = useCallback((action: Action): void => {
    const state = gameState.value;

    // START_RUN can be called without existing state
    if (!state && action.type !== 'START_RUN') {
      console.warn('[GameEngine] No active game state for action:', action.type);
      return;
    }

    console.debug('[GameEngine] Dispatch:', action.type);

    switch (action.type) {
      case 'START_RUN': {
        const party = createDefaultParty(action.seed);
        startNewGame(party, action.seed);
        break;
      }

      case 'ADVANCE_ROOM': {
        advanceRoom();
        break;
      }

      case 'RESOLVE_ROOM': {
        // Mark room as resolved for non-combat rooms
        updateState({ roomResolved: true });
        break;
      }

      case 'ATTACK': {
        attackEnemy(action.attackerId, action.targetId);
        break;
      }

      case 'USE_ABILITY': {
        useAbility(action.actorId, action.abilityId, action.targetId);
        break;
      }

      case 'ESCAPE': {
        attemptFlee();
        break;
      }

      case 'PRAY_AT_SHRINE':
      case 'PRAY_AT_BOSS_SHRINE': {
        prayAtShrine();
        break;
      }

      case 'DISARM_TRAP': {
        disarmTrap();
        break;
      }

      case 'TRIGGER_TRAP': {
        triggerTrap();
        break;
      }

      case 'DISMISS_POPUP': {
        dismissPopup();
        break;
      }

      case 'TAKE_SHORT_REST': {
        takeShortRest(action.actorIdsToHeal);
        break;
      }

      case 'TAKE_LONG_REST': {
        takeLongRest();
        break;
      }

      case 'BUY_ITEM': {
        buyItem(action.itemId, action.cost);
        break;
      }

      case 'SELL_ITEM': {
        sellItem(action.itemId);
        break;
      }

      case 'EQUIP_ITEM': {
        equipItem(action.actorId, action.itemId, action.slot);
        break;
      }

      case 'UNEQUIP_ITEM': {
        unequipItem(action.actorId, action.slot);
        break;
      }

      case 'HIRE_RECRUIT': {
        recruitMember(action.recruitId);
        break;
      }

      case 'ENTER_BOSS_ROOM': {
        enterBossRoom();
        break;
      }

      case 'RENAME_ITEM': {
        renameItem(action.itemId, action.newName);
        break;
      }

      case 'SPEND_STAT_POINT': {
        spendStatPoint(action.actorId, action.stat);
        break;
      }

      default: {
        // Exhaustive check - this should never happen with proper typing
        const _exhaustive: never = action;
        console.warn('[GameEngine] Unknown action type:', (action as Action).type);
      }
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Effects Initialization
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Initialize all game effects (autosave, audio, analytics, etc.)
    console.debug('[GameEngine] Initializing effects...');
    effectsCleanupRef.current = initAllEffects();

    return () => {
      console.debug('[GameEngine] Cleaning up effects...');
      effectsCleanupRef.current?.();
      effectsCleanupRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Game Initialization
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Prevent double initialization in dev mode
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Check for 'fresh' param to skip saved game
    const urlParams = new URLSearchParams(window.location.search);
    const forceFresh = urlParams.get('fresh') === '1';

    // Check for saved game first (unless fresh is requested)
    if (!forceFresh && hasSavedGame()) {
      console.debug('[GameEngine] Loading saved game...');
      const loaded = loadSavedGame();
      if (loaded) {
        // Check if saved game has victory - if so, start fresh
        if (gameState.value?.victory === true) {
          console.debug('[GameEngine] Saved game has victory, starting fresh');
          clearSavedGame();
        } else {
          console.debug('[GameEngine] Saved game loaded successfully');
          return;
        }
      } else {
        console.warn('[GameEngine] Failed to load saved game, starting fresh');
        clearSavedGame();
      }
    } else if (forceFresh) {
      console.debug('[GameEngine] Fresh start requested, clearing saved game');
      clearSavedGame();
    }

    // Start new game if seed provided and autoStart enabled
    if (initialSeed && autoStart) {
      console.debug('[GameEngine] Starting new game with seed:', initialSeed);
      dispatchAction({ type: 'START_RUN', seed: initialSeed });
    }
  }, [initialSeed, autoStart, dispatchAction]);

  // ─────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const state = gameState.value;
      if (!state) return;

      // Global shortcuts
      switch (e.key) {
        case 'Escape': {
          // Cancel current action / dismiss popup
          if (state.victory || state.shrineBoon) {
            dispatchAction({ type: 'DISMISS_POPUP' });
            e.preventDefault();
          }
          return;
        }

        case 'Enter': {
          // Confirm action / advance room
          if (state.roomResolved && !showGameOver.value) {
            dispatchAction({ type: 'ADVANCE_ROOM' });
            e.preventDefault();
          }
          return;
        }

        case 'r':
        case 'R': {
          // Quick rest (if available and not in combat)
          if (!isInCombat.value && shortRestsRemaining.value > 0) {
            const members = alivePartyMembers.value;
            const membersToHeal = members
              .filter((m: Actor) => m.hp.current < m.hp.max && m.hitDice.current > 0)
              .map((m: Actor) => m.id);

            if (membersToHeal.length > 0) {
              dispatchAction({ type: 'TAKE_SHORT_REST', actorIdsToHeal: membersToHeal });
              e.preventDefault();
            }
          }
          return;
        }
      }

      // Combat shortcuts (1-5 for abilities, only in combat on player turn)
      if (isInCombat.value && isPlayerTurn.value) {
        const abilityKeys = ['1', '2', '3', '4', '5'];
        const keyIndex = abilityKeys.indexOf(e.key);

        if (keyIndex !== -1) {
          // Get first alive party member
          const attacker = alivePartyMembers.value[0];
          if (!attacker) return;

          // If it's an ability (index > 0)
          if (keyIndex > 0) {
            const abilities = attacker.abilities || [];
            const abilityState = abilities[keyIndex - 1];

            if (abilityState && abilityState.currentCooldown === 0) {
              // For targeted abilities, default to first enemy
              const enemies = aliveEnemies.value;
              const targetId = enemies.length > 0 ? enemies[0].id : undefined;

              dispatchAction({
                type: 'USE_ABILITY',
                actorId: attacker.id,
                abilityId: abilityState.abilityId,
                targetId,
              });
              e.preventDefault();
            }
          } else {
            // Key '1' = basic attack on first enemy
            const enemies = aliveEnemies.value;
            if (enemies.length > 0) {
              dispatchAction({
                type: 'ATTACK',
                attackerId: attacker.id,
                targetId: enemies[0].id,
              });
              e.preventDefault();
            }
          }
        }

        // 'f' for flee
        if (e.key === 'f' || e.key === 'F') {
          dispatchAction({ type: 'ESCAPE' });
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatchAction]);

  // ─────────────────────────────────────────────────────────────
  // Context Value
  // ─────────────────────────────────────────────────────────────

  const contextValue = useMemo<GameContextValue>(() => ({
    dispatchAction,
    getState: () => gameState.value,
    getPhase: () => gamePhase.value,
    isInCombat: () => isInCombat.value,
    isPlayerTurn: () => isPlayerTurn.value,
  }), [dispatchAction]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  // Get current phase for data attribute
  const phase = gamePhase.value;
  const hasState = gameState.value !== null;

  return (
    <GameContext.Provider value={contextValue}>
      <div
        class="game-engine"
        data-phase={phase}
        data-combat={isInCombat.value ? 'true' : 'false'}
        data-player-turn={isPlayerTurn.value ? 'true' : 'false'}
      >
        {hasState && GameUI ? (
          <GameUI />
        ) : (
          children || (
            <div class="game-loading">
              <p>Preparing your adventure...</p>
            </div>
          )
        )}
      </div>
    </GameContext.Provider>
  );
};

// Export as default for Astro island usage
export default GameEngine;

// Also export named for flexibility
export { GameEngine };

// Re-export useGameEngine from the context file for convenience
export { useGameEngine } from '../state/gameContext';

// Re-export types for consumers
export type { Action, RunState } from '../engine/types';
