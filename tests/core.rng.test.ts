/**
 * Tests for SeededRNG - deterministic random number generation
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/core/rng';

describe('SeededRNG', () => {
  describe('determinism', () => {
    it('should produce the same sequence for the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      
      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });
    
    it('should produce different sequences for different seeds', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(54321);
      
      const sequence1: number[] = [];
      const sequence2: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        sequence1.push(rng1.next());
        sequence2.push(rng2.next());
      }
      
      expect(sequence1).not.toEqual(sequence2);
    });
  });
  
  describe('int()', () => {
    it('should generate integers within the specified range', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 1000; i++) {
        const value = rng.int(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
    
    it('should handle min > max by swapping', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 100; i++) {
        const value = rng.int(10, 1);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });
    
    it('should be deterministic for the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      
      for (let i = 0; i < 50; i++) {
        expect(rng1.int(1, 100)).toBe(rng2.int(1, 100));
      }
    });
  });
  
  describe('float()', () => {
    it('should generate floats in the range [0, 1)', () => {
      const rng = new SeededRNG(42);
      
      for (let i = 0; i < 1000; i++) {
        const value = rng.float();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
    
    it('should be deterministic for the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      
      for (let i = 0; i < 50; i++) {
        expect(rng1.float()).toBe(rng2.float());
      }
    });
  });
  
  describe('pick()', () => {
    it('should pick an element from the array', () => {
      const rng = new SeededRNG(42);
      const array = ['a', 'b', 'c', 'd', 'e'];
      
      const picked = rng.pick(array);
      expect(array).toContain(picked);
    });
    
    it('should be deterministic for the same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      const array = ['a', 'b', 'c', 'd', 'e'];
      
      for (let i = 0; i < 20; i++) {
        expect(rng1.pick(array)).toBe(rng2.pick(array));
      }
    });
    
    it('should throw an error for empty array', () => {
      const rng = new SeededRNG(42);
      const array: string[] = [];
      
      expect(() => rng.pick(array)).toThrow('Cannot pick from empty array');
    });
  });
  
  describe('fork()', () => {
    it('should create a new RNG with a derived seed', () => {
      const parent = new SeededRNG(12345);
      const child = parent.fork();
      
      expect(child.seed).not.toBe(parent.seed);
      expect(typeof child.seed).toBe('number');
    });
    
    it('should produce independent sequences', () => {
      const parent = new SeededRNG(12345);
      const child = parent.fork();
      
      const parentSequence: number[] = [];
      const childSequence: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        parentSequence.push(parent.next());
        childSequence.push(child.next());
      }
      
      expect(parentSequence).not.toEqual(childSequence);
    });
  });
  
  describe('seed property', () => {
    it('should store the initial seed', () => {
      const seed = 12345;
      const rng = new SeededRNG(seed);
      
      expect(rng.seed).toBe(seed);
    });
  });
});
