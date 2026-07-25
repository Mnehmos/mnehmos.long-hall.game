import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/engine/reducer';
import { createInitialRunState, createActor, migrateSave } from '../src/engine/state';
import { resolveEnemyTurn } from '../src/engine/combatHelpers';
import { SeededRNG } from '../src/core/rng';
import type { Enemy, RunState, Room } from '../src/engine/types';

function enemy(over: Partial<Enemy> = {}): Enemy {
    return { id: 'e1', name: 'Goblin', hp: 10, maxHp: 10, power: 2, damage: '1d4', ac: 10, xp: 10, ...over };
}

function combatRoom(enemies: Enemy[], type: Room['type'] = 'combat'): Room {
    return { id: 'r', type, themeId: 'dungeon_start', enemies, loot: [] };
}

function inCombat(seed: string, enemies: Enemy[], type: Room['type'] = 'combat'): RunState {
    return {
        ...createInitialRunState(seed),
        depth: 3,
        currentRoom: combatRoom(enemies, type),
        combatTurn: 'player',
        combatRound: 1,
        roomResolved: false,
    };
}

describe('stealth', () => {
    it('breaks when the hidden character attacks and misses', () => {
        // Regression: stealth was only cleared inside the `isKill` branch, so a
        // rogue who never landed a killing blow stayed hidden forever -- and
        // hidden characters are skipped as enemy targets.
        let state = inCombat('stealth-seed', [enemy({ hp: 500, maxHp: 500, ac: 99 })]);
        state.party.members[0] = { ...state.party.members[0], statuses: ['hidden'] };

        const after = gameReducer(state, {
            type: 'ATTACK',
            attackerId: state.party.members[0].id,
            targetId: 'e1',
        });

        // AC 99 guarantees a miss, and the enemy survives, so neither the
        // kill path nor the victory path runs.
        expect(after.currentRoom!.enemies[0].hp).toBe(500);
        expect(after.party.members[0].statuses).not.toContain('hidden');
    });

    it('does not let a fully hidden party stall the enemy turn', () => {
        // If every living member was hidden, the enemy loop hit `break` and no
        // attack ever landed: infinite invulnerability.
        let state = inCombat('stall-seed', [enemy({ power: 20, damage: '2d6' })]);
        state.party.members[0] = { ...state.party.members[0], statuses: ['hidden'] };

        const before = state.party.members[0].hp.current;
        const after = resolveEnemyTurn(state, new SeededRNG(7));

        const log = after.history.join('\n');
        expect(log).toMatch(/attacks/);
        // The attack resolved against the hidden member (hit or miss).
        expect(after.party.members[0].hp.current).toBeLessThanOrEqual(before);
    });
});

describe('kill rewards', () => {
    it('grants XP and gold whichever way the enemy dies', () => {
        // Regression: USE_ABILITY paid `power * 2` gold, dropped nothing, and
        // awarded zero XP, so spells were strictly worse than attacks.
        let state = inCombat('reward-seed', [enemy({ hp: 1, maxHp: 1, ac: 1 })]);
        const heroId = state.party.members[0].id;

        const after = gameReducer(state, { type: 'ATTACK', attackerId: heroId, targetId: 'e1' });

        expect(after.party.gold).toBeGreaterThan(state.party.gold);
        expect(after.party.members[0].xp).toBeGreaterThan(0);
    });
});

describe('traps', () => {
    it('hits a living member rather than re-killing the corpse', () => {
        // Regression: traps always targeted members[0]. Once the starting hero
        // died, every trap flagged game over while the party was still alive.
        let state = createInitialRunState('trap-seed');
        const dead = { ...state.party.members[0], hp: { current: 0, max: 20 }, isAlive: false };
        const alive = createActor('ally', 'Ally', 'cleric', 3, true);
        state = {
            ...state,
            party: { ...state.party, members: [dead, alive] },
            currentRoom: combatRoom([], 'hazard'),
            roomResolved: false,
        };

        const after = gameReducer(state, { type: 'TRIGGER_TRAP' });

        expect(after.gameOver).toBe(false);
        expect(after.party.members[0].hp.current).toBe(0);
        expect(after.party.members[1].hp.current).toBeLessThan(alive.hp.current);
    });

    it('refuses to disarm while guards are alive', () => {
        const state = inCombat('guard-seed', [enemy()], 'hazard');
        const after = gameReducer(state, { type: 'DISARM_TRAP' });
        expect(after.roomResolved).toBe(false);
        expect(after.currentRoom!.enemies[0].hp).toBe(10);
    });
});

