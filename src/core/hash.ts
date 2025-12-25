/**
 * Hash utilities for deterministic string-to-number conversion
 */

/**
 * Simple string hash function (djb2 algorithm variant)
 * Returns a 32-bit signed integer
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
 * Combine multiple hash values into a single hash
 * Uses XOR for combination, which is commutative and order-independent
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
 * Hash an object by converting to JSON first
 */
export function hashObject(obj: unknown): number {
  const str = JSON.stringify(obj);
  // JSON.stringify returns undefined for functions/undefined symbols
  // We treat that as empty string or a distinct marker
  return hashString(str ?? "");
}

/**
 * Create a hash from a string and a numeric seed
 */
export function hashWithSeed(str: string, seed: number): number {
  return combineHashes(hashString(str), seed);
}
