/**
 * Combat System - Core Functions
 *
 * Implements D&D 5e-style combat mechanics including:
 * - 🎯 Hit determination with critical hits/misses
 * - 💥 Damage calculation with dice expressions
 * - 🛡️ Damage application with resistance/vulnerability
 * - ⚔️ Attack resolution
 * - 🎮 Lite combat system (power-based)
 * - 🔢 AC calculation
 *
 * @module engine/combat
 */
import { SeededRNG } from '@lib/rng';
import type { Actor, Enemy, Item } from '@engine/types';

// ============================================================================
// Constants
// ============================================================================

/** 🎲 Natural 20 on d20 - always hits, critical success */
const NATURAL_20 = 20;

/** 🎲 Natural 1 on d20 - always misses, critical failure */
const NATURAL_1 = 1;

/** ⚔️ Critical hit multiplier - doubles the number of dice rolled */
const CRITICAL_MULTIPLIER = 2;

/** 🛡️ Base AC before modifiers (standard D&D 5e base) */
const BASE_AC = 10;

/** 🎲 Number of sides on a standard attack die */
const D20_SIDES = 20;

/** 💪 Minimum damage that can be dealt (prevents healing from negative damage) */
const MIN_DAMAGE = 1;

/** 📊 Dice expression pattern: matches "NdS" or "NdS+M" or "NdS-M" */
const DICE_EXPRESSION_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;

// Lite combat thresholds (margin of victory)
/** 🏆 Crushing victory threshold - dominant win with no damage */
const CRUSHING_WIN_THRESHOLD = 10;
/** ✅ Solid win threshold - clear victory with minor damage */
const SOLID_WIN_THRESHOLD = 5;
/** 📊 Close loss threshold - narrow defeat with moderate damage */
const CLOSE_LOSS_THRESHOLD = -5;

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for determining if an attack hits.
 */
export interface IsHitParams {
  /** The raw d20 roll (1-20) */
  roll: number;
  /** Attack bonus from attacker's abilities and equipment */
  attackBonus: number;
  /** Target's armor class */
  targetAC: number;
}

/**
 * Result of a hit determination check.
 */
export interface IsHitResult {
  /** Whether the attack hits the target */
  hits: boolean;
  /** Total attack value (roll + bonus) */
  total: number;
  /** Whether this is a critical hit (natural 20) */
  isCritical: boolean;
  /** Whether this is a critical miss (natural 1) */
  isCriticalMiss: boolean;
}

/**
 * Parameters for calculating damage from a dice expression.
 */
export interface CalculateDamageParams {
  /** Dice expression in format "NdS" or "NdS+M" (e.g., "2d6", "1d8+2") */
  diceExpression: string;
  /** Flat damage bonus to add after rolling */
  damageBonus: number;
  /** Seeded RNG for deterministic rolling */
  rng: SeededRNG;
  /** Whether this is a critical hit (doubles dice count) */
  isCritical?: boolean;
}

/**
 * Result of a damage calculation.
 */
export interface DamageResult {
  /** Total damage (sum of rolls + bonus, minimum 1) */
  total: number;
  /** Individual die roll results */
  rolls: number[];
  /** The flat bonus that was applied */
  bonus: number;
}

/**
 * Parameters for applying damage to a target.
 */
export interface ApplyDamageParams {
  /** Target receiving the damage */
  target: Actor | Enemy;
  /** Raw damage amount before resistance/vulnerability */
  damage: number;
  /** Whether target has resistance (halves damage) */
  resistance?: boolean;
  /** Whether target has vulnerability (doubles damage) */
  vulnerability?: boolean;
}

/**
 * Result of applying damage to a target.
 */
export interface ApplyDamageResult {
  /** Target's new HP after damage */
  newHp: number;
  /** Actual damage dealt (may differ due to resistance/vulnerability/cap) */
  damageDealt: number;
  /** Whether the target is now dead (HP <= 0) */
  isDead: boolean;
  /** Whether resistance was applied */
  wasResisted?: boolean;
  /** Whether vulnerability was applied */
  wasVulnerable?: boolean;
}

