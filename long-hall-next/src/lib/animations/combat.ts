/**
 * Combat Animation Module
 * 
 * Provides GSAP-powered combat timeline animations for The Long Hall.
 * Timelines orchestrate attacker lunges, state swaps, damage points, and recovery.
 * 
 * @module lib/animations/combat
 * @see {@link file://./../../docs/ANIMATION-STATES.md} for timing specifications
 */

import { gsap } from 'gsap';

/**
 * Valid character animation states matching SVG group IDs
 */
export type CharacterState = 'idle' | 'attack' | 'hurt' | 'death' | 'victory' | 'cast' | 'heal' | 'stealth' | 'shoot' | 'enrage' | 'breath';

/**
 * Options for combat timeline creation
 */
export interface CombatTimelineOptions {
  /** Whether this attack is a critical hit (affects visual intensity) */
  isCrit?: boolean;
  /** Callback fired at the exact moment damage is dealt (180ms mark) */
  onDamagePoint?: () => void;
  /** Callback fired when the entire combat animation completes */
  onComplete?: () => void;
  /** Direction for attacker lunge: 1 = right (default), -1 = left */
  direction?: 1 | -1;
  /** Distance in pixels for the attacker lunge (default: 20) */
  lungeDistance?: number;
}

/**
 * Helper to switch SVG character state visibility.
 * Toggles the `.active` class between state groups within an SVG element.
 * 
 * @param element - The SVG element or its container (must contain #state-{name} groups)
 * @param state - The target state to activate
 * 
 * @example
 * ```ts
 * setCharacterState(heroSvg, 'attack');
 * // Later...
 * setCharacterState(heroSvg, 'idle');
 * ```
 */
export function setCharacterState(
  element: Element, 
  state: CharacterState | string
): void {
  // Find all animation state groups
  const stateGroups = element.querySelectorAll('.anim-state');
  
  stateGroups.forEach((group) => {
    group.classList.remove('active');
  });
  
  // Activate the target state
  const targetState = element.querySelector(`#state-${state}`);
  if (targetState) {
    targetState.classList.add('active');
  }
}

/**
 * Creates a complete combat animation timeline.
 * 
 * Orchestrates a full attack sequence:
 * 1. Attacker lunges toward target (0-80ms)
 * 2. Flash attack state (80ms)
 * 3. Damage point fires (180ms) - target switches to hurt state
 * 4. Target shake/recoil effect (180-280ms)
 * 5. Attacker returns to position (180-280ms)
 * 6. Both reset to idle state (280ms)
 * 
 * Total duration: ≤280ms (requirement: <300ms for snappy feel)
 * 
 * @param attacker - The attacker's SVG element or container
 * @param target - The target's SVG element or container
 * @param damage - The damage amount (used for visual intensity)
 * @param options - Optional configuration for the timeline
 * @returns A GSAP Timeline instance (auto-plays by default)
 * 
 * @example
 * ```ts
 * const timeline = createCombatTimeline(heroElement, enemyElement, 25, {
 *   isCrit: true,
 *   onDamagePoint: () => {
 *     enemy.hp -= 25;
 *     showDamageNumber(enemyElement, 25, { isCrit: true });
 *   },
 *   onComplete: () => {
 *     checkForDeath(enemy);
 *   }
 * });
 * ```
 */
export function createCombatTimeline(
  attacker: Element,
  target: Element,
  damage: number,
  options?: CombatTimelineOptions
): gsap.core.Timeline {
  const {
    isCrit = false,
    onDamagePoint,
    onComplete,
    direction = 1,
    lungeDistance = 20,
  } = options ?? {};

  // Calculate intensity modifiers based on damage/crit
  const shakeIntensity = isCrit ? 8 : 5;
  const critScale = isCrit ? 1.05 : 1;

  // Create the master timeline
  const tl = gsap.timeline({
    onComplete: () => {
      // Ensure both are back to idle
      setCharacterState(attacker, 'idle');
      setCharacterState(target, 'idle');
      onComplete?.();
    },
    defaults: {
      ease: 'power2.out',
    },
  });

  // Phase 1: Anticipation (0-80ms) - Attacker lunges toward target
  tl.to(attacker, {
    x: direction * lungeDistance,
    scale: critScale,
    duration: 0.08,
    ease: 'power2.in',
  });

  // Phase 2: Attack state swap (at 80ms)
  tl.call(() => {
    setCharacterState(attacker, 'attack');
  }, [], 0.08);

  // Phase 3: Damage point (at 180ms)
  tl.call(() => {
    // Switch target to hurt state
    setCharacterState(target, 'hurt');
    // Fire the damage callback
    onDamagePoint?.();
  }, [], 0.18);

  // Phase 4: Target shake/recoil (180-280ms)
  tl.to(target, {
    x: -shakeIntensity,
    duration: 0.02,
    ease: 'power2.out',
  }, 0.18);

  tl.to(target, {
    x: shakeIntensity,
    duration: 0.02,
    ease: 'none',
  }, 0.20);

  tl.to(target, {
    x: -shakeIntensity * 0.5,
    duration: 0.02,
    ease: 'none',
  }, 0.22);

  tl.to(target, {
    x: 0,
    duration: 0.04,
    ease: 'power2.out',
  }, 0.24);

  // Phase 5: Attacker recovery (180-280ms) - Return to position
  tl.to(attacker, {
    x: 0,
    scale: 1,
    duration: 0.1,
    ease: 'power2.out',
  }, 0.18);

  // Phase 6: Reset states (at 280ms) - handled in onComplete

  return tl;
}

/**
 * Creates a quick attack timeline for multi-hit scenarios.
 * Faster timing optimized for combo attacks.
 * 
 * @param attacker - The attacker's SVG element
 * @param target - The target's SVG element
 * @param onDamagePoint - Callback when damage lands
 * @returns A GSAP Timeline (150ms total duration)
 */
export function createQuickAttackTimeline(
  attacker: Element,
  target: Element,
  onDamagePoint?: () => void
): gsap.core.Timeline {
  const tl = gsap.timeline({
    onComplete: () => {
      setCharacterState(attacker, 'idle');
      setCharacterState(target, 'idle');
    },
  });

  // Quick lunge (0-40ms)
  tl.to(attacker, {
    x: 15,
    duration: 0.04,
    ease: 'power2.in',
  });

  // Attack state (40ms)
  tl.call(() => setCharacterState(attacker, 'attack'), [], 0.04);

  // Damage point (90ms)
  tl.call(() => {
    setCharacterState(target, 'hurt');
    onDamagePoint?.();
  }, [], 0.09);

  // Target shake (90-130ms)
  tl.to(target, {
    x: -4,
    duration: 0.015,
  }, 0.09);

  tl.to(target, {
    x: 4,
    duration: 0.015,
  }, 0.105);

  tl.to(target, {
    x: 0,
    duration: 0.02,
    ease: 'power2.out',
  }, 0.12);

  // Return (90-150ms)
  tl.to(attacker, {
    x: 0,
    duration: 0.06,
    ease: 'power2.out',
  }, 0.09);

  return tl;
}

/**
 * Presets the character to a specific state without animation.
 * Useful for initialization or instant state changes.
 * 
 * @param element - The character's SVG element
 * @param state - The state to set
 */
export function forceCharacterState(
  element: Element,
  state: CharacterState | string
): void {
  // Kill any running animations on this element
  gsap.killTweensOf(element);
  
  // Reset transforms
  gsap.set(element, {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
  });
  
  // Set the state
  setCharacterState(element, state);
}
