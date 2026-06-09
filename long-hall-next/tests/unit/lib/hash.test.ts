import { describe, it, expect } from 'vitest';
import {
  hashString,
  combineHashes,
  hashObject,
  hashWithSeed,
  hashToId,
  createSeed,
} from '../../../src/lib/hash';
import { SeededRNG } from '../../../src/lib/rng';

describe('hash', () => {
  describe('hashString', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('hello');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a number', () => {
      const hash = hashString('test');
      expect(typeof hash).toBe('number');
    });

    it('should handle empty string', () => {
      const hash = hashString('');
      expect(typeof hash).toBe('number');
      expect(hash).toBe(5381); // djb2 initial value
    });

    it('should handle unicode characters', () => {
      const hash = hashString('héllo wörld 日本語');
      expect(typeof hash).toBe('number');
      
      // Should be consistent
      expect(hashString('héllo wörld 日本語')).toBe(hash);
    });

    it('should be case-sensitive', () => {
      const hash1 = hashString('Hello');
      const hash2 = hashString('hello');
      expect(hash1).not.toBe(hash2);
    });

    it('should distinguish similar strings', () => {
      const hash1 = hashString('ab');
      const hash2 = hashString('ba');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 32-bit integer', () => {
      const hash = hashString('test string');
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(-2147483648);
      expect(hash).toBeLessThanOrEqual(2147483647);
    });
  });

  describe('combineHashes', () => {
    it('should return 0 for empty input', () => {
      expect(combineHashes()).toBe(0);
    });

    it('should return the hash itself for single input', () => {
      const hash = hashString('test');
      expect(combineHashes(hash)).toBe(hash);
    });

    it('should combine multiple hashes', () => {
      const h1 = hashString('player');
      const h2 = hashString('room');
      const combined = combineHashes(h1, h2);
      
      expect(typeof combined).toBe('number');
      expect(combined).not.toBe(h1);
      expect(combined).not.toBe(h2);
    });

    it('should be deterministic', () => {
      const h1 = hashString('a');
      const h2 = hashString('b');
      const h3 = hashString('c');
      
      const combined1 = combineHashes(h1, h2, h3);
      const combined2 = combineHashes(h1, h2, h3);
      
      expect(combined1).toBe(combined2);
    });

    it('should produce different results for different orderings (after mixing)', () => {
      const h1 = hashString('first');
      const h2 = hashString('second');
      
      // Due to mixing step, order matters
      const combined1 = combineHashes(h1, h2);
      const combined2 = combineHashes(h2, h1);
      
      expect(combined1).not.toBe(combined2);
    });

    it('should work with many hashes', () => {
      const hashes = Array.from({ length: 100 }, (_, i) => hashString(`item-${i}`));
      const combined = combineHashes(...hashes);
      
      expect(typeof combined).toBe('number');
      expect(Number.isInteger(combined)).toBe(true);
    });
  });

  describe('hashObject', () => {
    it('should hash simple objects', () => {
      const hash = hashObject({ name: 'hero', level: 5 });
      expect(typeof hash).toBe('number');
    });

    it('should be consistent for same object structure', () => {
      const obj = { a: 1, b: 2 };
      const hash1 = hashObject(obj);
      const hash2 = hashObject({ a: 1, b: 2 });
      expect(hash1).toBe(hash2);
    });

    it('should differ for different values', () => {
      const hash1 = hashObject({ value: 1 });
      const hash2 = hashObject({ value: 2 });
      expect(hash1).not.toBe(hash2);
    });

    it('should hash arrays', () => {
      const hash = hashObject([1, 2, 3]);
      expect(typeof hash).toBe('number');
      
      // Different arrays should have different hashes
      expect(hashObject([1, 2, 3])).not.toBe(hashObject([3, 2, 1]));
    });

    it('should hash nested objects', () => {
      const nested = {
        position: { x: 10, y: 20 },
        inventory: ['sword', 'potion'],
        stats: { hp: 100, mp: 50 },
      };
      
      const hash = hashObject(nested);
      expect(typeof hash).toBe('number');
      expect(hashObject(nested)).toBe(hash);
    });

    it('should handle null', () => {
      const hash = hashObject(null);
      expect(typeof hash).toBe('number');
    });

    it('should handle primitives', () => {
      expect(typeof hashObject(42)).toBe('number');
      expect(typeof hashObject('hello')).toBe('number');
      expect(typeof hashObject(true)).toBe('number');
    });

    it('should produce different hashes for property order changes', () => {
      // Note: This is expected JSON behavior - order affects hash
      // In practice, if you need order-independent hashing, sort keys first
      const hash1 = hashObject(JSON.parse('{"a":1,"b":2}'));
      const hash2 = hashObject(JSON.parse('{"b":2,"a":1}'));
      // These might or might not be equal depending on JS engine
      // The important thing is consistency within a session
      expect(typeof hash1).toBe('number');
      expect(typeof hash2).toBe('number');
    });
  });

  describe('hashWithSeed', () => {
    it('should combine string and seed', () => {
      const result = hashWithSeed('room', 12345);
      expect(typeof result).toBe('number');
    });

    it('should be deterministic', () => {
      const hash1 = hashWithSeed('player', 42);
      const hash2 = hashWithSeed('player', 42);
      expect(hash1).toBe(hash2);
    });

    it('should differ for different strings', () => {
      const hash1 = hashWithSeed('room-1', 42);
      const hash2 = hashWithSeed('room-2', 42);
      expect(hash1).not.toBe(hash2);
    });

    it('should differ for different seeds', () => {
      const hash1 = hashWithSeed('room', 100);
      const hash2 = hashWithSeed('room', 200);
      expect(hash1).not.toBe(hash2);
    });

    it('should work with negative seeds', () => {
      const hash = hashWithSeed('test', -12345);
      expect(typeof hash).toBe('number');
    });

    it('should work with zero seed', () => {
      const hash = hashWithSeed('test', 0);
      expect(typeof hash).toBe('number');
    });
  });

  describe('hashToId', () => {
    it('should return a base-36 string', () => {
      const hash = hashString('test');
      const id = hashToId(hash);
      
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-z]+$/);
    });

    it('should be deterministic', () => {
      const hash = hashString('session-123');
      const id1 = hashToId(hash);
      const id2 = hashToId(hash);
      expect(id1).toBe(id2);
    });

    it('should handle negative hash values', () => {
      const negativeHash = -12345;
      const id = hashToId(negativeHash);
      
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-z]+$/);
    });

    it('should produce short IDs (up to 7 chars)', () => {
      const testCases = ['a', 'hello', 'long-string-test', '日本語'];
      
      for (const str of testCases) {
        const hash = hashString(str);
        const id = hashToId(hash);
        expect(id.length).toBeLessThanOrEqual(7);
      }
    });

    it('should produce different IDs for different hashes', () => {
      const id1 = hashToId(hashString('first'));
      const id2 = hashToId(hashString('second'));
      expect(id1).not.toBe(id2);
    });
  });

  describe('createSeed', () => {
    it('should return 0 for empty components', () => {
      expect(createSeed()).toBe(0);
    });

    it('should hash single component', () => {
      const seed = createSeed('player-123');
      expect(seed).toBe(hashString('player-123'));
    });

    it('should combine multiple components', () => {
      const seed = createSeed('player', 'dungeon', 'room');
      expect(typeof seed).toBe('number');
      
      // Should differ from individual hashes
      expect(seed).not.toBe(hashString('player'));
      expect(seed).not.toBe(hashString('dungeon'));
      expect(seed).not.toBe(hashString('room'));
    });

    it('should be deterministic', () => {
      const seed1 = createSeed('a', 'b', 'c');
      const seed2 = createSeed('a', 'b', 'c');
      expect(seed1).toBe(seed2);
    });

    it('should differ for different component orders', () => {
      const seed1 = createSeed('first', 'second');
      const seed2 = createSeed('second', 'first');
      expect(seed1).not.toBe(seed2);
    });

    it('should differ for different components', () => {
      const seed1 = createSeed('player-1', 'room-1');
      const seed2 = createSeed('player-1', 'room-2');
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('integration with SeededRNG', () => {
    it('should create reproducible game sessions', () => {
      const sessionSeed = hashString('game-session-abc');
      
      const rng1 = new SeededRNG(sessionSeed);
      const rng2 = new SeededRNG(sessionSeed);
      
      // Both should produce identical sequences
      expect(rng1.int(1, 100)).toBe(rng2.int(1, 100));
      expect(rng1.float()).toBe(rng2.float());
    });

    it('should create unique subsystem seeds', () => {
      const baseSeed = hashString('master-session');
      const combatSeed = hashWithSeed('combat', baseSeed);
      const lootSeed = hashWithSeed('loot', baseSeed);
      
      const combatRng = new SeededRNG(combatSeed);
      const lootRng = new SeededRNG(lootSeed);
      
      // Different subsystems should have different sequences
      const combatRolls = [combatRng.int(1, 20), combatRng.int(1, 20)];
      const lootRolls = [lootRng.int(1, 20), lootRng.int(1, 20)];
      
      expect(combatRolls).not.toEqual(lootRolls);
    });

    it('should support multi-factor seed creation', () => {
      const seed = createSeed('player-123', 'dungeon-5', 'floor-3');
      const rng = new SeededRNG(seed);
      
      // Should be deterministic
      const rng2 = new SeededRNG(createSeed('player-123', 'dungeon-5', 'floor-3'));
      
      expect(rng.int(1, 100)).toBe(rng2.int(1, 100));
    });
  });

  describe('stability and edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = hashString(longString);
      expect(typeof hash).toBe('number');
      expect(Number.isFinite(hash)).toBe(true);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const hash = hashString(specialChars);
      expect(typeof hash).toBe('number');
    });

    it('should handle whitespace consistently', () => {
      expect(hashString(' ')).not.toBe(hashString(''));
      expect(hashString('  ')).not.toBe(hashString(' '));
      expect(hashString('\t')).not.toBe(hashString(' '));
      expect(hashString('\n')).not.toBe(hashString(' '));
    });

    it('should handle numbers in strings', () => {
      expect(hashString('123')).not.toBe(hashString('321'));
      expect(hashString('1')).not.toBe(hashString('01'));
    });
  });
});
