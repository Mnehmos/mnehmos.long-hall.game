import { describe, it, expect } from 'vitest';
import {
  parseDiceExpression,
  roll,
  rollWithModifier,
  rollAdvantage,
  rollDisadvantage,
  type DiceRoll,
  type RollResult,
} from '../../../src/lib/dice';
import { SeededRNG } from '../../../src/lib/rng';

describe('dice', () => {
  describe('parseDiceExpression', () => {
    it('should parse basic dice notation (NdX)', () => {
      const result = parseDiceExpression('2d6');
      expect(result).toEqual<DiceRoll>({
        count: 2,
        sides: 6,
        modifier: 0,
        advantage: undefined,
      });
    });

    it('should parse with positive modifier', () => {
      const result = parseDiceExpression('1d20+5');
      expect(result).toEqual<DiceRoll>({
        count: 1,
        sides: 20,
        modifier: 5,
        advantage: undefined,
      });
    });

    it('should parse with negative modifier', () => {
      const result = parseDiceExpression('1d20-3');
      expect(result).toEqual<DiceRoll>({
        count: 1,
        sides: 20,
        modifier: -3,
        advantage: undefined,
      });
    });

    it('should parse advantage notation', () => {
      const result = parseDiceExpression('1d20adv');
      expect(result).toEqual<DiceRoll>({
        count: 1,
        sides: 20,
        modifier: 0,
        advantage: 'advantage',
      });
    });

    it('should parse disadvantage notation', () => {
      const result = parseDiceExpression('1d20dis');
      expect(result).toEqual<DiceRoll>({
        count: 1,
        sides: 20,
        modifier: 0,
        advantage: 'disadvantage',
      });
    });

    it('should be case-insensitive', () => {
      const result1 = parseDiceExpression('2D6+3');
      const result2 = parseDiceExpression('2d6+3');
      expect(result1).toEqual(result2);
    });

    it('should trim whitespace', () => {
      const result = parseDiceExpression('  2d6+3  ');
      expect(result.count).toBe(2);
      expect(result.sides).toBe(6);
      expect(result.modifier).toBe(3);
    });

    it('should throw on invalid expression', () => {
      expect(() => parseDiceExpression('invalid')).toThrow('Invalid dice expression');
      expect(() => parseDiceExpression('d6')).toThrow('Invalid dice expression');
      expect(() => parseDiceExpression('2d')).toThrow('Invalid dice expression');
    });

    it('should throw on dice count out of range', () => {
      expect(() => parseDiceExpression('0d6')).toThrow('Dice count must be between 1 and 100');
      expect(() => parseDiceExpression('101d6')).toThrow('Dice count must be between 1 and 100');
    });

    it('should throw on dice sides out of range', () => {
      expect(() => parseDiceExpression('1d0')).toThrow('Dice sides must be between 1 and 1000');
      expect(() => parseDiceExpression('1d1001')).toThrow('Dice sides must be between 1 and 1000');
    });
  });

  describe('roll', () => {
    it('should produce deterministic results with seeded RNG', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const result1 = roll('2d6', rng1);
      const result2 = roll('2d6', rng2);

      expect(result1.total).toBe(result2.total);
      expect(result1.rolls).toEqual(result2.rolls);
    });

    it('should return correct structure for basic roll', () => {
      const rng = new SeededRNG(42);
      const result = roll('1d20', rng);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('rolls');
      expect(result).toHaveProperty('modifier');
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(0);
    });

    it('should apply modifier correctly', () => {
      const rng = new SeededRNG(42);
      const result = roll('1d6+3', rng);

      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.rolls[0] + 3);
    });

    it('should roll multiple dice', () => {
      const rng = new SeededRNG(42);
      const result = roll('4d6', rng);

      expect(result.rolls).toHaveLength(4);
      expect(result.total).toBe(result.rolls.reduce((a, b) => a + b, 0));
    });

    it('should produce values in valid range', () => {
      const rng = new SeededRNG(999);
      
      // Roll many times to check bounds
      for (let i = 0; i < 100; i++) {
        const result = roll('1d6', rng);
        expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
        expect(result.rolls[0]).toBeLessThanOrEqual(6);
      }
    });

    describe('advantage', () => {
      it('should roll two dice and keep highest', () => {
        const rng = new SeededRNG(12345);
        const result = roll('1d20adv', rng);

        expect(result.rolls).toHaveLength(2);
        expect(result.keptRolls).toHaveLength(1);
        expect(result.keptRolls![0]).toBe(Math.max(...result.rolls));
        expect(result.total).toBe(Math.max(...result.rolls));
      });
    });

    describe('disadvantage', () => {
      it('should roll two dice and keep lowest', () => {
        const rng = new SeededRNG(12345);
        const result = roll('1d20dis', rng);

        expect(result.rolls).toHaveLength(2);
        expect(result.keptRolls).toHaveLength(1);
        expect(result.keptRolls![0]).toBe(Math.min(...result.rolls));
        expect(result.total).toBe(Math.min(...result.rolls));
      });
    });
  });

  describe('rollWithModifier', () => {
    it('should override expression modifier', () => {
      const rng = new SeededRNG(42);
      const result = rollWithModifier('1d20+0', 7, rng);

      expect(result.modifier).toBe(7);
      expect(result.total).toBe(result.rolls[0] + 7);
    });

    it('should work with negative modifiers', () => {
      const rng = new SeededRNG(42);
      const result = rollWithModifier('1d20', -2, rng);

      expect(result.modifier).toBe(-2);
      expect(result.total).toBe(result.rolls[0] - 2);
    });

    it('should be deterministic with same seed', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const result1 = rollWithModifier('1d20', 5, rng1);
      const result2 = rollWithModifier('1d20', 5, rng2);

      expect(result1.total).toBe(result2.total);
    });
  });

  describe('rollAdvantage', () => {
    it('should roll 1d20 with advantage', () => {
      const rng = new SeededRNG(42);
      const result = rollAdvantage(rng);

      expect(result.rolls).toHaveLength(2);
      expect(result.keptRolls).toHaveLength(1);
      expect(result.keptRolls![0]).toBe(Math.max(...result.rolls));
    });

    it('should be equivalent to roll("1d20adv")', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const result1 = rollAdvantage(rng1);
      const result2 = roll('1d20adv', rng2);

      expect(result1.total).toBe(result2.total);
      expect(result1.rolls).toEqual(result2.rolls);
    });
  });

  describe('rollDisadvantage', () => {
    it('should roll 1d20 with disadvantage', () => {
      const rng = new SeededRNG(42);
      const result = rollDisadvantage(rng);

      expect(result.rolls).toHaveLength(2);
      expect(result.keptRolls).toHaveLength(1);
      expect(result.keptRolls![0]).toBe(Math.min(...result.rolls));
    });

    it('should be equivalent to roll("1d20dis")', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const result1 = rollDisadvantage(rng1);
      const result2 = roll('1d20dis', rng2);

      expect(result1.total).toBe(result2.total);
      expect(result1.rolls).toEqual(result2.rolls);
    });
  });

  describe('integration with SeededRNG', () => {
    it('should produce consistent game sequence', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      // Simulate a combat sequence
      const sequence1 = [
        roll('1d20+5', rng1).total,   // Attack roll
        roll('2d6+3', rng1).total,     // Damage roll
        roll('1d20+2', rng1).total,    // Enemy attack
      ];

      const sequence2 = [
        roll('1d20+5', rng2).total,
        roll('2d6+3', rng2).total,
        roll('1d20+2', rng2).total,
      ];

      expect(sequence1).toEqual(sequence2);
    });
  });
});
