/**
 * @fileoverview Hash utilities for deterministic string-to-number conversion
 * 
 * This module provides fast, deterministic hash functions for converting
 * strings and objects into numeric seeds. Primary use cases:
 * - Converting session IDs to RNG seeds
 * - Creating deterministic identifiers
 * - Combining multiple values into a single hash
 * 
 * @module hash
 */

/**
 * Simple string hash function using the djb2 algorithm variant.
 * 
 * The djb2 algorithm is a fast, effective hash function created by
 * Daniel J. Bernstein. It has good distribution properties and is
 * widely used for hash tables and checksums.
 * 
 * Formula: `hash = ((hash << 5) + hash) + char`
 * 
 * @param seed - The string to hash
 * @returns A 32-bit signed integer hash value
 * 
 * @example
 * // Basic usage
 * const hash = hashString('hello');
 * console.log(hash); // -1882256994
 * 
 * @example
 * // Consistent hashing (same input = same output)
 * const hash1 = hashString('player-123');
 * const hash2 = hashString('player-123');
 * console.log(hash1 === hash2); // true
 * 
 * @example
 * // Use as RNG seed
 * import { SeededRNG } from './rng';
 * const seed = hashString('game-session-abc');
 * const rng = new SeededRNG(seed);
 */
export function hashString(seed: string): number {
  let hash = 5381;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) + hash + seed.charCodeAt(i);
    hash = hash | 0; // Convert to 32-bit integer
  }

  return hash;
}

/**
 * Combine multiple hash values into a single hash.
 * 
 * Uses XOR for initial combination, which is commutative and order-independent
 * for the base operation, then adds mixing to avoid patterns. The mixing step
 * makes the final result order-dependent.
 * 
 * @param hashes - Variable number of hash values to combine
 * @returns A combined 32-bit signed integer hash
 * 
 * @example
 * // Combine two hashes
 * const h1 = hashString('player');
 * const h2 = hashString('level-3');
 * const combined = combineHashes(h1, h2);
 * 
 * @example
 * // Combine multiple values
 * const hashes = ['a', 'b', 'c'].map(hashString);
 * const combined = combineHashes(...hashes);
 * 
 * @example
 * // Create unique seeds for different game aspects
 * const baseSeed = hashString('session-xyz');
 * const combatSeed = combineHashes(baseSeed, hashString('combat'));
 * const lootSeed = combineHashes(baseSeed, hashString('loot'));
 * // combatSeed !== lootSeed
 */
export function combineHashes(...hashes: number[]): number {
  if (hashes.length === 0) {
    return 0;
  }

  let combined = hashes[0];
  for (let i = 1; i < hashes.length; i++) {
    combined = combined ^ hashes[i];
    // Add some mixing to avoid patterns
    combined = ((combined << 5) + combined) | 0;
  }

  return combined;
}

/**
 * Hash an object by converting to JSON first.
 * 
 * ⚠️ **Important**: Object property order affects the hash. For consistent
 * results with objects that may have different property ordering, consider
 * sorting keys or using a canonical JSON stringifier.
 * 
 * @param obj - Any JSON-serializable value
 * @returns A 32-bit signed integer hash
 * 
 * @example
 * // Hash a simple object
 * const hash = hashObject({ name: 'hero', level: 5 });
 * 
 * @example
 * // Hash game state
 * const state = {
 *   position: { x: 10, y: 20 },
 *   inventory: ['sword', 'potion'],
 *   gold: 100
 * };
 * const stateHash = hashObject(state);
 * 
 * @example
 * // Hash arrays
 * const arrayHash = hashObject([1, 2, 3]);
 * 
 * @example
 * // Null/undefined handling
 * const nullHash = hashObject(null);       // Hashes "null"
 * const undefinedHash = hashObject(undefined); // Hashes ""
 */
export function hashObject(obj: unknown): number {
  const str = JSON.stringify(obj);
  return hashString(str ?? "");
}

/**
 * Create a hash from a string and a numeric seed.
 * 
 * Useful for creating variation within a category or adding entropy
 * to a base hash.
 * 
 * @param str - The string to hash
 * @param seed - A numeric seed to combine with the string hash
 * @returns A combined 32-bit signed integer hash
 * 
 * @example
 * // Create room-specific seeds
 * const baseSeed = 12345;
 * const room1Seed = hashWithSeed('room-1', baseSeed);
 * const room2Seed = hashWithSeed('room-2', baseSeed);
 * // room1Seed !== room2Seed
 * 
 * @example
 * // Create deterministic variants
 * const masterSeed = hashString('game-session');
 * const enemySeed = hashWithSeed('goblin-spawner', masterSeed);
 * const treasureSeed = hashWithSeed('treasure-placement', masterSeed);
 * 
 * @example
 * // Combine with game tick for time-based variation
 * const tickSeed = hashWithSeed('ambient-events', gameTick);
 */
export function hashWithSeed(str: string, seed: number): number {
  return combineHashes(hashString(str), seed);
}

/**
 * Generate a short alphanumeric ID from a numeric hash.
 * 
 * Converts a 32-bit hash into a base-36 string (0-9, a-z).
 * Useful for creating human-readable identifiers.
 * 
 * @param hash - A numeric hash value (typically from hashString or hashObject)
 * @returns A short alphanumeric string (up to 7 characters)
 * 
 * @example
 * // Generate a short ID
 * const hash = hashString('some-long-identifier');
 * const shortId = hashToId(hash);
 * console.log(shortId); // e.g., "1k5j8m2"
 * 
 * @example
 * // Use for display purposes
 * const sessionId = hashString('user-session-data-12345');
 * const displayId = hashToId(sessionId);
 * console.log(`Session: ${displayId}`);
 */
export function hashToId(hash: number): string {
  // Ensure positive value for consistent base-36 encoding
  const positive = hash >>> 0;
  return positive.toString(36);
}

/**
 * Create a deterministic seed from multiple string components.
 * 
 * Convenience function that hashes each component and combines them.
 * Useful for creating unique seeds from multiple identifying factors.
 * 
 * @param components - Variable number of strings to combine
 * @returns A combined 32-bit signed integer hash
 * 
 * @example
 * // Create a seed from multiple identifiers
 * const seed = createSeed('player-123', 'dungeon-5', 'room-3');
 * 
 * @example
 * // Create reproducible random states
 * const gameSeed = createSeed(playerId, sessionId, visitDate);
 * const rng = new SeededRNG(gameSeed);
 */
export function createSeed(...components: string[]): number {
  if (components.length === 0) {
    return 0;
  }
  const hashes = components.map(hashString);
  return combineHashes(...hashes);
}
