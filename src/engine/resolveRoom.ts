import type { Action, RunState } from './types';
import { resolveCombat } from './combat';
import { SeededRNG } from '../core/rng';
import { generateRoom } from './generateRoom';
import { hashWithSeed } from '../core/hash';

export function resolveRoom(state: RunState, _action: Action & { type: 'RESOLVE_ROOM' }): RunState {
    // Ensure we are in a room?
    // For v1, let's assume valid state.
    // We need to know WHAT we are resolving.
    // We might need to regenerate the current room content to check its stats, 
    // or store it in state (which we discussed in types.ts but didn't fully implement persistence of Room object in state, 
    // only currentRoomId... wait, I added `currentRoomId`. 
    // And `generateRoom` is deterministic.)
    
    // Re-generate room to know what we fought
    const room = generateRoom(state);
    
    // Prepare RNG for resolution (distinct from generation)
    // Seed = hash(state.seed, state.depth + "resolve")
    const resolveSeed = hashWithSeed(`${state.seed}-resolve-${state.depth}`, 0);
    const rng = new SeededRNG(resolveSeed);
    
    let newState = { ...state };
    let log: string[] = [];
    
    if (room.type === 'combat' || room.type === 'elite') {
        // Calculate power
        // Party power = maxHp sum? Level sum?
        const partyPower = state.party.members.reduce((sum, m) => sum + (m.hp.current > 0 ? 2 : 0), 0) + 2; // Arbitrary 2 base + 2 per alive
        
        // Enemy power
        const enemyPower = (room.enemies || []).reduce((sum, e) => sum + e.power, 0);
        
        const result = resolveCombat(partyPower, enemyPower, rng);
        
        // Apply Damage (spread evenly or to front?)
        // Simple: Spread to first available alive member
        let damageRemaining = result.damageTaken;
        
        const newMembers = state.party.members.map(m => {
            if (damageRemaining > 0 && m.hp.current > 0) {
                const take = Math.min(m.hp.current, damageRemaining);
                damageRemaining -= take;
                return {
                    ...m,
                    hp: { ...m.hp, current: m.hp.current - take },
                    stress: { ...m.stress, current: m.stress.current + result.stressTaken }
                };
            }
            return m;
        });
        
        newState.party = {
            ...state.party,
            members: newMembers,
            gold: state.party.gold // + loot?
        };
        
        log.push(`Combat resolved: Took ${result.damageTaken} damage, ${result.stressTaken} stress.`);
        if (result.damageTaken === 0) log.push("Flawless victory!");
    } else {
        log.push(`Resolved ${room.type} room safely.`);
    }
    
    // Append log
    newState.history = [...state.history, ...log];
    
    return newState;
}
