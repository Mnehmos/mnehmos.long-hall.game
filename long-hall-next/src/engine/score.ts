/**
 * 🏆 Score System - Run scoring and leaderboard integration
 * 
 * Scoring matches the server implementation for leaderboard consistency:
 * - Depth points: rooms cleared × 100
 * - Gold: party gold (1:1)
 * - XP: total XP earned across party
 * - Level bonus: (level - 1) × 500 per member
 * - Inventory value: 10% of item costs (equipped + inventory)
 */

import type { RunState, Actor, Item } from './types';

// ─────────────────────────────────────────────────────────────
// 📊 Score Configuration
// ─────────────────────────────────────────────────────────────

/** Points per room cleared (depth × this value) */
export const POINTS_PER_ROOM = 100;

/** Points per gold earned (1:1 ratio) */
export const POINTS_PER_GOLD = 1;

/** Points per XP earned (1:1 ratio) */
export const POINTS_PER_XP = 1;

/** Bonus points per character level above 1 */
export const POINTS_PER_LEVEL = 500;

/** Inventory value percentage (items worth 10% of cost) */
export const INVENTORY_VALUE_PERCENT = 0.1;

/** Bonus points for surviving party members (for breakdown display) */
export const POINTS_PER_SURVIVOR = 200;

/** Bonus for victory (clearing final boss - for breakdown display) */
export const VICTORY_BONUS = 5000;

// ─────────────────────────────────────────────────────────────
// 📋 Score Breakdown Interface
// ─────────────────────────────────────────────────────────────

/**
 * Detailed breakdown of score components for display
 */
export interface ScoreBreakdown {
  /** Number of rooms cleared (depth) */
  roomsCleared: number;
  /** Points from room progression */
  roomPoints: number;
  /** Total gold earned */
  goldEarned: number;
  /** Points from gold */
  goldPoints: number;
  /** Total XP earned across party */
  xpEarned: number;
  /** Points from XP */
  xpPoints: number;
  /** Total level bonuses ((level-1) × 500 per member) */
  levelPoints: number;
  /** Total inventory value (10% of item costs) */
  inventoryValue: number;
  /** Points from inventory */
  inventoryPoints: number;
  /** Number of surviving party members */
  survivors: number;
  /** Victory bonus (if applicable) */
  victoryBonus: number;
  /** Final calculated score */
  totalScore: number;
}

// ─────────────────────────────────────────────────────────────
// 🧮 Score Calculation - Server Compatible
// ─────────────────────────────────────────────────────────────

/**
 * Calculate final score for a run.
 * This matches the server implementation exactly for leaderboard consistency.
 * 
 * @param state - Current run state
 * @returns Detailed score breakdown with all components
 */
export function calculateScore(state: RunState): ScoreBreakdown {
  // 1. Room/Depth points
  const roomsCleared = state.depth;
  const roomPoints = roomsCleared * POINTS_PER_ROOM;

  // 2. Gold points
  const goldEarned = state.party.gold;
  const goldPoints = goldEarned * POINTS_PER_GOLD;

  // 3. XP points and level bonuses
  let xpEarned = 0;
  let levelPoints = 0;
  for (const actor of state.party.members) {
    xpEarned += actor.xp;
    levelPoints += (actor.level - 1) * POINTS_PER_LEVEL;
  }
  const xpPoints = xpEarned * POINTS_PER_XP;

  // 4. Inventory value (10% of item costs)
  let inventoryValue = 0;
  
  // Items in inventory
  for (const item of state.inventory.items) {
    inventoryValue += Math.floor(item.cost * INVENTORY_VALUE_PERCENT);
  }
  
  // Equipped items on party members
  for (const actor of state.party.members) {
    for (const item of Object.values(actor.equipment)) {
      if (item) {
        inventoryValue += Math.floor(item.cost * INVENTORY_VALUE_PERCENT);
      }
    }
  }
  const inventoryPoints = inventoryValue;

  // 5. Survivors count (for display, not in base calculation)
  const survivors = state.party.members.filter(m => m.isAlive).length;

  // 6. Victory bonus (only if game won)
  const victoryBonus = state.victory && state.gameOver ? VICTORY_BONUS : 0;

  // Calculate total (matches server: depth×100 + gold + xp + levels + inventory)
  const totalScore = Math.floor(
    roomPoints + 
    goldPoints + 
    xpPoints + 
    levelPoints + 
    inventoryPoints + 
    victoryBonus
  );

  return {
    roomsCleared,
    roomPoints,
    goldEarned,
    goldPoints,
    xpEarned,
    xpPoints,
    levelPoints,
    inventoryValue,
    inventoryPoints,
    survivors,
    victoryBonus,
    totalScore,
  };
}

/**
 * Calculate simple numeric score (for quick access).
 * Use calculateScore() for full breakdown.
 * 
 * @param state - Current run state
 * @returns Final score as a number
 */
export function getScore(state: RunState): number {
  return calculateScore(state).totalScore;
}

// ─────────────────────────────────────────────────────────────
// 🧩 Component Score Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate score for just the rooms/depth component.
 * 
 * @param depth - Number of rooms cleared
 * @returns Points from room progression
 */
export function calculateRoomScore(depth: number): number {
  return depth * POINTS_PER_ROOM;
}

/**
 * Calculate score for enemies defeated (legacy/display).
 * Note: In the current system, enemy XP is rolled into xpPoints.
 * 
 * @param enemiesDefeated - Number of enemies defeated
 * @param pointsPerEnemy - Points per enemy (default 50)
 * @returns Points from enemy defeats
 */
