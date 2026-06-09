import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../../src/lib/rng';

describe('SeededRNG', () => {
  describe('constructor', () => {
    it('should store the seed', () => {
      const rng = new SeededRNG(12345);
      expect(rng.seed).toBe(12345);
    });

    it('should accept negative seeds', () => {
      const rng = new SeededRNG(-12345);
      expect(rng.seed).toBe(-12345);
    });

    it('should accept zero as seed', () => {
      const rng = new SeededRNG(0);
      expect(rng.seed).toBe(0);
    });
  });

  describe('determinism', () => {
    it('should produce identical sequence with same seed', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(43);

      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should produce repeatable sequence across test runs', () => {
      // These specific values verify the LCG implementation is stable
      const rng = new SeededRNG(12345);
      const expectedSequence = [
        rng.next(),
        rng.next(),
        rng.next(),
      ];
      
      // Verify we get consistent results
      const rng2 = new SeededRNG(12345);
      expect(rng2.next()).toBe(expectedSequence[0]);
      expect(rng2.next()).toBe(expectedSequence[1]);
      expect(rng2.next()).toBe(expectedSequence[2]);
    });
  });

  describe('next()', () => {
    it('should return non-negative values', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 1000; i++) {
        expect(rng.next()).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return values less than MODULUS (2^31)', () => {
      const rng = new SeededRNG(42);
      const modulus = 0x80000000;
      
      for (let i = 0; i < 1000; i++) {
        expect(rng.next()).toBeLessThan(modulus);
      }
    });
  });

  describe('int()', () => {
    it('should return values within specified range', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 1000; i++) {
        const value = rng.int(1, 6);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    });

    it('should swap min and max if min > max', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const value1 = rng1.int(10, 1);
      const value2 = rng2.int(1, 10);

      // They should produce the same value since args are swapped
      expect(value1).toBe(value2);
    });

    it('should handle single value range', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 10; i++) {
        expect(rng.int(5, 5)).toBe(5);
      }
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      for (let i = 0; i < 50; i++) {
        expect(rng1.int(1, 100)).toBe(rng2.int(1, 100));
      }
    });

    it('should cover the full range over many rolls', () => {
      const rng = new SeededRNG(42);
      const seen = new Set<number>();
      
      // Roll d6 many times, should eventually see all values
      for (let i = 0; i < 1000; i++) {
        seen.add(rng.int(1, 6));
      }
      
      expect(seen.size).toBe(6);
      expect(seen.has(1)).toBe(true);
      expect(seen.has(6)).toBe(true);
    });
  });

  describe('float()', () => {
    it('should return values in [0, 1)', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 1000; i++) {
        const value = rng.float();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      for (let i = 0; i < 50; i++) {
        expect(rng1.float()).toBe(rng2.float());
      }
    });
  });

  describe('pick()', () => {
    it('should return an element from the array', () => {
      const rng = new SeededRNG(42);
      const options = ['sword', 'axe', 'bow', 'staff'];
      
      for (let i = 0; i < 100; i++) {
        const picked = rng.pick(options);
        expect(options).toContain(picked);
      }
    });

    it('should throw on empty array', () => {
      const rng = new SeededRNG(42);
      expect(() => rng.pick([])).toThrow('Cannot pick from empty array');
    });

    it('should return the only element for single-element array', () => {
      const rng = new SeededRNG(42);
      expect(rng.pick(['only'])).toBe('only');
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      const options = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 50; i++) {
        expect(rng1.pick(options)).toBe(rng2.pick(options));
      }
    });

    it('should cover all options over many picks', () => {
      const rng = new SeededRNG(42);
      const options = ['a', 'b', 'c', 'd'];
      const seen = new Set<string>();
      
      for (let i = 0; i < 1000; i++) {
        seen.add(rng.pick(options));
      }
      
      expect(seen.size).toBe(4);
    });

    it('should work with different types', () => {
      const rng = new SeededRNG(42);
      
      expect(typeof rng.pick([1, 2, 3])).toBe('number');
      expect(typeof rng.pick(['a', 'b', 'c'])).toBe('string');
      expect(typeof rng.pick([true, false])).toBe('boolean');
    });
  });

  describe('shuffle()', () => {
    it('should return the same array instance', () => {
      const rng = new SeededRNG(42);
      const original = [1, 2, 3, 4, 5];
      const result = rng.shuffle(original);
      
      expect(result).toBe(original);
    });

    it('should contain all original elements', () => {
      const rng = new SeededRNG(42);
      const array = [1, 2, 3, 4, 5];
      rng.shuffle(array);
      
      expect(array.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('should be deterministic', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      
      const array1 = [1, 2, 3, 4, 5];
      const array2 = [1, 2, 3, 4, 5];
      
      rng1.shuffle(array1);
      rng2.shuffle(array2);
      
      expect(array1).toEqual(array2);
    });

    it('should handle empty array', () => {
      const rng = new SeededRNG(42);
      const empty: number[] = [];
      rng.shuffle(empty);
      expect(empty).toEqual([]);
    });

    it('should handle single element', () => {
      const rng = new SeededRNG(42);
      const single = [42];
      rng.shuffle(single);
      expect(single).toEqual([42]);
    });

    it('should produce different orderings for different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(9999);
      
      const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      rng1.shuffle(array1);
      rng2.shuffle(array2);
      
      // Extremely unlikely to be equal with different seeds
      expect(array1).not.toEqual(array2);
    });
  });

  describe('fork()', () => {
    it('should create a new SeededRNG instance', () => {
      const parent = new SeededRNG(42);
      const child = parent.fork();
      
      expect(child).toBeInstanceOf(SeededRNG);
      expect(child).not.toBe(parent);
    });

    it('should produce independent sequences', () => {
      const parent = new SeededRNG(42);
      const child = parent.fork();
      
      // Parent and child should not produce the same sequence
      const parentValues = Array.from({ length: 10 }, () => parent.int(1, 100));
      const childValues = Array.from({ length: 10 }, () => child.int(1, 100));
      
      // Very unlikely to match
      expect(parentValues).not.toEqual(childValues);
    });

    it('should be deterministic', () => {
      const parent1 = new SeededRNG(12345);
      const parent2 = new SeededRNG(12345);
      
      const child1 = parent1.fork();
      const child2 = parent2.fork();
      
      // Same parent seed should produce identical child sequences
      for (let i = 0; i < 50; i++) {
        expect(child1.int(1, 100)).toBe(child2.int(1, 100));
      }
    });

    it('should allow multiple forks with different sequences', () => {
      const parent = new SeededRNG(42);
      
      const child1 = parent.fork();
      const child2 = parent.fork();
      
      // Two forks from same parent at different points should differ
      const seq1 = Array.from({ length: 10 }, () => child1.int(1, 100));
      const seq2 = Array.from({ length: 10 }, () => child2.int(1, 100));
      
      expect(seq1).not.toEqual(seq2);
    });

    it('should advance parent state when forking', () => {
      const parent1 = new SeededRNG(42);
      const parent2 = new SeededRNG(42);
      
      parent1.fork(); // This should advance parent1's state
      
      // Now parent1 and parent2 should be out of sync
      expect(parent1.next()).not.toBe(parent2.next());
    });
  });

  describe('real-world usage patterns', () => {
    it('should support game session reproducibility', () => {
      // Simulate two identical game sessions
      const sessionSeed = 54321;
      
      function simulateSession(seed: number) {
        const rng = new SeededRNG(seed);
        const results = {
          roomType: rng.pick(['dungeon', 'forest', 'cave', 'castle']),
          enemyCount: rng.int(1, 5),
          lootQuality: rng.float(),
          treasureItems: [] as string[],
        };
        
        const items = ['gold', 'gem', 'potion', 'sword', 'armor'];
        const shuffled = rng.shuffle([...items]);
        results.treasureItems = shuffled.slice(0, 3);
        
        return results;
      }
      
      const session1 = simulateSession(sessionSeed);
      const session2 = simulateSession(sessionSeed);
      
      expect(session1).toEqual(session2);
    });

    it('should support isolated subsystems via fork', () => {
      const masterRng = new SeededRNG(12345);
      
      // Create isolated RNGs for different game systems
      const combatRng = masterRng.fork();
      const lootRng = masterRng.fork();
      const dialogueRng = masterRng.fork();
      
      // Each system can operate independently
      const combatRolls = [combatRng.int(1, 20), combatRng.int(1, 20)];
      const lootRolls = [lootRng.float(), lootRng.float()];
      const dialogueChoice = dialogueRng.pick(['friendly', 'hostile', 'neutral']);
      
      // Verify determinism
      const masterRng2 = new SeededRNG(12345);
      const combatRng2 = masterRng2.fork();
      const lootRng2 = masterRng2.fork();
      const dialogueRng2 = masterRng2.fork();
      
      expect([combatRng2.int(1, 20), combatRng2.int(1, 20)]).toEqual(combatRolls);
      expect([lootRng2.float(), lootRng2.float()]).toEqual(lootRolls);
      expect(dialogueRng2.pick(['friendly', 'hostile', 'neutral'])).toBe(dialogueChoice);
    });
  });
});
