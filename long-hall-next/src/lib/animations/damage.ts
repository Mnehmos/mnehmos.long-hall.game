/**
 * Damage Number Animation Module
 * 
 * Provides floating damage number animations for The Long Hall combat system.
 * Numbers float up and fade out, with styling for crits, heals, and standard damage.
 * 
 * @module lib/animations/damage
 * @see {@link file://./../../docs/ANIMATION-STATES.md} for timing specifications
 */

import { gsap } from 'gsap';

/**
 * Options for damage number display
 */
export interface DamageNumberOptions {
  /** Whether this is a critical hit (larger, golden color) */
  isCrit?: boolean;
  /** Whether this is healing (green color) */
  isHeal?: boolean;
  /** Whether this is a miss (gray, "MISS" text) */
  isMiss?: boolean;
  /** Horizontal offset from target center (default: 0) */
  offsetX?: number;
  /** Vertical offset from target top (default: -20) */
  offsetY?: number;
  /** Custom duration in seconds (default: 0.8) */
  duration?: number;
  /** Float distance in pixels (default: 30) */
  floatDistance?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * CSS class names for damage number styling
 */
const DAMAGE_CLASSES = {
  base: 'damage-number',
  crit: 'damage-number--crit',
  heal: 'damage-number--heal',
  miss: 'damage-number--miss',
} as const;

/**
 * Inline styles for damage numbers (using CSS variables from tokens.css)
 */
const DAMAGE_STYLES = {
  base: `
    position: absolute;
    pointer-events: none;
    font-family: var(--font-display, 'Space Grotesk', sans-serif);
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 100;
    white-space: nowrap;
  `,
  damage: `
    color: var(--damage, #ef4444);
    font-size: 1.25rem;
  `,
  crit: `
    color: var(--crit, #fbbf24);
    font-size: 1.75rem;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
  `,
  heal: `
    color: var(--heal, #22c55e);
    font-size: 1.25rem;
  `,
  miss: `
    color: var(--miss, #9ca3af);
    font-size: 1rem;
    font-style: italic;
  `,
} as const;

/**
 * Creates a DOM element for displaying damage numbers.
 * The element is styled based on the damage type (normal, crit, heal, miss).
 * 
 * @param damage - The damage/heal value to display (or 0 for miss)
 * @param isCrit - Whether this is a critical hit
 * @param isHeal - Whether this is healing
 * @param isMiss - Whether this is a miss
 * @returns The created HTMLSpanElement (not yet attached to DOM)
 * 
 * @example
 * ```ts
 * const element = createDamageElement(25, true, false);
 * container.appendChild(element);
 * ```
 */
export function createDamageElement(
  damage: number,
  isCrit: boolean = false,
  isHeal: boolean = false,
  isMiss: boolean = false
): HTMLSpanElement {
  const span = document.createElement('span');
  
  // Set class names
  span.className = DAMAGE_CLASSES.base;
  if (isCrit) span.classList.add(DAMAGE_CLASSES.crit);
  if (isHeal) span.classList.add(DAMAGE_CLASSES.heal);
  if (isMiss) span.classList.add(DAMAGE_CLASSES.miss);
  
  // Set text content
  if (isMiss) {
    span.textContent = 'MISS';
  } else {
    const prefix = isHeal ? '+' : (damage > 0 ? '-' : '');
    span.textContent = `${prefix}${Math.abs(damage)}`;
    
    // Add exclamation for crits
    if (isCrit) {
      span.textContent += '!';
    }
  }
  
  // Apply inline styles (fallback if CSS classes aren't loaded)
  let styleString = DAMAGE_STYLES.base;
  
  if (isMiss) {
    styleString += DAMAGE_STYLES.miss;
  } else if (isHeal) {
    styleString += DAMAGE_STYLES.heal;
  } else if (isCrit) {
    styleString += DAMAGE_STYLES.crit;
  } else {
    styleString += DAMAGE_STYLES.damage;
  }
  
  span.style.cssText = styleString;
  
  return span;
}

/**
 * Gets the bounding rect of an element, handling SVG elements specially.
 * 
 * @param element - The target element
 * @returns The bounding rectangle
 */
function getElementBounds(element: Element): DOMRect {
  if (element instanceof SVGElement) {
    return element.getBoundingClientRect();
  }
  return (element as HTMLElement).getBoundingClientRect();
}

/**
 * Shows a floating damage number above the target element.
 * The number floats up and fades out over the specified duration.
 * 
 * Animation spec:
 * - Creates a span element positioned above the target
 * - Moves up 30px over 800ms (default)
 * - Fades from opacity 1 to 0
 * - Removes element after animation
 * 
 * @param target - The target element to show damage above
 * @param damage - The damage value to display
 * @param options - Optional configuration for the animation
 * @returns A GSAP Timeline instance for the animation
 * 
 * @example
 * ```ts
 * // Normal damage
 * showDamageNumber(enemyElement, 15);
 * 
 * // Critical hit
 * showDamageNumber(enemyElement, 42, { isCrit: true });
 * 
 * // Healing
 * showDamageNumber(heroElement, 20, { isHeal: true });
 * 
 * // Miss
 * showDamageNumber(enemyElement, 0, { isMiss: true });
 * ```
 */
export function showDamageNumber(
  target: Element,
  damage: number,
  options?: DamageNumberOptions
): gsap.core.Timeline {
  const {
    isCrit = false,
    isHeal = false,
    isMiss = false,
    offsetX = 0,
    offsetY = -20,
    duration = 0.8,
    floatDistance = 30,
    onComplete,
  } = options ?? {};

  // Create the damage element
  const damageEl = createDamageElement(damage, isCrit, isHeal, isMiss);
  
  // Get target position
  const targetBounds = getElementBounds(target);
  
  // Find a suitable container (parent with position: relative/absolute, or body)
  let container = target.parentElement;
  while (container && container !== document.body) {
    const position = getComputedStyle(container).position;
    if (position === 'relative' || position === 'absolute' || position === 'fixed') {
      break;
    }
    container = container.parentElement;
  }
  
  if (!container) {
    container = document.body;
  }
  
  // Calculate position relative to container
  const containerBounds = container.getBoundingClientRect();
  const startX = targetBounds.left - containerBounds.left + targetBounds.width / 2 + offsetX;
  const startY = targetBounds.top - containerBounds.top + offsetY;
  
  // Position the element
  damageEl.style.left = `${startX}px`;
  damageEl.style.top = `${startY}px`;
  damageEl.style.transform = 'translateX(-50%)'; // Center horizontally
  
  // Add to DOM
  container.appendChild(damageEl);
  
  // Create the animation timeline
  const tl = gsap.timeline({
    onComplete: () => {
      // Clean up: remove element from DOM
      damageEl.remove();
      onComplete?.();
    },
  });

  // Initial pop-in effect for crits
  if (isCrit) {
    tl.fromTo(damageEl, {
      scale: 0.5,
      opacity: 0,
    }, {
      scale: 1.2,
      opacity: 1,
      duration: 0.1,
      ease: 'back.out(2)',
    });
    
    tl.to(damageEl, {
      scale: 1,
      duration: 0.1,
      ease: 'power2.out',
    });
  } else {
    tl.fromTo(damageEl, {
      opacity: 0,
      scale: 0.8,
    }, {
      opacity: 1,
      scale: 1,
      duration: 0.1,
      ease: 'power2.out',
    });
  }
  
  // Float up animation
  tl.to(damageEl, {
    y: -floatDistance,
    duration: duration - 0.2, // Account for fade-out time
    ease: 'power2.out',
  }, isCrit ? 0.2 : 0.1);
  
  // Fade out
  tl.to(damageEl, {
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
  }, `-=0.2`);

  return tl;
}

/**
 * Shows multiple damage numbers with staggered timing.
 * Useful for multi-hit attacks or AoE damage.
 * 
 * @param targets - Array of target elements
 * @param damages - Array of damage values (must match targets length)
 * @param options - Options applied to all damage numbers
 * @param stagger - Delay between each number in seconds (default: 0.05)
 * @returns A GSAP Timeline containing all animations
 * 
 * @example
 * ```ts
 * // AoE damage
 * showMultipleDamageNumbers(
 *   [enemy1, enemy2, enemy3],
 *   [15, 12, 18],
 *   { isCrit: false },
 *   0.1
 * );
 * ```
 */
export function showMultipleDamageNumbers(
  targets: Element[],
  damages: number[],
  options?: Omit<DamageNumberOptions, 'onComplete'>,
  stagger: number = 0.05
): gsap.core.Timeline {
  const tl = gsap.timeline();
  
  targets.forEach((target, index) => {
    const damage = damages[index] ?? 0;
    
    // Add slight random offset for visual variety
    const randomOffsetX = (Math.random() - 0.5) * 20;
    
    tl.add(
      showDamageNumber(target, damage, {
        ...options,
        offsetX: (options?.offsetX ?? 0) + randomOffsetX,
      }),
      index * stagger
    );
  });
  
  return tl;
}

/**
 * Shows a combo counter damage number.
 * Displayed larger and in a different position for combo tracking.
 * 
 * @param target - The target element
 * @param comboCount - The current combo count
 * @param totalDamage - Total combo damage dealt
 * @returns A GSAP Timeline for the animation
 */
export function showComboNumber(
  target: Element,
  comboCount: number,
  totalDamage: number
): gsap.core.Timeline {
  const span = document.createElement('span');
  span.className = 'combo-number';
  span.innerHTML = `<strong>${comboCount}x</strong> Combo!<br/><small>${totalDamage} total</small>`;
  
  span.style.cssText = `
    position: absolute;
    pointer-events: none;
    font-family: var(--font-display, 'Space Grotesk', sans-serif);
    font-weight: 700;
    font-size: 1.5rem;
    color: var(--crit, #fbbf24);
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.7), 0 2px 4px rgba(0, 0, 0, 0.4);
    text-align: center;
    z-index: 101;
  `;
  
  const targetBounds = getElementBounds(target);
  let container = target.parentElement ?? document.body;
  const containerBounds = container.getBoundingClientRect();
  
  span.style.left = `${targetBounds.left - containerBounds.left + targetBounds.width / 2}px`;
  span.style.top = `${targetBounds.top - containerBounds.top - 40}px`;
  span.style.transform = 'translateX(-50%)';
  
  container.appendChild(span);
  
  const tl = gsap.timeline({
    onComplete: () => span.remove(),
  });
  
  tl.fromTo(span, {
    scale: 0,
    rotation: -10,
    opacity: 0,
  }, {
    scale: 1.3,
    rotation: 0,
    opacity: 1,
    duration: 0.2,
    ease: 'back.out(2)',
  });
  
  tl.to(span, {
    scale: 1,
    duration: 0.1,
  });
  
  tl.to(span, {
    y: -20,
    duration: 0.6,
    ease: 'power2.out',
  }, 0.3);
  
  tl.to(span, {
    opacity: 0,
    duration: 0.3,
  }, '-=0.3');
  
  return tl;
}
