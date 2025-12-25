/**
 * Dice rolling utilities supporting D&D 5e notation
 */

export interface DiceRoll {
  count: number;
  sides: number;
  modifier: number;
  advantage?: 'advantage' | 'disadvantage';
}

export interface RollResult {
  total: number;
  rolls: number[];
  modifier: number;
  keptRolls?: number[];
}

/**
 * Parse a dice expression like "2d6", "1d20+5", "4d6kh3", "2d20adv"
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
 * Roll dice using the provided RNG
 */
export function roll(expression: string, rng?: { int: (min: number, max: number) => number }): RollResult {
  const dice = parseDiceExpression(expression);
  
  // Use a simple RNG if none provided
  const random = rng || { int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min };
  
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
  
  const rollSum = keptRolls ? keptRolls.reduce((a, b) => a + b, 0) : rolls.reduce((a, b) => a + b, 0);
  const total = rollSum + dice.modifier;
  
  return { total, rolls, modifier: dice.modifier, keptRolls };
}

/**
 * Roll dice with an explicit modifier (overrides expression modifier)
 */
export function rollWithModifier(expression: string, modifier: number, rng?: { int: (min: number, max: number) => number }): RollResult {
  const dice = parseDiceExpression(expression);
  const modifiedExpr = `${dice.count}d${dice.sides}${modifier >= 0 ? '+' : ''}${modifier}`;
  return roll(modifiedExpr, rng);
}

/**
 * Roll with advantage (2d20, keep highest)
 */
export function rollAdvantage(rng?: { int: (min: number, max: number) => number }): RollResult {
  return roll('1d20adv', rng);
}

/**
 * Roll with disadvantage (2d20, keep lowest)
 */
export function rollDisadvantage(rng?: { int: (min: number, max: number) => number }): RollResult {
  return roll('1d20dis', rng);
}
