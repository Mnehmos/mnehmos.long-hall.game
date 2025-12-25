import { RunState } from './types';

export function calculateScore(state: RunState): number {
  let score = 0;

  // 1. Depth points
  score += state.depth * 100;

  // 2. Gold
  score += state.party.gold;

  // 3. XP / Levels
  state.party.members.forEach(actor => {
    score += actor.xp;
    score += (actor.level - 1) * 500;
  });

  // 4. Inventory Value (optional, maybe just 10% of cost)
  state.inventory.items.forEach(item => {
    score += Math.floor(item.cost / 10);
  });
  state.party.members.forEach(actor => {
     Object.values(actor.equipment).forEach(item => {
         if (item) score += Math.floor(item.cost / 10);
     });
  });

  // 5. Rooms Resolved (if tracked separately, but depth proxies this)
  
  return Math.floor(score);
}
