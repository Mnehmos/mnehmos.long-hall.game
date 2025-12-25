import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/engine/reducer';
import { createInitialRunState } from '../src/engine/state';
import { ITEMS } from '../src/content/tables';

describe('Inventory & Economy', () => {
    
    it('should buy item if enough gold', () => {
        let state = createInitialRunState('seed-econ');
        state.party.gold = 100;
        const itemToBuy = ITEMS[0]; // Iron Sword
        
        const nextState = gameReducer(state, { type: 'BUY_ITEM', itemId: itemToBuy.id, cost: 50 });
        
        expect(nextState.party.gold).toBe(50);
        expect(nextState.inventory.items).toHaveLength(1);
        expect(nextState.inventory.items[0].id).toBe(itemToBuy.id);
    });

    it('should fail buy if not enough gold', () => {
        let state = createInitialRunState('seed-econ');
        state.party.gold = 10;
        const itemToBuy = ITEMS[0];
        
        const nextState = gameReducer(state, { type: 'BUY_ITEM', itemId: itemToBuy.id, cost: 50 });
        
        expect(nextState.party.gold).toBe(10);
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
