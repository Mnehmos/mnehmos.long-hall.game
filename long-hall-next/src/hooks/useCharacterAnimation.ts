/**
 * useCharacterAnimation Hook
 * 
 * Provides animation state management and control for character sprites.
 * Integrates with GSAP animation modules for smooth transitions.
 * 
 * @module hooks/useCharacterAnimation
 * @see {@link file://./../lib/animations/} for animation implementations
 */

import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { gsap } from 'gsap';
import {
  setCharacterState,
  forceCharacterState,
  createCombatTimeline,
  playDeathAnimation,
  type CharacterState,
} from '../lib/animations';

// ============================================================================
// Types
// ============================================================================

/**
 * Character types for SVG asset resolution
 */
export type CharacterType = 'hero' | 'enemy';

/**
 * Hero character names (must match SVG filenames in src/art/heroes/)
 */
export type HeroName = 'fighter' | 'wizard' | 'rogue' | 'cleric' | 'ranger';

/**
 * Enemy character names (must match SVG filenames in src/art/enemies/)
 */
export type EnemyName = 'goblin' | 'skeleton' | 'orc' | 'troll' | 'dark-knight' | 'dragon';

/**
 * Union of all character names
 */
export type CharacterName = HeroName | EnemyName;

/**
 * Animation states - subset of CharacterState that can be animated
 */
export type AnimationState = CharacterState;

/**
 * Options for the play() method
 */
export interface PlayOptions {
  /** Duration override in seconds (for custom timing) */
  duration?: number;
  /** Target element for attack animations */
  target?: Element;
  /** Damage amount for attack/hurt intensity */
  damage?: number;
  /** Whether this is a critical hit */
  isCrit?: boolean;
  /** Direction for attacks: 1 = right, -1 = left */
  direction?: 1 | -1;
}

/**
 * Options for the useCharacterAnimation hook
 */
export interface UseCharacterAnimationOptions {
  /** Callback fired when an animation state completes */
  onComplete?: (state: AnimationState) => void;
  /** Callback fired at damage point during attack animations */
  onDamagePoint?: () => void;
  /** Automatically return to idle after non-terminal states (default: true) */
  autoIdle?: boolean;
}

/**
 * Return type for useCharacterAnimation hook
 */
