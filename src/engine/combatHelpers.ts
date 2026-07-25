import { roll } from '../core/dice';
import type { RunState } from './types';
import type { SeededRNG } from '../core/rng';
import { cappedHistory } from './history';
import { REST_COOLDOWN } from './constants';

// Helper to resolve enemy turn
export function resolveEnemyTurn(state: RunState, rng: SeededRNG): RunState {
    const room = state.currentRoom;
    const livingEnemies = room?.enemies.filter(e => e.hp > 0) ?? [];
    if (!room || livingEnemies.length === 0) return { ...state, combatTurn: 'player' };

    let nextState = { ...state };
    let newHistory = [...nextState.history];

    for (const enemy of livingEnemies) {
        // Target a random ALIVE party member. Hidden members are skipped, but
        // only while someone else can be hit -- otherwise the enemies would
        // simply never act and combat would stall forever.
        const alive = nextState.party.members.filter(m => m.isAlive);
        if (alive.length === 0) break;
        const visible = alive.filter(m => !m.statuses?.includes('hidden'));
        const targetPool = visible.length > 0 ? visible : alive;

        const targetMember = rng.pick(targetPool);
        const targetIndex = nextState.party.members.findIndex(m => m.id === targetMember.id);

        // Calculate AC from all equipped items + Skills (including enchantments)
        let memberAC = 10 + (targetMember.skills?.defense || 0);
        Object.values(targetMember.equipment).forEach(item => {
            if (!item) return;
            memberAC += (item.baseStats.acBonus || 0);
            if (item.enchantment?.effect) {
                memberAC += (item.enchantment.effect.acBonus || 0);
            }
        });

        const enemyAttackRoll = roll('1d20', rng).total;
        const enemyHit = (enemyAttackRoll + enemy.power) >= memberAC;

        if (enemyHit) {
            const enemyDamageRoll = roll(enemy.damage, rng);
            const newHp = Math.max(0, targetMember.hp.current - enemyDamageRoll.total);
            const isNowDead = newHp <= 0;

            const newMembers = nextState.party.members.map((m, i) => 
                i === targetIndex ? { 
                    ...m, 
                    hp: { ...m.hp, current: newHp },
                    isAlive: !isNowDead
                } : m
            );

            nextState = {
                ...nextState,
                party: { ...nextState.party, members: newMembers }
            };

            newHistory.push(`${enemy.name} attacks ${targetMember.name}: [${enemyAttackRoll}+${enemy.power}=${enemyAttackRoll+enemy.power} vs AC ${memberAC}] HIT! ${enemyDamageRoll.total} damage!`);
            
            if (isNowDead) {
                newHistory.push(`${targetMember.name} has fallen!`);
            }
        } else {
            newHistory.push(`${enemy.name} attacks ${targetMember.name}: [${enemyAttackRoll}+${enemy.power}=${enemyAttackRoll+enemy.power} vs AC ${memberAC}] MISS!`);
        }
    }

    // Check game over
    const allDead = nextState.party.members.every(m => !m.isAlive);
    if (allDead) {
        return {
            ...nextState,
            history: cappedHistory([...newHistory, 'The entire party has fallen! Game Over.']),
            roomResolved: true,
            combatTurn: null,
            gameOver: true
        };
    }

    // End of enemy turn -> Player turn
    // Let's decrement cooldowns here since it's passing back to player.
    // REST_COOLDOWN entries are sentinels, not turn counts -- ticking them down
    // would let a once-per-rest ability come back on its own after 999 rounds.
    const membersWithCooldowns = nextState.party.members.map(m => {
        if (!m.abilities) return m;
        return {
            ...m,
            abilities: m.abilities.map(a => ({
                ...a,
                currentCooldown: a.currentCooldown >= REST_COOLDOWN
                    ? a.currentCooldown
                    : Math.max(0, a.currentCooldown - 1)
            }))
        };
    });

    const newRound = (nextState.combatRound || 0) + 1;
    return {
        ...nextState,
        party: { ...nextState.party, members: membersWithCooldowns },
        history: cappedHistory([...newHistory, `━━━ ROUND ${newRound} ━━━`]),
        combatTurn: 'player',
        combatRound: newRound,
        actedThisRound: [] // Reset for new round
    };
}
