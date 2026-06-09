/**
 * 🎮 Game State Store using Preact Signals
 * 
 * Provides reactive game state with minimal re-renders.
 * Uses signals for fine-grained reactivity.
 * 
 * @module state/gameState
 */

import { signal, computed } from '@preact/signals';
import type { RunState, Room, Actor, PartyState } from '@engine/types';

// ─────────────────────────────────────────────────────────────
// 🎯 Core Game State Signal
// ─────────────────────────────────────────────────────────────

/** Main game state - null when no game is running */
export const gameState = signal<RunState | null>(null);

// ─────────────────────────────────────────────────────────────
// 📊 State Query Computed Signals
// ─────────────────────────────────────────────────────────────

/** Check if a game is currently running */
export const hasActiveGame = computed(() => gameState.value !== null);

/** Get current room or null */
export const currentRoom = computed(() => gameState.value?.currentRoom ?? null);

/** Get party state (members + gold) */
export const party = computed(() => gameState.value?.party ?? null);

/** Get party members array */
export const partyMembers = computed(() => gameState.value?.party.members ?? []);

/** Get alive party members (hp.current > 0) */
export const alivePartyMembers = computed(() => 
  partyMembers.value.filter(m => m.hp.current > 0)
);

/** Get current depth */
export const currentDepth = computed(() => gameState.value?.depth ?? 0);

/** Get current segment index (0-indexed, each segment is 10 rooms) */
export const currentSegment = computed(() => Math.floor(currentDepth.value / 10));

/** Get current room number within segment (1-10) */
export const roomInSegment = computed(() => (currentDepth.value % 10) + 1);

/** Check if in combat (combat room with living enemies) */
export const isInCombat = computed(() => {
  const room = currentRoom.value;
  if (!room) return false;
  const isCombatType = room.type === 'combat' || room.type === 'elite' || room.type === 'boss';
  return isCombatType && room.enemies.some(e => e.hp > 0);
});

/** Get living enemies in current room */
export const livingEnemies = computed(() => 
  currentRoom.value?.enemies.filter(e => e.hp > 0) ?? []
);

/** Get party gold */
export const gold = computed(() => gameState.value?.party.gold ?? 0);

/** Get inventory items */
export const inventoryItems = computed(() => gameState.value?.inventory.items ?? []);

/** Check if game is over */
export const isGameOver = computed(() => gameState.value?.gameOver ?? false);

/** Check if room is resolved */
export const isRoomResolved = computed(() => gameState.value?.roomResolved ?? false);

/** Get combat history/log */
export const historyLog = computed(() => gameState.value?.history ?? []);

/** Get current theme ID */
export const themeId = computed(() => gameState.value?.themeId ?? 'dungeon_start');

/** Check whose turn it is in combat */
export const combatTurn = computed(() => gameState.value?.combatTurn ?? null);

/** Get shrine boon message (if any) */
export const shrineBoon = computed(() => gameState.value?.shrineBoon ?? null);

// ─────────────────────────────────────────────────────────────
// 🔄 State Update Functions
// ─────────────────────────────────────────────────────────────

/** Initialize a new game state */
export function initGame(initialState: RunState): void {
  gameState.value = initialState;
}

/** Update game state with partial changes (shallow merge) */
export function updateState(updates: Partial<RunState>): void {
  if (gameState.value) {
    gameState.value = { ...gameState.value, ...updates };
  }
}

/** Update current room */
export function updateRoom(roomUpdates: Partial<Room>): void {
  if (gameState.value?.currentRoom) {
    gameState.value = {
      ...gameState.value,
      currentRoom: { ...gameState.value.currentRoom, ...roomUpdates }
    };
  }
}

/** Update party state (gold, members array) */
export function updateParty(partyUpdates: Partial<PartyState>): void {
  if (gameState.value) {
    gameState.value = {
      ...gameState.value,
      party: { ...gameState.value.party, ...partyUpdates }
    };
  }
}

/** Update a party member by ID */
export function updatePartyMember(memberId: string, updates: Partial<Actor>): void {
  if (gameState.value) {
    gameState.value = {
      ...gameState.value,
      party: {
        ...gameState.value.party,
        members: gameState.value.party.members.map(m => 
          m.id === memberId ? { ...m, ...updates } : m
        )
      }
    };
  }
}

/** Add gold to party */
export function addGold(amount: number): void {
  if (gameState.value) {
    updateParty({ gold: gameState.value.party.gold + amount });
  }
}

/** Spend gold from party (returns false if insufficient funds) */
export function spendGold(amount: number): boolean {
  if (!gameState.value || gameState.value.party.gold < amount) {
    return false;
  }
  updateParty({ gold: gameState.value.party.gold - amount });
  return true;
}

/** Add message to history log */
export function addToHistory(message: string): void {
  if (gameState.value) {
    updateState({ 
      history: [...gameState.value.history, message] 
    });
  }
}

/** Clear game state */
export function clearGame(): void {
  gameState.value = null;
}
