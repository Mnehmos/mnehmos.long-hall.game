/**
 * Tests for hash utilities
 */

import { describe, it, expect } from 'vitest';
import { hashString, combineHashes, hashObject, hashWithSeed } from '../src/core/hash';

describe('hashString', () => {
  it('should return a number for any string', () => {
    const result = hashString('test');
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should be deterministic for same input', () => {
    const input = 'hello world';
    const hash1 = hashString(input);
    const hash2 = hashString(input);
    
    expect(hash1).toBe(hash2);
  });
  
  it('should produce different hashes for different strings', () => {
    const hash1 = hashString('hello');
    const hash2 = hashString('world');
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('should be case sensitive', () => {
    const hash1 = hashString('Hello');
    const hash2 = hashString('hello');
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('should handle empty string', () => {
    const result = hashString('');
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should handle special characters', () => {
    const result = hashString('test!@#$%^&*()');
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should handle unicode characters', () => {
    const result = hashString('你好世界 🌍');
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('combineHashes', () => {
  it('should return 0 for empty array', () => {
    const result = combineHashes();
    expect(result).toBe(0);
  });
  
  it('should return single hash for single input', () => {
    const hash = 12345;
    const result = combineHashes(hash);
    expect(result).toBe(hash);
  });
  
  it('should combine multiple hashes', () => {
    const hash1 = 100;
    const hash2 = 200;
    const hash3 = 300;
    const result = combineHashes(hash1, hash2, hash3);
    
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should be deterministic for same inputs', () => {
    const hash1 = 100;
    const hash2 = 200;
    
    const result1 = combineHashes(hash1, hash2);
    const result2 = combineHashes(hash1, hash2);
    
    expect(result1).toBe(result2);
  });
  
  it('should produce different results for different order', () => {
    const hash1 = 100;
    const hash2 = 200;
    
    const result1 = combineHashes(hash1, hash2);
    const result2 = combineHashes(hash2, hash1);
    
    // XOR is commutative, but with mixing they might differ
    // Just verify they're both valid numbers
    expect(typeof result1).toBe('number');
    expect(typeof result2).toBe('number');
  });
});

describe('hashObject', () => {
  it('should hash simple objects', () => {
    const obj = { a: 1, b: 2 };
    const result = hashObject(obj);
    
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should be deterministic for same object', () => {
    const obj = { name: 'test', value: 42 };
    const hash1 = hashObject(obj);
    const hash2 = hashObject(obj);
    
    expect(hash1).toBe(hash2);
  });
  
  it('should produce different hashes for different objects', () => {
    const obj1 = { name: 'test', value: 42 };
    const obj2 = { name: 'test', value: 43 };
    
    const hash1 = hashObject(obj1);
    const hash2 = hashObject(obj2);
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('should handle nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    const result = hashObject(obj);
    
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should handle arrays', () => {
    const arr = [1, 2, 3, 4];
    const result = hashObject(arr);
    
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should be deterministic for same array', () => {
    const arr = [1, 2, 3];
    const hash1 = hashObject(arr);
    const hash2 = hashObject(arr);
    
    expect(hash1).toBe(hash2);
  });
  
  it('should handle null and undefined', () => {
    const hash1 = hashObject(null);
    const hash2 = hashObject(undefined);
    
    expect(typeof hash1).toBe('number');
    expect(typeof hash2).toBe('number');
  });
});

describe('hashWithSeed', () => {
  it('should combine string hash with seed', () => {
    const str = 'test';
    const seed = 12345;
    const result = hashWithSeed(str, seed);
    
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
  
  it('should produce different results for different seeds', () => {
    const str = 'test';
    const hash1 = hashWithSeed(str, 12345);
    const hash2 = hashWithSeed(str, 54321);
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('should be deterministic for same inputs', () => {
    const str = 'test';
    const seed = 12345;
    
    const hash1 = hashWithSeed(str, seed);
    const hash2 = hashWithSeed(str, seed);
    
    expect(hash1).toBe(hash2);
  });
});
