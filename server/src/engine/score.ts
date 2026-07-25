import type { CleanRunData } from '../utils/sanitize.js';

/**
 * Score a run.
 *
 * Takes a CleanRunData, not a raw RunState: callers must run the payload
 * through sanitizeRunData first so the inputs are already validated and
 * clamped. The scoring itself is unchanged.
 */
export function calculateScore(run: CleanRunData): number {
  let score = 0;

  // 1. Depth points
  score += run.depth * 100;

  // 2. Gold
  score += run.party.gold;

  // 3. XP / Levels
  run.party.members.forEach(actor => {
    score += actor.xp;
    score += (actor.level - 1) * 500;
  });

  // 4. Inventory value (10% of cost)
  run.inventory.items.forEach(item => {
    score += Math.floor(item.cost / 10);
  });
  run.party.members.forEach(actor => {
    Object.values(actor.equipment).forEach(item => {
      score += Math.floor(item.cost / 10);
    });
  });

  return Math.floor(score);
}
