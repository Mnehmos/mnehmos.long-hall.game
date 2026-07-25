import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/engine/reducer';
import { createInitialRunState } from '../src/engine/state';
import { ITEMS } from '../src/content/tables';
import type { Item, RunState } from '../src/engine/types';

/** Put a trader room with `item` on the shelf under the party. */
function withShop(state: RunState, item: Item): RunState {
    return {
        ...state,
        currentRoom: {
            id: 'shop', type: 'trader', themeId: 'dungeon_start',
            enemies: [], loot: [], shopItems: [item],
        },
    };
}

describe('Inventory & Economy', () => {

    it('should buy item if enough gold, charging the shelf price', () => {
        const itemToBuy = ITEMS[0]; // Iron Sword
        let state = withShop(createInitialRunState('seed-econ'), itemToBuy);
        state.party.gold = 100;

        const nextState = gameReducer(state, { type: 'BUY_ITEM', itemId: itemToBuy.id });

        expect(nextState.party.gold).toBe(100 - itemToBuy.cost);
        expect(nextState.inventory.items).toHaveLength(1);
        expect(nextState.inventory.items[0].id).toBe(itemToBuy.id);
        // Sold out of the shop, so it can't be bought twice.
        expect(nextState.currentRoom?.shopItems).toHaveLength(0);
    });

    it('should fail buy if not enough gold', () => {
        const itemToBuy = ITEMS[0];
        let state = withShop(createInitialRunState('seed-econ'), itemToBuy);
        state.party.gold = 1;

        const nextState = gameReducer(state, { type: 'BUY_ITEM', itemId: itemToBuy.id });

        expect(nextState.party.gold).toBe(1);
        expect(nextState.inventory.items).toHaveLength(0);
    });

    it('refuses to buy an item that is not on this shelf', () => {
        // Regression: the price used to arrive on the action (scraped from the
        // DOM) and the item could fall back to the global ITEMS table, so any
        // item in the game could be bought anywhere, at any price.
        let state = createInitialRunState('seed-econ');
        state.party.gold = 10_000;

        const nextState = gameReducer(state, { type: 'BUY_ITEM', itemId: ITEMS[5].id });

        expect(nextState.party.gold).toBe(10_000);
        expect(nextState.inventory.items).toHaveLength(0);
    });

    it('should equip weapon and swap old one to inventory', () => {
        let state = createInitialRunState('seed-equip');
        const hero = state.party.members[0];
        const newSword = ITEMS[0]; // Iron Sword
        
        // Give item to inventory
        state.inventory.items.push(newSword);
        
        // Assume hero has no weapon initially (check createActor)
        // Let's give them a stick first to test swap
        const oldStick = { id: 'stick', name: 'Stick', slot: 'weapon', rarity: 'common' } as any;
        state.party.members[0].equipment.main_hand = oldStick;
        
        const nextState = gameReducer(state, { type: 'EQUIP_ITEM', actorId: hero.id, itemId: newSword.id, slot: 'main_hand' });
        
        const heroAfter = nextState.party.members[0];
        expect(heroAfter.equipment.main_hand?.id).toBe(newSword.id);
        
        // Old stick should be in inventory
        expect(nextState.inventory.items).toContainEqual(oldStick);
        // New sword should NOT be in inventory
        expect(nextState.inventory.items.find(i => i.id === newSword.id)).toBeUndefined();
    });
});
