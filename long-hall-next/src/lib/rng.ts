/**
 * @fileoverview SeededRNG - Deterministic Random Number Generator
 * 
 * Uses a Linear Congruential Generator (LCG) algorithm for reproducible
 * random sequences based on a seed value. Essential for:
 * - Reproducible game states from seed strings
 * - Deterministic testing of random behaviors
 * - Procedural generation with consistent results
 * 
 * @module rng
 */

/**
 * A deterministic random number generator using the Linear Congruential Generator (LCG) algorithm.
 * 
 * The LCG algorithm uses the formula: `next = (a * current + c) mod m`
 * where:
 * - `a` (multiplier) = 1103515245
 * - `c` (increment) = 12345
 * - `m` (modulus) = 2^31
 * 
 * These are the constants used by glibc, providing a period of 2^31.
 * 
 * @example
 * // Create a seeded RNG
 * const rng = new SeededRNG(12345);
 * 
 * // Same seed always produces same sequence
 * const rng1 = new SeededRNG(42);
 * const rng2 = new SeededRNG(42);
 * console.log(rng1.int(1, 100) === rng2.int(1, 100)); // true
 * 
 * @example
 * // Use with dice rolling
 * import { roll } from './dice';
 * const rng = new SeededRNG(54321);
 * const result = roll('2d6+3', rng);
 * // Result is deterministic based on seed
 */
export class SeededRNG {
  private current: number;
  
  // LCG parameters (using constants from glibc)
  private static readonly MULTIPLIER = 1103515245;
  private static readonly INCREMENT = 12345;
  private static readonly MODULUS = 0x80000000; // 2^31

  /**
   * Create a new seeded random number generator.
   * 
   * @param seed - The initial seed value (any 32-bit integer)
   * 
   * @example
   * // Create from numeric seed
   * const rng = new SeededRNG(12345);
   * 
   * @example
   * // Create from hash (see hash.ts)
   * import { hashString } from './hash';
   * const rng = new SeededRNG(hashString('game-session-abc'));
   */
  constructor(public readonly seed: number) {
    this.current = seed;
  }

  /**
   * Get the next raw random value in the sequence.
   * 
   * Returns a value in the range [0, 2^31 - 1].
   * Generally, use `int()`, `float()`, or `pick()` instead.
   * 
   * @returns The next value in the pseudo-random sequence
   * @internal
   * 
   * @example
   * const rng = new SeededRNG(42);
   * const raw = rng.next(); // 0 to 2147483647
   */
  next(): number {
    this.current = (SeededRNG.MULTIPLIER * this.current + SeededRNG.INCREMENT) % SeededRNG.MODULUS;
    // Handle potential negative result from JS modulo operator with negative operands
    if (this.current < 0) this.current += SeededRNG.MODULUS;
    return this.current;
  }

  /**
   * Generate a random integer in the inclusive range [min, max].
   * 
   * If min > max, the values are automatically swapped.
   * This method satisfies the RNG interface expected by dice rolling functions.
   * 
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @returns A random integer in the range [min, max]
   * 
   * @example
   * const rng = new SeededRNG(12345);
   * 
   * // Roll a d6
   * const d6 = rng.int(1, 6);
   * 
   * // Generate a random index
   * const index = rng.int(0, array.length - 1);
   * 
   * @example
   * // Min/max are auto-swapped
   * const rng = new SeededRNG(42);
   * const value = rng.int(10, 1); // Same as rng.int(1, 10)
   */
  int(min: number, max: number): number {
    if (min > max) {
      [min, max] = [max, min];
    }
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  /**
   * Generate a random float in the range [0, 1).
   * 
   * The result is uniformly distributed with approximately 31 bits of precision.
   * 
   * @returns A random float in [0, 1)
   * 
   * @example
   * const rng = new SeededRNG(42);
   * 
   * // Random percentage
   * const chance = rng.float();
   * if (chance < 0.3) {
   *   console.log('30% chance triggered!');
   * }
   * 
   * @example
   * // Random value in range
   * const rng = new SeededRNG(42);
   * const damage = 10 + rng.float() * 10; // 10.0 to 19.999...
   */
  float(): number {
    return this.next() / SeededRNG.MODULUS;
  }

  /**
   * Deterministically pick a random element from an array.
   * 
   * @typeParam T - The type of elements in the array
   * @param array - Non-empty array to pick from
   * @returns A randomly selected element
   * @throws {Error} If the array is empty
   * 
   * @example
   * const rng = new SeededRNG(42);
   * 
   * const weapons = ['sword', 'axe', 'bow', 'staff'];
   * const weapon = rng.pick(weapons);
   * 
   * @example
   * // Pick from weighted options
   * const rng = new SeededRNG(42);
   * const lootTable = [
   *   'common', 'common', 'common',  // 60%
   *   'rare', 'rare',                 // 40%
   * ];
   * const loot = rng.pick(lootTable);
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.int(0, array.length - 1);
    return array[index];
  }

  /**
   * Shuffle an array in-place using Fisher-Yates algorithm.
   * 
   * Modifies the original array. For immutable shuffle, copy the array first.
   * 
   * @typeParam T - The type of elements in the array
   * @param array - The array to shuffle (modified in place)
   * @returns The same array, now shuffled
   * 
   * @example
   * const rng = new SeededRNG(42);
   * 
   * const deck = ['A', 'K', 'Q', 'J', '10'];
   * rng.shuffle(deck);
   * console.log(deck); // Deterministically shuffled
   * 
   * @example
   * // Immutable shuffle
   * const rng = new SeededRNG(42);
   * const original = [1, 2, 3, 4, 5];
   * const shuffled = rng.shuffle([...original]);
   * // original is unchanged, shuffled is randomized
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Create a new RNG with a derived seed.
   * 
   * Useful for creating independent sub-generators for different purposes
   * while maintaining overall reproducibility from the parent seed.
   * 
   * The child sequence is designed to diverge from the parent's next value
   * by XORing with a magic constant.
   * 
   * @returns A new SeededRNG with a derived seed
   * 
   * @example
   * const masterRng = new SeededRNG(12345);
   * 
   * // Create independent generators for different systems
   * const combatRng = masterRng.fork();
   * const lootRng = masterRng.fork();
   * 
   * // Each fork produces independent sequences
   * console.log(combatRng.int(1, 20)); // Combat roll
   * console.log(lootRng.pick(['gold', 'gem'])); // Loot drop
   * 
   * @example
   * // Deterministic branches
   * const rng1 = new SeededRNG(42);
   * const rng2 = new SeededRNG(42);
   * 
   * const fork1 = rng1.fork();
   * const fork2 = rng2.fork();
   * 
   * console.log(fork1.int(1, 100) === fork2.int(1, 100)); // true
   */
  fork(): SeededRNG {
    // XOR with a constant to ensure the child sequence diverges from the parent's next step
    return new SeededRNG(this.next() ^ 0xDEADBEEF);
  }
}
