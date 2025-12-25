import { roll } from '../core/dice';
import type { RunState } from './types';

// Helper to resolve enemy turn
export function resolveEnemyTurn(state: RunState): RunState {
    const room = state.currentRoom;
    if (!room || room.enemies.length === 0) return { ...state, combatTurn: 'player' };

    let nextState = { ...state };
    let newHistory = [...nextState.history];

    for (const enemy of room.enemies) {
        // Target random ALIVE party member who is NOT hidden
        const aliveMembers = nextState.party.members.filter(m => m.isAlive && !m.statuses?.includes('hidden'));
        if (aliveMembers.length === 0) break;

        const targetMember = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
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

        const enemyAttackRoll = roll('1d20').total;
        const enemyHit = (enemyAttackRoll + enemy.power) >= memberAC;

        if (enemyHit) {
            const enemyDamageRoll = roll(enemy.damage);
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
            history: [...newHistory, 'The entire party has fallen! Game Over.'],
            roomResolved: true,
            combatTurn: null,
            gameOver: true
        };
    }

    // End of enemy turn -> Player turn
    // Let's decrement cooldowns here since it's passing back to player
    const membersWithCooldowns = nextState.party.members.map(m => {
        if (!m.abilities) return m;
        return {
            ...m,
            abilities: m.abilities.map(a => ({
                ...a,
                currentCooldown: Math.max(0, a.currentCooldown - 1)
            }))
        };
    });

    const newRound = (nextState.combatRound || 0) + 1;
    return {
        ...nextState,
        party: { ...nextState.party, members: membersWithCooldowns },
        history: [...newHistory, `━━━ ROUND ${newRound} ━━━`],
        combatTurn: 'player',
        combatRound: newRound
    };
}
