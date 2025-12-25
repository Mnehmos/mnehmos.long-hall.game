/**
 * SeededRNG - Deterministic Random Number Generator
 * 
 * Uses a simple linear congruential generator (LCG) for reproducible
 * random sequences based on a seed value.
 */
export class SeededRNG {
  private current: number;
  
  // LCG parameters (using constants from glibc)
  private static readonly MULTIPLIER = 1103515245;
  private static readonly INCREMENT = 12345;
  private static readonly MODULUS = 0x80000000; // 2^31

  constructor(public readonly seed: number) {
    this.current = seed;
  }

  /**
   * Get the next random value in the sequence (0 to MODULUS-1)
   */
  next(): number {
    this.current = (SeededRNG.MULTIPLIER * this.current + SeededRNG.INCREMENT) % SeededRNG.MODULUS;
    // Handle potential negative result from JS modulo operator with negative operands
    if (this.current < 0) this.current += SeededRNG.MODULUS;
    return this.current;
  }

  /**
   * Generate a random integer in the inclusive range [min, max]
   */
  int(min: number, max: number): number {
    if (min > max) {
      [min, max] = [max, min];
    }
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  /**
   * Generate a random float in the range [0, 1)
   */
  float(): number {
    return this.next() / SeededRNG.MODULUS;
  }

  /**
   * Deterministically pick an element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.int(0, array.length - 1);
    return array[index];
  }

  /**
   * Create a new RNG with a derived seed (useful for sub-generators)
   */
  fork(): SeededRNG {
    // XOR with a constant to ensure the child sequence diverges from the parent's next step
    // otherwise child.next() would equal parent.next()
    return new SeededRNG(this.next() ^ 0xDEADBEEF);
  }
}
