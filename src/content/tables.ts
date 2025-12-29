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
  // ============================================================================
  // TIER 1 - Power 1-2: Early floors, weak enemies
  // ============================================================================
  { id: 'rat_swarm', name: 'Rat Swarm', tags: ['vermin', 'beast'], power: 1, hp: 8, damage: '1d4' },
  { id: 'giant_rat', name: 'Giant Rat', tags: ['vermin', 'beast'], power: 1, hp: 6, damage: '1d4' },
  { id: 'kobold', name: 'Kobold', tags: ['humanoid', 'kobold'], power: 1, hp: 6, damage: '1d4+1' },
  { id: 'goblin', name: 'Goblin', tags: ['humanoid', 'goblin'], power: 1, hp: 7, damage: '1d4+1' },
  { id: 'slime', name: 'Green Slime', tags: ['slime', 'ooze'], power: 2, hp: 12, damage: '1d6' },
  { id: 'giant_spider', name: 'Giant Spider', tags: ['vermin', 'beast'], power: 2, hp: 10, damage: '1d6' },
  { id: 'stirge', name: 'Stirge', tags: ['vermin', 'beast'], power: 1, hp: 4, damage: '1d4' },
  { id: 'bandit', name: 'Bandit', tags: ['humanoid'], power: 2, hp: 11, damage: '1d6' },

  // ============================================================================
  // TIER 2 - Power 3-4: Mid-early floors
  // ============================================================================
  { id: 'skeleton', name: 'Skeleton Warrior', tags: ['undead', 'skeleton'], power: 3, hp: 12, damage: '1d6+1' },
  { id: 'zombie', name: 'Rotting Zombie', tags: ['undead', 'zombie'], power: 3, hp: 14, damage: '1d6' },
  { id: 'dire_wolf', name: 'Dire Wolf', tags: ['beast'], power: 3, hp: 15, damage: '1d6+2' },
  { id: 'hobgoblin', name: 'Hobgoblin', tags: ['humanoid', 'goblin'], power: 3, hp: 14, damage: '1d8' },
  { id: 'gnoll', name: 'Gnoll Hunter', tags: ['humanoid', 'gnoll'], power: 3, hp: 16, damage: '1d8' },
  { id: 'cultist', name: 'Dark Cultist', tags: ['humanoid', 'magic'], power: 3, hp: 10, damage: '1d8' },
  { id: 'bugbear', name: 'Bugbear', tags: ['humanoid', 'goblin'], power: 4, hp: 18, damage: '1d8+1' },
  { id: 'harpy', name: 'Harpy', tags: ['monstrosity', 'flying'], power: 4, hp: 14, damage: '1d6+2' },

  // ============================================================================
  // TIER 3 - Power 5-6: Mid floors, challenging enemies
  // ============================================================================
  { id: 'orc', name: 'Orc Berserker', tags: ['humanoid', 'orc'], power: 5, hp: 18, damage: '1d8+2' },
  { id: 'ghoul', name: 'Ghoul', tags: ['undead'], power: 5, hp: 16, damage: '1d8+1' },
  { id: 'wight', name: 'Wight', tags: ['undead'], power: 5, hp: 20, damage: '1d10' },
  { id: 'owlbear', name: 'Owlbear', tags: ['beast', 'monstrosity'], power: 5, hp: 22, damage: '1d10+2' },
  { id: 'minotaur', name: 'Minotaur', tags: ['monstrosity'], power: 6, hp: 28, damage: '2d6' },
  { id: 'werewolf', name: 'Werewolf', tags: ['humanoid', 'shapechanger'], power: 6, hp: 24, damage: '1d10+2' },
  { id: 'troll', name: 'Troll', tags: ['giant'], power: 6, hp: 30, damage: '2d6+2' },
  { id: 'wraith', name: 'Wraith', tags: ['undead', 'incorporeal'], power: 6, hp: 18, damage: '1d10+2' },

  // ============================================================================
  // TIER 4 - Power 7-8: Deep floors, dangerous enemies
  // ============================================================================
  { id: 'ogre', name: 'Ogre', tags: ['giant'], power: 7, hp: 32, damage: '2d6+2' },
  { id: 'ettin', name: 'Ettin', tags: ['giant'], power: 7, hp: 36, damage: '2d8' },
  { id: 'vampire_spawn', name: 'Vampire Spawn', tags: ['undead', 'vampire'], power: 7, hp: 28, damage: '1d10+3' },
  { id: 'manticore', name: 'Manticore', tags: ['monstrosity', 'flying'], power: 7, hp: 30, damage: '2d6+2' },
  { id: 'hill_giant', name: 'Hill Giant', tags: ['giant'], power: 8, hp: 45, damage: '2d8+3' },
  { id: 'flesh_golem', name: 'Flesh Golem', tags: ['construct'], power: 8, hp: 40, damage: '2d8+2' },
  { id: 'chimera', name: 'Chimera', tags: ['monstrosity', 'flying'], power: 8, hp: 38, damage: '2d8+2' },
  { id: 'oni', name: 'Oni', tags: ['giant', 'magic'], power: 8, hp: 35, damage: '2d8+3' },

  // ============================================================================
  // TIER 5 - Power 9-10: Late floors, elite enemies
  // ============================================================================
  { id: 'frost_giant', name: 'Frost Giant', tags: ['giant'], power: 9, hp: 55, damage: '3d6+4' },
  { id: 'fire_giant', name: 'Fire Giant', tags: ['giant'], power: 9, hp: 50, damage: '3d6+4' },
  { id: 'young_dragon', name: 'Young Dragon', tags: ['dragon', 'flying'], power: 9, hp: 48, damage: '2d10+3' },
  { id: 'beholder_zombie', name: 'Beholder Zombie', tags: ['undead', 'aberration'], power: 9, hp: 40, damage: '2d10' },
  { id: 'mind_flayer', name: 'Mind Flayer', tags: ['aberration', 'magic'], power: 10, hp: 42, damage: '2d10+4' },
  { id: 'death_knight', name: 'Death Knight', tags: ['undead', 'knight'], power: 10, hp: 60, damage: '2d10+5' },
  { id: 'stone_giant', name: 'Stone Giant', tags: ['giant'], power: 10, hp: 65, damage: '3d8+4' },

  // ============================================================================
  // TIER 6 - Power 11+: Boss tier, extremely dangerous
  // ============================================================================
  { id: 'adult_dragon', name: 'Adult Dragon', tags: ['dragon', 'flying', 'boss'], power: 12, hp: 120, damage: '3d10+6' },
  { id: 'lich', name: 'Lich', tags: ['undead', 'magic', 'boss'], power: 12, hp: 80, damage: '3d8+6' },
  { id: 'vampire_lord', name: 'Vampire Lord', tags: ['undead', 'vampire', 'boss'], power: 11, hp: 85, damage: '2d12+5' },
  { id: 'beholder', name: 'Beholder', tags: ['aberration', 'boss'], power: 11, hp: 75, damage: '2d10+5' },
  { id: 'demon_lord', name: 'Demon Lord', tags: ['fiend', 'demon', 'boss'], power: 13, hp: 100, damage: '3d10+8' },
  { id: 'storm_giant', name: 'Storm Giant', tags: ['giant', 'boss'], power: 12, hp: 110, damage: '3d10+6' },
];

