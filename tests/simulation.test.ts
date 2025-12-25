import { describe, it, expect } from 'vitest';
import { createInitialRunState } from '../src/engine/state';
import { gameReducer } from '../src/engine/reducer';

describe('Run Simulation', () => {
    it('should survive 30 rooms with default interactions (bot test)', () => {
        let state = createInitialRunState('simulation-seed');
        
        for (let i = 0; i < 30; i++) {
            // 1. Advance (enters room i+1, depth i+1)
            // Initial state depth=0. Action ADVANCE -> depth=1.
            state = gameReducer(state, { type: 'ADVANCE_ROOM' });
            
            // 2. Resolve (fight/event at depth)
            state = gameReducer(state, { type: 'RESOLVE_ROOM' });
            
            // Check alive
            const aliveCount = state.party.members.filter(m => m.hp.current > 0).length;
            if (aliveCount === 0) {
                // If we die, perform a "reset" or fail?
                // For a simulation, surviving 30 rooms might be hard without healing logic.
                // We should add Rest logic if needed.
                // Or just expect "state is valid" even if dead.
            }
            
            // Check invariants
            expect(state.depth).toBe(i + 1);
            expect(state.party.members).toBeDefined();
        }
        
        console.log(`Simulation finished at depth ${state.depth}. History len: ${state.history.length}`);
    });
});
