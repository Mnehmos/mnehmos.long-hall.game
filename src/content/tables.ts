import type { Item } from '../engine/types';

export type RoomType = 'combat' | 'elite' | 'hazard' | 'trader' | 'ally' | 'shrine' | 'intermission';

interface RoomWeight {
  type: RoomType;
  weight: number;
  minDepth?: number;
}

// Weights based on room-in-segment (1-10)
// Higher index = harder content
export function getRoomWeights(roomInSegment: number): RoomWeight[] {
  // Room 10 is always the "Boss" or "End of Segment" logic (handled explicitly in code usually)
  // But for 1-9:
  
  if (roomInSegment === 1) return [{ type: 'combat', weight: 10 }];

  const base: RoomWeight[] = [
    { type: 'combat', weight: 50 },
    { type: 'hazard', weight: 20 },
    { type: 'shrine', weight: 10 },
    { type: 'trader', weight: 10 },
  ];

  if (roomInSegment > 5) {
     base.push({ type: 'elite', weight: 10 + (roomInSegment * 2) });
  }

  return base;
}

export interface EnemyDef {
  id: string;
  name: string;
  tags: string[];
  power: number; // simplified challenge rating
  hp: number;
  damage: string; // "1d6+2"
}

export const ENEMIES: EnemyDef[] = [
  // Tier 1 - Early floors
  { id: 'rat_swarm', name: 'Rat Swarm', tags: ['vermin'], power: 1, hp: 8, damage: '1d4' },
  { id: 'slime', name: 'Green Slime', tags: ['slime'], power: 2, hp: 12, damage: '1d6' },
  { id: 'giant_spider', name: 'Giant Spider', tags: ['vermin', 'beast'], power: 2, hp: 10, damage: '1d6' },
  { id: 'kobold', name: 'Kobold', tags: ['humanoid'], power: 1, hp: 6, damage: '1d4+1' },
  
  // Tier 2 - Mid floors  
  { id: 'skeleton', name: 'Skeleton Warrior', tags: ['undead', 'skeleton'], power: 3, hp: 12, damage: '1d6+1' },
  { id: 'zombie', name: 'Rotting Zombie', tags: ['undead'], power: 2, hp: 14, damage: '1d6' },
  { id: 'cultist', name: 'Dark Cultist', tags: ['humanoid', 'magic'], power: 3, hp: 10, damage: '1d8' },
  { id: 'dire_wolf', name: 'Dire Wolf', tags: ['beast'], power: 3, hp: 15, damage: '1d6+2' },
  
  // Tier 3 - Tough enemies
  { id: 'orc', name: 'Orc Berserker', tags: ['humanoid', 'orc'], power: 4, hp: 18, damage: '1d8+2' },
  { id: 'ghoul', name: 'Ghoul', tags: ['undead'], power: 4, hp: 16, damage: '1d8+1' },
  { id: 'ogre', name: 'Ogre', tags: ['giant'], power: 5, hp: 25, damage: '2d6' },
  { id: 'wraith', name: 'Wraith', tags: ['undead', 'incorporeal'], power: 5, hp: 14, damage: '1d10' },
];