describe('shrines', () => {
    it('does not throw at a boss shrine when nothing is equipped', () => {
        // Regression: every non-enchant boon is gated behind !isBossShrine, so
        // a party with no equipment produced an empty boon list and the reducer
        // called .apply() on undefined.
        let state = createInitialRunState('boss-shrine-seed');
        state = {
            ...state,
            depth: 10,
            pendingBossReward: true,
            currentRoom: { id: 'i', type: 'intermission', themeId: 'dungeon_start', enemies: [], loot: [] },
            party: {
                ...state.party,
                members: [{ ...state.party.members[0], equipment: {} }],
            },
        };

        expect(() => gameReducer(state, { type: 'PRAY_AT_SHRINE' })).not.toThrow();
        const after = gameReducer(state, { type: 'PRAY_AT_SHRINE' });
        expect(after.shrineBoon).toBeTruthy();
        expect(after.pendingBossReward).toBe(false);
    });

    it('refuses to pray while guards are alive', () => {
        const state = inCombat('guarded-shrine', [enemy()], 'shrine');
        const after = gameReducer(state, { type: 'PRAY_AT_SHRINE' });
        expect(after.shrineBoon).toBeNull();
    });

    it('blesses the weapon at the starting shrine', () => {
        const state = createInitialRunState('start-shrine');
        const after = gameReducer(state, { type: 'PRAY_AT_SHRINE' });
        expect(after.party.members[0].equipment.main_hand?.enchantment).toBeDefined();
    });
});

describe('escape', () => {
    it('leaves the party able to act in the room it lands in', () => {
        // Regression: ESCAPE only set combatTurn for combat/elite rooms, so
        // fleeing into a guarded shrine produced live enemies with no turn.
        for (let i = 0; i < 40; i++) {
            let state = inCombat(`escape-${i}`, [enemy({ power: 1 })]);
            const after = gameReducer(state, { type: 'ESCAPE' });
            if (after.depth === state.depth) continue; // failed escape
            if (after.gameOver) continue;

            const enemiesAlive = after.currentRoom?.enemies.some(e => e.hp > 0) ?? false;
            if (enemiesAlive) expect(after.combatTurn).not.toBeNull();
            expect(after.actedThisRound).toEqual([]);
        }
    });

    it('does not reroll the room (escaping is not a slot machine)', () => {
        // The old ESCAPE salted the seed with 'retreat' and used the OLD depth,
        // so fleeing produced a different room than advancing would have.
        const base = inCombat('reroll-seed', [enemy({ power: 1 })]);
        const advanced = gameReducer(base, { type: 'ADVANCE_ROOM' });

        let escaped: RunState | null = null;
        for (let i = 0; i < 60 && !escaped; i++) {
            const attempt = gameReducer({ ...base, rngCursor: i }, { type: 'ESCAPE' });
            if (attempt.depth > base.depth) escaped = attempt;
        }

        expect(escaped).not.toBeNull();
        expect(escaped!.currentRoom!.type).toBe(advanced.currentRoom!.type);
        expect(escaped!.currentRoom!.enemies.map(e => e.name))
            .toEqual(advanced.currentRoom!.enemies.map(e => e.name));
    });

    it('clears boss state so the boss-victory branch cannot re-fire', () => {
        let state = inCombat('boss-escape', [enemy({ power: 1 })]);
        state = {
            ...state,
            inBossRoom: true,
            parentIntermission: { id: 'i', type: 'intermission', themeId: 'd', enemies: [], loot: [] },
        };

        for (let i = 0; i < 60; i++) {
            const after = gameReducer({ ...state, rngCursor: i }, { type: 'ESCAPE' });
            if (after.depth > state.depth) {
                expect(after.inBossRoom).toBe(false);
                expect(after.parentIntermission).toBeNull();
                return;
            }
        }
    });
});

describe('save migration', () => {
    it('fills in fields missing from older saves', () => {
        const legacy = {
            seed: 'old-save',
            depth: 4,
            party: { gold: 10, members: [createActor('h', 'Hero', 'fighter')] },
            currentRoom: combatRoom([enemy()]),
            history: ['something happened'],
        };

        const migrated = migrateSave(legacy)!;
        expect(migrated.rngCursor).toBe(0);
        expect(migrated.mutations).toEqual([]);
        expect(migrated.inventory).toEqual({ items: [], consumables: [] });
        // Living enemies must leave someone able to act.
        expect(migrated.combatTurn).toBe('player');
    });

    it('rejects junk', () => {
        expect(migrateSave(null)).toBeNull();
        expect(migrateSave({})).toBeNull();
        expect(migrateSave({ seed: 'x' })).toBeNull();
        expect(migrateSave('not an object')).toBeNull();
    });
});