export const ITEMS: Item[] = [
    // ============================================================================
    // FIGHTER EQUIPMENT (Swords, Heavy Armor)
    // ============================================================================
    // Weapons
    { id: 'fighter_sword_common', name: 'Iron Sword', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'fighter_sword_uncommon', name: 'Steel Longsword', type: 'weapon', rarity: 'uncommon', cost: 35, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'fighter_sword_rare', name: "Knight's Blade", type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'fighter_sword_epic', name: 'Dragonslayer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'fighter_sword_legendary', name: 'Excalibur', type: 'weapon', rarity: 'legendary', cost: 280, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'fighter_sword_godly', name: 'Godsteel Blade', type: 'weapon', rarity: 'godly', cost: 600, baseStats: { attackBonus: 7, damageBonus: 7 } },
    // Armor
    { id: 'fighter_armor_common', name: 'Chainmail', type: 'chest', rarity: 'common', cost: 20, baseStats: { acBonus: 1 } },
    { id: 'fighter_armor_uncommon', name: 'Plate Armor', type: 'chest', rarity: 'uncommon', cost: 45, baseStats: { acBonus: 2, maxHpBonus: 2 } },
    { id: 'fighter_armor_rare', name: 'Crusader Plate', type: 'chest', rarity: 'rare', cost: 90, baseStats: { acBonus: 3, maxHpBonus: 4 } },
    { id: 'fighter_armor_epic', name: 'Dragon Scale', type: 'chest', rarity: 'epic', cost: 180, baseStats: { acBonus: 4, maxHpBonus: 6 } },
    { id: 'fighter_armor_legendary', name: "Titan's Aegis", type: 'chest', rarity: 'legendary', cost: 350, baseStats: { acBonus: 5, maxHpBonus: 8 } },
    { id: 'fighter_armor_godly', name: 'Armor of the Valkyrie', type: 'chest', rarity: 'godly', cost: 700, baseStats: { acBonus: 7, maxHpBonus: 12 } },

    // ============================================================================
    // WIZARD EQUIPMENT (Staffs, Robes)
    // ============================================================================
    // Weapons
    { id: 'wizard_staff_common', name: 'Oak Staff', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 2 } },
    { id: 'wizard_staff_uncommon', name: 'Arcane Staff', type: 'weapon', rarity: 'uncommon', cost: 30, baseStats: { attackBonus: 3, damageBonus: 1 } },
    { id: 'wizard_staff_rare', name: 'Staff of Flames', type: 'weapon', rarity: 'rare', cost: 65, baseStats: { attackBonus: 4, damageBonus: 2 } },
    { id: 'wizard_staff_epic', name: 'Voidwalker Staff', type: 'weapon', rarity: 'epic', cost: 130, baseStats: { attackBonus: 5, damageBonus: 3 } },
    { id: 'wizard_staff_legendary', name: 'Staff of Infinite Power', type: 'weapon', rarity: 'legendary', cost: 260, baseStats: { attackBonus: 6, damageBonus: 4 } },
    { id: 'wizard_staff_godly', name: 'Cosmic Conduit', type: 'weapon', rarity: 'godly', cost: 550, baseStats: { attackBonus: 8, damageBonus: 6 } },
    // Armor
    { id: 'wizard_robe_common', name: 'Apprentice Robe', type: 'chest', rarity: 'common', cost: 15, baseStats: { maxHpBonus: 2 } },
    { id: 'wizard_robe_uncommon', name: 'Mage Robe', type: 'chest', rarity: 'uncommon', cost: 35, baseStats: { maxHpBonus: 4, attackBonus: 1 } },
    { id: 'wizard_robe_rare', name: 'Archmage Vestments', type: 'chest', rarity: 'rare', cost: 75, baseStats: { maxHpBonus: 6, attackBonus: 2 } },
    { id: 'wizard_robe_epic', name: 'Ethereal Robe', type: 'chest', rarity: 'epic', cost: 150, baseStats: { maxHpBonus: 8, attackBonus: 3 } },
    { id: 'wizard_robe_legendary', name: 'Robe of the Arcane', type: 'chest', rarity: 'legendary', cost: 300, baseStats: { maxHpBonus: 10, attackBonus: 4 } },
    { id: 'wizard_robe_godly', name: 'Astral Vestments', type: 'chest', rarity: 'godly', cost: 650, baseStats: { maxHpBonus: 15, attackBonus: 6 } },

    // ============================================================================
    // ROGUE EQUIPMENT (Daggers, Leather)
    // ============================================================================
    // Weapons
    { id: 'rogue_dagger_common', name: 'Sharp Dagger', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'rogue_dagger_uncommon', name: 'Assassin Blade', type: 'weapon', rarity: 'uncommon', cost: 32, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'rogue_dagger_rare', name: 'Shadowstrike', type: 'weapon', rarity: 'rare', cost: 68, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'rogue_dagger_epic', name: 'Venom Fang', type: 'weapon', rarity: 'epic', cost: 135, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'rogue_dagger_legendary', name: 'Deathwhisper', type: 'weapon', rarity: 'legendary', cost: 270, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'rogue_dagger_godly', name: 'Midnight Edge', type: 'weapon', rarity: 'godly', cost: 580, baseStats: { attackBonus: 7, damageBonus: 7 } },
    // Armor
    { id: 'rogue_armor_common', name: 'Leather Vest', type: 'chest', rarity: 'common', cost: 18, baseStats: { acBonus: 1 } },
    { id: 'rogue_armor_uncommon', name: "Thieves' Garb", type: 'chest', rarity: 'uncommon', cost: 40, baseStats: { acBonus: 2 } },
    { id: 'rogue_armor_rare', name: 'Nightstalker Leather', type: 'chest', rarity: 'rare', cost: 85, baseStats: { acBonus: 3, attackBonus: 1 } },
    { id: 'rogue_armor_epic', name: "Assassin's Shroud", type: 'chest', rarity: 'epic', cost: 170, baseStats: { acBonus: 4, attackBonus: 2 } },
    { id: 'rogue_armor_legendary', name: 'Shadow Walker Armor', type: 'chest', rarity: 'legendary', cost: 340, baseStats: { acBonus: 5, attackBonus: 3 } },
    { id: 'rogue_armor_godly', name: 'Cloak of Invisibility', type: 'chest', rarity: 'godly', cost: 680, baseStats: { acBonus: 7, attackBonus: 5 } },

    // ============================================================================
    // CLERIC EQUIPMENT (Maces, Vestments)
    // ============================================================================
    // Weapons
    { id: 'cleric_mace_common', name: 'Holy Mace', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'cleric_mace_uncommon', name: 'Blessed Hammer', type: 'weapon', rarity: 'uncommon', cost: 35, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'cleric_mace_rare', name: 'Divine Scepter', type: 'weapon', rarity: 'rare', cost: 72, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'cleric_mace_epic', name: 'Judgment', type: 'weapon', rarity: 'epic', cost: 145, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'cleric_mace_legendary', name: 'Hand of God', type: 'weapon', rarity: 'legendary', cost: 290, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'cleric_mace_godly', name: "Heaven's Wrath", type: 'weapon', rarity: 'godly', cost: 620, baseStats: { attackBonus: 7, damageBonus: 7 } },
    // Armor
    { id: 'cleric_armor_common', name: 'Clerical Robe', type: 'chest', rarity: 'common', cost: 18, baseStats: { maxHpBonus: 3 } },
    { id: 'cleric_armor_uncommon', name: 'Priest Vestments', type: 'chest', rarity: 'uncommon', cost: 42, baseStats: { maxHpBonus: 5, acBonus: 1 } },
    { id: 'cleric_armor_rare', name: 'Holy Raiment', type: 'chest', rarity: 'rare', cost: 88, baseStats: { maxHpBonus: 7, acBonus: 2 } },
    { id: 'cleric_armor_epic', name: 'Blessed Plate', type: 'chest', rarity: 'epic', cost: 175, baseStats: { maxHpBonus: 9, acBonus: 3 } },
    { id: 'cleric_armor_legendary', name: 'Divine Aegis', type: 'chest', rarity: 'legendary', cost: 360, baseStats: { maxHpBonus: 12, acBonus: 4 } },
    { id: 'cleric_armor_godly', name: 'Celestial Vestments', type: 'chest', rarity: 'godly', cost: 720, baseStats: { maxHpBonus: 18, acBonus: 6 } },

    // ============================================================================
    // RANGER EQUIPMENT (Bows, Cloaks)
    // ============================================================================
    // Weapons
    { id: 'ranger_bow_common', name: 'Short Bow', type: 'weapon', rarity: 'common', cost: 14, baseStats: { attackBonus: 2 } },
    { id: 'ranger_bow_uncommon', name: 'Longbow', type: 'weapon', rarity: 'uncommon', cost: 34, baseStats: { attackBonus: 3, damageBonus: 1 } },
    { id: 'ranger_bow_rare', name: 'Elven Bow', type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 4, damageBonus: 2 } },
    { id: 'ranger_bow_epic', name: 'Windpiercer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 5, damageBonus: 3 } },
    { id: 'ranger_bow_legendary', name: 'Heartseeker', type: 'weapon', rarity: 'legendary', cost: 280, baseStats: { attackBonus: 6, damageBonus: 4 } },
    { id: 'ranger_bow_godly', name: 'Star Shot', type: 'weapon', rarity: 'godly', cost: 600, baseStats: { attackBonus: 8, damageBonus: 6 } },
    // Armor
    { id: 'ranger_armor_common', name: 'Ranger Cloak', type: 'chest', rarity: 'common', cost: 16, baseStats: { acBonus: 1 } },
    { id: 'ranger_armor_uncommon', name: "Hunter's Mail", type: 'chest', rarity: 'uncommon', cost: 38, baseStats: { acBonus: 2 } },
    { id: 'ranger_armor_rare', name: 'Woodland Armor', type: 'chest', rarity: 'rare', cost: 80, baseStats: { acBonus: 3, attackBonus: 1 } },
    { id: 'ranger_armor_epic', name: 'Beast Hunter Gear', type: 'chest', rarity: 'epic', cost: 160, baseStats: { acBonus: 4, attackBonus: 2 } },
    { id: 'ranger_armor_legendary', name: "Nature's Warden", type: 'chest', rarity: 'legendary', cost: 320, baseStats: { acBonus: 5, attackBonus: 3 } },
    { id: 'ranger_armor_godly', name: 'Avatar of the Wild', type: 'chest', rarity: 'godly', cost: 660, baseStats: { acBonus: 7, attackBonus: 5 } },

    // ============================================================================
    // UNIVERSAL ACCESSORIES (Head, Shield, Ring, Neck, Feet, Legs)
    // ============================================================================
    // HEAD
    { id: 'helm_common', name: 'Iron Helm', type: 'head', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
    { id: 'helm_uncommon', name: 'Steel Helm', type: 'head', rarity: 'uncommon', cost: 35, baseStats: { acBonus: 2 } },
    { id: 'helm_rare', name: "Knight's Helm", type: 'head', rarity: 'rare', cost: 70, baseStats: { acBonus: 3 } },
    { id: 'helm_epic', name: 'Dragon Helm', type: 'head', rarity: 'epic', cost: 140, baseStats: { acBonus: 4, maxHpBonus: 4 } },
    { id: 'helm_legendary', name: 'Crown of Kings', type: 'head', rarity: 'legendary', cost: 280, baseStats: { acBonus: 5, maxHpBonus: 6 } },
    { id: 'helm_godly', name: 'Halo of Divinity', type: 'head', rarity: 'godly', cost: 580, baseStats: { acBonus: 7, maxHpBonus: 10 } },

    // SHIELD
    { id: 'shield_common', name: 'Wooden Shield', type: 'shield', rarity: 'common', cost: 15, baseStats: { acBonus: 1 } },
    { id: 'shield_uncommon', name: 'Iron Shield', type: 'shield', rarity: 'uncommon', cost: 35, baseStats: { acBonus: 2 } },
    { id: 'shield_rare', name: 'Tower Shield', type: 'shield', rarity: 'rare', cost: 72, baseStats: { acBonus: 3, maxHpBonus: 2 } },
    { id: 'shield_epic', name: 'Aegis', type: 'shield', rarity: 'epic', cost: 145, baseStats: { acBonus: 4, maxHpBonus: 4 } },
    { id: 'shield_legendary', name: 'Bulwark', type: 'shield', rarity: 'legendary', cost: 290, baseStats: { acBonus: 5, maxHpBonus: 6 } },
    { id: 'shield_godly', name: 'Shield of the Gods', type: 'shield', rarity: 'godly', cost: 600, baseStats: { acBonus: 7, maxHpBonus: 10 } },

    // RING
    { id: 'ring_common', name: 'Ring of Vigor', type: 'ring', rarity: 'common', cost: 18, baseStats: { maxHpBonus: 2 } },
    { id: 'ring_uncommon', name: 'Ring of Power', type: 'ring', rarity: 'uncommon', cost: 40, baseStats: { maxHpBonus: 4, damageBonus: 1 } },
    { id: 'ring_rare', name: 'Ring of Mastery', type: 'ring', rarity: 'rare', cost: 85, baseStats: { maxHpBonus: 6, damageBonus: 2 } },
    { id: 'ring_epic', name: 'Ring of Legends', type: 'ring', rarity: 'epic', cost: 170, baseStats: { maxHpBonus: 8, damageBonus: 3, attackBonus: 1 } },
    { id: 'ring_legendary', name: 'Ring of Eternity', type: 'ring', rarity: 'legendary', cost: 340, baseStats: { maxHpBonus: 10, damageBonus: 4, attackBonus: 2 } },
    { id: 'ring_godly', name: 'Godring', type: 'ring', rarity: 'godly', cost: 700, baseStats: { maxHpBonus: 15, damageBonus: 6, attackBonus: 4 } },

    // NECK
    { id: 'neck_common', name: 'Lucky Charm', type: 'neck', rarity: 'common', cost: 15, baseStats: { attackBonus: 1 } },
    { id: 'neck_uncommon', name: 'Amulet of Strength', type: 'neck', rarity: 'uncommon', cost: 38, baseStats: { attackBonus: 1, damageBonus: 2 } },
    { id: 'neck_rare', name: 'Amulet of Power', type: 'neck', rarity: 'rare', cost: 78, baseStats: { attackBonus: 2, damageBonus: 3 } },
    { id: 'neck_epic', name: 'Heart of the Dragon', type: 'neck', rarity: 'epic', cost: 160, baseStats: { attackBonus: 3, damageBonus: 4, maxHpBonus: 4 } },
    { id: 'neck_legendary', name: 'Star of Souls', type: 'neck', rarity: 'legendary', cost: 320, baseStats: { attackBonus: 4, damageBonus: 5, maxHpBonus: 6 } },
    { id: 'neck_godly', name: 'Divine Pendant', type: 'neck', rarity: 'godly', cost: 680, baseStats: { attackBonus: 6, damageBonus: 7, maxHpBonus: 10 } },

    // FEET
    { id: 'boots_common', name: 'Leather Boots', type: 'feet', rarity: 'common', cost: 12, baseStats: { maxHpBonus: 2 } },
    { id: 'boots_uncommon', name: 'Iron Boots', type: 'feet', rarity: 'uncommon', cost: 30, baseStats: { maxHpBonus: 4 } },
    { id: 'boots_rare', name: 'Boots of Speed', type: 'feet', rarity: 'rare', cost: 65, baseStats: { maxHpBonus: 6, attackBonus: 1 } },
    { id: 'boots_epic', name: 'Boots of Flight', type: 'feet', rarity: 'epic', cost: 130, baseStats: { maxHpBonus: 8, attackBonus: 2 } },
    { id: 'boots_legendary', name: 'Winged Boots', type: 'feet', rarity: 'legendary', cost: 260, baseStats: { maxHpBonus: 10, attackBonus: 3 } },
    { id: 'boots_godly', name: 'Boots of the Cosmos', type: 'feet', rarity: 'godly', cost: 550, baseStats: { maxHpBonus: 15, attackBonus: 5 } },

    // LEGS
    { id: 'legs_common', name: 'Leather Leggings', type: 'legs', rarity: 'common', cost: 14, baseStats: { acBonus: 1 } },
    { id: 'legs_uncommon', name: 'Chain Leggings', type: 'legs', rarity: 'uncommon', cost: 32, baseStats: { acBonus: 2 } },
    { id: 'legs_rare', name: 'Plated Greaves', type: 'legs', rarity: 'rare', cost: 68, baseStats: { acBonus: 3, maxHpBonus: 2 } },
    { id: 'legs_epic', name: 'Dragon Greaves', type: 'legs', rarity: 'epic', cost: 135, baseStats: { acBonus: 4, maxHpBonus: 4 } },
    { id: 'legs_legendary', name: "Titan's Legguards", type: 'legs', rarity: 'legendary', cost: 270, baseStats: { acBonus: 5, maxHpBonus: 6 } },
    { id: 'legs_godly', name: 'Celestial Greaves', type: 'legs', rarity: 'godly', cost: 580, baseStats: { acBonus: 7, maxHpBonus: 10 } },
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

// Enchantment name suffixes by slot (6 Tiers: Common to Godly)
export const ENCHANT_NAMES: Record<string, string[][]> = {
    weapon: [
        ['of Striking'],           // Tier 1 - Common
        ['of Wounding'],           // Tier 2 - Uncommon
        ['of Slaying'],            // Tier 3 - Rare
        ['of Destruction'],        // Tier 4 - Epic
        ['of Annihilation'],       // Tier 5 - Legendary
        ['of the Apocalypse'],     // Tier 6 - Godly
    ],
    armor: [
        ['of Protection'],         // Tier 1
        ['of Warding'],            // Tier 2
        ['of the Fortress'],       // Tier 3
        ['of Invulnerability'],    // Tier 4
        ['of Immortality'],        // Tier 5
        ['of the Divine Aegis'],   // Tier 6
    ],
    trinket: [
        ['of Power'],              // Tier 1
        ['of Might'],              // Tier 2
        ['of Glory'],              // Tier 3
        ['of Legends'],            // Tier 4
        ['of Eternity'],           // Tier 5
        ['of the Gods'],           // Tier 6
    ],
    utility: [
        ['of Fortune'],            // Tier 1 - Escape/Luck
        ['of Swiftness'],          // Tier 2 - Escape
        ['of Prosperity'],         // Tier 3 - Gold
        ['of the Windwalker'],     // Tier 4 - Escape + Stats
        ['of the Midas Touch'],    // Tier 5 - Gold + Loot
        ['of the Cosmic Wanderer'],// Tier 6 - All Utility
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

// Item drop configuration by enemy power tier and source type
// All classes' weapons + universal accessories in pools
const COMMON_POOL = [
    'fighter_sword_common', 'wizard_staff_common', 'rogue_dagger_common', 'cleric_mace_common', 'ranger_bow_common',
    'fighter_armor_common', 'wizard_robe_common', 'rogue_armor_common', 'cleric_armor_common', 'ranger_armor_common',
    'helm_common', 'shield_common', 'ring_common', 'neck_common', 'boots_common', 'legs_common'
];
const UNCOMMON_POOL = [
    'fighter_sword_uncommon', 'wizard_staff_uncommon', 'rogue_dagger_uncommon', 'cleric_mace_uncommon', 'ranger_bow_uncommon',
    'fighter_armor_uncommon', 'wizard_robe_uncommon', 'rogue_armor_uncommon', 'cleric_armor_uncommon', 'ranger_armor_uncommon',
    'helm_uncommon', 'shield_uncommon', 'ring_uncommon', 'neck_uncommon', 'boots_uncommon', 'legs_uncommon'
];
const RARE_POOL = [
    'fighter_sword_rare', 'wizard_staff_rare', 'rogue_dagger_rare', 'cleric_mace_rare', 'ranger_bow_rare',
    'fighter_armor_rare', 'wizard_robe_rare', 'rogue_armor_rare', 'cleric_armor_rare', 'ranger_armor_rare',
    'helm_rare', 'shield_rare', 'ring_rare', 'neck_rare', 'boots_rare', 'legs_rare'
];
const EPIC_POOL = [
    'fighter_sword_epic', 'wizard_staff_epic', 'rogue_dagger_epic', 'cleric_mace_epic', 'ranger_bow_epic',
    'fighter_armor_epic', 'wizard_robe_epic', 'rogue_armor_epic', 'cleric_armor_epic', 'ranger_armor_epic',
    'helm_epic', 'shield_epic', 'ring_epic', 'neck_epic', 'boots_epic', 'legs_epic'
];
const LEGENDARY_POOL = [
    'fighter_sword_legendary', 'wizard_staff_legendary', 'rogue_dagger_legendary', 'cleric_mace_legendary', 'ranger_bow_legendary',
    'fighter_armor_legendary', 'wizard_robe_legendary', 'rogue_armor_legendary', 'cleric_armor_legendary', 'ranger_armor_legendary',
    'helm_legendary', 'shield_legendary', 'ring_legendary', 'neck_legendary', 'boots_legendary', 'legs_legendary'
];
const GODLY_POOL = [
    'fighter_sword_godly', 'wizard_staff_godly', 'rogue_dagger_godly', 'cleric_mace_godly', 'ranger_bow_godly',
    'fighter_armor_godly', 'wizard_robe_godly', 'rogue_armor_godly', 'cleric_armor_godly', 'ranger_armor_godly',
    'helm_godly', 'shield_godly', 'ring_godly', 'neck_godly', 'boots_godly', 'legs_godly'
];

export const DROP_TABLES = {
    // Power 1-2: 8% chance, common only
    low: { chance: 0.08, pool: COMMON_POOL },
    // Power 3-4: 12% chance, common + uncommon
    mid: { chance: 0.12, pool: [...COMMON_POOL, ...UNCOMMON_POOL] },
    // Power 5+: 15% chance, uncommon + rare
    high: { chance: 0.15, pool: [...UNCOMMON_POOL, ...RARE_POOL] },
    // Elites: 25% chance, rare + epic
    elite: { chance: 0.25, pool: [...RARE_POOL, ...EPIC_POOL] },
    // Bosses: 50% chance, epic + legendary (+ small godly chance handled separately)
    boss: { chance: 0.50, pool: [...EPIC_POOL, ...LEGENDARY_POOL] },
    // Shrines: 30% chance, rare to legendary weighted toward higher
    shrine: { chance: 0.30, pool: [...RARE_POOL, ...EPIC_POOL, ...LEGENDARY_POOL] },
    // Godly: separate 2% chance from any high-tier source
    godly: { chance: 0.02, pool: GODLY_POOL }
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

// Common leather armor and boots for all new characters
export const UNIVERSAL_STARTER: Item[] = [
    ITEMS.find(i => i.id === 'rogue_armor_common')!, // Leather Vest
    ITEMS.find(i => i.id === 'boots_common')!,       // Leather Boots
    ITEMS.find(i => i.id === 'legs_common')!,        // Leather Leggings
];

// Role-appropriate starting WEAPON only (armor comes from UNIVERSAL_STARTER)
export const STARTER_WEAPONS: Record<string, string> = {
    fighter: 'fighter_sword',
    wizard: 'wizard_staff',
    rogue: 'rogue_dagger',
    cleric: 'cleric_mace',
    ranger: 'ranger_bow',
};

// Rarity weights for starting weapon roll
const STARTING_WEAPON_WEIGHTS = [
    { rarity: 'common', weight: 60 },
    { rarity: 'uncommon', weight: 25 },
    { rarity: 'rare', weight: 10 },
    { rarity: 'epic', weight: 4 },
    { rarity: 'legendary', weight: 1 },
    // godly: 0 - can't start with godly
];

/**
 * Roll for starting weapon rarity.
 * Returns a rarity string based on weighted random roll.
 */
export function rollStartingWeaponRarity(rng: () => number): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' {
    const totalWeight = STARTING_WEAPON_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * totalWeight;
    
    for (const entry of STARTING_WEAPON_WEIGHTS) {
        roll -= entry.weight;
        if (roll <= 0) {
            return entry.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
        }
    }
    return 'common'; // Fallback
}

/**
 * Get the starting weapon for a role at a specific rarity.
 */
export function getStartingWeapon(role: string, rarity: string): Item | null {
    const baseId = STARTER_WEAPONS[role];
    if (!baseId) return null;
    
    const itemId = `${baseId}_${rarity}`;
    return ITEMS.find(i => i.id === itemId) || null;
}

// Legacy STARTER_EQUIPMENT for recruits (they get common weapon + armor)
export const STARTER_EQUIPMENT: Record<string, Item[]> = {
    fighter: [
        ITEMS.find(i => i.id === 'fighter_sword_common')!,
        ITEMS.find(i => i.id === 'shield_common')!
    ],
    wizard: [
        ITEMS.find(i => i.id === 'wizard_staff_common')!
    ],
    rogue: [
        ITEMS.find(i => i.id === 'rogue_dagger_common')!,
        ITEMS.find(i => i.id === 'rogue_armor_common')!
    ],
    cleric: [
        ITEMS.find(i => i.id === 'cleric_mace_common')!,
        ITEMS.find(i => i.id === 'cleric_armor_common')!
    ],
    ranger: [
        ITEMS.find(i => i.id === 'ranger_bow_common')!,
        ITEMS.find(i => i.id === 'ranger_armor_common')!
    ]
};
