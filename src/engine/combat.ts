import { SeededRNG } from '../core/rng';

export interface CombatResult {
  hit: boolean;
  damageDealt: number;
  damageTaken: number;
  stressTaken: number;
  isFatal: boolean; // did party wipe?
  enemyDefeated: boolean;
}

/**
 * Resolve a single round of "Lite" combat.
 * 
 * Rules:
 * - Party Power = sum of levels + equipment bonuses (simplified for v1: just level/stats)
 * - Enemy Power = sum of enemy power ratings
 * - Roll d20 + PartyPower vs d20 + EnemyPower
 * - Difference determines outcome (Win/Loss margin)
 * - Damage/Stress scaled by margin and "Deadliness"
 */
export function resolveCombat(
  partyPower: number, 
  enemyPower: number, 
  rng: SeededRNG
): CombatResult {
  const partyRoll = rng.int(1, 20) + partyPower;
  const enemyRoll = rng.int(1, 20) + enemyPower;
  
  const margin = partyRoll - enemyRoll;
  
  // Base outcome
  let result: CombatResult = {
    hit: false,
    damageDealt: 0,
    damageTaken: 0,
    stressTaken: 0,
    isFatal: false,
    enemyDefeated: false
  };
  
  if (margin >= 0) {
    // Win
    result.hit = true;
    result.enemyDefeated = true; // One-roll resolution for v1 ? 
    // Or iterative? Design doc: "Outcome determines party damage + stress gained"
    // "Fast resolution (not tactical grid)"
    // Let's assume one "Roll" resolves the encounter or a significant chunk of it.
    // If we want "Encounter-by-encounter", one roll is very fast.
    
    // Win margin:
    // 0-5: Close fight (take some dmg/stress)
    // 5-10: Solid win (little dmg)
    // 10+: Crushing win (no dmg)
    
    if (margin < 5) {
      result.damageTaken = rng.int(1, 4);
      result.stressTaken = rng.int(1, 3);
    } else if (margin < 10) {
      result.damageTaken = rng.int(0, 2);
      result.stressTaken = rng.int(0, 1);
    } else {
      // Flawless
    }
    
  } else {
    // Loss (or struggle)
    // Party takes significant damage/stress
    // Enemy might NOT be defeated? Or we treat it as "You won but at what cost?"
    // Design doc: "Outcome determines... loot drop chance... ally injury"
    // Usually roguelikes don't let you lose and proceed. "Loss" means retreat or death.
    // Let's Assume "You survive but hurt" unless fatal.
    
    const lossMagnitude = Math.abs(margin);
    result.enemyDefeated = true; // You eventually win
    result.damageTaken = rng.int(2, 6) + Math.floor(lossMagnitude / 2);
    result.stressTaken = rng.int(2, 5) + Math.floor(lossMagnitude / 2);
    
    // Check fatality caller-side usually, but we flag it here if logic dictates?
    // No, damage is applied to HP outside.
  }
  
  return result;
}
