/**
 * SeededRNG - Deterministic Random Number Generator
 *
 * Uses mulberry32: a 32-bit PRNG with a full 2^32 period and good
 * avalanche across ALL bits, including the low ones.
 *
 * History: this used to be a glibc-style LCG computed with plain `*`.
 * `MULTIPLIER * current` overflows 2^53, so float rounding silently zeroed
 * the low ~10 bits of every value after the first step. Because `int()`
 * derives from the low bits, every range dividing 1024 collapsed to a single
 * value -- `int(1, 2)` returned 1 forever, and `pick()` on any power-of-two
 * array returned element 0 roughly 98% of the time. All arithmetic here is
 * kept inside 32 bits (Math.imul / >>> 0) so that can't happen again.
 */
export class SeededRNG {
  private current: number;

  constructor(public readonly seed: number) {
    // Normalise to uint32 so negative hashes are valid seeds.
    this.current = seed >>> 0;
  }

  /**
   * Get the next random value in the sequence, as a uint32.
   */
  next(): number {
    // mulberry32
    this.current = (this.current + 0x6d2b79f5) >>> 0;
    let t = this.current;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  /**
   * Generate a random integer in the inclusive range [min, max].
   *
   * Uses rejection sampling so the distribution is exactly uniform rather
   * than modulo-biased toward the low end of the range.
   */
  int(min: number, max: number): number {
    if (min > max) {
      [min, max] = [max, min];
    }
    min = Math.ceil(min);
    max = Math.floor(max);
    const range = max - min + 1;
    if (range <= 1) return min;

    // Largest multiple of `range` that fits in uint32; values at or above it
    // would skew the distribution, so draw again.
    const limit = Math.floor(0x100000000 / range) * range;
    let v = this.next();
    while (v >= limit) {
      v = this.next();
    }
    return min + (v % range);
  }

  /**
   * Generate a random float in the range [0, 1)
   */
  float(): number {
    return this.next() / 0x100000000;
  }

  /**
   * Deterministically pick an element from an array
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Return a new array holding the same elements in a deterministically
   * shuffled order (Fisher-Yates).
   *
   * Prefer this over `array.sort(() => rng.float() - 0.5)`: that comparator is
   * inconsistent, so the result is engine-defined and heavily biased toward
   * the input order.
   */
  shuffle<T>(array: readonly T[]): T[] {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Take `count` distinct elements at random (fewer if the array is smaller).
   */
  sample<T>(array: readonly T[], count: number): T[] {
    return this.shuffle(array).slice(0, Math.max(0, count));
  }

  /**
   * Return true with the given probability (0..1).
   */
  chance(probability: number): boolean {
    return this.float() < probability;
  }

  /**
   * Create a new RNG with a derived seed (useful for sub-generators)
   */
  fork(): SeededRNG {
    // XOR with a constant to ensure the child sequence diverges from the parent's next step
    // otherwise child.next() would equal parent.next()
    return new SeededRNG((this.next() ^ 0xdeadbeef) >>> 0);
  }
}
