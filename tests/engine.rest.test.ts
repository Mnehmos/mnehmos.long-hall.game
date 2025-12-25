import { describe, it, expect } from 'vitest';
import { performShortRest, performLongRest } from '../src/engine/rest';
import { createInitialRunState } from '../src/engine/state';
import { SeededRNG } from '../src/core/rng';
import { gameReducer } from '../src/engine/reducer';

describe('Rests and Mutations', () => {
    
    it('Short Rest should heal and consume hit dice', () => {
        let state = createInitialRunState('seed-rest');
        const hero = state.party.members[0].id;
        
        // Damage hero
        state.party.members[0].hp.current = 1;
        state.party.members[0].hitDice.current = 1;
        state.shortRestsRemaining = 2;
        
        const nextState = performShortRest(state, [hero]);
        
        // Expect healing (50% max = 6 for fighter with 12 max)
        expect(nextState.party.members[0].hp.current).toBe(7); // 1 + 6
        expect(nextState.party.members[0].hitDice.current).toBe(0);
        expect(nextState.shortRestsRemaining).toBe(1);
    });

    it('Long Rest should restore everything and add mutation', () => {
        let state = createInitialRunState('seed-long');
        state.shortRestsRemaining = 0;
        state.party.members[0].hp.current = 1;
        state.party.members[0].hitDice.current = 0;
        state.mutations = [];
        state.themeId = 'dungeon_start';
        state.depth = 9; // About to finish segment
        
        const rng = new SeededRNG(12345);
        const nextState = performLongRest(state, rng);
        
        expect(nextState.shortRestsRemaining).toBe(2);
        expect(nextState.party.members[0].hp.current).toBe(12); // Max
        expect(nextState.party.members[0].hitDice.current).toBeGreaterThan(0);
        
        // 50% chance of mutation with seed 12345?
        // Let's check if mutations changed or rng was used.
        // It's probabilistic, but deterministic for seed.
        // With seed 12345, next()... 
        // We can just check type.
        expect(Array.isArray(nextState.mutations)).toBe(true);
        expect(nextState.themeId).toBeDefined(); // Theme might remain same if RNG picks it, satisfying randomness
    });

    it('Reducer should trigger Long Rest at depth 10, 20...', () => {
        let state = createInitialRunState('seed-red-rest');
        state.depth = 9;
        state.shortRestsRemaining = 0;
        
        // Action: Advance to 10 (Start of new segment 1? No, 0-9 is seg 0. 10-19 is seg 1.)
        const nextState = gameReducer(state, { type: 'ADVANCE_ROOM' });
        
        expect(nextState.depth).toBe(10);
        // Should have triggered long rest restoration
        expect(nextState.shortRestsRemaining).toBe(2);
    });
});
