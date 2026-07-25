import { describe, it, expect } from 'vitest';
import { createInitialRunState, createActor } from '../src/engine/state';
import { gameReducer } from '../src/engine/reducer';
import { resolveEnemyTurn } from '../src/engine/combatHelpers';
import { SeededRNG } from '../src/core/rng';
import { ALL_ABILITIES, getAbilityById, isFreeAction } from '../src/content/abilities';
import { STATUS, SHIELD_AC } from '../src/engine/constants';
import type { Enemy, Role, RunState } from '../src/engine/types';

const dummy = (id: string, over: Partial<Enemy> = {}): Enemy => ({
    id, name: `Dummy ${id}`, hp: 999, maxHp: 999, power: 1, damage: '1d1', ac: 1, xp: 1, ...over,
});

function party(roles: Role[], enemies: Enemy[] = [dummy('e1'), dummy('e2')]): RunState {
    const base = createInitialRunState('abilities');
    return {
        ...base,
        depth: 5,
        party: { ...base.party, members: roles.map((r, i) => createActor(`m${i}`, `${r}-${i}`, r, 5, true)) },
        currentRoom: { id: 'r', type: 'combat', themeId: 'dungeon_start', enemies, loot: [] },
        combatTurn: 'player', combatRound: 1, roomResolved: false,
        actedThisRound: [], extraActions: {},
    };
}

/** What the UI would send as targetId for a given ability. */
function targetFor(target: string): string | undefined {
    if (target === 'enemy') return 'e1';
    if (target === 'ally') return 'm0';
    return undefined;
}

describe('every ability has an observable effect', () => {
    // Regression: `special` and `debuff` were declared in content but never
    // implemented in the reducer, and `buff` required a `status` field the
    // wizard's Shield didn't have. Five abilities silently did nothing while
    // still consuming a cooldown: shield, turn_undead, cunning_action,
    // evasion and volley.
    for (const ability of ALL_ABILITIES) {
        it(`${ability.role}: ${ability.id}`, () => {
            // Two members, so the player turn continues after one acts. With a
            // lone member the enemy turn resolves inside the same dispatch and
            // legitimately consumes duration statuses before we can see them.
            let st = party([ability.role, ability.role], [dummy('e1'), dummy('e2')]);
            st.party.members[0] = { ...st.party.members[0], hp: { current: 5, max: 60 } };
            if (ability.id === 'sneak_attack') {
                st.party.members[0] = { ...st.party.members[0], statuses: [STATUS.HIDDEN] };
            }

            const before = st;
            const after = gameReducer(st, {
                type: 'USE_ABILITY',
                actorId: 'm0',
                abilityId: ability.id,
                targetId: targetFor(ability.effect.target),
            });

            const enemyHpBefore = before.currentRoom!.enemies.reduce((s, e) => s + e.hp, 0);
            const enemyHpAfter = after.currentRoom!.enemies.reduce((s, e) => s + e.hp, 0);
            const damaged = enemyHpAfter < enemyHpBefore;
            const healed = after.party.members[0].hp.current > before.party.members[0].hp.current;
            const gainedStatus = after.party.members[0].statuses.length > before.party.members[0].statuses.length;
            const enemyStatus = after.currentRoom!.enemies.some(e => (e.statuses?.length ?? 0) > 0);
            const gainedAction = Object.keys(after.extraActions).length > 0;

            expect(
                damaged || healed || gainedStatus || enemyStatus || gainedAction,
                `${ability.id} (${ability.effect.type}) produced no observable change`
            ).toBe(true);
        });
    }
});

