/**
 * @fileoverview Dice rolling utilities supporting D&D 5e notation
 * 
 * This module provides deterministic dice rolling with support for:
 * - Standard dice notation (NdX+Y)
 * - Advantage and disadvantage mechanics
 * - Custom RNG injection for reproducible results
 * 
 * @module dice
 */

/**
 * Represents a parsed dice expression with count, sides, modifier, and optional advantage.
 * 
 * @example
 * // A parsed "2d6+3" expression
 * const roll: DiceRoll = { count: 2, sides: 6, modifier: 3 };
 * 
 * @example
 * // A parsed "1d20adv" expression
 * const roll: DiceRoll = { count: 1, sides: 20, modifier: 0, advantage: 'advantage' };
 */
export interface DiceRoll {
  /** Number of dice to roll (1-100) */
  count: number;
  /** Number of sides per die (1-1000) */
  sides: number;
  /** Numeric modifier added to the roll total */
  modifier: number;
  /** Optional advantage or disadvantage mode */
  advantage?: 'advantage' | 'disadvantage';
}

/**
 * Represents the result of a dice roll, including all individual rolls and the final total.
 * 
 * @example
 * // Result from rolling "2d6+3" that rolled 4 and 5
 * const result: RollResult = {
 *   total: 12,      // 4 + 5 + 3
 *   rolls: [4, 5],
 *   modifier: 3
 * };
 * 
 * @example
 * // Result from rolling "1d20adv" that rolled 8 and 15
 * const result: RollResult = {
 *   total: 15,
 *   rolls: [8, 15],
 *   modifier: 0,
 *   keptRolls: [15]  // Only the highest is kept
 * };
 */
export interface RollResult {
  /** Final calculated total (sum of kept rolls + modifier) */
  total: number;
  /** All individual die results */
  rolls: number[];
  /** The modifier that was applied */
  modifier: number;
  /** For advantage/disadvantage, which roll(s) were kept */
  keptRolls?: number[];
}

/**
 * Interface for a random number generator that can be injected for deterministic testing.
 * 
 * @example
 * // Create a simple RNG wrapper
 * const rng: RNG = {
 *   int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
 * };
 */
export interface RNG {
  /** Generate a random integer in the inclusive range [min, max] */
  int: (min: number, max: number) => number;
}

/**
 * Parse a dice expression into its component parts.
 * 
 * Supports D&D 5e notation:
 * - Basic: `NdX` (e.g., "2d6", "1d20")
 * - With modifier: `NdX+Y` or `NdX-Y` (e.g., "2d6+3", "1d20-2")
 * - With advantage: `NdXadv` (e.g., "1d20adv")
 * - With disadvantage: `NdXdis` (e.g., "1d20dis")
 * 
 * @param expression - The dice expression to parse (case-insensitive)
 * @returns The parsed dice roll configuration
 * @throws {Error} If the expression format is invalid
 * @throws {Error} If dice count is not between 1-100
 * @throws {Error} If dice sides is not between 1-1000
 * 
 * @example
 * // Parse a simple roll
 * const dice = parseDiceExpression('2d6');
 * // Returns: { count: 2, sides: 6, modifier: 0 }
 * 
 * @example
 * // Parse with modifier
 * const dice = parseDiceExpression('1d20+5');
 * // Returns: { count: 1, sides: 20, modifier: 5 }
 * 
 * @example
 * // Parse with advantage
 * const dice = parseDiceExpression('1d20adv');
 * // Returns: { count: 1, sides: 20, modifier: 0, advantage: 'advantage' }
 * 
 * @example
 * // Parse with disadvantage and modifier
 * const dice = parseDiceExpression('1d20-2dis');
 * // Returns: { count: 1, sides: 20, modifier: -2, advantage: 'disadvantage' }
 */
export function parseDiceExpression(expression: string): DiceRoll {
  const expr = expression.toLowerCase().trim();
  
  // Check for advantage/disadvantage
  let advantage: 'advantage' | 'disadvantage' | undefined;
  let cleanExpr = expr;
  
  if (expr.endsWith('adv')) {
    advantage = 'advantage';
    cleanExpr = expr.slice(0, -3);
  } else if (expr.endsWith('dis')) {
    advantage = 'disadvantage';
    cleanExpr = expr.slice(0, -3);
  }
  
  // Parse "NdX+Y" format
  const match = cleanExpr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }
  
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  
  if (count < 1 || count > 100) {
    throw new Error(`Dice count must be between 1 and 100: ${count}`);
  }
  if (sides < 1 || sides > 1000) {
    throw new Error(`Dice sides must be between 1 and 1000: ${sides}`);
  }
  
  return { count, sides, modifier, advantage };
}