/**
 * Parameters for resolving a complete attack.
 */
export interface ResolveAttackParams {
  /** The attacking actor */
  attacker: Actor;
  /** The target enemy */
  target: Enemy;
  /** Weapon damage dice expression (e.g., "1d8") */
  weaponDamage: string;
  /** Additional damage bonus (e.g., from magic weapons) */
  damageBonus?: number;
  /** Seeded RNG for deterministic combat */
  rng?: SeededRNG;
  /** Force a specific attack roll (for testing) */
  forceRoll?: number;
  /** Whether target has resistance to the damage */
  targetResistance?: boolean;
}

/**
 * Result of a resolved attack.
 */
export interface AttackResult {
  /** Whether the attack hit */
  hit: boolean;
  /** Damage dealt to the target */
  damageDealt: number;
  /** Target's HP after the attack */
  targetNewHp: number;
  /** Whether this was a critical hit */
  isCritical: boolean;
  /** The raw attack roll (1-20) */
  attackRoll: number;
  /** Total attack value (roll + bonus) */
  attackTotal: number;
  /** Target's armor class */
  targetAC: number;
  /** Whether resistance reduced the damage */
  wasResisted?: boolean;
}

/**
 * Parameters for lite (power-based) combat resolution.
 */
export interface ResolveCombatParams {
  /** Combined power level of the party */
  partyPower: number;
  /** Enemy's power level */
  enemyPower: number;
  /** Seeded RNG for deterministic combat */
  rng: SeededRNG;
}

/**
 * Result of lite combat resolution.
 */
export interface CombatResult {
  /** Always true in lite combat (simplified system) */
  hit: boolean;
  /** Damage dealt to enemy (1 if defeated, 0 otherwise) */
  damageDealt: number;
  /** Damage taken by party */
  damageTaken: number;
  /** Stress/mental damage taken by party */
  stressTaken: number;
  /** Whether combat was fatal (determined by caller) */
  isFatal: boolean;
  /** Whether the enemy was defeated */
  enemyDefeated: boolean;
  /** Margin of victory/defeat (party total - enemy total) */
  margin: number;
}

// ============================================================================
// Hit Determination
// ============================================================================

/**
 * Determine if an attack roll hits the target.
 *
 * Follows D&D 5e rules:
 * - Natural 20 always hits and is a critical (regardless of AC)
 * - Natural 1 always misses (regardless of bonuses)
 * - Otherwise, roll + bonus must meet or exceed target AC
 *
 * @param params - Attack parameters including roll, bonus, and target AC
 * @returns Hit result with critical status
 *
 * @example
 * // Standard hit check
 * isHit({ roll: 15, attackBonus: 3, targetAC: 15 })
 * // → { hits: true, total: 18, isCritical: false, isCriticalMiss: false }
 *
 * @example
 * // Natural 20 always hits (even against impossible AC)
 * isHit({ roll: 20, attackBonus: -10, targetAC: 30 })
 * // → { hits: true, total: 10, isCritical: true, isCriticalMiss: false }
 *
 * @example
 * // Natural 1 always misses (even with high bonus)
 * isHit({ roll: 1, attackBonus: 50, targetAC: 10 })
 * // → { hits: false, total: 51, isCritical: false, isCriticalMiss: true }
 */
export function isHit(params: IsHitParams): IsHitResult {
  const { roll, attackBonus, targetAC } = params;
  const total = roll + attackBonus;

  // Natural 20 always hits and is a critical
  if (roll === NATURAL_20) {
    return {
      hits: true,
      total,
      isCritical: true,
      isCriticalMiss: false,
    };
  }

  // Natural 1 always misses
  if (roll === NATURAL_1) {
    return {
      hits: false,
      total,
      isCritical: false,
      isCriticalMiss: true,
    };
  }

  // Standard hit check: total >= targetAC
  return {
    hits: total >= targetAC,
    total,
    isCritical: false,
    isCriticalMiss: false,
  };
}

