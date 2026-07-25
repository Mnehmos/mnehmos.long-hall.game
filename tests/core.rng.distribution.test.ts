import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/core/rng';
import { ENEMIES } from '../src/content/tables';

/**
 * Distribution tests.
 *
 * The original RNG passed every range/determinism assertion in
 * core.rng.test.ts while being catastrophically broken: `MULTIPLIER * current`
 * overflowed 2^53, float rounding zeroed the low bits, and any range dividing
 * 1024 collapsed to a single value. `int(1, 2)` returned 1 forever, and
 * `pick()` on an 8- or 16-element array returned element 0 ~98% of the time.
 *
 * Range checks cannot catch that. These tests assert the shape of the output.
 */
describe('SeededRNG distribution', () => {
  it('int() covers small ranges (regression: power-of-two collapse)', () => {
    // int(1,2) and int(1,4) are used for enemy counts, minion counts and loot
    // counts. Both used to be constant.
    for (const max of [2, 3, 4, 5, 8, 16]) {
      const seen = new Set<number>();
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 500; i++) seen.add(rng.int(1, max));
      expect(seen.size, `int(1, ${max}) only produced ${[...seen]}`).toBe(max);
    }
  });

  it('int() is close to uniform', () => {
    const counts = new Array(6).fill(0);
    const rng = new SeededRNG(99);
    const draws = 60_000;
    for (let i = 0; i < draws; i++) counts[rng.int(0, 5)]++;

    const expected = draws / 6;
    for (const c of counts) {
      // Generous band; a biased generator misses this by a mile.
      expect(Math.abs(c - expected) / expected).toBeLessThan(0.06);
    }
  });

  it('low bits are not degenerate', () => {
    // The old LCG produced values that were all multiples of 1024 after the
    // first step, so v % 2 was always 0.
    const rng = new SeededRNG(2024);
    let odd = 0;
    for (let i = 0; i < 1000; i++) if (rng.next() % 2 === 1) odd++;
    expect(odd).toBeGreaterThan(400);
    expect(odd).toBeLessThan(600);
  });

  it('next() stays within uint32 and is an integer', () => {
    const rng = new SeededRNG(-7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xFFFFFFFF);
    }
  });

  it('pick() reaches every element of power-of-two pools', () => {
    // This is the bug players actually felt: segment 1 has 8 eligible enemies
    // and 198/200 rooms spawned "Rat Swarm".
    for (const size of [2, 4, 8, 16, 32]) {
      const pool = Array.from({ length: size }, (_, i) => i);
      const seen = new Set<number>();
      const rng = new SeededRNG(777);
      for (let i = 0; i < size * 60; i++) seen.add(rng.pick(pool));
      expect(seen.size, `pick() on a ${size}-element pool saw ${seen.size}`).toBe(size);
    }
  });

  it('enemy pools produce varied encounters at every segment', () => {
    const tiers: Array<[number, number]> = [[1, 2], [2, 4], [3, 6], [5, 8], [7, 10], [9, 13]];

    tiers.forEach(([lo, hi], index) => {
      const pool = ENEMIES.filter(e => e.power >= lo && e.power <= hi);
      const counts = new Map<string, number>();

      for (let seed = 0; seed < 300; seed++) {
        const rng = new SeededRNG(seed * 7919 + 13);
        // generateRoom makes several rolls before picking enemies. Advance
        // past the first value: the old LCG was still exact on step 1 and only
        // degenerated afterwards, so a fresh-RNG pick would hide the bug.
        rng.next();
        const picked = rng.pick(pool);
        counts.set(picked.name, (counts.get(picked.name) || 0) + 1);
      }

      // Every enemy in the tier should show up...
      expect(counts.size, `segment ${index + 1} (pool ${pool.length}) only spawned ${counts.size} kinds`)
        .toBe(pool.length);

      // ...and no single enemy should dominate.
      const most = Math.max(...counts.values());
      expect(most / 300, `segment ${index + 1} is dominated by one enemy`).toBeLessThan(0.35);
    });
  });

  it('shuffle() is a permutation and actually reorders', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const rng = new SeededRNG(4242);

    let movedAtLeastOnce = false;
    for (let i = 0; i < 50; i++) {
      const out = rng.shuffle(input);
      expect(out).toHaveLength(input.length);
      expect([...out].sort((a, b) => a - b)).toEqual(input);
      if (out.some((v, idx) => v !== input[idx])) movedAtLeastOnce = true;
    }
    expect(movedAtLeastOnce).toBe(true);
  });

  it('shuffle() does not favour the original order', () => {
    // `sort(() => rng.float() - 0.5)` -- the old approach -- leaves elements
    // near where they started. Fisher-Yates should not.
    const input = Array.from({ length: 10 }, (_, i) => i);
    const rng = new SeededRNG(31337);
    let firstStaysFirst = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (rng.shuffle(input)[0] === 0) firstStaysFirst++;
    }
    // Should be ~1/10 of the time.
    expect(firstStaysFirst / trials).toBeGreaterThan(0.06);
    expect(firstStaysFirst / trials).toBeLessThan(0.15);
  });

  it('sample() returns distinct elements', () => {
    const rng = new SeededRNG(5);
    const pool = Array.from({ length: 12 }, (_, i) => `item-${i}`);
    for (let i = 0; i < 100; i++) {
      const taken = rng.sample(pool, 4);
      expect(taken).toHaveLength(4);
      expect(new Set(taken).size).toBe(4);
    }
    // Asking for more than exists yields the whole pool, not undefined padding.
    expect(rng.sample(pool, 99)).toHaveLength(pool.length);
  });

  it('stays deterministic for a given seed', () => {
    const a = new SeededRNG(2718);
    const b = new SeededRNG(2718);
    for (let i = 0; i < 200; i++) {
      expect(a.int(1, 100)).toBe(b.int(1, 100));
    }
  });
});