/**
 * Roll dice using the provided expression and optional RNG.
 * 
 * If no RNG is provided, uses `Math.random()` which is non-deterministic.
 * For reproducible results in tests, inject a seeded RNG.
 * 
 * @param expression - The dice expression to roll (e.g., "2d6+3", "1d20adv")
 * @param rng - Optional random number generator for deterministic results
 * @returns The complete roll result including individual dice and total
 * 
 * @example
 * // Simple roll (non-deterministic)
 * const result = roll('2d6+3');
 * console.log(result.total); // 5-15 (random)
 * 
 * @example
 * // Roll with seeded RNG for testing
 * import { SeededRNG } from './rng';
 * const rng = new SeededRNG(12345);
 * const result = roll('1d20+5', rng);
 * // Result is deterministic based on seed
 * 
 * @example
 * // Roll with advantage
 * const result = roll('1d20adv');
 * console.log(result.rolls);     // e.g., [8, 15] - both rolls
 * console.log(result.keptRolls); // e.g., [15] - highest kept
 * console.log(result.total);     // e.g., 15
 */
export function roll(expression: string, rng?: RNG): RollResult {
  const dice = parseDiceExpression(expression);
  
  // Use a simple RNG if none provided
  const random: RNG = rng || { 
    int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min 
  };
  
  let rolls: number[] = [];
  let keptRolls: number[] | undefined;
  
  if (dice.advantage) {
    // Roll 2d20, keep highest or lowest
    const roll1 = random.int(1, dice.sides);
    const roll2 = random.int(1, dice.sides);
    rolls = [roll1, roll2];
    
    if (dice.advantage === 'advantage') {
      keptRolls = [Math.max(roll1, roll2)];
    } else {
      keptRolls = [Math.min(roll1, roll2)];
    }
  } else {
    // Standard NdX roll
    for (let i = 0; i < dice.count; i++) {
      rolls.push(random.int(1, dice.sides));
    }
  }
  
  const rollSum = keptRolls 
    ? keptRolls.reduce((a, b) => a + b, 0) 
    : rolls.reduce((a, b) => a + b, 0);
  const total = rollSum + dice.modifier;
  
  return { total, rolls, modifier: dice.modifier, keptRolls };
}

/**
 * Roll dice with an explicit modifier that overrides any modifier in the expression.
 * 
 * Useful when you have a base expression but need to apply a dynamic modifier
 * (e.g., ability scores, proficiency bonuses).
 * 
 * @param expression - The dice expression (modifier in expression is ignored)
 * @param modifier - The modifier to apply to the roll
 * @param rng - Optional random number generator for deterministic results
 * @returns The complete roll result with the specified modifier
 * 
 * @example
 * // Override modifier
 * const result = rollWithModifier('1d20+0', 7);
 * // Uses +7 regardless of the +0 in the expression
 * 
 * @example
 * // Apply ability modifier dynamically
 * const abilityMod = 3;
 * const proficiency = 2;
 * const result = rollWithModifier('1d20', abilityMod + proficiency);
 */
export function rollWithModifier(
  expression: string, 
  modifier: number, 
  rng?: RNG
): RollResult {
  const dice = parseDiceExpression(expression);
  const modifiedExpr = `${dice.count}d${dice.sides}${modifier >= 0 ? '+' : ''}${modifier}`;
  return roll(modifiedExpr, rng);
}

/**
 * Roll 1d20 with advantage (roll twice, keep highest).
 * 
 * Shorthand for `roll('1d20adv', rng)`.
 * 
 * @param rng - Optional random number generator for deterministic results
 * @returns The roll result with both dice shown and highest kept
 * 
 * @example
 * const result = rollAdvantage();
 * console.log(result.rolls);     // [8, 15] - both d20 rolls
 * console.log(result.keptRolls); // [15] - highest
 * console.log(result.total);     // 15
 */
export function rollAdvantage(rng?: RNG): RollResult {
  return roll('1d20adv', rng);
}

/**
 * Roll 1d20 with disadvantage (roll twice, keep lowest).
 * 
 * Shorthand for `roll('1d20dis', rng)`.
 * 
 * @param rng - Optional random number generator for deterministic results
 * @returns The roll result with both dice shown and lowest kept
 * 
 * @example
 * const result = rollDisadvantage();
 * console.log(result.rolls);     // [8, 15] - both d20 rolls
 * console.log(result.keptRolls); // [8] - lowest
 * console.log(result.total);     // 8
 */
export function rollDisadvantage(rng?: RNG): RollResult {
  return roll('1d20dis', rng);
}
