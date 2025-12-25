import type { RunState, Actor, Role, Item, Room } from './types';
import { getAbilitiesForRole } from '../content/abilities';
import { STARTING_SKILLS, getHitDie } from '../content/classes';

const SAVE_KEY = 'the_long_hall_save';

// Starting weapon for the fighter
const STARTER_SWORD: Item = {
  id: 'starter_sword',
  name: 'Rusty Sword',
  type: 'weapon',
  rarity: 'common',
  cost: 5,
  baseStats: { attackBonus: 0, damageBonus: 1 }
};

// Room 0: Starting shrine that always grants a boon
const STARTING_SHRINE: Room = {
  id: 'room-0',
  type: 'shrine',
  themeId: 'dungeon_start',
  enemies: [],
  loot: []
};

export const INITIAL_HP: Record<Role, number> = {
  fighter: 12,
  wizard: 6,
  rogue: 8,
  cleric: 10,
  ranger: 10,
};

export function createActor(id: string, name: string, role: Role, level: number = 1): Actor {
  const maxHp = INITIAL_HP[role] + ((level - 1) * 4); // +4 HP per level
  const hitDieVal = getHitDie(role);
  
  return {
    id,
    name,
    role,
    level,
    xp: 0,
    statPoints: 0,
    skills: { ...STARTING_SKILLS[role] }, // Copy starting skills
    isAlive: true,
    hp: { current: maxHp, max: maxHp },
    stress: { current: 0, max: 20 }, // fixed max stress for now
    hitDice: { current: level, max: level, die: hitDieVal }, 
    spellSlots: {},
    equipment: {},
    abilities: getAbilitiesForRole(role).map(a => ({ abilityId: a.id, currentCooldown: 0 })),
    statuses: [],
  };
}

export function createInitialRunState(seed: string): RunState {
  // Use RNG to maybe randomize starting gold slightly? Or fixed.
  // Design says "deterministic".

  const hero = createActor('hero-1', 'Hero', 'fighter');
  // Equip fighter with starting sword
  hero.equipment.main_hand = { ...STARTER_SWORD };

  return {
    seed,
    depth: 0,
    themeId: 'dungeon_start',
    shortRestsRemaining: 2,
    longRestsTaken: 0,
    party: {
      members: [hero],
      gold: 0,
    },
    inventory: {
      items: [],
      consumables: [],
    },
    currentRoom: { ...STARTING_SHRINE }, // Room 0: Starting shrine
    roomResolved: false, // Shrine needs to be resolved (prayed at)
    combatTurn: null,
    combatRound: 0,
    extraActions: 0,
    gameOver: false,
    victory: false,
    shrineBoon: null,
    mutations: [],
    history: ['Run started.', 'You stand before an ancient shrine...'],
  };
}

// Save game state to localStorage
export function saveGameState(state: RunState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save game state:', e);
  }
}

// Load game state from localStorage
export function loadGameState(): RunState | null {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      return JSON.parse(saved) as RunState;
    }
  } catch (e) {
    console.warn('Failed to load game state:', e);
  }
  return null;
}

// Clear saved game state (called on game over)
export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Failed to clear game state:', e);
  }
}
