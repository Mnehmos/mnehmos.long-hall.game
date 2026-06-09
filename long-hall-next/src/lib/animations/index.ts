/**
 * Animation Module Barrel Export
 * 
 * Central export point for all GSAP-powered animation modules in The Long Hall.
 * Provides combat, damage number, and death animation utilities.
 * 
 * @module lib/animations
 * @see {@link file://./../../docs/ANIMATION-STATES.md} for full animation specifications
 * 
 * @example
 * ```ts
 * import {
 *   createCombatTimeline,
 *   showDamageNumber,
 *   playDeathAnimation,
 *   setCharacterState
 * } from '@/lib/animations';
 * 
 * // Execute attack with damage and potential death
 * const timeline = createCombatTimeline(attacker, target, damage, {
 *   onDamagePoint: () => {
 *     target.hp -= damage;
 *     showDamageNumber(targetElement, damage);
 *     
 *     if (target.hp <= 0) {
 *       playDeathAnimation(targetElement, {
 *         onComplete: () => handleEnemyDeath(target)
 *       });
 *     }
 *   }
 * });
 * ```
 */

// ============================================================================
// Combat Animations
// ============================================================================

export {
  // Main timeline factory
  createCombatTimeline,
  // Quick attack variant for combos
  createQuickAttackTimeline,
  // State management utilities
  setCharacterState,
  forceCharacterState,
  // Types
  type CharacterState,
  type CombatTimelineOptions,
} from './combat';

// ============================================================================
// Damage Number Animations
// ============================================================================

export {
  // Main damage number function
  showDamageNumber,
  // DOM element factory
  createDamageElement,
  // Multi-target variant
  showMultipleDamageNumbers,
  // Combo counter
  showComboNumber,
  // Types
  type DamageNumberOptions,
} from './damage';

// ============================================================================
// Death & Defeat Animations
// ============================================================================

export {
  // Standard death animation
  playDeathAnimation,
  // AoE/mass death variant
  playMassDeathAnimation,
  // Extended boss death sequence
  playBossDeathAnimation,
  // Quick despawn for summons
  playDespawnAnimation,
  // Hero knockout (not dead, just down)
  playKnockoutAnimation,
  // Recovery from knockout
  playReviveAnimation,
  // Types
  type DeathAnimationOptions,
  type MassDeathAnimationOptions,
} from './death';

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * Animation timing constants (in milliseconds)
 * These match the CSS variables defined in tokens.css
 */
export const ANIMATION_TIMINGS = {
  /** Attack animation budget (must complete within this) */
  ATTACK_BUDGET_MS: 280,
  /** Damage point fires at this time in attack sequence */
  DAMAGE_POINT_MS: 180,
  /** Hurt animation duration */
  HURT_DURATION_MS: 200,
  /** Death animation duration */
  DEATH_DURATION_MS: 600,
  /** Damage number float duration */
  DAMAGE_NUMBER_MS: 800,
  /** Boss death extended duration */
  BOSS_DEATH_MS: 1600,
} as const;

/**
 * Default animation distances (in pixels)
 */
export const ANIMATION_DISTANCES = {
  /** How far attacker lunges toward target */
  LUNGE_DISTANCE: 20,
  /** How far damage numbers float up */
  DAMAGE_FLOAT: 30,
  /** Shake intensity for normal hits */
  SHAKE_NORMAL: 5,
  /** Shake intensity for critical hits */
  SHAKE_CRIT: 8,
} as const;
