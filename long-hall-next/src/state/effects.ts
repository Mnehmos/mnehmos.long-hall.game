/**
 * 📟 State Effects - Side effects triggered by signal changes
 * 
 * Effects run automatically when their signal dependencies change.
 * Used for persistence, analytics, UI updates, and other async operations.
 * 
 * @module state/effects
 */

import { effect } from '@preact/signals';
import { 
  gameState, 
  historyLog,
  currentDepth,
  alivePartyMembers
} from './gameState';
import { 
  showGameOver, 
  showVictory
} from './derived';

// ─────────────────────────────────────────────────────────────
// 💾 Persistence Effects
// ─────────────────────────────────────────────────────────────

/** Save key for localStorage */
const SAVE_KEY = 'long-hall-save';
const AUTOSAVE_DEBOUNCE_MS = 1000;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Autosave effect - saves game state to localStorage after changes
 * Debounced to avoid excessive writes
 */
export function initAutosaveEffect(): () => void {
  return effect(() => {
    const state = gameState.value;
    
    // Don't save if no active game
    if (!state) return;
    
    // Debounce saves
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        console.debug('[Autosave] Game saved');
      } catch (error) {
        console.error('[Autosave] Failed to save:', error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  });
}

/**
 * Load saved game from localStorage
 */
export function loadSavedGame(): boolean {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      gameState.value = state;
      return true;
    }
  } catch (error) {
    console.error('[Load] Failed to load saved game:', error);
  }
  return false;
}

/**
 * Clear saved game from localStorage
 */
export function clearSavedGame(): void {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * Check if a saved game exists
 */
export function hasSavedGame(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 📜 Combat Log Effects
// ─────────────────────────────────────────────────────────────

/**
 * Combat log scroll effect - scrolls log to bottom on new entries
 */
export function initLogScrollEffect(): () => void {
  return effect(() => {
    const log = historyLog.value;
    
    // Only scroll if we have entries
    if (log.length === 0) return;
    
    // Find the log element and scroll to bottom
    requestAnimationFrame(() => {
      const logElement = document.getElementById('combat-log');
      if (logElement) {
        logElement.scrollTop = logElement.scrollHeight;
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 🔊 Audio Effects
// ─────────────────────────────────────────────────────────────

/**
 * Sound effect triggers based on game events
 */
export function initAudioEffects(): () => void {
  let previousDepth = 0;
  let previousPartyCount = 0;
  let wasGameOver = false;
  let wasVictory = false;
  
  return effect(() => {
    const depth = currentDepth.value;
    const partyCount = alivePartyMembers.value.length;
    const isGameOver = showGameOver.value;
    const isVictory = showVictory.value;
    
    // Play sound when entering new room
    if (depth > previousDepth) {
      playSound('room-enter');
    }
    previousDepth = depth;
    
    // Play sound when party member dies
    if (partyCount < previousPartyCount && partyCount > 0) {
      playSound('party-member-down');
    }
    previousPartyCount = partyCount;
    
    // Game over sound (only trigger once)
    if (isGameOver && !wasGameOver) {
      playSound('game-over');
    }
    wasGameOver = isGameOver;
    
    // Victory sound (only trigger once)
    if (isVictory && !wasVictory) {
      playSound('victory');
    }
    wasVictory = isVictory;
  });
}

/**
 * Play a sound effect (placeholder - implement with actual audio)
 */
function playSound(soundId: string): void {
  // TODO: Implement with actual audio system
  console.debug(`[Audio] Would play: ${soundId}`);
}

// ─────────────────────────────────────────────────────────────
// 📊 Analytics Effects
// ─────────────────────────────────────────────────────────────

/**
 * Track game progress for analytics
 */
export function initAnalyticsEffect(): () => void {
  let lastTrackedDepth = 0;
  let trackedGameOver = false;
  let trackedVictory = false;
  
  return effect(() => {
    const depth = currentDepth.value;
    const isGameOver = showGameOver.value;
    const isVictory = showVictory.value;
    
    // Track depth milestones (every 10 rooms)
    if (depth > 0 && depth % 10 === 0 && depth !== lastTrackedDepth) {
      trackEvent('milestone_reached', { depth });
      lastTrackedDepth = depth;
    }
    
    // Track game end (only once per game)
    if (isGameOver && !trackedGameOver) {
      trackEvent('game_over', { depth });
      trackedGameOver = true;
    }
    
    if (isVictory && !trackedVictory) {
      trackEvent('victory', { depth });
      trackedVictory = true;
    }
    
    // Reset tracking flags when new game starts
    if (depth === 0 && !isGameOver && !isVictory) {
      trackedGameOver = false;
      trackedVictory = false;
      lastTrackedDepth = 0;
    }
  });
}

/**
 * Track an analytics event (placeholder)
 */
function trackEvent(event: string, data: Record<string, unknown>): void {
  // TODO: Implement with actual analytics
  console.debug(`[Analytics] ${event}:`, data);
}

// ─────────────────────────────────────────────────────────────
// 🎮 Game State Effects
// ─────────────────────────────────────────────────────────────

/**
 * Handle game over state transitions
 */
export function initGameOverEffect(): () => void {
  return effect(() => {
    if (showGameOver.value) {
      // Trigger game over overlay
      document.body.classList.add('game-over');
    } else {
      document.body.classList.remove('game-over');
    }
  });
}

/**
 * Handle victory state transitions
 */
export function initVictoryEffect(): () => void {
  return effect(() => {
    if (showVictory.value) {
      // Trigger victory overlay
      document.body.classList.add('victory');
    } else {
      document.body.classList.remove('victory');
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 🚀 Effect Initialization
// ─────────────────────────────────────────────────────────────

const cleanupFunctions: Array<() => void> = [];

/**
 * Initialize all game effects
 * Returns cleanup function to dispose all effects
 */
export function initAllEffects(): () => void {
  cleanupFunctions.push(
    initAutosaveEffect(),
    initLogScrollEffect(),
    initAudioEffects(),
    initAnalyticsEffect(),
    initGameOverEffect(),
    initVictoryEffect()
  );
  
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions.length = 0;
  };
}

/**
 * Dispose all active effects
 */
export function disposeAllEffects(): void {
  cleanupFunctions.forEach(cleanup => cleanup());
  cleanupFunctions.length = 0;
  
  // Clear any pending saves
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}
