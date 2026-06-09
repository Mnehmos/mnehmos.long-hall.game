/**
 * Astro Content Collection Configuration
 *
 * Defines content collections for game static data using schemas
 * imported from ./schemas.ts:
 * - abilities: Class abilities with cooldowns and effects
 * - classes: Class definitions with hit dice and starting skills
 * - themes: Dungeon theme definitions with enemy/trap pools
 * - items: Base item templates for loot generation
 * - enemies: Enemy templates for encounter generation
 *
 * @see long-hall-next/src/content/schemas.ts for schema definitions and types
 * @see long-hall-next/src/lib/content.ts for type-safe content loaders
 */
import { defineCollection } from 'astro:content';
import {
  abilitySchema,
  classSchema,
  themeSchema,
  itemSchema,
  enemySchema,
} from './schemas';

// ============================================================================
// Collection Definitions
// ============================================================================

/**
 * Abilities Collection
 * Class abilities with cooldowns and effects
 */
const abilities = defineCollection({
  type: 'data',
  schema: abilitySchema,
});

/**
 * Classes Collection
 * Defines starting stats and hit dice for each role
 */
const classes = defineCollection({
  type: 'data',
  schema: classSchema,
});

/**
 * Themes Collection
 * Dungeon theme definitions for procedural generation
 */
const themes = defineCollection({
  type: 'data',
  schema: themeSchema,
});

/**
 * Items Collection
 * Base item templates for loot generation
 */
const items = defineCollection({
  type: 'data',
  schema: itemSchema,
});

/**
 * Enemies Collection
 * Enemy templates for encounter generation
 */
const enemies = defineCollection({
  type: 'data',
  schema: enemySchema,
});

// ============================================================================
// Export Collections
// ============================================================================

export const collections = {
  abilities,
  classes,
  themes,
  items,
  enemies,
};