export function calculateEnemyScore(enemiesDefeated: number, pointsPerEnemy = 50): number {
  return enemiesDefeated * pointsPerEnemy;
}

/**
 * Calculate score for gold earned.
 * 
 * @param gold - Amount of gold
 * @returns Points from gold (1:1 ratio)
 */
export function calculateGoldScore(gold: number): number {
  return gold * POINTS_PER_GOLD;
}

/**
 * Calculate survivor bonus for living party members.
 * 
 * @param party - Array of party actors
 * @returns Bonus points for survivors
 */
export function calculateSurvivorBonus(party: Actor[]): number {
  const survivors = party.filter(m => m.isAlive).length;
  return survivors * POINTS_PER_SURVIVOR;
}

/**
 * Calculate inventory value score.
 * 
 * @param items - Array of items
 * @returns Points from inventory (10% of total cost)
 */
export function calculateInventoryScore(items: Item[]): number {
  let value = 0;
  for (const item of items) {
    value += Math.floor(item.cost * INVENTORY_VALUE_PERCENT);
  }
  return value;
}

/**
 * Calculate XP and level bonus score.
 * 
 * @param party - Array of party actors
 * @returns Combined XP and level bonus points
 */
export function calculateXpScore(party: Actor[]): number {
  let total = 0;
  for (const actor of party) {
    total += actor.xp * POINTS_PER_XP;
    total += (actor.level - 1) * POINTS_PER_LEVEL;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────
// 🏅 Score Ranking
// ─────────────────────────────────────────────────────────────

/** Rank thresholds and titles */
const SCORE_RANKS: Array<{ threshold: number; rank: string; emoji: string }> = [
  { threshold: 50000, rank: 'Legendary Hero', emoji: '👑' },
  { threshold: 25000, rank: 'Champion', emoji: '🏆' },
  { threshold: 15000, rank: 'Master', emoji: '⭐' },
  { threshold: 10000, rank: 'Veteran', emoji: '🛡️' },
  { threshold: 5000, rank: 'Adventurer', emoji: '⚔️' },
  { threshold: 2500, rank: 'Explorer', emoji: '🗺️' },
  { threshold: 1000, rank: 'Apprentice', emoji: '📜' },
  { threshold: 500, rank: 'Novice', emoji: '🌱' },
  { threshold: 0, rank: 'Beginner', emoji: '👤' },
];

/**
 * Get human-readable score rank based on score value.
 * 
 * @param score - The score value
 * @returns Rank title (e.g., "Champion", "Veteran")
 */
export function getScoreRank(score: number): string {
  for (const { threshold, rank } of SCORE_RANKS) {
    if (score >= threshold) {
      return rank;
    }
  }
  return 'Beginner';
}

/**
 * Get score rank with emoji prefix.
 * 
 * @param score - The score value
 * @returns Rank with emoji (e.g., "🏆 Champion")
 */
export function getScoreRankWithEmoji(score: number): string {
  for (const { threshold, rank, emoji } of SCORE_RANKS) {
    if (score >= threshold) {
      return `${emoji} ${rank}`;
    }
  }
  return '👤 Beginner';
}

/**
 * Get the next rank threshold above current score.
 * 
 * @param score - Current score
 * @returns Next threshold or null if at max rank
 */
export function getNextRankThreshold(score: number): number | null {
  // Find current rank index
  let currentIndex = SCORE_RANKS.length - 1;
  for (let i = 0; i < SCORE_RANKS.length; i++) {
    if (score >= SCORE_RANKS[i].threshold) {
      currentIndex = i;
      break;
    }
  }
  
  // Return next higher threshold if available
  if (currentIndex > 0) {
    return SCORE_RANKS[currentIndex - 1].threshold;
  }
  return null; // Already at max rank
}

// ─────────────────────────────────────────────────────────────
// 🎨 Score Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format score for display with thousands separators.
 * 
 * @param score - The score value
 * @returns Formatted string (e.g., "12,345")
 */
export function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}

/**
 * Format score with abbreviated suffix for large numbers.
 * 
 * @param score - The score value
 * @returns Abbreviated string (e.g., "12.3K", "1.5M")
 */
export function formatScoreCompact(score: number): string {
  if (score >= 1_000_000) {
    return `${(score / 1_000_000).toFixed(1)}M`;
  }
  if (score >= 10_000) {
    return `${(score / 1_000).toFixed(1)}K`;
  }
  return formatScore(score);
}

/**
 * Format score breakdown as display-ready object.
 * 
 * @param breakdown - Score breakdown from calculateScore
 * @returns Object with formatted string values
 */
export function formatBreakdown(breakdown: ScoreBreakdown): Record<string, string> {
  return {
    roomsCleared: `${breakdown.roomsCleared} rooms`,
    roomPoints: `+${formatScore(breakdown.roomPoints)}`,
    goldEarned: `${formatScore(breakdown.goldEarned)} gold`,
    goldPoints: `+${formatScore(breakdown.goldPoints)}`,
    xpEarned: `${formatScore(breakdown.xpEarned)} XP`,
    xpPoints: `+${formatScore(breakdown.xpPoints)}`,
    levelPoints: `+${formatScore(breakdown.levelPoints)}`,
    inventoryValue: `${formatScore(breakdown.inventoryValue)} value`,
    inventoryPoints: `+${formatScore(breakdown.inventoryPoints)}`,
    survivors: `${breakdown.survivors} alive`,
    victoryBonus: breakdown.victoryBonus > 0 
      ? `+${formatScore(breakdown.victoryBonus)} 🏆` 
      : '—',
    totalScore: formatScore(breakdown.totalScore),
  };
}
