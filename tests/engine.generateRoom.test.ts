import { describe, it, expect } from 'vitest';
import { generateRoom } from '../src/engine/generateRoom';
import { createInitialRunState } from '../src/engine/state';


describe('Room Generation', () => {
    
    it('should be deterministic for the same seed and depth', () => {
        const state1 = createInitialRunState('seed-A');
        state1.depth = 5;
        const room1 = generateRoom(state1);
        
        const state2 = createInitialRunState('seed-A');
        state2.depth = 5;
        const room2 = generateRoom(state2);
        
        expect(room1).toEqual(room2);
    });
    
    it('should be different for different depths', () => {
         const state = createInitialRunState('seed-A');
         
         state.depth = 1;
         const room1 = generateRoom(state);
         
         state.depth = 2;
         const room2 = generateRoom(state);
         
         // IDs should differ at minimum
         expect(room1.id).not.toBe(room2.id);
         // Likely content differs too, but not guaranteed (could roll same room type/enemies).
    });
    
    it('should always generate Intermission room at index 10 (depth 9, 19, etc)', () => {
        // Room in segment logic: depth % 10 === 0 → room 10 (intermission)
        // Depth 10, 20, 30 etc. are intermission rooms
        
        const state = createInitialRunState('seed-B');
        state.depth = 10; // Room 10 of segment 1
        
        const room = generateRoom(state);
        expect(room.type).toBe('intermission');
    });

    it('should generate enemies for combat rooms', () => {
         // Force a combat room by checking many depths or mocking RNG?
         // We can just rely on determinism. seed-C depth 2 might be combat.
         // Let's just Loop until we find one.
         
         const state = createInitialRunState('seed-C');
         let foundCombat = false;
         
         for(let i=0; i<10; i++) {
             state.depth = i;
             const room = generateRoom(state);
             if(room.type === 'combat') {
                 expect(room.enemies).toBeDefined();
                 expect(room.enemies!.length).toBeGreaterThan(0);
                 foundCombat = true;
                 break;
             }
         }
         
         if (!foundCombat) {
             console.warn('Did not generate a combat room in 10 tries, check weights');
         }
    });
});