// ============================================================================
// Damage Calculation
// ============================================================================

/**
 * Calculate damage from a dice expression with optional critical hit doubling.
 *
 * Critical hits double the number of dice rolled (not the modifier).
 * Minimum damage is always 1 (prevents healing from negative damage).
 *
 * @param params - Damage parameters including dice expression and bonuses
 * @returns Damage result with individual rolls and total
 * @throws Error if dice expression is invalid
 *
 * @example
 * // Standard damage roll
 * calculateDamage({ diceExpression: '2d6', damageBonus: 3, rng })
 * // → { total: 10, rolls: [4, 3], bonus: 3 }
 *
 * @example
 * // Critical hit (doubles dice count)
 * calculateDamage({ diceExpression: '1d8', damageBonus: 2, rng, isCritical: true })
 * // → { total: 13, rolls: [5, 6], bonus: 2 }
 *
 * @example
 * // Minimum damage is 1
 * calculateDamage({ diceExpression: '1d4', damageBonus: -10, rng })
 * // → { total: 1, rolls: [2], bonus: -10 }
 */
export function calculateDamage(params: CalculateDamageParams): DamageResult {
  const { diceExpression, damageBonus, rng, isCritical = false } = params;

  // Parse the dice expression to get count and sides
  const match = diceExpression.toLowerCase().match(DICE_EXPRESSION_PATTERN);
  if (!match) {
    throw new Error(`Invalid dice expression: ${diceExpression}`);
  }

  let diceCount = parseInt(match[1], 10);
  const diceSides = parseInt(match[2], 10);

  // Critical hits double the number of dice
  if (isCritical) {
    diceCount *= CRITICAL_MULTIPLIER;
  }

  // Roll all the dice
  const rolls: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    rolls.push(rng.int(1, diceSides));
  }

  // Calculate total with minimum of 1
  const rollSum = rolls.reduce((a, b) => a + b, 0);
  const rawTotal = rollSum + damageBonus;
  const total = Math.max(MIN_DAMAGE, rawTotal);

  return {
    total,
    rolls,
    bonus: damageBonus,
  };
}

// ============================================================================
// Damage Application
// ============================================================================

/**
 * Apply damage to a target, respecting resistance and vulnerability.
 *
 * - Resistance halves damage (rounded down)
 * - Vulnerability doubles damage
 * - Damage is capped at remaining HP (can't go negative)
 * - If both resistance and vulnerability apply, vulnerability takes precedence
 *
 * @param params - Parameters including target, damage, and modifiers
 * @returns Result with new HP, actual damage dealt, and death status
 *
 * @example
 * // Standard damage
 * applyDamage({ target: enemy, damage: 10 })
 * // → { newHp: 15, damageDealt: 10, isDead: false }
 *
 * @example
 * // Resistance halves damage
 * applyDamage({ target: enemy, damage: 10, resistance: true })
 * // → { newHp: 20, damageDealt: 5, isDead: false, wasResisted: true }
 *
 * @example
 * // Vulnerability doubles damage
 * applyDamage({ target: enemy, damage: 10, vulnerability: true })
 * // → { newHp: 5, damageDealt: 20, isDead: false, wasVulnerable: true }
 */
export function applyDamage(params: ApplyDamageParams): ApplyDamageResult {
  const { target, damage, resistance = false, vulnerability = false } = params;

  // Get current HP - handle both Actor and Enemy structures
  const currentHp =
    'hp' in target && typeof target.hp === 'object'
      ? (target.hp as { current: number }).current
      : (target as Enemy).hp;

  // Apply resistance (halve damage, round down) or vulnerability (double damage)
  let modifiedDamage = damage;
  let wasResisted = false;
  let wasVulnerable = false;

  if (resistance) {
    modifiedDamage = Math.floor(damage / 2);
    wasResisted = true;
  } else if (vulnerability) {
    modifiedDamage = damage * 2;
    wasVulnerable = true;
  }

  // Cap damage at remaining HP (can't go negative)
  const actualDamage = Math.min(modifiedDamage, currentHp);
  const newHp = currentHp - actualDamage;
  const isDead = newHp <= 0;

  return {
    newHp,
    damageDealt: actualDamage,
    isDead,
    wasResisted,
    wasVulnerable,
  };
}