describe('action surge is per-fighter', () => {
    it('a surge cannot be spent by a different party member', () => {
        // The reported bug: clicking Surge on the 2nd fighter let the 1st act again.
        let st = party(['fighter', 'fighter']);

        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        expect(st.actedThisRound).toContain('m0');

        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm1', abilityId: 'action_surge' });
        expect(st.extraActions).toEqual({ m1: 1 });
        // Surging must not mark the surger as having acted.
        expect(st.actedThisRound).not.toContain('m1');

        // m0 already acted and owns no extra action, so this must be a no-op.
        const hpBefore = st.currentRoom!.enemies.reduce((s, e) => s + e.hp, 0);
        const attempted = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        const hpAfter = attempted.currentRoom!.enemies.reduce((s, e) => s + e.hp, 0);

        expect(hpAfter).toBe(hpBefore);
        expect(attempted.extraActions).toEqual({ m1: 1 });
    });

    it('the surging fighter can act twice', () => {
        let st = party(['fighter', 'fighter']);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm1', abilityId: 'action_surge' });

        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm1', targetId: 'e1' });
        expect(st.actedThisRound).toContain('m1');
        expect(st.extraActions).toEqual({ m1: 1 }); // normal action spent first

        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm1', targetId: 'e1' });
        expect(st.extraActions.m1 ?? 0).toBe(0); // extra action now spent
    });

    it('two surging fighters keep separate pools', () => {
        let st = party(['fighter', 'fighter']);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'action_surge' });
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm1', abilityId: 'action_surge' });
        expect(st.extraActions).toEqual({ m0: 1, m1: 1 });

        // m0 spends both of its own actions; m1's bank is untouched.
        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        expect(st.extraActions.m0 ?? 0).toBe(0);
        expect(st.extraActions.m1).toBe(1);
    });

    it('extra actions do not survive into the enemy turn', () => {
        let st = party(['fighter']);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'action_surge' });
        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        st = gameReducer(st, { type: 'ATTACK', attackerId: 'm0', targetId: 'e1' });
        // Both actions spent -> enemy turn -> fresh round.
        expect(st.extraActions).toEqual({});
    });
});

describe('class kits work end to end', () => {
    it('rogue can hide then land Sneak Attack', () => {
        // Cunning Action was declared `special`, which the reducer ignored, so
        // the rogue could never become hidden -- and Sneak Attack requires it.
        let st = party(['rogue']);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'cunning_action' });
        expect(st.party.members[0].statuses).toContain(STATUS.HIDDEN);
        // Hiding is a free action, so the rogue may still attack.
        expect(st.actedThisRound).not.toContain('m0');

        const hp = st.currentRoom!.enemies[0].hp;
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'sneak_attack', targetId: 'e1' });
        expect(st.currentRoom!.enemies[0].hp).toBeLessThan(hp);
        // Attacking reveals.
        expect(st.party.members[0].statuses).not.toContain(STATUS.HIDDEN);
    });

    it('rogue Evasion negates exactly one hit', () => {
        let st = party(['rogue', 'rogue'], [dummy('e1', { power: 50, damage: '3d6' }), dummy('e2', { power: 50, damage: '3d6' })]);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'evasion' });
        expect(st.party.members[0].statuses).toContain(STATUS.EVASIVE);

        const before = st.party.members[0].hp.current;
        const after = resolveEnemyTurn(st, new SeededRNG(3));
        // One attack was voided; the second still lands.
        expect(after.history.join('\n')).toContain('evades');
        expect(after.party.members[0].statuses).not.toContain(STATUS.EVASIVE);
        expect(after.party.members[0].hp.current).toBeLessThan(before);
    });

    it('wizard Shield raises AC and expires after the enemy turn', () => {
        let st = party(['wizard', 'wizard']);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'shield' });
        expect(st.party.members[0].statuses).toContain(STATUS.SHIELDED);

        const after = resolveEnemyTurn(st, new SeededRNG(11));
        // The AC bonus was applied during the attack...
        const acLine = after.history.find(h => h.includes('vs AC'));
        expect(acLine).toBeDefined();
        // ...and the ward drops once the wizard's turn comes round again.
        expect(after.party.members[0].statuses).not.toContain(STATUS.SHIELDED);
        expect(SHIELD_AC).toBeGreaterThan(0);
    });

    it('cleric Turn Undead makes enemies skip a turn, then wear off', () => {
        let st = party(['cleric', 'cleric'], [dummy('e1', { power: 50, damage: '3d6' })]);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'turn_undead' });
        expect(st.currentRoom!.enemies[0].statuses).toContain(STATUS.FEARED);

        const hpBefore = st.party.members.map(m => m.hp.current);
        const afterFeared = resolveEnemyTurn(st, new SeededRNG(5));
        expect(afterFeared.party.members.map(m => m.hp.current)).toEqual(hpBefore); // it cowered
        expect(afterFeared.currentRoom!.enemies[0].statuses).not.toContain(STATUS.FEARED);

        // Next round it attacks normally again.
        const afterRecovered = resolveEnemyTurn(afterFeared, new SeededRNG(6));
        expect(afterRecovered.history.join('\n')).toMatch(/attacks/);
    });

    it('ranger Volley hits every enemy', () => {
        let st = party(['ranger']);
        const before = st.currentRoom!.enemies.map(e => e.hp);
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'volley' });
        const after = st.currentRoom!.enemies.map(e => e.hp);
        expect(after[0]).toBeLessThan(before[0]);
        expect(after[1]).toBeLessThan(before[1]);
    });

    it('Magic Missile auto-hits and includes its +3', () => {
        // It advertised auto-hit but rolled to hit, and its `modifier: 3` was
        // never read because the reducer only rolls the dice expression.
        let st = party(['wizard'], [dummy('e1', { ac: 999 })]);
        const before = st.currentRoom!.enemies[0].hp;
        st = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: 'magic_missile', targetId: 'e1' });
        const dealt = before - st.currentRoom!.enemies[0].hp;
        expect(dealt).toBeGreaterThanOrEqual(3 + 3); // 3d4 min 3, plus +3
    });
});

