import type { AbilityDef, Role } from '../engine/types';

// Fighter abilities
const FIGHTER_ABILITIES: AbilityDef[] = [
    {
        id: 'second_wind',
        name: 'Second Wind',
        role: 'fighter',
        description: 'Heal 1d10+level HP',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'heal',
            target: 'self',
            dice: '1d10',
            modifier: 0 // Will add level at runtime
        }
    },
    {
        id: 'action_surge',
        name: 'Action Surge',
        role: 'fighter',
        description: 'Take an extra attack this turn',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'special',
            target: 'self'
        }
    },
    {
        id: 'champion_strike',
        name: 'Champion Strike',
        role: 'fighter',
        description: 'Powerful strike for Weapon + 2d6 damage',
        cooldownType: 'turns',
        cooldownValue: 3,
        effect: {
            type: 'attack',
            target: 'enemy',
            dice: '2d6',
            useWeaponDamage: true,
            attackBonus: 2
        }
    }
];

// Wizard abilities
const WIZARD_ABILITIES: AbilityDef[] = [
    {
        id: 'magic_missile',
        name: 'Magic Missile',
        role: 'wizard',
        description: 'Auto-hit 3d4+3 force damage',
        cooldownType: 'turns',
        cooldownValue: 2,
        effect: {
            type: 'damage',
            target: 'enemy',
            dice: '3d4+3',
            alwaysHits: true
        }
    },
    {
        id: 'fireball',
        name: 'Fireball',
        role: 'wizard',
        description: '6d6 fire damage to all enemies',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'damage',
            target: 'all_enemies',
            dice: '6d6'
        }
    },
    {
        id: 'shield',
        name: 'Shield',
        role: 'wizard',
        description: '+5 AC until your next turn',
        cooldownType: 'combat',
        cooldownValue: 1,
        effect: {
            type: 'buff',
            target: 'self',
            status: 'shielded'
        }
    }
];

// Cleric abilities
const CLERIC_ABILITIES: AbilityDef[] = [
    {
        id: 'healing_word',
        name: 'Healing Word',
        role: 'cleric',
        description: 'Heal ally 1d8+level',
        cooldownType: 'turns',
        cooldownValue: 2,
        effect: {
            type: 'heal',
            target: 'ally',
            dice: '1d8',
            modifier: 0
        }
    },
    {
        id: 'sacred_flame',
        name: 'Sacred Flame',
        role: 'cleric',
        description: '1d8 radiant damage',
        cooldownType: 'turns',
        cooldownValue: 0, // Cantrip, always available
        effect: {
            type: 'damage',
            target: 'enemy',
            dice: '1d8',
            scalesWith: 'faith'
        }
    },
    {
        id: 'turn_undead',
        name: 'Turn Undead',
        role: 'cleric',
        description: 'Fear undead enemies for 2 turns',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'debuff',
            target: 'all_enemies'
        }
    }
];

// Rogue abilities
const ROGUE_ABILITIES: AbilityDef[] = [
    {
        id: 'sneak_attack',
        name: 'Sneak Attack',
        role: 'rogue',
        description: '+2d6 damage (Requires Hidden)',
        cooldownType: 'combat',
        cooldownValue: 1,
        effect: {
            type: 'damage',
            target: 'enemy',
            dice: '2d6',
            scalesWith: 'ranged'
        }
    },
    {
        id: 'cunning_action',
        name: 'Cunning Action',
        role: 'rogue',
        description: 'Hide - become untargetable (free action)',
        cooldownType: 'turns',
        cooldownValue: 2,
        effect: {
            type: 'buff',
            target: 'self',
            status: 'hidden'
        }
    },
    {
        id: 'evasion',
        name: 'Evasion',
        role: 'rogue',
        description: 'Dodge the next attack against you completely',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'buff',
            target: 'self',
            status: 'evasive'
        }
    }
];

// Ranger abilities
const RANGER_ABILITIES: AbilityDef[] = [
    {
        id: 'aimed_shot',
        name: 'Aimed Shot',
        role: 'ranger',
        description: 'High accuracy ranged attack',
        cooldownType: 'turns',
        cooldownValue: 2,
        effect: {
            type: 'attack',
            target: 'enemy',
            damageBonus: 2,
            attackBonus: 5
        }
    },
    {
        id: 'volley',
        name: 'Volley',
        role: 'ranger',
        description: 'Attack all enemies with ranged damage',
        cooldownType: 'rest',
        cooldownValue: 1,
        effect: {
            type: 'attack',
            target: 'all_enemies',
            dice: '1d6'
        }
    },
    {
        id: 'camouflage',
        name: 'Camouflage',
        role: 'ranger',
        description: 'Become Hidden (Stealth)',
        cooldownType: 'combat',
        cooldownValue: 1,
        effect: {
            type: 'buff',
            target: 'self',
            status: 'hidden'
        }
    }
];

// Combined abilities by role
export const ALL_ABILITIES: AbilityDef[] = [
    ...FIGHTER_ABILITIES,
    ...WIZARD_ABILITIES,
    ...CLERIC_ABILITIES,
    ...ROGUE_ABILITIES,
    ...RANGER_ABILITIES
];

// Get abilities for a specific role
export function getAbilitiesForRole(role: Role): AbilityDef[] {
    switch (role) {
        case 'fighter': return FIGHTER_ABILITIES;
        case 'wizard': return WIZARD_ABILITIES;
        case 'cleric': return CLERIC_ABILITIES;
        case 'rogue': return ROGUE_ABILITIES;
        case 'ranger': return RANGER_ABILITIES;
        default: return [];
    }
}

// Get a specific ability by ID
export function getAbilityById(id: string): AbilityDef | undefined {
    return ALL_ABILITIES.find(a => a.id === id);
}

/**
 * Abilities that don't consume the actor's action for the round.
 *
 * Single source of truth: the reducer decides whether to spend an action and
 * the UI decides whether to enable the button. They used to answer this
 * question separately -- the UI from a hardcoded list of ids, the reducer from
 * the effect shape -- which is how Cunning Action ended up clickable but inert.
 */
export function isFreeAction(ability: AbilityDef): boolean {
    if (ability.id === 'action_surge') return true;
    return ability.effect.type === 'buff' && ability.effect.status === 'hidden';
}
