/**
 * Death Animation Module
 * 
 * Provides death and defeat animation sequences for The Long Hall combat system.
 * Animations include grayscale transition, collapse, and fade out effects.
 * 
 * @module lib/animations/death
 * @see {@link file://./../../docs/ANIMATION-STATES.md} for timing specifications
 */

import { gsap } from 'gsap';
import { setCharacterState } from './combat';

/**
 * Options for death animation
 */
export interface DeathAnimationOptions {
  /** Callback fired when animation completes */
  onComplete?: () => void;
  /** Whether to remove the element from DOM after animation (default: false) */
  removeElement?: boolean;
  /** Custom duration in seconds (default: 0.6) */
  duration?: number;
  /** Whether to play the "death" state SVG animation (default: true) */
  useDeathState?: boolean;
}

/**
 * Options for mass death animation
 */
export interface MassDeathAnimationOptions {
  /** Delay between each death in seconds (default: 0.05) */
  stagger?: number;
  /** Callback fired when all deaths complete */
  onAllComplete?: () => void;
  /** Whether to remove elements after animation (default: false) */
  removeElements?: boolean;
}

/**
 * Plays a death animation sequence for a single character.
 * 
 * Animation phases (600ms total):
 * 1. 0-200ms: Switch to death state, apply grayscale filter
 * 2. 200-400ms: Collapse (scaleY to 0.5, transformOrigin: bottom)
 * 3. 400-600ms: Fade out (opacity to 0)
 * 4. 600ms: Call onComplete, optionally remove element
 * 
 * @param target - The character's SVG element or container
 * @param options - Optional configuration for the animation
 * @returns A GSAP Timeline instance for the animation
 * 
 * @example
 * ```ts
 * // Basic death animation
 * playDeathAnimation(enemyElement, {
 *   onComplete: () => {
 *     dropLoot(enemy);
 *     awardXP(enemy.xp);
 *   }
 * });
 * 
 * // Remove element after death
 * playDeathAnimation(enemyElement, {
 *   removeElement: true,
 *   onComplete: () => updateBattlefield()
 * });
 * ```
 */
export function playDeathAnimation(
  target: Element,
  options?: DeathAnimationOptions
): gsap.core.Timeline {
  const {
    onComplete,
    removeElement = false,
    duration = 0.6,
    useDeathState = true,
  } = options ?? {};

  // Calculate phase durations based on total duration
  const phaseDuration = duration / 3;
  
  // Create the death timeline
  const tl = gsap.timeline({
    onComplete: () => {
      if (removeElement && target.parentNode) {
        target.remove();
      }
      onComplete?.();
    },
  });

  // Phase 1 (0-200ms equivalent): Switch to death state and apply grayscale
  if (useDeathState) {
    tl.call(() => {
      setCharacterState(target, 'death');
    }, [], 0);
  }
  
  tl.to(target, {
    filter: 'grayscale(1)',
    duration: phaseDuration,
    ease: 'power2.out',
  }, 0);

  // Also add a slight red tint flash at the start
  tl.to(target, {
    filter: 'grayscale(0.3) brightness(1.2) saturate(0.5)',
    duration: phaseDuration * 0.3,
    ease: 'power2.in',
  }, 0);
  
  tl.to(target, {
    filter: 'grayscale(1)',
    duration: phaseDuration * 0.7,
    ease: 'power2.out',
  }, phaseDuration * 0.3);

  // Phase 2 (200-400ms equivalent): Collapse with scaleY
  tl.to(target, {
    scaleY: 0.5,
    transformOrigin: 'center bottom',
    duration: phaseDuration,
    ease: 'power2.in',
  }, phaseDuration);
  
  // Slight horizontal wobble during collapse
  tl.to(target, {
    rotation: -5,
    duration: phaseDuration * 0.5,
    ease: 'power1.inOut',
  }, phaseDuration);
  
  tl.to(target, {
    rotation: 0,
    duration: phaseDuration * 0.5,
    ease: 'power1.out',
  }, phaseDuration + phaseDuration * 0.5);

  // Phase 3 (400-600ms equivalent): Fade out
  tl.to(target, {
    opacity: 0,
    y: 10, // Slight drop as fading
    duration: phaseDuration,
    ease: 'power2.out',
  }, phaseDuration * 2);

  return tl;
}

/**
 * Plays death animations for multiple characters with staggered timing.
 * Optimized for AoE kills or mass combat resolutions.
 * 
 * @param targets - Array of character SVG elements
 * @param options - Optional configuration for the mass animation
 * @returns A GSAP Timeline containing all death animations
 * 
 * @example
 * ```ts
 * // AoE kill
 * playMassDeathAnimation(deadEnemies, {
 *   stagger: 0.1,
 *   onAllComplete: () => {
 *     showVictoryScreen();
 *   }
 * });
 * ```
 */
export function playMassDeathAnimation(
  targets: Element[],
  options?: MassDeathAnimationOptions
): gsap.core.Timeline {
  const {
    stagger = 0.05,
    onAllComplete,
    removeElements = false,
  } = options ?? {};

  const tl = gsap.timeline({
    onComplete: onAllComplete,
  });

  targets.forEach((target, index) => {
    tl.add(
      playDeathAnimation(target, {
        removeElement: removeElements,
      }),
      index * stagger
    );
  });

  return tl;
}