export const ITEMS: Item[] = [
    // Weapons (Main Hand)
    { id: 'sword_common', name: 'Iron Sword', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'axe_common', name: 'Hand Axe', type: 'weapon', rarity: 'common', cost: 12, baseStats: { damageBonus: 2 } },
    { id: 'staff_common', name: 'Wooden Staff', type: 'weapon', rarity: 'common', cost: 10, baseStats: { attackBonus: 2 } },
    { id: 'sword_rare', name: 'Steel Longsword', type: 'weapon', rarity: 'uncommon', cost: 30, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'dagger_rare', name: 'Assassin Dagger', type: 'weapon', rarity: 'rare', cost: 45, baseStats: { attackBonus: 3, damageBonus: 3 } },
    
    // Armor (Chest)
    { id: 'leather_armor', name: 'Leather Armor', type: 'chest', rarity: 'common', cost: 20, baseStats: { acBonus: 1 } },
    { id: 'chain_mail', name: 'Chain Mail', type: 'chest', rarity: 'uncommon', cost: 35, baseStats: { acBonus: 2 } },
    { id: 'plate_armor', name: 'Plate Armor', type: 'chest', rarity: 'rare', cost: 60, baseStats: { acBonus: 3, maxHpBonus: 4 } },
    
    // Other Slots (New for Milestone 5)
    { id: 'helm_iron', name: 'Iron Helm', type: 'head', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
    { id: 'boots_leather', name: 'Leather Boots', type: 'feet', rarity: 'common', cost: 10, baseStats: { maxHpBonus: 2 } },
    { id: 'shield_wood', name: 'Wooden Shield', type: 'shield', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
    
    // Trinkets (Rings/Neck)
    { id: 'ring_vit', name: 'Ring of Vitality', type: 'ring', rarity: 'uncommon', cost: 25, baseStats: { maxHpBonus: 4 } },
    { id: 'amulet_str', name: 'Amulet of Strength', type: 'neck', rarity: 'rare', cost: 40, baseStats: { damageBonus: 2, attackBonus: 1 } },
    { id: 'charm_luck', name: 'Lucky Charm', type: 'neck', rarity: 'common', cost: 15, baseStats: { attackBonus: 1 } },
];

// Recruits available for hire at intermission
export interface RecruitDef {
    id: string;
    name: string;
    role: 'fighter' | 'wizard' | 'rogue' | 'cleric';
    cost: number;
    description: string;
    level?: number;  // Optional level (set during room generation based on segment)
}

export const RECRUITS: RecruitDef[] = [
    { id: 'recruit_fighter', name: 'Sir Roland', role: 'fighter', cost: 30, description: 'A veteran knight seeking glory.' },
    { id: 'recruit_wizard', name: 'Elara the Wise', role: 'wizard', cost: 40, description: 'A scholar of the arcane arts.' },
    { id: 'recruit_rogue', name: 'Shadow', role: 'rogue', cost: 25, description: 'A thief with quick reflexes.' },
    { id: 'recruit_cleric', name: 'Brother Marcus', role: 'cleric', cost: 35, description: 'A holy man with healing touch.' },
    { id: 'recruit_fighter2', name: 'Greta the Strong', role: 'fighter', cost: 30, description: 'A barbarian from the north.' },
    { id: 'recruit_wizard2', name: 'Merlin Jr.', role: 'wizard', cost: 45, description: 'A prodigy of magical talent.' },
];

// Enchantment name suffixes by slot
export const ENCHANT_NAMES: Record<string, string[][]> = {
    weapon: [
        ['of Striking'],           // Tier 1
        ['of Wounding'],          // Tier 2
        ['of Slaying'],           // Tier 3
        ['of Destruction'],       // Tier 4
        ['of the Divine'],        // Tier 5
    ],
    armor: [
        ['of Protection'],        // Tier 1
        ['of Warding'],          // Tier 2
        ['of the Fortress'],     // Tier 3
        ['of Invulnerability'],  // Tier 4
        ['of Immortality'],      // Tier 5
    ],
    trinket: [
        ['of Power'],            // Tier 1
        ['of Might'],           // Tier 2
        ['of Glory'],           // Tier 3
        ['of Legends'],         // Tier 4
        ['of the Gods'],        // Tier 5
    ],
};

// Helper to calculate total stats from item (base + enchant)
export function getItemTotalStats(item: Item): { attackBonus: number; damageBonus: number; acBonus: number; maxHpBonus: number } {
    const base = item.baseStats;
    const enchant = item.enchantment?.effect || {};
    return {
        attackBonus: (base.attackBonus || 0) + (enchant.attackBonus || 0),
        damageBonus: (base.damageBonus || 0) + (enchant.damageBonus || 0),
        acBonus: (base.acBonus || 0) + (enchant.acBonus || 0),
        maxHpBonus: (base.maxHpBonus || 0) + (enchant.maxHpBonus || 0),
    };
}

// ============================================================================
// MONSTER DROP TABLES
// ============================================================================

// Item drop configuration by enemy power tier
export const DROP_TABLES = {
    // Power 1-2: 5% chance for common items
    low: { chance: 0.05, pool: ['sword_common', 'axe_common', 'staff_common', 'leather_armor', 'helm_iron', 'boots_leather', 'shield_wood'] },
    // Power 3-4: 10% chance, uncommon possible
    mid: { chance: 0.10, pool: ['sword_rare', 'chain_mail', 'ring_vit', 'charm_luck'] },
    // Power 5+: 15% chance, rare possible
    high: { chance: 0.15, pool: ['dagger_rare', 'plate_armor', 'amulet_str'] }
};

/**
 * Roll for an item drop from an enemy based on its power level.
 * Returns a copy of the item with a unique ID, or null if no drop.
 */
export function getDropForEnemy(enemyPower: number, rng: () => number): Item | null {
    const tier = enemyPower <= 2 ? 'low' : enemyPower <= 4 ? 'mid' : 'high';
    const config = DROP_TABLES[tier];
    
    if (rng() > config.chance) return null;
    
    // Pick random item from pool
    const itemId = config.pool[Math.floor(rng() * config.pool.length)];
    const itemDef = ITEMS.find(i => i.id === itemId);
    if (!itemDef) return null;
    
    // Return a copy with unique ID for tracking
    return {
        ...itemDef,
        id: `drop-${itemId}-${Date.now()}`
    };
}

// ============================================================================
// STARTER EQUIPMENT BY ROLE
// ============================================================================

// Role-appropriate starting equipment for recruits
export const STARTER_EQUIPMENT: Record<string, Item[]> = {
    fighter: [
        { id: 'starter_sword', name: 'Iron Sword', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
        { id: 'starter_shield', name: 'Wooden Shield', type: 'shield', rarity: 'common', cost: 10, baseStats: { acBonus: 1 } }
    ],
    wizard: [
        { id: 'starter_staff', name: 'Oak Staff', type: 'weapon', rarity: 'common', cost: 10, baseStats: { attackBonus: 2 } }
    ],
    rogue: [
        { id: 'starter_dagger', name: 'Sharp Dagger', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 1, damageBonus: 1 } },
        { id: 'starter_leather', name: 'Leather Vest', type: 'chest', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } }
    ],
    cleric: [
        { id: 'starter_mace', name: 'Holy Mace', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
        { id: 'starter_robe', name: 'Clerical Robe', type: 'chest', rarity: 'common', cost: 12, baseStats: { maxHpBonus: 2 } }
    ],
    ranger: [
        { id: 'starter_bow', name: 'Short Bow', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 2 } },
        { id: 'starter_cloak', name: 'Ranger Cloak', type: 'chest', rarity: 'common', cost: 10, baseStats: { acBonus: 1 } }
    ]
};
