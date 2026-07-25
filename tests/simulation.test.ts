import { describe, it, expect } from 'vitest';
import { createInitialRunState } from '../src/engine/state';
import { gameReducer } from '../src/engine/reducer';
import type { Action, RunState } from '../src/engine/types';

/**
 * A bot that plays the game the way the UI allows: it fights what's in front of
 * it, interacts with rooms, and advances.
 *
 * The old version of this test dispatched RESOLVE_ROOM (an action no button
 * ever produced) and asserted only that `depth` incremented, so it never
 * exercised combat at all.
 */
function playRun(seed: string, rooms: number): { state: RunState; actions: Action[] } {
    let state = createInitialRunState(seed);
    const actions: Action[] = [];

    const apply = (action: Action) => {
        actions.push(action);
        state = gameReducer(state, action);
    };

    // Room 0 is the starting shrine.
    apply({ type: 'PRAY_AT_SHRINE' });
    apply({ type: 'DISMISS_POPUP' });

    for (let i = 0; i < rooms && !state.gameOver; i++) {
        apply({ type: 'ADVANCE_ROOM' });

        // Fight until the room is clear (bounded so a bug can't hang the suite).
        let guard = 0;
        while (!state.gameOver && state.combatTurn === 'player' && guard++ < 200) {
            const room = state.currentRoom;
            const target = room?.enemies.find(e => e.hp > 0);
            const attacker = state.party.members.find(
                m => m.isAlive && !state.actedThisRound.includes(m.id)
            ) ?? state.party.members.find(m => m.isAlive);
            if (!target || !attacker) break;
            apply({ type: 'ATTACK', attackerId: attacker.id, targetId: target.id });
        }

        if (state.gameOver) break;

        const type = state.currentRoom?.type;
        if (type === 'hazard' && !state.roomResolved) apply({ type: 'DISARM_TRAP' });
        if (type === 'shrine' && !state.roomResolved) apply({ type: 'PRAY_AT_SHRINE' });
        apply({ type: 'DISMISS_POPUP' });
    }

    return { state, actions };
}

describe('Run Simulation', () => {
    it('plays 30 rooms without corrupting state', () => {
        const { state } = playRun('simulation-seed', 30);

        expect(state.party.members.length).toBeGreaterThan(0);
        expect(state.history.length).toBeLessThanOrEqual(100);
        for (const m of state.party.members) {
            expect(m.hp.current).toBeGreaterThanOrEqual(0);
            expect(m.hp.current).toBeLessThanOrEqual(m.hp.max);
            expect(m.hp.max).toBeGreaterThan(0);
            expect(Number.isFinite(m.xp)).toBe(true);
        }
        expect(state.party.gold).toBeGreaterThanOrEqual(0);
    });

    it('never leaves the player without a legal move', () => {
        // Regression: ESCAPE used to drop the party into a guarded shrine with
        // combatTurn === null, so living enemies blocked the room and no button
        // could resolve it. loadGameState carried a heuristic to "repair" it.
        for (const seed of ['softlock-a', 'softlock-b', 'softlock-c', 'softlock-d']) {
            const { state } = playRun(seed, 25);
            if (state.gameOver) continue;

            const enemiesAlive = state.currentRoom?.enemies.some(e => e.hp > 0) ?? false;
            if (enemiesAlive) {
                expect(state.combatTurn).not.toBeNull();
            }
        }
    });

    it('is reproducible: same seed + same actions produce identical state', () => {
        // This is the whole point of the seed. It could not hold while combat
        // called Math.random().
        const a = playRun('determinism-seed', 20);
        const b = playRun('determinism-seed', 20);

        expect(b.actions).toEqual(a.actions);
        expect(JSON.stringify(b.state)).toEqual(JSON.stringify(a.state));
    });

    it('produces different runs for different seeds', () => {
        const a = playRun('seed-one', 20);
        const b = playRun('seed-two', 20);
        expect(JSON.stringify(a.state)).not.toEqual(JSON.stringify(b.state));
    });

    it('does not mutate the state passed into the reducer', () => {
        let state = createInitialRunState('purity-seed');
        state = gameReducer(state, { type: 'PRAY_AT_SHRINE' });
        state = gameReducer(state, { type: 'ADVANCE_ROOM' });

        const before = JSON.stringify(state);
        const target = state.currentRoom?.enemies[0];
        const attacker = state.party.members[0];
        if (target) {
            gameReducer(state, { type: 'ATTACK', attackerId: attacker.id, targetId: target.id });
        }
        expect(JSON.stringify(state)).toEqual(before);
    });
});
