import { createInitialRunState, loadGameState, saveGameState, clearGameState } from './engine/state';
import { gameReducer } from './engine/reducer';
import { renderGame } from './ui/render';
import type { Action } from './engine/types';

// State - load from localStorage or create new
let state = loadGameState() || createInitialRunState(Date.now().toString());

// App Element
const app = document.getElementById('app');

function update() {
  if (app) {
    app.innerHTML = renderGame(state);
    attachEvents();
    
    // Scroll combat log to bottom
    const logContent = document.getElementById('log-content');
    if (logContent) {
      logContent.scrollTop = logContent.scrollHeight;
    }
  }
}

function dispatch(action: Action) {
  state = gameReducer(state, action);

  // Ironman save: auto-save after each action
  // Clear save on game over (party death)
  if (state.gameOver) {
    clearGameState();
  } else {
    saveGameState(state);
  }

  update();
}

function attachEvents() {
  document.getElementById('btn-advance')?.addEventListener('click', () => {
    dispatch({ type: 'ADVANCE_ROOM' });
  });

  document.getElementById('btn-resolve')?.addEventListener('click', () => {
    dispatch({ type: 'RESOLVE_ROOM' });
  });

  document.getElementById('btn-rest')?.addEventListener('click', () => {
      // Heal first member for now (simplified)
      const heroId = state.party.members[0].id;
      dispatch({ type: 'TAKE_SHORT_REST', actorIdsToHeal: [heroId] });
  });
  
  // Equip buttons - select party member
  document.querySelectorAll('.btn-equip-to').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const el = e.target as HTMLElement;
          const itemId = el.getAttribute('data-equip');
          const actorId = el.getAttribute('data-actor');
          const slot = el.getAttribute('data-slot') as string | null;
          if (itemId && actorId) {
              dispatch({ type: 'EQUIP_ITEM', actorId, itemId, slot: (slot as any) || undefined });
          }
      });
  });

  // Rename buttons
  document.querySelectorAll('.btn-rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
           e.stopPropagation(); // prevent bubbling if inside clickable slot
           const el = e.target as HTMLElement;
           const id = el.getAttribute('data-rename');
           if (id) {
               const newName = prompt('Enter new name for item:');
               if (newName && newName.trim().length > 0) {
                   dispatch({ type: 'RENAME_ITEM', itemId: id, newName: newName.trim() });
               }
           }
      });
  });

  // Unequip buttons
  document.querySelectorAll('.btn-unequip').forEach(btn => {
      btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const el = e.target as HTMLElement;
          const actorId = el.getAttribute('data-actor');
          const slot = el.getAttribute('data-slot');
          if (actorId && slot) {
              dispatch({ type: 'UNEQUIP_ITEM', actorId, slot: slot as any });
          }
      });
  });
  
  // Stat Up buttons
  document.querySelectorAll('.btn-stat-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const el = e.target as HTMLElement;
          const actorId = el.getAttribute('data-actor');
          const stat = el.getAttribute('data-stat');
          if (actorId && stat) {
              dispatch({ type: 'SPEND_STAT_POINT', actorId, stat: stat as any });
          }
      });
  });
  
  // Attack buttons
  document.querySelectorAll('.btn-attack').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const el = e.target as HTMLElement;
          const attackerId = el.getAttribute('data-attacker');
          const targetId = el.getAttribute('data-target');
          if (attackerId && targetId) {
              dispatch({ type: 'ATTACK', attackerId, targetId });
          }
      });
  });
  
  // Escape button
  document.getElementById('btn-escape')?.addEventListener('click', () => {
      dispatch({ type: 'ESCAPE' });
  });
  
  // Ability buttons
  document.querySelectorAll('.btn-ability').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const el = e.target as HTMLElement;
          const actorId = el.getAttribute('data-actor');
          const abilityId = el.getAttribute('data-ability');
          const targetId = el.getAttribute('data-target') || undefined;
          if (actorId && abilityId) {
              dispatch({ type: 'USE_ABILITY', actorId, abilityId, targetId });
          }
      });
  });
  
  // Trap buttons
  document.getElementById('btn-disarm')?.addEventListener('click', () => {
      dispatch({ type: 'DISARM_TRAP' });
  });
  
  document.getElementById('btn-trigger')?.addEventListener('click', () => {
      dispatch({ type: 'TRIGGER_TRAP' });
  });
  
  // Shrine pray button
  document.getElementById('btn-pray')?.addEventListener('click', () => {
      dispatch({ type: 'PRAY_AT_SHRINE' });
  });
  
  // Victory continue
  document.getElementById('btn-continue')?.addEventListener('click', () => {
      dispatch({ type: 'DISMISS_POPUP' });
  });
  
  
  // Long rest at intermission
  document.getElementById('btn-long-rest')?.addEventListener('click', () => {
      dispatch({ type: 'TAKE_LONG_REST' });
  });
  
  // Hire recruit
  document.querySelectorAll('.btn-hire').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const recruitId = (e.target as HTMLElement).getAttribute('data-recruit');
          if (recruitId) {
              dispatch({ type: 'HIRE_RECRUIT', recruitId });
          }
      });
  });
  
  // Advance to next segment (with confirmation)
  document.getElementById('btn-advance-confirm')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to continue? The next segment will be harder!')) {
          dispatch({ type: 'ADVANCE_ROOM' });
      }
  });
  
  // Buy item from shop
  document.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const itemId = (e.target as HTMLElement).getAttribute('data-item');
          const itemCost = parseInt((e.target as HTMLElement).closest('.shop-item')?.querySelector('.item-cost')?.textContent?.replace(/[^\d]/g, '') || '0');
          if (itemId && itemCost) {
              dispatch({ type: 'BUY_ITEM', itemId, cost: itemCost });
          }
      });
  });
  
}

// Start
update();
