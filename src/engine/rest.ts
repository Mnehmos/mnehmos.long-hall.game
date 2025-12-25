import type { RunState } from './types';
import { SeededRNG } from '../core/rng';
import { generateTheme } from './generateTheme';

export function performShortRest(state: RunState, actorIds: string[]): RunState {
    if (state.shortRestsRemaining <= 0) {
        return state;
    }

    // Heal logic: recover HP based on Hit Dice
    // For v1: Flat heal or max-based heal.
    // Design: "Spend hit dice to heal".

    const newMembers = state.party.members.map(member => {
        let updatedMember = member;

        if (actorIds.includes(member.id)) {
            // If has hit dice: heal 50% max HP, consume 1 hit die
            // If no hit dice: heal 25% max HP (emergency rest)
            if (member.hitDice.current > 0) {
                const heal = Math.floor(member.hp.max * 0.5);
                updatedMember = {
                    ...member,
                    hp: { ...member.hp, current: Math.min(member.hp.max, member.hp.current + heal) },
                    hitDice: { ...member.hitDice, current: member.hitDice.current - 1 }
                };
            } else {
                // Emergency rest - smaller heal, no hit dice consumed
                const heal = Math.floor(member.hp.max * 0.25);
                updatedMember = {
                    ...member,
                    hp: { ...member.hp, current: Math.min(member.hp.max, member.hp.current + heal) }
                };
            }
        }

        // Reset "rest" cooldown abilities (those with cooldown >= 999)
        if (updatedMember.abilities) {
            updatedMember = {
                ...updatedMember,
                abilities: updatedMember.abilities.map(a =>
                    a.currentCooldown >= 999 ? { ...a, currentCooldown: 0 } : a
                )
            };
        }

        return updatedMember;
    });

    return {
        ...state,
        shortRestsRemaining: state.shortRestsRemaining - 1,
        party: { ...state.party, members: newMembers },
        history: [...state.history, 'Party took a short rest. Rest abilities restored!']
    };
}

export function performLongRest(state: RunState, rng: SeededRNG): RunState {
    // 1. Restore resources
    const newMembers = state.party.members.map(member => ({
        ...member,
        hp: { ...member.hp, current: member.hp.max },
        hitDice: {
            ...member.hitDice,
            current: Math.min(member.hitDice.max, member.hitDice.current + Math.max(1, Math.floor(member.hitDice.max / 2)))
        },
        stress: { ...member.stress, current: Math.max(0, member.stress.current - 5) },
        // Reset ALL ability cooldowns on long rest
        abilities: member.abilities?.map(a => ({ ...a, currentCooldown: 0 })) || []
    }));
    
    // 2. Mutations
    // "Apply 0-1 Dungeon Mutation"
    const mutations = [...(state.mutations || [])]; // Ensure mutations exists in state
    if (rng.float() < 0.5) {
        // Add a mutation
        const possibleMutations = ['Darkness', 'Fog', 'Brittle Weapons', 'Frenzied Enemies'];
        const m = rng.pick(possibleMutations);
        mutations.push(m);
    }
    
    // 3. Theme shift?
    // Design: "Then theme shift". 
    // generateTheme uses segmentIndex. If we just entered depth 10, next room is 11 (Start of segment 1).
    // The theme for new segment will be calculated when `generateRoom` is called for depth 11?
    // Or we store themeId in state? We DO store `themeId`.
    // So we must update `themeId` here.
    
    // RunState update
    const nextTheme = generateTheme({
        ...state,
        depth: state.depth + 1 // anticipation
    }, rng);
    
    return {
        ...state,
        shortRestsRemaining: 2,
        longRestsTaken: state.longRestsTaken + 1,
        mutations: mutations,
        themeId: nextTheme,
        party: { ...state.party, members: newMembers },
        history: [...state.history, 'Party took a Long Rest. Theme changed.', ...mutations.length > (state.mutations?.length || 0) ? ['New Mutation Applied!'] : []]
    };
}
