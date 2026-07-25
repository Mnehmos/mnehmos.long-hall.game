import type { Actor, Item, RunState } from './types';
import { SeededRNG } from '../core/rng';
import { hashWithSeed } from '../core/hash';
import { generateRoom } from './generateRoom';
import { performLongRest } from './rest';
import { resolveEnemyTurn } from './combatHelpers';
import { roll } from '../core/dice';
import { cappedHistory } from './history';

/** Rooms that still need player interaction before "Advance" unlocks. */
const INTERACTIVE_ROOMS = ['combat', 'elite', 'hazard', 'shrine', 'trader'];

/** Increment the encounter counter on every equipped weapon. */
function incrementWeaponEncounters(members: Actor[]): Actor[] {
    return members.map(member => {
        const weapon = member.equipment.main_hand;
        if (!weapon) return member;

        const stats = weapon.stats
            || { kills: 0, damageDealt: 0, highestHit: 0, criticalHits: 0, encountersUsed: 0 };
        const updatedWeapon: Item = {
            ...weapon,
            stats: { ...stats, encountersUsed: stats.encountersUsed + 1 },
        };
        return {
            ...member,
            equipment: { ...member.equipment, main_hand: updatedWeapon },
        };
    });
}

/**
 * Move the party into the room at `newDepth` and set up combat state.
 *
 * ADVANCE_ROOM and ESCAPE both funnel through here. They used to be separate
 * implementations, and the ESCAPE copy had drifted: it skipped initiative,
 * weapon-encounter tracking, the segment long rest, the actedThisRound reset,
 * and boss-state teardown -- and it left `combatTurn: null` in guarded shrines,
 * which softlocked the run.
 *
 * The room itself is derived from (seed, depth), so escaping into depth N
 * yields the same room as advancing into depth N. That's deliberate: the old
 * ESCAPE salted the seed differently, which made escape-spam a free reroll of
 * the room's contents.
 */
export function enterRoom(
    state: RunState,
    newDepth: number,
    rng: SeededRNG,
    extraHistory: string[] = []
): RunState {
    const roomRng = new SeededRNG(hashWithSeed(state.seed, newDepth));

    // Dead party members are left behind permanently.
    const survivingMembers = state.party.members.filter(m => m.isAlive);

    const room = generateRoom(
        { ...state, depth: newDepth, party: { ...state.party, members: survivingMembers } },
        roomRng
    );

    // Combat includes guarded shrines/hazards, which carry enemies.
    const hasEnemies = room.enemies.length > 0;
    const isCombat = room.type === 'combat'
        || room.type === 'elite'
        || room.type === 'boss'
        || ((room.type === 'shrine' || room.type === 'hazard') && hasEnemies);

    const updatedMembers = isCombat
        ? incrementWeaponEncounters(survivingMembers)
        : survivingMembers;

    const newHistory = [...state.history, ...extraHistory];
    const deadNames = state.party.members.filter(m => !m.isAlive).map(m => m.name);
    if (deadNames.length > 0) {
        newHistory.push(`☠️ ${deadNames.join(', ')} left behind forever...`);
    }
    newHistory.push(`Entered room ${newDepth}: ${room.type.toUpperCase()}`);

    // Initiative: party uses best agility, enemies use highest power.
    let combatTurn: 'player' | 'enemy' | null = isCombat ? 'player' : null;
    if (isCombat && hasEnemies) {
        const partyAgility = Math.max(
            ...updatedMembers.filter(m => m.isAlive).map(m => m.skills?.agility || 0),
            0
        );
        const enemyPower = Math.max(...room.enemies.map(e => e.power), 0);

        const partyInit = roll('1d20', rng).total + partyAgility;
        const enemyInit = roll('1d20', rng).total + Math.floor(enemyPower / 2);

        newHistory.push(`⚔️ Initiative: Party ${partyInit} vs Enemies ${enemyInit}`);
        if (enemyInit > partyInit) {
            combatTurn = 'enemy';
            newHistory.push('Enemies act first!');
        } else {
            newHistory.push('Party acts first!');
        }
        newHistory.push('━━━ ROUND 1 ━━━');
    }

    let nextState: RunState = {
        ...state,
        depth: newDepth,
        currentRoom: room,
        roomResolved: !INTERACTIVE_ROOMS.includes(room.type),
        combatTurn,
        combatRound: isCombat ? 1 : 0,
        actedThisRound: [],
        extraActions: {},
        victory: false,
        shrineBoon: null,
        // Leaving a boss chamber by any route clears the return link, so the
        // boss-victory branch can't fire again in an unrelated room.
        inBossRoom: false,
        parentIntermission: null,
        party: { ...state.party, members: updatedMembers },
        history: cappedHistory(newHistory),
    };

    // Long rest at segment boundaries.
    if (newDepth > 0 && newDepth % 10 === 0) {
        nextState = performLongRest(nextState, rng);
    }

    if (combatTurn === 'enemy') {
        nextState = resolveEnemyTurn(nextState, rng);
    }

    return nextState;
}
