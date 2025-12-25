import type { Item } from './types';
import { SeededRNG } from '../core/rng';
import { ITEMS } from '../content/tables';

export function generateLoot(rng: SeededRNG, _rarityBias: number = 0): Item {
    // rarityBias: higher = better chance
    // For v1: uniform random from ITEMS
    // Or filtered by rarity.
    
    // Simple logic: Pick random item.
    // Real logic: weighted rarity.
    
    // Filter ITEMS by rarity based on roll?
    // Let's just pick one for now.
    
    return rng.pick(ITEMS);
}

// Logic for generating a shop inventory
export function generateShopInventory(rng: SeededRNG, count: number): Item[] {
    const stock: Item[] = [];
    for(let i=0; i<count; i++) {
        stock.push(generateLoot(rng));
    }
    return stock;
}