export interface UseCharacterAnimationReturn {
  /** Current animation state */
  state: AnimationState;
  /** Play an animation state, returns Promise for chaining */
  play: (newState: AnimationState, options?: PlayOptions) => Promise<void>;
  /** Stop current animation and freeze at current frame */
  stop: () => void;
  /** Reset to idle state, clearing any in-progress animations */
  reset: () => void;
  /** Whether an animation is currently playing */
  isPlaying: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * States that should NOT auto-return to idle
 */
const TERMINAL_STATES: Set<AnimationState> = new Set(['death', 'victory']);

/**
 * Default durations for each animation state (in seconds)
 */
const STATE_DURATIONS: Partial<Record<AnimationState, number>> = {
  attack: 0.28,
  hurt: 0.2,
  death: 0.6,
  cast: 0.4,
  heal: 0.35,
  stealth: 0.3,
  shoot: 0.3,
  enrage: 0.5,
  breath: 0.8,
  victory: 0.5,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing character sprite animations.
 * 
 * Provides state management and control methods for animating SVG character sprites.
 * Integrates with GSAP for smooth timeline-based animations.
 * 
 * @param ref - React ref to the SVG element
 * @param initialState - Initial animation state (default: 'idle')
 * @param options - Configuration options
 * @returns Animation state and control methods
 * 
 * @example
 * ```tsx
 * const svgRef = useRef<SVGSVGElement>(null);
 * const { state, play, stop, reset, isPlaying } = useCharacterAnimation(
 *   svgRef,
 *   'idle',
 *   {
 *     onComplete: (state) => console.log(`${state} animation finished`),
 *     onDamagePoint: () => applyDamage(),
 *   }
 * );
 * 
 * // Trigger attack animation
 * await play('attack', { damage: 25, isCrit: true });
 * 
 * // Chain animations
 * await play('cast');
 * await play('heal');
 * ```
 */
export function useCharacterAnimation(
  ref: RefObject<SVGElement>,
  initialState: AnimationState = 'idle',
  options?: UseCharacterAnimationOptions
): UseCharacterAnimationReturn {
  const { onComplete, onDamagePoint, autoIdle = true } = options ?? {};

  // State
  const [state, setState] = useState<AnimationState>(initialState);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for mutable values that don't trigger re-renders
  const currentTimeline = useRef<gsap.core.Timeline | null>(null);
  const currentPromiseReject = useRef<((reason?: unknown) => void) | null>(null);

  /**
   * Initialize SVG state on mount
   */
  useEffect(() => {
    if (ref.current) {
      forceCharacterState(ref.current, initialState);
    }
  }, [ref, initialState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (currentTimeline.current) {
        currentTimeline.current.kill();
      }
    };
  }, []);

  /**
   * Stop the current animation and freeze at current frame
   */
  const stop = useCallback(() => {
    if (currentTimeline.current) {
      currentTimeline.current.pause();
    }
    setIsPlaying(false);
  }, []);

  /**
   * Reset to idle state, clearing any in-progress animations
   */
  const reset = useCallback(() => {
    // Kill any running timeline
    if (currentTimeline.current) {
      currentTimeline.current.kill();
      currentTimeline.current = null;
    }

    // Reject any pending promise
    if (currentPromiseReject.current) {
      currentPromiseReject.current(new Error('Animation reset'));
      currentPromiseReject.current = null;
    }

    // Force back to idle
    if (ref.current) {
      forceCharacterState(ref.current, 'idle');
    }

    setState('idle');
    setIsPlaying(false);
  }, [ref]);

  /**
   * Play an animation state
   * 
   * @param newState - The animation state to play
   * @param playOptions - Options for this specific play call
   * @returns Promise that resolves when animation completes
   */
  const play = useCallback(
    (newState: AnimationState, playOptions?: PlayOptions): Promise<void> => {
      return new Promise((resolve, reject) => {
        const element = ref.current;
        if (!element) {
          reject(new Error('SVG element ref is null'));
          return;
        }

        // Kill any running animation
        if (currentTimeline.current) {
          currentTimeline.current.kill();
          currentTimeline.current = null;
        }

        // Store reject function for potential cancellation
        currentPromiseReject.current = reject;

        // Update state
        setState(newState);
        setIsPlaying(true);

        // If just switching to idle, no timeline needed
        if (newState === 'idle') {
          setCharacterState(element, 'idle');
          setIsPlaying(false);
          resolve();
          return;
        }

        // Get duration for this state
        const duration = playOptions?.duration ?? STATE_DURATIONS[newState] ?? 0.3;

        // Handle special states that use dedicated animation functions
        if (newState === 'death') {
          const deathTl = playDeathAnimation(element, {
            duration,
            onComplete: () => {
              setIsPlaying(false);
              currentTimeline.current = null;
              currentPromiseReject.current = null;
              onComplete?.(newState);
              resolve();
            },
          });
          currentTimeline.current = deathTl;
          return;
        }

        // For attack with target, use combat timeline
        if (newState === 'attack' && playOptions?.target) {
          const combatTl = createCombatTimeline(element, playOptions.target, playOptions.damage ?? 10, {
            isCrit: playOptions.isCrit,
            direction: playOptions.direction,
            onDamagePoint,
            onComplete: () => {
              setIsPlaying(false);
              currentTimeline.current = null;
              currentPromiseReject.current = null;
              
              // Auto-return to idle if configured
              if (autoIdle && !TERMINAL_STATES.has(newState)) {
                setState('idle');
                setCharacterState(element, 'idle');
              }
              
              onComplete?.(newState);
              resolve();
            },
          });
          currentTimeline.current = combatTl;
          return;
        }

        // Generic state animation timeline
        const tl = gsap.timeline({
          onComplete: () => {
            setIsPlaying(false);
            currentTimeline.current = null;
            currentPromiseReject.current = null;

            // Auto-return to idle if configured and not terminal state
            if (autoIdle && !TERMINAL_STATES.has(newState)) {
              setState('idle');
              setCharacterState(element, 'idle');
            }

            onComplete?.(newState);
            resolve();
          },
        });

        // Set to the new state immediately
        tl.call(() => {
          setCharacterState(element, newState);
        }, [], 0);

        // For attack states, fire damage point callback at appropriate time
        if (newState === 'attack') {
          tl.call(() => {
            onDamagePoint?.();
          }, [], 0.18); // Damage point at 180ms per spec
        }

        // Add a delay for the state duration
        tl.to({}, { duration });

        currentTimeline.current = tl;
      });
    },
    [ref, autoIdle, onComplete, onDamagePoint]
  );

  return {
    state,
    play,
    stop,
    reset,
    isPlaying,
  };
}

export default useCharacterAnimation;