// ============================================================================
// Attack Resolution
// ============================================================================

/**
 * Resolve a complete attack from attacker to target.
 *
 * This is the main combat function that orchestrates:
 * 1. Attack roll (d20 + attack skill)
 * 2. Hit determination (vs target AC)
 * 3. Damage calculation (weapon dice + strength bonus)
 * 4. Damage application (with optional resistance)
 *
 * @param params - Attack parameters including attacker, target, and weapon
 * @returns Complete attack result with all combat details
 *
 * @example
 * // Basic attack
 * resolveAttack({
 *   attacker: hero,
 *   target: goblin,
 *   weaponDamage: '1d8',
 *   rng: combatRng,
 * })
 *
 * @example
 * // Testing with forced roll
 * resolveAttack({
 *   attacker: hero,
 *   target: goblin,
 *   weaponDamage: '1d8',
 *   forceRoll: 20,  // Force a critical hit
 * })
 */
export function resolveAttack(params: ResolveAttackParams): AttackResult {
  const {
    attacker,
    target,
    weaponDamage,
    damageBonus = 0,
    rng = new SeededRNG(Date.now()),
    forceRoll,
    targetResistance = false,
  } = params;

  // Calculate attack bonus from attacker's skills
  const attackBonus = attacker.skills.attack;
  const targetAC = target.ac;

  // Roll attack (or use forced roll for testing)
  const attackRoll = forceRoll ?? rng.int(1, D20_SIDES);

  // Determine if hit
  const hitResult = isHit({
    roll: attackRoll,
    attackBonus,
    targetAC,
  });

  // If miss, return miss result
  if (!hitResult.hits) {
    return {
      hit: false,
      damageDealt: 0,
      targetNewHp: target.hp,
      isCritical: false,
      attackRoll,
      attackTotal: hitResult.total,
      targetAC,
    };
  }

  // Calculate damage (weapon dice + strength bonus + any additional bonus)
  const strengthBonus = attacker.skills.strength;
  const totalDamageBonus = damageBonus + strengthBonus;

  const damageResult = calculateDamage({
    diceExpression: weaponDamage,
    damageBonus: totalDamageBonus,
    rng,
    isCritical: hitResult.isCritical,
  });

  // Apply damage
  const applyResult = applyDamage({
    target,
    damage: damageResult.total,
    resistance: targetResistance,
  });

  return {
    hit: true,
    damageDealt: applyResult.damageDealt,
    targetNewHp: applyResult.newHp,
    isCritical: hitResult.isCritical,
    attackRoll,
    attackTotal: hitResult.total,
    targetAC,
    wasResisted: applyResult.wasResisted,
  };
}

// ============================================================================
// Lite Combat System
// ============================================================================

/**
 * Resolve lite combat between party and enemy using power values.
 *
 * Used for simplified/abstracted combat resolution where detailed
 * attack mechanics aren't needed. Outcome is based on comparing
 * d20 + power rolls between party and enemy.
 *
 * Damage taken scales with margin of defeat:
 * - 🏆 Crushing win (margin ≥ 10): No damage
 * - ✅ Solid win (margin ≥ 5): Minor damage (1d4)
 * - 📊 Close win (margin ≥ 0): Moderate damage (2d4) + minor stress
 * - ⚠️ Close loss (margin ≥ -5): Significant damage (4d4-ish) + stress
 * - 💀 Bad loss (margin < -5): Heavy damage (8d4-ish) + high stress
 *
 * @param params - Combat parameters including power values and RNG
 * @returns Combat result with damage and outcome information
 *
 * @example
 * // Evenly matched combat
 * resolveCombat({ partyPower: 10, enemyPower: 10, rng })
 * // Result depends on rolls, but margin will be around 0
 */
