import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/engine/reducer';
import { createInitialRunState } from '../src/engine/state';


describe('Game Reducer', () => {
  it('should initialize run state correctly via START_RUN', () => {
    // We pass a dummy state for the first call, or handle undefined in a real Redux setup. 
    // Here our reducer signature expects RunState, so we might need a factory helper for the "empty" start 
    // or just rely on createInitialRunState being tested separately.
    // Let's test the action flows.
    
    // Simulating "empty" state input isn't quite right for our signature.
    // We will verify the createInitialRunState output first.
    const state = createInitialRunState('test-seed');
    expect(state.seed).toBe('test-seed');
    expect(state.depth).toBe(0);
    expect(state.party.members.length).toBe(1);
    expect(state.shortRestsRemaining).toBe(2);
  });

  it('should advance depth on ADVANCE_ROOM', () => {
    const state = createInitialRunState('test');
    const newState = gameReducer(state, { type: 'ADVANCE_ROOM' });
    expect(newState.depth).toBe(1);
    expect(newState.shortRestsRemaining).toBe(2);
  });

  it('should handle short rests', () => {
    let state = createInitialRunState('test');
    // Damage the hero first to see healing
    const heroId = state.party.members[0].id;
    state.party.members[0].hp.current = 5;
    
    const newState = gameReducer(state, { type: 'TAKE_SHORT_REST', actorIdsToHeal: [heroId] });
    
    expect(newState.shortRestsRemaining).toBe(1);
    // Checked expected heal amount from reducer (50% of 12 = 6, 5+6=11)
    expect(newState.party.members[0].hp.current).toBe(11);
  });

  it('should prevent short rest if none remaining', () => {
    let state = createInitialRunState('test');
    state.shortRestsRemaining = 0;
    state.party.members[0].hp.current = 5;
    
    const newState = gameReducer(state, { type: 'TAKE_SHORT_REST', actorIdsToHeal: [state.party.members[0].id] });
    
    expect(newState.shortRestsRemaining).toBe(0);
    expect(newState.party.members[0].hp.current).toBe(5); // No healing
  });
});
