/**
 * Type-Safe Content Loaders
 *
 * Provides utility functions for accessing game content collections at build time.
 * All functions are async and return typed content entries.
 *
 * @module lib/content
 * @see long-hall-next/src/content/schemas.ts for schema definitions and types
 * @see long-hall-next/src/content/config.ts for collection definitions
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Role, Rarity, ItemType } from '../content/schemas';

// ============================================================================
// Type Aliases for Content Entries
// ============================================================================

/** Ability content entry type */
export type AbilityEntry = CollectionEntry<'abilities'>;
/** Class content entry type */
export type ClassEntry = CollectionEntry<'classes'>;
/** Theme content entry type */
export type ThemeEntry = CollectionEntry<'themes'>;
/** Item content entry type */
export type ItemEntry = CollectionEntry<'items'>;
/** Enemy content entry type */
export type EnemyEntry = CollectionEntry<'enemies'>;

// ============================================================================
// Items Loaders
// ============================================================================

/**
 * Get all items from the collection
 * @returns Promise resolving to array of all item entries
 */
export async function getAllItems(): Promise<ItemEntry[]> {
  return await getCollection('items');
}

/**
 * Get a single item by its ID
 * @param id - Item ID (filename without extension)
 * @returns Promise resolving to item entry or undefined if not found
 */
export async function getItemById(id: string): Promise<ItemEntry | undefined> {
  return await getEntry('items', id);
}

/**
 * Get all items of a specific type
 * @param type - Item type to filter by (weapon, armor, etc.)
 * @returns Promise resolving to filtered item entries
 */
export async function getItemsByType(type: ItemType): Promise<ItemEntry[]> {
  const items = await getCollection('items');
  return items.filter(item => item.data.type === type);
}

/**
 * Get all items of a specific rarity
 * @param rarity - Rarity tier to filter by
 * @returns Promise resolving to filtered item entries
 */
export async function getItemsByRarity(rarity: Rarity): Promise<ItemEntry[]> {
  const items = await getCollection('items');
  return items.filter(item => item.data.rarity === rarity);
}

/**
 * Get all items that have a specific tag
 * @param tag - Tag to filter by (e.g., 'light', 'heavy', 'finesse')
 * @returns Promise resolving to filtered item entries
 */
export async function getItemsByTag(tag: string): Promise<ItemEntry[]> {
  const items = await getCollection('items');
  return items.filter(item => item.data.tags?.includes(tag));
}

// ============================================================================
// Enemies Loaders
// ============================================================================

/**
 * Get all enemies from the collection
 * @returns Promise resolving to array of all enemy entries
 */
export async function getAllEnemies(): Promise<EnemyEntry[]> {
  return await getCollection('enemies');
}

/**
 * Get a single enemy by its ID
 * @param id - Enemy ID (filename without extension)
 * @returns Promise resolving to enemy entry or undefined if not found
 */
export async function getEnemyById(id: string): Promise<EnemyEntry | undefined> {
  return await getEntry('enemies', id);
}

/**
 * Get enemies within a power level range
 * @param min - Minimum power level (inclusive)
 * @param max - Maximum power level (inclusive)
 * @returns Promise resolving to filtered enemy entries
 */
export async function getEnemiesByPowerRange(min: number, max: number): Promise<EnemyEntry[]> {
  const enemies = await getCollection('enemies');
  return enemies.filter(e => e.data.power >= min && e.data.power <= max);
}

/**
 * Get all enemies that have a specific tag
 * @param tag - Tag to filter by (e.g., 'undead', 'vermin', 'beast')
 * @returns Promise resolving to filtered enemy entries
 */
export async function getEnemiesByTag(tag: string): Promise<EnemyEntry[]> {
  const enemies = await getCollection('enemies');
  return enemies.filter(e => e.data.tags?.includes(tag));
}

/**
 * Get all boss enemies
 * @returns Promise resolving to boss enemy entries
 */
export async function getBossEnemies(): Promise<EnemyEntry[]> {
  const enemies = await getCollection('enemies');
  return enemies.filter(e => e.data.isBoss === true);
}

/**
 * Get all enemies that match a theme's enemy tags
 * @param themeId - Theme ID to get enemies for
 * @returns Promise resolving to enemy entries matching the theme, or empty array if theme not found
 */
export async function getEnemiesForTheme(themeId: string): Promise<EnemyEntry[]> {
  const theme = await getEntry('themes', themeId);
  if (!theme) return [];

  const enemies = await getCollection('enemies');
  return enemies.filter(e =>
    e.data.tags?.some(tag => theme.data.enemyTags.includes(tag))
  );
}

// ============================================================================
// Abilities Loaders
// ============================================================================

/**
 * Get all abilities from the collection
 * @returns Promise resolving to array of all ability entries
 */
export async function getAllAbilities(): Promise<AbilityEntry[]> {
  return await getCollection('abilities');
}

/**
 * Get a single ability by its ID
 * @param id - Ability ID (filename without extension)
 * @returns Promise resolving to ability entry or undefined if not found
 */
export async function getAbilityById(id: string): Promise<AbilityEntry | undefined> {
  return await getEntry('abilities', id);
}

/**
 * Get all abilities for a specific role/class
 * @param role - Role to filter abilities by
 * @returns Promise resolving to filtered ability entries
 */
export async function getAbilitiesForRole(role: Role): Promise<AbilityEntry[]> {
  const abilities = await getCollection('abilities');
  return abilities.filter(a => a.data.role === role);
}

// ============================================================================
// Classes Loaders
// ============================================================================

/**
 * Get all classes from the collection
 * @returns Promise resolving to array of all class entries
 */
export async function getAllClasses(): Promise<ClassEntry[]> {
  return await getCollection('classes');
}

/**
 * Get a class definition by its role
 * @param role - Role identifier (fighter, wizard, etc.)
 * @returns Promise resolving to class entry or undefined if not found
 */
export async function getClassByRole(role: Role): Promise<ClassEntry | undefined> {
  return await getEntry('classes', role);
}

// ============================================================================
// Themes Loaders
// ============================================================================

/**
 * Get all themes from the collection
 * @returns Promise resolving to array of all theme entries
 */
export async function getAllThemes(): Promise<ThemeEntry[]> {
  return await getCollection('themes');
}

/**
 * Get a single theme by its ID
 * @param id - Theme ID (filename without extension)
 * @returns Promise resolving to theme entry or undefined if not found
 */
export async function getThemeById(id: string): Promise<ThemeEntry | undefined> {
  return await getEntry('themes', id);
}