describe('ability scaling uses the right skill per class', () => {
    // `damage` abilities hardcoded `skills.magic`. Rogues and clerics have
    // magic 0, so their signature abilities scaled off nothing.
    const cases: Array<{ role: Role; ability: string; skill: 'ranged' | 'faith' }> = [
        { role: 'rogue', ability: 'sneak_attack', skill: 'ranged' },
        { role: 'cleric', ability: 'sacred_flame', skill: 'faith' },
    ];

    for (const { role, ability, skill } of cases) {
        it(`${role} ${ability} scales with ${skill}`, () => {
            const damageWith = (value: number) => {
                let st = party([role], [dummy('e1', { ac: 1 })]);
                st.party.members[0] = {
                    ...st.party.members[0],
                    skills: { ...st.party.members[0].skills, [skill]: value },
                    statuses: [STATUS.HIDDEN],
                    equipment: {}, // strip gear so only the skill varies
                };
                const before = st.currentRoom!.enemies[0].hp;
                const after = gameReducer(st, { type: 'USE_ABILITY', actorId: 'm0', abilityId: ability, targetId: 'e1' });
                return before - after.currentRoom!.enemies[0].hp;
            };
            expect(damageWith(20)).toBeGreaterThan(damageWith(0));
        });
    }
});

describe('free-action predicate is shared by UI and reducer', () => {
    it('marks exactly the abilities that do not consume the round', () => {
        const free = ALL_ABILITIES.filter(isFreeAction).map(a => a.id).sort();
        expect(free).toEqual(['action_surge', 'camouflage', 'cunning_action']);
    });

    it('non-free abilities consume the actor action', () => {
        // Two members so the round doesn't immediately flip to the enemy.
        for (const id of ['sacred_flame', 'magic_missile', 'champion_strike']) {
            const def = getAbilityById(id)!;
            const st = party([def.role, def.role]);
            const after = gameReducer(st, {
                type: 'USE_ABILITY', actorId: 'm0', abilityId: id, targetId: targetFor(def.effect.target),
            });
            expect(after.actedThisRound, `${id} should consume an action`).toContain('m0');
        }
    });
});
