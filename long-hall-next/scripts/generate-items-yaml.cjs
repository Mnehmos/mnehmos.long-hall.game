#!/usr/bin/env node
/**
 * Generate YAML files for all 96 items from tables.ts source data
 * Run: node scripts/generate-items-yaml.js
 */

const fs = require('fs');
const path = require('path');

// Source item data (from src/content/tables.ts ITEMS array)
const ITEMS = [
    // FIGHTER EQUIPMENT
    { id: 'fighter_sword_common', name: 'Iron Sword', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'fighter_sword_uncommon', name: 'Steel Longsword', type: 'weapon', rarity: 'uncommon', cost: 35, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'fighter_sword_rare', name: "Knight's Blade", type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'fighter_sword_epic', name: 'Dragonslayer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'fighter_sword_legendary', name: 'Excalibur', type: 'weapon', rarity: 'legendary', cost: 280, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'fighter_sword_godly', name: 'Godsteel Blade', type: 'weapon', rarity: 'godly', cost: 600, baseStats: { attackBonus: 7, damageBonus: 7 } },
    { id: 'fighter_armor_common', name: 'Chainmail', type: 'chest', rarity: 'common', cost: 20, baseStats: { acBonus: 1 } },
    { id: 'fighter_armor_uncommon', name: 'Plate Armor', type: 'chest', rarity: 'uncommon', cost: 45, baseStats: { acBonus: 2, maxHpBonus: 2 } },
    { id: 'fighter_armor_rare', name: 'Crusader Plate', type: 'chest', rarity: 'rare', cost: 90, baseStats: { acBonus: 3, maxHpBonus: 4 } },
    { id: 'fighter_armor_epic', name: 'Dragon Scale', type: 'chest', rarity: 'epic', cost: 180, baseStats: { acBonus: 4, maxHpBonus: 6 } },
    { id: 'fighter_armor_legendary', name: "Titan's Aegis", type: 'chest', rarity: 'legendary', cost: 350, baseStats: { acBonus: 5, maxHpBonus: 8 } },
    { id: 'fighter_armor_godly', name: 'Armor of the Valkyrie', type: 'chest', rarity: 'godly', cost: 700, baseStats: { acBonus: 7, maxHpBonus: 12 } },

    // WIZARD EQUIPMENT
    { id: 'wizard_staff_common', name: 'Oak Staff', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 2 } },
    { id: 'wizard_staff_uncommon', name: 'Arcane Staff', type: 'weapon', rarity: 'uncommon', cost: 30, baseStats: { attackBonus: 3, damageBonus: 1 } },
    { id: 'wizard_staff_rare', name: 'Staff of Flames', type: 'weapon', rarity: 'rare', cost: 65, baseStats: { attackBonus: 4, damageBonus: 2 } },
    { id: 'wizard_staff_epic', name: 'Voidwalker Staff', type: 'weapon', rarity: 'epic', cost: 130, baseStats: { attackBonus: 5, damageBonus: 3 } },
    { id: 'wizard_staff_legendary', name: 'Staff of Infinite Power', type: 'weapon', rarity: 'legendary', cost: 260, baseStats: { attackBonus: 6, damageBonus: 4 } },
    { id: 'wizard_staff_godly', name: 'Cosmic Conduit', type: 'weapon', rarity: 'godly', cost: 550, baseStats: { attackBonus: 8, damageBonus: 6 } },
    { id: 'wizard_robe_common', name: 'Apprentice Robe', type: 'chest', rarity: 'common', cost: 15, baseStats: { maxHpBonus: 2 } },
    { id: 'wizard_robe_uncommon', name: 'Mage Robe', type: 'chest', rarity: 'uncommon', cost: 35, baseStats: { maxHpBonus: 4, attackBonus: 1 } },
    { id: 'wizard_robe_rare', name: 'Archmage Vestments', type: 'chest', rarity: 'rare', cost: 75, baseStats: { maxHpBonus: 6, attackBonus: 2 } },
    { id: 'wizard_robe_epic', name: 'Ethereal Robe', type: 'chest', rarity: 'epic', cost: 150, baseStats: { maxHpBonus: 8, attackBonus: 3 } },
    { id: 'wizard_robe_legendary', name: 'Robe of the Arcane', type: 'chest', rarity: 'legendary', cost: 300, baseStats: { maxHpBonus: 10, attackBonus: 4 } },
    { id: 'wizard_robe_godly', name: 'Astral Vestments', type: 'chest', rarity: 'godly', cost: 650, baseStats: { maxHpBonus: 15, attackBonus: 6 } },

    // ROGUE EQUIPMENT
    { id: 'rogue_dagger_common', name: 'Sharp Dagger', type: 'weapon', rarity: 'common', cost: 12, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'rogue_dagger_uncommon', name: 'Assassin Blade', type: 'weapon', rarity: 'uncommon', cost: 32, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'rogue_dagger_rare', name: 'Shadowstrike', type: 'weapon', rarity: 'rare', cost: 68, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'rogue_dagger_epic', name: 'Venom Fang', type: 'weapon', rarity: 'epic', cost: 135, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'rogue_dagger_legendary', name: 'Deathwhisper', type: 'weapon', rarity: 'legendary', cost: 270, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'rogue_dagger_godly', name: 'Midnight Edge', type: 'weapon', rarity: 'godly', cost: 580, baseStats: { attackBonus: 7, damageBonus: 7 } },
    { id: 'rogue_armor_common', name: 'Leather Vest', type: 'chest', rarity: 'common', cost: 18, baseStats: { acBonus: 1 } },
    { id: 'rogue_armor_uncommon', name: "Thieves' Garb", type: 'chest', rarity: 'uncommon', cost: 40, baseStats: { acBonus: 2 } },
    { id: 'rogue_armor_rare', name: 'Nightstalker Leather', type: 'chest', rarity: 'rare', cost: 85, baseStats: { acBonus: 3, attackBonus: 1 } },
    { id: 'rogue_armor_epic', name: "Assassin's Shroud", type: 'chest', rarity: 'epic', cost: 170, baseStats: { acBonus: 4, attackBonus: 2 } },
    { id: 'rogue_armor_legendary', name: 'Shadow Walker Armor', type: 'chest', rarity: 'legendary', cost: 340, baseStats: { acBonus: 5, attackBonus: 3 } },
    { id: 'rogue_armor_godly', name: 'Cloak of Invisibility', type: 'chest', rarity: 'godly', cost: 680, baseStats: { acBonus: 7, attackBonus: 5 } },

    // CLERIC EQUIPMENT
    { id: 'cleric_mace_common', name: 'Holy Mace', type: 'weapon', rarity: 'common', cost: 15, baseStats: { attackBonus: 1, damageBonus: 1 } },
    { id: 'cleric_mace_uncommon', name: 'Blessed Hammer', type: 'weapon', rarity: 'uncommon', cost: 35, baseStats: { attackBonus: 2, damageBonus: 2 } },
    { id: 'cleric_mace_rare', name: 'Divine Scepter', type: 'weapon', rarity: 'rare', cost: 72, baseStats: { attackBonus: 3, damageBonus: 3 } },
    { id: 'cleric_mace_epic', name: 'Judgment', type: 'weapon', rarity: 'epic', cost: 145, baseStats: { attackBonus: 4, damageBonus: 4 } },
    { id: 'cleric_mace_legendary', name: 'Hand of God', type: 'weapon', rarity: 'legendary', cost: 290, baseStats: { attackBonus: 5, damageBonus: 5 } },
    { id: 'cleric_mace_godly', name: "Heaven's Wrath", type: 'weapon', rarity: 'godly', cost: 620, baseStats: { attackBonus: 7, damageBonus: 7 } },
    { id: 'cleric_armor_common', name: 'Clerical Robe', type: 'chest', rarity: 'common', cost: 18, baseStats: { maxHpBonus: 3 } },
    { id: 'cleric_armor_uncommon', name: 'Priest Vestments', type: 'chest', rarity: 'uncommon', cost: 42, baseStats: { maxHpBonus: 5, acBonus: 1 } },
    { id: 'cleric_armor_rare', name: 'Holy Raiment', type: 'chest', rarity: 'rare', cost: 88, baseStats: { maxHpBonus: 7, acBonus: 2 } },
    { id: 'cleric_armor_epic', name: 'Blessed Plate', type: 'chest', rarity: 'epic', cost: 175, baseStats: { maxHpBonus: 9, acBonus: 3 } },
    { id: 'cleric_armor_legendary', name: 'Divine Aegis', type: 'chest', rarity: 'legendary', cost: 360, baseStats: { maxHpBonus: 12, acBonus: 4 } },
    { id: 'cleric_armor_godly', name: 'Celestial Vestments', type: 'chest', rarity: 'godly', cost: 720, baseStats: { maxHpBonus: 18, acBonus: 6 } },

    // RANGER EQUIPMENT
    { id: 'ranger_bow_common', name: 'Short Bow', type: 'weapon', rarity: 'common', cost: 14, baseStats: { attackBonus: 2 } },
    { id: 'ranger_bow_uncommon', name: 'Longbow', type: 'weapon', rarity: 'uncommon', cost: 34, baseStats: { attackBonus: 3, damageBonus: 1 } },
    { id: 'ranger_bow_rare', name: 'Elven Bow', type: 'weapon', rarity: 'rare', cost: 70, baseStats: { attackBonus: 4, damageBonus: 2 } },
    { id: 'ranger_bow_epic', name: 'Windpiercer', type: 'weapon', rarity: 'epic', cost: 140, baseStats: { attackBonus: 5, damageBonus: 3 } },
    { id: 'ranger_bow_legendary', name: 'Heartseeker', type: 'weapon', rarity: 'legendary', cost: 280, baseStats: { attackBonus: 6, damageBonus: 4 } },
    { id: 'ranger_bow_godly', name: 'Star Shot', type: 'weapon', rarity: 'godly', cost: 600, baseStats: { attackBonus: 8, damageBonus: 6 } },
    { id: 'ranger_armor_common', name: 'Ranger Cloak', type: 'chest', rarity: 'common', cost: 16, baseStats: { acBonus: 1 } },
    { id: 'ranger_armor_uncommon', name: "Hunter's Mail", type: 'chest', rarity: 'uncommon', cost: 38, baseStats: { acBonus: 2 } },
    { id: 'ranger_armor_rare', name: 'Woodland Armor', type: 'chest', rarity: 'rare', cost: 80, baseStats: { acBonus: 3, attackBonus: 1 } },
    { id: 'ranger_armor_epic', name: 'Beast Hunter Gear', type: 'chest', rarity: 'epic', cost: 160, baseStats: { acBonus: 4, attackBonus: 2 } },
    { id: 'ranger_armor_legendary', name: "Nature's Warden", type: 'chest', rarity: 'legendary', cost: 320, baseStats: { acBonus: 5, attackBonus: 3 } },
    { id: 'ranger_armor_godly', name: 'Avatar of the Wild', type: 'chest', rarity: 'godly', cost: 660, baseStats: { acBonus: 7, attackBonus: 5 } },

    // UNIVERSAL ACCESSORIES - HEAD
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

// Convert name to kebab-case filename
function toKebabCase(name) {
    return name
        .toLowerCase()
        .replace(/[']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// Get weapon type tag from item id
function getWeaponTag(id) {
    if (id.includes('sword')) return 'sword';
    if (id.includes('staff')) return 'staff';
    if (id.includes('dagger')) return 'dagger';
    if (id.includes('mace')) return 'mace';
    if (id.includes('bow')) return 'bow';
    return null;
}

// Get class restriction from item id
function getClassFromId(id) {
    if (id.startsWith('fighter_')) return 'fighter';
    if (id.startsWith('wizard_')) return 'wizard';
    if (id.startsWith('rogue_')) return 'rogue';
    if (id.startsWith('cleric_')) return 'cleric';
    if (id.startsWith('ranger_')) return 'ranger';
    return null;
}

// Generate YAML content for an item
function generateYaml(item) {
    const lines = [];
    
    lines.push(`id: ${item.id}`);
    
    // Name - quote if contains special chars
    if (item.name.includes("'") || item.name.includes('"')) {
        lines.push(`name: "${item.name.replace(/"/g, '\\"')}"`);
    } else {
        lines.push(`name: ${item.name}`);
    }
    
    lines.push(`type: ${item.type}`);
    lines.push(`rarity: ${item.rarity}`);
    lines.push(`cost: ${item.cost}`);
    
    // baseStats - only include non-zero values
    lines.push('baseStats:');
    const stats = item.baseStats;
    if (stats.attackBonus) lines.push(`  attackBonus: ${stats.attackBonus}`);
    if (stats.damageBonus) lines.push(`  damageBonus: ${stats.damageBonus}`);
    if (stats.acBonus) lines.push(`  acBonus: ${stats.acBonus}`);
    if (stats.maxHpBonus) lines.push(`  maxHpBonus: ${stats.maxHpBonus}`);
    
    // Tags
    const tags = [];
    const classTag = getClassFromId(item.id);
    if (classTag) tags.push(classTag);
    
    const weaponTag = getWeaponTag(item.id);
    if (weaponTag) tags.push(weaponTag);
    
    // Add category tag
    if (item.type === 'weapon') tags.push('weapon');
    else if (item.type === 'chest') tags.push('armor');
    else tags.push('accessory');
    
    if (tags.length > 0) {
        lines.push('tags:');
        tags.forEach(tag => lines.push(`  - ${tag}`));
    }
    
    return lines.join('\n');
}

// Determine output path for an item
function getOutputPath(item) {
    const baseDir = 'src/content/items';
    const filename = toKebabCase(item.name) + '.yaml';
    
    const classTag = getClassFromId(item.id);
    
    if (item.type === 'weapon') {
        return path.join(baseDir, 'weapons', classTag, filename);
    } else if (item.type === 'chest') {
        return path.join(baseDir, 'armor', classTag, filename);
    } else {
        // Accessories
        return path.join(baseDir, 'accessories', item.type, filename);
    }
}

// Main execution
function main() {
    const outputDir = path.resolve(__dirname, '..');
    let filesCreated = 0;
    const allPaths = [];
    
    // Create all directories first
    const dirs = [
        'src/content/items/weapons/fighter',
        'src/content/items/weapons/wizard',
        'src/content/items/weapons/rogue',
        'src/content/items/weapons/cleric',
        'src/content/items/weapons/ranger',
        'src/content/items/armor/fighter',
        'src/content/items/armor/wizard',
        'src/content/items/armor/rogue',
        'src/content/items/armor/cleric',
        'src/content/items/armor/ranger',
        'src/content/items/accessories/head',
        'src/content/items/accessories/shield',
        'src/content/items/accessories/ring',
        'src/content/items/accessories/neck',
        'src/content/items/accessories/feet',
        'src/content/items/accessories/legs',
    ];
    
    for (const dir of dirs) {
        const fullPath = path.join(outputDir, dir);
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
    
    // Generate all YAML files
    for (const item of ITEMS) {
        const relativePath = getOutputPath(item);
        const fullPath = path.join(outputDir, relativePath);
        const yaml = generateYaml(item);
        
        fs.writeFileSync(fullPath, yaml + '\n');
        filesCreated++;
        allPaths.push(relativePath);
    }
    
    console.log(`\n✅ Created ${filesCreated} YAML files`);
    console.log(`   - Weapons: 30 files (6 per class × 5 classes)`);
    console.log(`   - Armor: 30 files (6 per class × 5 classes)`);
    console.log(`   - Accessories: 36 files (6 per type × 6 types)`);
    
    // Verify count
    if (filesCreated !== 96) {
        console.error(`\n❌ Expected 96 files but created ${filesCreated}`);
        process.exit(1);
    }
    
    return allPaths;
}

main();
