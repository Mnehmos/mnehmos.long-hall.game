/**
 * 😴 Rest Mechanics - Short and long rest HP recovery
 * 
 * Pure functions for calculating and applying rest effects to actors.
 * Short rest: Quick recovery (25% HP), no cost
 * Long rest: Full recovery (50% HP), costs gold per party member
 */

import type { Actor } from './types';

// ─────────────────────────────────────────────────────────────
// 📊 Rest Configuration
// ─────────────────────────────────────────────────────────────

/** Short rest heals this percentage of max HP */
export const SHORT_REST_HEAL_PERCENT = 0.25;

/** Long rest heals this percentage of max HP */
export const LONG_REST_HEAL_PERCENT = 0.50;

/** Long rest gold cost per party member */
export const LONG_REST_GOLD_COST = 10;

// ─────────────────────────────────────────────────────────────
// 🔢 Rest Calculation Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate HP restored from short rest.
 * Returns floor of 25% of max HP.
 */
export function calculateShortRestHealing(member: Actor): number {
  return Math.floor(member.hp.max * SHORT_REST_HEAL_PERCENT);
}

/**
 * Calculate HP restored from long rest.
 * Returns floor of 50% of max HP.
 */
export function calculateLongRestHealing(member: Actor): number {
  return Math.floor(member.hp.max * LONG_REST_HEAL_PERCENT);
}

// ─────────────────────────────────────────────────────────────
// 💤 Individual Rest Functions
// ─────────────────────────────────────────────────────────────

/**
 * Apply short rest to a single party member.
 * - Heals 25% of max HP
 * - Resets rest-based ability cooldowns (cooldownType: 'rest')
 * - Does not affect stress or hit dice
 */
export function applyShortRest(member: Actor): Actor {
  const healing = calculateShortRestHealing(member);
  const newHp = Math.min(member.hp.max, member.hp.current + healing);
  
  // Reset rest-based ability cooldowns
  const updatedAbilities = member.abilities.map(ability => 
    // Rest abilities typically have high cooldown values (999+) or specific markers
    // We reset cooldowns >= 999 as per original logic
    ability.currentCooldown >= 999 
      ? { ...ability, currentCooldown: 0 }
      : ability
  );
  
  return {
    ...member,
    hp: { ...member.hp, current: newHp },
    abilities: updatedAbilities
  };
}

/**
 * Apply long rest to a single party member.
 * - Heals 50% of max HP  
 * - Resets ALL ability cooldowns
 * - Restores half of max hit dice (rounded up, minimum 1)
 * - Reduces stress by 5
 */
export function applyLongRest(member: Actor): Actor {
  const healing = calculateLongRestHealing(member);
  const newHp = Math.min(member.hp.max, member.hp.current + healing);
  
  // Restore hit dice: add half of max (minimum 1), capped at max
  const hitDiceToRestore = Math.max(1, Math.floor(member.hitDice.max / 2));
  const newHitDice = Math.min(
    member.hitDice.max, 
    member.hitDice.current + hitDiceToRestore
  );
  
  // Reduce stress by 5 (minimum 0)
  const newStress = Math.max(0, member.stress.current - 5);
  
  // Reset ALL ability cooldowns on long rest
  const updatedAbilities = member.abilities.map(ability => ({
    ...ability,
    currentCooldown: 0
  }));
  
  return {
    ...member,
    hp: { ...member.hp, current: newHp },
    hitDice: { ...member.hitDice, current: newHitDice },
    stress: { ...member.stress, current: newStress },
    abilities: updatedAbilities
  };
}

// ─────────────────────────────────────────────────────────────
// 👥 Party Rest Functions
// ─────────────────────────────────────────────────────────────

/**
 * Apply short rest to entire party.
 * Only affects living members.
 */
export function shortRestParty(party: Actor[]): Actor[] {
  return party.map(member => 
    member.isAlive ? applyShortRest(member) : member
  );
}

/**
 * Apply long rest to entire party.
 * Only affects living members.
 */
export function longRestParty(party: Actor[]): Actor[] {
  return party.map(member =>
    member.isAlive ? applyLongRest(member) : member
  );
}

// ─────────────────────────────────────────────────────────────
// 💰 Cost Calculation Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate long rest cost for party.
 * Cost scales with party size.
 */
export function calculateLongRestCost(partySize: number): number {
  return partySize * LONG_REST_GOLD_COST;
}

/**
 * Check if party can afford long rest.
 */
export function canAffordLongRest(gold: number, partySize: number): boolean {
  return gold >= calculateLongRestCost(partySize);
}

// ─────────────────────────────────────────────────────────────
// 📋 Rest Options
// ─────────────────────────────────────────────────────────────

/**
 * Rest option for UI display
 */
export interface RestOption {
  type: 'short' | 'long';
  healPercent: number;
  cost: number;
  canAfford: boolean;
}

/**
 * Get available rest options for current state.
 * Returns both short and long rest options with affordability info.
 */
export function getRestOptions(gold: number, partySize: number): RestOption[] {
  const longRestCost = calculateLongRestCost(partySize);
  
  return [
    {
      type: 'short',
      healPercent: SHORT_REST_HEAL_PERCENT * 100,
      cost: 0,
      canAfford: true
    },
    {
      type: 'long',
      healPercent: LONG_REST_HEAL_PERCENT * 100,
      cost: longRestCost,
      canAfford: gold >= longRestCost
    }
  ];
}