/**
 * Plays a dramatic boss death animation.
 * Extended duration with more visual effects.
 * 
 * @param target - The boss character element
 * @param options - Optional configuration
 * @returns A GSAP Timeline for the boss death sequence
 * 
 * @example
 * ```ts
 * playBossDeathAnimation(bossElement, {
 *   onComplete: () => {
 *     playVictoryFanfare();
 *     showLootScreen();
 *   }
 * });
 * ```
 */
export function playBossDeathAnimation(
  target: Element,
  options?: DeathAnimationOptions
): gsap.core.Timeline {
  const {
    onComplete,
    removeElement = false,
  } = options ?? {};

  const tl = gsap.timeline({
    onComplete: () => {
      if (removeElement && target.parentNode) {
        target.remove();
      }
      onComplete?.();
    },
  });

  // Switch to death state
  tl.call(() => {
    setCharacterState(target, 'death');
  }, [], 0);

  // Phase 1: Flash white/red (0-200ms)
  tl.to(target, {
    filter: 'brightness(2) saturate(0.5)',
    duration: 0.1,
    ease: 'power2.in',
  }, 0);
  
  tl.to(target, {
    filter: 'brightness(1) saturate(1)',
    duration: 0.1,
    ease: 'power2.out',
  }, 0.1);

  // Phase 2: Shake violently (200-600ms)
  for (let i = 0; i < 8; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    const intensity = 10 - (i * 0.8); // Decreasing intensity
    
    tl.to(target, {
      x: direction * intensity,
      rotation: direction * (intensity * 0.3),
      duration: 0.05,
      ease: 'none',
    }, 0.2 + (i * 0.05));
  }
  
  tl.to(target, {
    x: 0,
    rotation: 0,
    duration: 0.05,
  }, 0.6);

  // Phase 3: Apply grayscale slowly (600-900ms)
  tl.to(target, {
    filter: 'grayscale(1)',
    duration: 0.3,
    ease: 'power2.inOut',
  }, 0.6);

  // Phase 4: Collapse and fall (900-1300ms)
  tl.to(target, {
    scaleY: 0.4,
    scaleX: 1.1,
    transformOrigin: 'center bottom',
    duration: 0.4,
    ease: 'power2.in',
  }, 0.9);
  
  tl.to(target, {
    rotation: -15,
    duration: 0.4,
    ease: 'power2.in',
  }, 0.9);

  // Phase 5: Fade out (1300-1600ms)
  tl.to(target, {
    opacity: 0,
    y: 20,
    duration: 0.3,
    ease: 'power2.out',
  }, 1.3);

  return tl;
}

/**
 * Plays a quick despawn animation (for summoned creatures, etc.)
 * Faster than death animation, just fades and scales out.
 * 
 * @param target - The element to despawn
 * @param onComplete - Callback when complete
 * @returns A GSAP Timeline (300ms duration)
 */
export function playDespawnAnimation(
  target: Element,
  onComplete?: () => void
): gsap.core.Timeline {
  const tl = gsap.timeline({
    onComplete: () => {
      target.remove();
      onComplete?.();
    },
  });

  tl.to(target, {
    scale: 0.5,
    opacity: 0,
    filter: 'blur(4px)',
    duration: 0.3,
    ease: 'power2.in',
  });

  return tl;
}

/**
 * Plays a "knockout" animation for heroes reaching 0 HP.
 * Similar to death but leaves the character visible (knocked down).
 * 
 * @param target - The hero element
 * @param options - Optional configuration
 * @returns A GSAP Timeline (500ms duration)
 */
export function playKnockoutAnimation(
  target: Element,
  options?: { onComplete?: () => void }
): gsap.core.Timeline {
  const { onComplete } = options ?? {};

  const tl = gsap.timeline({
    onComplete,
  });

  // Switch to death state (knocked out pose)
  tl.call(() => {
    setCharacterState(target, 'death');
  }, [], 0);

  // Flash red
  tl.to(target, {
    filter: 'brightness(1.3) saturate(1.5) hue-rotate(-10deg)',
    duration: 0.1,
    ease: 'power2.in',
  }, 0);
  
  tl.to(target, {
    filter: 'brightness(1) saturate(1) hue-rotate(0deg)',
    duration: 0.1,
  }, 0.1);

  // Fall down
  tl.to(target, {
    rotation: -10,
    y: 15,
    duration: 0.3,
    ease: 'power2.in',
  }, 0.2);

  // Reduce saturation (but don't fully grayscale - they're not dead)
  tl.to(target, {
    filter: 'saturate(0.5) brightness(0.8)',
    opacity: 0.7,
    duration: 0.2,
    ease: 'power2.out',
  }, 0.3);

  return tl;
}

/**
 * Revives a knocked-out character with a recovery animation.
 * 
 * @param target - The knocked-out character element
 * @param options - Optional configuration
 * @returns A GSAP Timeline (400ms duration)
 */
export function playReviveAnimation(
  target: Element,
  options?: { onComplete?: () => void }
): gsap.core.Timeline {
  const { onComplete } = options ?? {};

  const tl = gsap.timeline({
    onComplete,
  });

  // Flash heal color
  tl.to(target, {
    filter: 'brightness(1.5) saturate(1.2)',
    duration: 0.1,
    ease: 'power2.in',
  }, 0);

  // Restore position and appearance
  tl.to(target, {
    rotation: 0,
    y: 0,
    opacity: 1,
    filter: 'brightness(1) saturate(1)',
    duration: 0.3,
    ease: 'back.out(1.5)',
  }, 0.1);

  // Switch back to idle state
  tl.call(() => {
    setCharacterState(target, 'idle');
  }, [], 0.4);

  return tl;
}
