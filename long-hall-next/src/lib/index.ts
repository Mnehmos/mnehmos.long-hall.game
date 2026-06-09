/**
 * @fileoverview Core utility exports for Long Hall game engine
 * 
 * This module provides a centralized entry point for all core utilities:
 * - **Dice**: D&D 5e dice notation parsing and rolling
 * - **RNG**: Deterministic seeded random number generation
 * - **Hash**: String-to-number hashing for seed generation
 * 
 * @example
 * // Import everything
 * import { roll, SeededRNG, hashString } from '@lib';
 * 
 * @example
 * // Create a deterministic game session
 * import { hashString, SeededRNG, roll } from '@lib';
 * 
 * const sessionSeed = hashString('player-123-session-456');
 * const rng = new SeededRNG(sessionSeed);
 * const attackRoll = roll('1d20+5', rng);
 * 
 * @module lib
 */

// Dice rolling utilities
export {
  type DiceRoll,
  type RollResult,
  type RNG,
  parseDiceExpression,
  roll,
  rollWithModifier,
  rollAdvantage,
  rollDisadvantage,
} from './dice';

// Seeded random number generator
export { SeededRNG } from './rng';

// Hash utilities
export {
  hashString,
  combineHashes,
  hashObject,
  hashWithSeed,
  hashToId,
  createSeed,
} from './hash';
