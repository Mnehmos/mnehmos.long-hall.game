/** Shared engine constants. */

/**
 * Sentinel cooldown meaning "unavailable until the party rests" rather than a
 * literal turn count. Anything >= this is left alone by per-round cooldown
 * ticking and cleared by short/long rests.
 */
export const REST_COOLDOWN = 999;

/** Cumulative XP required to reach index+1. Level 1 starts at 0 XP. */
export const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000] as const;

export const MAX_LEVEL = XP_THRESHOLDS.length;

/** Maximum party size, including the starting hero. */
export const MAX_PARTY_SIZE = 4;

/** Enchantment tier names, indexed by tier - 1. */
export const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Godly'] as const;

export type EnchantTier = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Map a 0..100+ roll onto an enchantment tier.
 * Kept in one place so the shrine and the starting-shrine paths can't drift.
 */
export function tierFromRoll(tierRoll: number): EnchantTier {
    if (tierRoll < 40) return 1;
    if (tierRoll < 65) return 2;
    if (tierRoll < 82) return 3;
    if (tierRoll < 93) return 4;
    if (tierRoll < 99) return 5;
    return 6;
}
