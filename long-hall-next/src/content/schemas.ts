/**
 * Reusable Zod Schemas for Game Content
 *
 * This module exports all Zod schemas used for content collection validation,
 * along with inferred TypeScript types for use throughout the application.
 *
 * @module content/schemas
 * @see long-hall-next/src/content/config.ts - Collection definitions using these schemas
 * @see long-hall-next/src/lib/content.ts - Type-safe content loaders
 */
import { z } from 'zod';

// ============================================================================
// Shared Schema Components
// ============================================================================

/** Valid character roles/classes */
export const roleSchema = z.enum(['fighter', 'wizard', 'rogue', 'cleric', 'ranger']);
export type Role = z.infer<typeof roleSchema>;

/** Skills schema matching the Skills interface */
export const skillsSchema = z.object({
  strength: z.number().int().min(0),
  attack: z.number().int().min(0),
  defense: z.number().int().min(0),
  magic: z.number().int().min(0),
  ranged: z.number().int().min(0),
  faith: z.number().int().min(0),
  agility: z.number().int().min(0),
});
export type Skills = z.infer<typeof skillsSchema>;

/** Item rarity tiers */
export const raritySchema = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'godly']);
export type Rarity = z.infer<typeof raritySchema>;

/** Item type matching runtime ItemType (subset for equipment) */
export const itemTypeSchema = z.enum([
  'weapon', 'armor', 'ring', 'shield', 'neck', 'feet', 'legs', 'head', 'chest'
]);
export type ItemType = z.infer<typeof itemTypeSchema>;

// ============================================================================
// Effect Schemas
// ============================================================================

/**
 * Ability effect schema - defines what an ability does when used
 * Matches the effect property of AbilityDef in types.ts
 */
export const abilityEffectSchema = z.object({
  type: z.enum(['damage', 'heal', 'buff', 'debuff', 'special', 'attack']),
  target: z.enum(['ally', 'self', 'enemy', 'all_enemies', 'all_allies']),
  /** Dice expression like "3d4", "2d6" */
  dice: z.string().regex(/^\d+d\d+$/).optional(),
  /** Flat modifier to add to dice roll */
  modifier: z.number().int().optional(),
  /** Status effect to apply (e.g., 'hidden') */
  status: z.string().optional(),
  /** Bonus to attack roll */
  attackBonus: z.number().int().optional(),
  /** Bonus to damage roll */
  damageBonus: z.number().int().optional(),
  /** Whether this ability uses weapon damage as base */
  useWeaponDamage: z.boolean().optional(),
});
export type AbilityEffect = z.infer<typeof abilityEffectSchema>;

/**
 * Base stats schema for items
 * These are the static bonuses an item provides before enchantments
 */
export const baseStatsSchema = z.object({
  attackBonus: z.number().int().optional(),
  damageBonus: z.number().int().optional(),
  acBonus: z.number().int().optional(),
  maxHpBonus: z.number().int().optional(),
});
export type BaseStats = z.infer<typeof baseStatsSchema>;

// ============================================================================
// Entity Schemas
// ============================================================================

/**
 * Abilities Schema
 * Matches AbilityDef interface in types.ts
 */
export const abilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: roleSchema,
  description: z.string(),
  cooldownType: z.enum(['turns', 'rest', 'combat']),
  /** Cooldown duration: turns count, or 1 for rest/combat */
  cooldownValue: z.number().int().min(0),
  effect: abilityEffectSchema,
});
export type Ability = z.infer<typeof abilitySchema>;

/**
 * Classes Schema
 * Defines starting stats and hit dice for each role
 */
export const classSchema = z.object({
  /** Role identifier, also used as collection key */
  role: roleSchema,
  /** Hit die size: d6 (wizard), d8 (cleric/rogue), d10 (fighter/ranger) */
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10)]),
  /** Starting skill distribution */
  startingSkills: skillsSchema,
});
export type GameClass = z.infer<typeof classSchema>;

/**
 * Themes Schema
 * Defines dungeon theme properties for procedural generation
 * Matches ThemeDef interface in themes.ts
 */
export const themeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Tags for enemy pool selection (e.g., ['undead', 'skeleton']) */
  enemyTags: z.array(z.string()),
  /** Tags for trap pool selection */
  trapTags: z.array(z.string()),
  /** Boss enemy IDs available in this theme */
  bossPool: z.array(z.string()),
  /** Flavor text for room descriptions */
  ambiance: z.array(z.string()),
});
export type Theme = z.infer<typeof themeSchema>;

/**
 * Items Schema
 * Base item templates for loot generation
 * Runtime items may have additional properties (stats, history, customName)
 */
export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: itemTypeSchema,
  /** Base rarity - may be upgraded during generation */
  rarity: raritySchema,
  /** Base gold value */
  cost: z.number().int().min(0),
  /** Base stat bonuses */
  baseStats: baseStatsSchema,
  /** Optional: which slot this equips to (derived from type if not specified) */
  slot: z.enum([
    'head', 'neck', 'chest', 'legs', 'feet',
    'main_hand', 'off_hand', 'ring1', 'ring2'
  ]).optional(),
  /** Optional: damage dice for weapons */
  damageDice: z.string().regex(/^\d+d\d+$/).optional(),
  /** Optional: role restrictions */
  roleRestriction: z.array(roleSchema).optional(),
  /** Optional: flavor text */
  description: z.string().optional(),
  /** Tags for loot table filtering */
  tags: z.array(z.string()).optional(),
});
export type Item = z.infer<typeof itemSchema>;

/**
 * Enemies Schema
 * Enemy templates for encounter generation
 * Matches Enemy interface in types.ts
 */
export const enemySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Base HP (may be scaled at runtime) */
  hp: z.number().int().min(1),
  /** Max HP (typically same as hp for templates) */
  maxHp: z.number().int().min(1),
  /** Power level for encounter balancing */
  power: z.number().int().min(0),
  /** Damage dice expression like "1d6+2" */
  damage: z.string().regex(/^\d+d\d+(\+\d+)?$/),
  /** Armor class */
  ac: z.number().int().min(0),
  /** XP reward on defeat */
  xp: z.number().int().min(0),
  /** Tags for theme filtering (e.g., 'undead', 'vermin') */
  tags: z.array(z.string()).optional(),
  /** Whether this is a boss enemy */
  isBoss: z.boolean().optional(),
  /** Optional special abilities or behaviors */
  abilities: z.array(z.string()).optional(),
  /** Optional flavor text */
  description: z.string().optional(),
});
export type Enemy = z.infer<typeof enemySchema>;
