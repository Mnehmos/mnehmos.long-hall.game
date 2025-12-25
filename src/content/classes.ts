import type { Role, Skills } from '../engine/types';

export const STARTING_SKILLS: Record<Role, Skills> = {
  fighter: {
    strength: 2,
    attack: 2,
    defense: 1,
    magic: 0,
    ranged: 0,
    faith: 0,
    agility: 1
  },
  wizard: {
    strength: 0,
    attack: 0,
    defense: 0,
    magic: 3,
    ranged: 0,
    faith: 0,
    agility: 0
  },
  rogue: {
    strength: 0,
    attack: 1,
    defense: 0,
    magic: 0,
    ranged: 2,
    faith: 0,
    agility: 3  // Rogues are the best at escaping
  },
  cleric: {
    strength: 1,
    attack: 0,
    defense: 1,
    magic: 0,
    ranged: 0,
    faith: 3,
    agility: 0
  },
  ranger: {
    strength: 0,
    attack: 1,
    defense: 0,
    magic: 0,
    ranged: 3,
    faith: 1,
    agility: 2  // Rangers are also nimble
  }
};

export function getHitDie(role: Role): number {
    switch (role) {
        case 'fighter': return 10;
        case 'ranger': return 10;
        case 'cleric': return 8;
        case 'rogue': return 8;
        case 'wizard': return 6;
    }
}
