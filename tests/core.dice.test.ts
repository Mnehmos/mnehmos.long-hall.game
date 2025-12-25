/**
 * Tests for dice rolling utilities
 */

import { describe, it, expect } from 'vitest';
import { roll, rollWithModifier, rollAdvantage, rollDisadvantage, parseDiceExpression } from '../src/core/dice';

describe('parseDiceExpression', () => {
  it('should parse basic dice expression', () => {
    const result = parseDiceExpression('2d6');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(0);
    expect(result.advantage).toBeUndefined();
  });
  
  it('should parse dice expression with positive modifier', () => {
    const result = parseDiceExpression('1d20+5');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.modifier).toBe(5);
  });
  
  it('should parse dice expression with negative modifier', () => {
    const result = parseDiceExpression('2d8-3');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(8);
    expect(result.modifier).toBe(-3);
  });
  
  it('should parse advantage expression', () => {
    const result = parseDiceExpression('1d20adv');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.advantage).toBe('advantage');
  });
  
  it('should parse disadvantage expression', () => {
    const result = parseDiceExpression('1d20dis');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.advantage).toBe('disadvantage');
  });
  
  it('should be case insensitive', () => {
    const result1 = parseDiceExpression('2D6');
    const result2 = parseDiceExpression('2d6');
    expect(result1).toEqual(result2);
  });
  
  it('should throw error for invalid expression', () => {
    expect(() => parseDiceExpression('invalid')).toThrow('Invalid dice expression');
  });
  
  it('should throw error for invalid dice count', () => {
    expect(() => parseDiceExpression('0d6')).toThrow('Dice count must be between 1 and 100');
  });
  
  it('should throw error for invalid dice sides', () => {
    expect(() => parseDiceExpression('1d0')).toThrow('Dice sides must be between 1 and 1000');
  });
});

describe('roll', () => {
  it('should roll dice and return result', () => {
    const result = roll('2d6', { int: () => 3 });
    expect(result.total).toBe(6 + 0); // 3 + 3 + 0 modifier
    expect(result.rolls).toEqual([3, 3]);
    expect(result.modifier).toBe(0);
  });
  
  it('should apply modifier to total', () => {
    const result = roll('1d20+5', { int: () => 10 });
    expect(result.total).toBe(15); // 10 + 5
    expect(result.rolls).toEqual([10]);
    expect(result.modifier).toBe(5);
  });
  
  it('should handle negative modifier', () => {
    const result = roll('1d8-2', { int: () => 5 });
    expect(result.total).toBe(3); // 5 - 2
    expect(result.modifier).toBe(-2);
  });
  
  it('should roll with advantage', () => {
    const result = roll('1d20adv', { int: () => 10 });
    expect(result.total).toBe(10); // max(10, 10) = 10
    expect(result.rolls).toEqual([10, 10]);
    expect(result.keptRolls).toEqual([10]);
  });
  
  it('should roll with disadvantage', () => {
    const result = roll('1d20dis', { int: () => 10 });
    expect(result.total).toBe(10); // min(10, 10) = 10
    expect(result.rolls).toEqual([10, 10]);
    expect(result.keptRolls).toEqual([10]);
  });
  
  it('should keep highest with advantage', () => {
    let callCount = 0;
    const result = roll('1d20adv', { 
      int: () => callCount++ === 0 ? 15 : 5 
    });
    expect(result.total).toBe(15); // max(15, 5) = 15
    expect(result.keptRolls).toEqual([15]);
  });
  
  it('should keep lowest with disadvantage', () => {
    let callCount = 0;
    const result = roll('1d20dis', { 
      int: () => callCount++ === 0 ? 5 : 15 
    });
    expect(result.total).toBe(5); // min(5, 15) = 5
    expect(result.keptRolls).toEqual([5]);
  });
  
  it('should handle multiple dice', () => {
    let callCount = 0;
    const result = roll('4d6', { 
      int: () => [1, 2, 3, 4][callCount++] 
    });
    expect(result.total).toBe(10); // 1 + 2 + 3 + 4 = 10
    expect(result.rolls).toEqual([1, 2, 3, 4]);
  });
});

describe('rollWithModifier', () => {
  it('should override expression modifier', () => {
    const result = rollWithModifier('1d20+5', 10, { int: () => 8 });
    expect(result.total).toBe(18); // 8 + 10
    expect(result.modifier).toBe(10);
  });
  
  it('should work with negative modifier', () => {
    const result = rollWithModifier('1d20', -3, { int: () => 10 });
    expect(result.total).toBe(7); // 10 - 3
    expect(result.modifier).toBe(-3);
  });
});

describe('rollAdvantage', () => {
  it('should roll 2d20 and keep highest', () => {
    let callCount = 0;
    const result = rollAdvantage({ 
      int: () => callCount++ === 0 ? 5 : 18 
    });
    expect(result.total).toBe(18);
    expect(result.rolls).toEqual([5, 18]);
    expect(result.keptRolls).toEqual([18]);
  });
});

describe('rollDisadvantage', () => {
  it('should roll 2d20 and keep lowest', () => {
    let callCount = 0;
    const result = rollDisadvantage({ 
      int: () => callCount++ === 0 ? 5 : 18 
    });
    expect(result.total).toBe(5);
    expect(result.rolls).toEqual([5, 18]);
    expect(result.keptRolls).toEqual([5]);
  });
});