export function resolveCombat(params: ResolveCombatParams): CombatResult {
  const { partyPower, enemyPower, rng } = params;

  // Roll for both sides (1d20)
  const partyRoll = rng.int(1, D20_SIDES);
  const enemyRoll = rng.int(1, D20_SIDES);

  // Calculate totals
  const partyTotal = partyRoll + partyPower;
  const enemyTotal = enemyRoll + enemyPower;

  // Calculate margin of victory/defeat
  const margin = partyTotal - enemyTotal;

  // Determine outcome based on margin
  const enemyDefeated = margin >= 0;

  // Calculate damage taken based on margin
  let damageTaken = 0;
  let stressTaken = 0;

  if (margin >= CRUSHING_WIN_THRESHOLD) {
    // 🏆 Crushing win - no damage
    damageTaken = 0;
    stressTaken = 0;
  } else if (margin >= SOLID_WIN_THRESHOLD) {
    // ✅ Solid win - minor damage
    damageTaken = rng.int(1, 4);
    stressTaken = 0;
  } else if (margin >= 0) {
    // 📊 Close win - moderate damage
    damageTaken = rng.int(2, 8);
    stressTaken = rng.int(0, 1);
  } else if (margin >= CLOSE_LOSS_THRESHOLD) {
    // ⚠️ Close loss - significant damage
    damageTaken = rng.int(4, 12);
    stressTaken = rng.int(1, 2);
  } else {
    // 💀 Bad loss - heavy damage
    damageTaken = rng.int(8, 20);
    stressTaken = rng.int(2, 4);
  }

  return {
    hit: true, // Always "hit" in lite combat
    damageDealt: enemyDefeated ? 1 : 0, // Simplified - enemy takes 1 "damage" if defeated
    damageTaken,
    stressTaken,
    isFatal: false, // Determined by caller based on party HP
    enemyDefeated,
    margin,
  };
}

// ============================================================================
// AC Calculation
// ============================================================================

/**
 * Calculate AC for an actor based on base AC, defense skill, and equipment.
 *
 * Formula: `AC = 10 + defense skill + equipment bonuses`
 *
 * Equipment bonuses include:
 * - Base stats AC bonus (e.g., armor)
 * - Enchantment AC bonus (e.g., +1 shield)
 *
 * @param actor - The actor to calculate AC for
 * @returns Calculated armor class
 *
 * @example
 * // Basic calculation (no equipment)
 * calculateAC({ skills: { defense: 3 }, equipment: null })
 * // → 13 (10 base + 3 defense)
 *
 * @example
 * // With enchanted armor
 * calculateAC({
 *   skills: { defense: 2 },
 *   equipment: {
 *     armor: { baseStats: { acBonus: 5 }, enchantment: { effect: { acBonus: 1 } } }
 *   }
 * })
 * // → 18 (10 + 2 + 5 + 1)
 */
export function calculateAC(actor: Actor): number {
  // Add defense skill
  const defenseBonus = actor.skills.defense;

  // Sum equipment AC bonuses
  let equipmentAcBonus = 0;

  if (actor.equipment) {
    // Check all equipment slots for AC bonuses
    for (const [_slot, item] of Object.entries(actor.equipment)) {
      if (item) {
        const itemWithStats = item as Item;

        // Add base stats AC bonus
        if (itemWithStats.baseStats?.acBonus) {
          equipmentAcBonus += itemWithStats.baseStats.acBonus;
        }

        // Add enchantment AC bonus
        if (itemWithStats.enchantment?.effect?.acBonus) {
          equipmentAcBonus += itemWithStats.enchantment.effect.acBonus;
        }
      }
    }
  }

  return BASE_AC + defenseBonus + equipmentAcBonus;
}
