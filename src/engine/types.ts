export type Role = 'fighter' | 'wizard' | 'rogue' | 'cleric' | 'ranger';

export type RoomType = 'combat' | 'elite' | 'hazard' | 'trader' | 'ally' | 'shrine' | 'intermission';
export type ThemeType = 'dungeon_start' | 'crypt' | 'sewer' | string; // extensible

export interface Stats {
  current: number;
  max: number;
}

// Ability definition
export type AbilityCooldownType = 'turns' | 'rest' | 'combat';
export interface AbilityDef {
  id: string;
  name: string;
  role: Role;
  description: string;
  cooldownType: AbilityCooldownType;
  cooldownValue: number; // turns, or 1 for rest/combat
  effect: {
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'special' | 'attack'; // Added 'attack' for weapon-based abilities
    target: 'ally' | 'self' | 'enemy' | 'all_enemies' | 'all_allies';
    dice?: string; // e.g. "3d4", "2d6"
    modifier?: number;
    status?: string; // For buffs that apply a status (e.g. 'hidden')
    attackBonus?: number; // For Aimed Shot
    damageBonus?: number; // For Aimed Shot
  };
}

// Ability state on an actor
export interface AbilityState {
  abilityId: string;
  currentCooldown: number; // 0 = ready
}

// Enemy definition for combat
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  power: number;
  damage: string; // dice expression like "1d6+2"
  ac: number;
  xp: number;
}

// Recruit definition (for intermission rooms)
export interface RecruitOption {
  id: string;
  name: string;
  role: 'fighter' | 'wizard' | 'rogue' | 'cleric';
  cost: number;
  description: string;
  level: number;  // Level scaling based on segment
}

// Room definition
export interface Room {
  id: string;
  type: RoomType;
  themeId: string;
  enemies: Enemy[];
  loot: Item[];
  shopItems?: Item[]; // For trader/intermission rooms
  availableRecruits?: RecruitOption[]; // For intermission rooms
}

// Equipment Slots
export type EquipmentSlot = 
  | 'head' | 'neck' | 'chest' | 'legs' | 'feet' 
  | 'main_hand' | 'off_hand' 
  | 'ring1' | 'ring2';

export type ItemType = 
  | 'head' | 'neck' | 'chest' | 'legs' | 'feet' 
  | 'weapon' | 'shield' // 'weapon' maps to main_hand usually, shield to off_hand
  | 'ring' | 'waist' | 'hands' | 'potion'; // Added waist/hands for completeness if managing RS style, but sticking to requested list for now except mapped types



export interface Skills {
  strength: number; // Melee Damage
  attack: number;   // Melee Hit Chance
  defense: number;  // AC Bonus
  magic: number;    // Magic Hit & Damage
  ranged: number;   // Ranged Hit & Damage
  faith: number;    // Healing & Shrine Luck
  agility: number;  // Escape chance & initiative
}

export interface Actor {
  id: string;
  name: string;
  role: Role;
  level: number;
  hp: Stats; // Current/Max Health
  stress: Stats; // Current/Max Stress (0-20)
  hitDice: { current: number; max: number; die: number }; // e.g. 1d8
  xp: number;
  statPoints: number; // Available points to spend
  skills: Skills;     // Current skills
  isAlive: boolean;
  spellSlots: Record<number, Stats>;
  equipment: Partial<Record<EquipmentSlot, Item>>;
  abilities: AbilityState[]; // Tracks cooldowns for each ability
  statuses: string[]; // Active status effects (e.g., 'hidden')
}

export interface ItemStats {
  attackBonus?: number;    // +to hit
  damageBonus?: number;    // +damage
  acBonus?: number;        // +AC  
  maxHpBonus?: number;     // +max HP
}

export interface Enchantment {
  tier: 1 | 2 | 3 | 4 | 5; // Minor to Godlike
  name: string;
  effect: ItemStats;
}

export interface Item {
  id: string;
  name: string;
  customName?: string; // Player-given name
  type: 'weapon' | 'armor' | 'ring' | 'shield' | 'neck' | 'feet' | 'legs' | 'head' | 'chest'; // TODO: match EquipmentSlot keys properly or keep mapped
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
  cost: number;
  baseStats: {
    attackBonus?: number;
    damageBonus?: number;
    acBonus?: number;
    maxHpBonus?: number;
  };
  enchantment?: {
    tier: 1 | 2 | 3 | 4 | 5; // Minor to Legendary
    name: string;
    description: string;
    effect: {
      attackBonus?: number;
      damageBonus?: number;
      acBonus?: number;
      maxHpBonus?: number;
    };
  };
  // Mastery Stats - tracked during combat
  stats?: {
      kills: number;
      damageDealt: number;
      highestHit: number;
      criticalHits: number;
      encountersUsed: number; // How many combats this item was equipped for
  };
  // History log for notable events
  history?: string[];
}

export interface PartyState {
  members: Actor[];
  gold: number;
}

export interface InventoryState {
  items: Item[];
  consumables: Item[]; // distinct type later?
}

export interface RunState {
  seed: string;
  depth: number; // rooms cleared. Starts at 0.
  // segmentIndex is derived: Math.floor(depth / 10)
  // roomInSegment is derived: (depth % 10) + 1
  themeId: string;
  shortRestsRemaining: number;
  longRestsTaken: number;
  party: PartyState;
  inventory: InventoryState;
  // The current room object (null when not in a room)
  // Storing the full Room allows us to track enemy HP during combat
  currentRoom: Room | null;
  roomResolved: boolean;
  // Combat state
  combatTurn: 'player' | 'enemy' | null;
  combatRound: number; // Current round in combat
  actedThisRound: string[]; // IDs of party members who have acted this round
  extraActions: number; // Extra actions granted (e.g., from Action Surge)
  // Game end states
  gameOver: boolean;
  victory: boolean; // true if just won a combat (for popup)
  shrineBoon: string | null; // Message to display after praying at shrine
  mutations: string[];
  history: string[]; // log of events
}

export type Action = 
  | { type: 'START_RUN'; seed: string }
  | { type: 'ADVANCE_ROOM' }
  | { type: 'TAKE_SHORT_REST'; actorIdsToHeal: string[] }
  | { type: 'RESOLVE_ROOM' }
  | { type: 'ATTACK'; attackerId: string; targetId: string }
  | { type: 'DISARM_TRAP' }
  | { type: 'TRIGGER_TRAP' }
  | { type: 'PRAY_AT_SHRINE' }
  | { type: 'DISMISS_POPUP' }
  | { type: 'BUY_ITEM'; itemId: string; cost: number } 
  | { type: 'SELL_ITEM'; itemId: string } 
  | { type: 'EQUIP_ITEM'; actorId: string; itemId: string; slot?: EquipmentSlot }
  | { type: 'HIRE_RECRUIT'; recruitId: string }
  | { type: 'ESCAPE' }
  | { type: 'RENAME_ITEM'; itemId: string; newName: string }
  | { type: 'UNEQUIP_ITEM'; actorId: string; slot: EquipmentSlot }
  | { type: 'USE_ABILITY'; actorId: string; abilityId: string; targetId?: string }
  | { type: 'TAKE_LONG_REST' }
  | { type: 'SPEND_STAT_POINT', actorId: string, stat: keyof Skills };
