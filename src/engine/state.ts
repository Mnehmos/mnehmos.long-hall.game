import type { RunState, Actor, Role, Item, Room, EquipmentSlot } from "./types";
import { getAbilitiesForRole } from "../content/abilities";
import { STARTING_SKILLS, getHitDie } from "../content/classes";
import { STARTER_EQUIPMENT, UNIVERSAL_STARTER, rollStartingWeaponRarity, getStartingWeapon } from "../content/tables";
import { SeededRNG } from "../core/rng";
import { hashWithSeed } from "../core/hash";

const SAVE_KEY = "the_long_hall_save";

// Room 0: Starting shrine that always grants a boon
const STARTING_SHRINE: Room = {
  id: "room-0",
  type: "shrine",
  themeId: "dungeon_start",
  enemies: [],
  loot: [],
};

export const INITIAL_HP: Record<Role, number> = {
  fighter: 12,
  wizard: 6,
  rogue: 8,
  cleric: 10,
  ranger: 10,
};

/**
 * Create an actor with the given role and level.
 * @param includeEquipment - If true, equips role-appropriate starter gear. Default false for main hero (manually equipped).
 */
export function createActor(
  id: string,
  name: string,
  role: Role,
  level: number = 1,
  includeEquipment: boolean = false
): Actor {
  const maxHp = INITIAL_HP[role] + (level - 1) * 4; // +4 HP per level
  const hitDieVal = getHitDie(role);

  // Build equipment from starter gear if requested
  const equipment: Partial<Record<EquipmentSlot, Item>> = {};
  if (includeEquipment && STARTER_EQUIPMENT[role]) {
    STARTER_EQUIPMENT[role].forEach((item) => {
      // Map item type to equipment slot
      const slot: EquipmentSlot =
        item.type === "weapon"
          ? "main_hand"
          : item.type === "shield"
          ? "off_hand"
          : (item.type as EquipmentSlot);
      // Create a unique copy for this actor
      equipment[slot] = { ...item, id: `${item.id}-${id}` };
    });
  }

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
    equipment,
    abilities: getAbilitiesForRole(role).map((a) => ({
      abilityId: a.id,
      currentCooldown: 0,
    })),
    statuses: [],
  };
}

export function createInitialRunState(seed: string): RunState {
  // Use seeded RNG for deterministic starting equipment
  const rng = new SeededRNG(hashWithSeed(seed, 0));

  const hero = createActor("hero-1", "Hero", "fighter");
  
  // Roll for starting weapon rarity (60% common, 25% uncommon, 10% rare, 4% epic, 1% legendary)
  const weaponRarity = rollStartingWeaponRarity(() => rng.float());
  const startingWeapon = getStartingWeapon("fighter", weaponRarity);
  
  // Equip weapon
  if (startingWeapon) {
    hero.equipment.main_hand = { ...startingWeapon, id: `${startingWeapon.id}-hero-1` };
  }
  
  // Equip universal starter gear (leather armor, boots, leggings)
  UNIVERSAL_STARTER.forEach((item) => {
    if (!item) return;
    const slot: EquipmentSlot =
      item.type === "chest" ? "chest"
      : item.type === "feet" ? "feet"
      : item.type === "legs" ? "legs"
      : (item.type as EquipmentSlot);
    hero.equipment[slot] = { ...item, id: `${item.id}-hero-1` };
  });
  
  // Build history message about starting gear
  const weaponMsg = startingWeapon 
    ? `You found a ${startingWeapon.name} (${weaponRarity})!` 
    : "You grip your fists, ready to fight.";

  return {
    seed,
    depth: 0,
    themeId: "dungeon_start",
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
    actedThisRound: [],
    extraActions: 0,
    gameOver: false,
    victory: false,
    shrineBoon: null,
    mutations: [],
    history: ["Run started.", weaponMsg, "You stand before an ancient shrine..."],
  };
}

// Save game state to localStorage
export function saveGameState(state: RunState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save game state:", e);
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
    console.warn("Failed to load game state:", e);
  }
  return null;
}

// Clear saved game state (called on game over)
export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn("Failed to clear game state:", e);
  }
}
