/**
 * 🧮 Derived Signals - Computed values for UI components
 * 
 * These signals provide pre-calculated values that minimize
 * re-renders and simplify component logic.
 * 
 * @module state/derived
 */

import { computed } from '@preact/signals';
import { 
  gameState, 
  partyMembers,
  alivePartyMembers,
  currentRoom, 
  currentDepth,
  isInCombat,
  livingEnemies,
  gold,
  inventoryItems,
  isGameOver,
  isRoomResolved
} from './gameState';
import type { Actor, Enemy, Item, RecruitOption, Role } from '@engine/types';

// ─────────────────────────────────────────────────────────────
// 🎭 Party Derived Signals
// ─────────────────────────────────────────────────────────────

/** Total party HP (current / max) */
export const partyHealth = computed(() => {
  const members = partyMembers.value;
  const current = members.reduce((sum, m) => sum + m.hp.current, 0);
  const max = members.reduce((sum, m) => sum + m.hp.max, 0);
  return { current, max, percentage: max > 0 ? (current / max) * 100 : 0 };
});

/** Average party level */
export const partyLevel = computed(() => {
  const members = partyMembers.value;
  if (members.length === 0) return 0;
  return Math.floor(members.reduce((sum, m) => sum + m.level, 0) / members.length);
});

/** Party composition summary for UI display */
export const partyComposition = computed(() => {
  const members = partyMembers.value;
  return members.map(m => ({ 
    id: m.id, 
    name: m.name, 
    role: m.role, 
    hp: m.hp.current, 
    maxHp: m.hp.max,
    level: m.level,
    isAlive: m.isAlive
  }));
});

/** Check if party has a healer (cleric) */
export const hasHealer = computed(() => 
  partyMembers.value.some(m => m.role === 'cleric' && m.isAlive)
);

/** Check if party has a tank (fighter) */
export const hasTank = computed(() => 
  partyMembers.value.some(m => m.role === 'fighter' && m.isAlive)
);

/** Party roles breakdown for UI */
export const partyRoles = computed(() => {
  const members = alivePartyMembers.value;
  const roles: Record<Role, number> = {
    fighter: 0,
    wizard: 0,
    rogue: 0,
    cleric: 0,
    ranger: 0
  };
  members.forEach(m => { roles[m.role]++; });
  return roles;
});

/** Dead party members count */
export const deadMemberCount = computed(() => 
  partyMembers.value.filter(m => !m.isAlive || m.hp.current <= 0).length
);

// ─────────────────────────────────────────────────────────────
// ⚔️ Combat Derived Signals
// ─────────────────────────────────────────────────────────────

/** Alias for livingEnemies with explicit Enemy[] type */
export const aliveEnemies = computed((): Enemy[] => livingEnemies.value);

/** Total enemy health remaining */
export const enemyHealthTotal = computed(() => {
  const enemies = aliveEnemies.value;
  const current = enemies.reduce((sum, e) => sum + e.hp, 0);
  const max = enemies.reduce((sum, e) => sum + e.maxHp, 0);
  return { current, max, percentage: max > 0 ? (current / max) * 100 : 0 };
});

/** Total enemy count in current room */
export const enemyCount = computed(() => ({
  total: currentRoom.value?.enemies.length ?? 0,
  alive: aliveEnemies.value.length,
  dead: (currentRoom.value?.enemies.length ?? 0) - aliveEnemies.value.length
}));

/** Is it player's turn in combat */
export const isPlayerTurn = computed(() => 
  isInCombat.value && gameState.value?.combatTurn === 'player'
);

/** Is it enemy's turn in combat */
export const isEnemyTurn = computed(() => 
  isInCombat.value && gameState.value?.combatTurn === 'enemy'
);

/** Current combat round number */
export const combatRound = computed(() => 
  gameState.value?.combatRound ?? 0
);

/** Party members who have already acted this round */
export const actedThisRound = computed(() => 
  gameState.value?.actedThisRound ?? []
);

/** Party members who can still act this round */
export const canActThisRound = computed(() => {
  const acted = actedThisRound.value;
  return alivePartyMembers.value.filter(m => !acted.includes(m.id));
});

/** Extra actions remaining (e.g., from Action Surge) */
export const extraActions = computed(() => 
  gameState.value?.extraActions ?? 0
);

/** Combat is finished (all enemies dead or party fled) */
export const combatFinished = computed(() => 
  currentRoom.value?.type === 'combat' && aliveEnemies.value.length === 0
);

// ─────────────────────────────────────────────────────────────
// 🎒 Inventory Derived Signals
// ─────────────────────────────────────────────────────────────

/** Count of inventory items */
export const inventoryCount = computed(() => inventoryItems.value.length);

/** Inventory items by type */
export const itemsByType = computed(() => {
  const items = inventoryItems.value;
  const grouped: Record<string, Item[]> = {};
  items.forEach(item => {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  });
  return grouped;
});

/** Items sorted by rarity */
export const itemsByRarity = computed(() => {
  const items = inventoryItems.value;
  const rarityOrder = ['godly', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  return [...items].sort((a, b) => 
    rarityOrder.indexOf(a.rarity ?? 'common') - rarityOrder.indexOf(b.rarity ?? 'common')
  );
});

/** Consumables in inventory */
export const consumableItems = computed(() => 
  gameState.value?.inventory.consumables ?? []
);

/** Equipped items across all party members */
export const allEquippedItems = computed(() => {
  const members = partyMembers.value;
  const equipped: Array<{ memberId: string; memberName: string; slot: string; item: Item }> = [];
  
  members.forEach(m => {
    Object.entries(m.equipment).forEach(([slot, item]) => {
      if (item) {
        equipped.push({ memberId: m.id, memberName: m.name, slot, item });
      }
    });
  });
  
  return equipped;
});

/** Items with notable stats/enchantments */
export const notableItems = computed(() => 
  inventoryItems.value.filter(item => 
    item.rarity === 'epic' || 
    item.rarity === 'legendary' || 
    item.rarity === 'godly' ||
    item.enchantment !== undefined
  )
);

// ─────────────────────────────────────────────────────────────
// 🏪 Shop Derived Signals
// ─────────────────────────────────────────────────────────────

/** Shop items available in current room */
export const shopItems = computed((): Item[] => 
  currentRoom.value?.shopItems ?? []
);

/** Available recruits in current room */
export const availableRecruits = computed((): RecruitOption[] => 
  currentRoom.value?.availableRecruits ?? []
);

/** Loot items in current room */
export const roomLoot = computed((): Item[] => 
  currentRoom.value?.loot ?? []
);

/** Can afford any shop item */
export const canAffordAnyItem = computed(() => {
  const currentGold = gold.value;
  return shopItems.value.some(item => item.cost <= currentGold);
});

/** Can afford any recruit */
export const canAffordAnyRecruit = computed(() => {
  const currentGold = gold.value;
  return availableRecruits.value.some(recruit => recruit.cost <= currentGold);
});

/** Affordable shop items */
export const affordableItems = computed(() => {
  const currentGold = gold.value;
  return shopItems.value.filter(item => item.cost <= currentGold);
});

/** Affordable recruits */
export const affordableRecruits = computed(() => {
  const currentGold = gold.value;
  return availableRecruits.value.filter(recruit => recruit.cost <= currentGold);
});

// ─────────────────────────────────────────────────────────────
// 📊 Progress Derived Signals
// ─────────────────────────────────────────────────────────────

/** Current segment (dungeon level tier, 1-indexed for display) */
export const currentSegmentDisplay = computed(() => 
  Math.floor(currentDepth.value / 10) + 1
);

/** Room number within segment (1-10) for display */
export const roomInSegmentDisplay = computed(() => 
  (currentDepth.value % 10) + 1
);

/** Segment progress percentage */
export const segmentProgress = computed(() => 
  (roomInSegmentDisplay.value / 10) * 100
);

/** Is at boss room */
export const isAtBossRoom = computed(() => 
  currentRoom.value?.type === 'boss'
);

/** Is at intermission/trader */
export const isAtIntermission = computed(() => 
  currentRoom.value?.type === 'intermission' || currentRoom.value?.type === 'trader'
);

/** Is at shrine */
export const isAtShrine = computed(() => 
  currentRoom.value?.type === 'shrine'
);

/** Is at hazard room */
export const isAtHazard = computed(() => 
  currentRoom.value?.type === 'hazard'
);

/** Is at elite combat room */
export const isAtElite = computed(() => 
  currentRoom.value?.type === 'elite'
);

/** Is at ally recruitment room */
export const isAtAlly = computed(() => 
  currentRoom.value?.type === 'ally'
);

/** Is in optional boss room from intermission */
export const isInBossRoom = computed(() => 
  gameState.value?.inBossRoom ?? false
);

/** Short rests remaining */
export const shortRestsRemaining = computed(() => 
  gameState.value?.shortRestsRemaining ?? 0
);

/** Long rests taken */
export const longRestsTaken = computed(() => 
  gameState.value?.longRestsTaken ?? 0
);

// ─────────────────────────────────────────────────────────────
// 🎯 UI Helper Signals
// ─────────────────────────────────────────────────────────────

/** Available actions based on room type and game state */
export const availableActions = computed(() => {
  const room = currentRoom.value;
  if (!room) return [];
  
  const actions: string[] = [];
  
  // Combat rooms
  if ((room.type === 'combat' || room.type === 'elite' || room.type === 'boss') && aliveEnemies.value.length > 0) {
    if (isPlayerTurn.value) {
      actions.push('attack', 'ability', 'escape');
    }
    return actions;
  }
  
  // Room resolved - can continue
  if (isRoomResolved.value) {
    actions.push('continue');
    return actions;
  }
  
  // Shrine room
  if (room.type === 'shrine') {
    actions.push('pray', 'skip');
  } 
  // Intermission/Trader room
  else if (room.type === 'intermission' || room.type === 'trader') {
    if (shopItems.value.length > 0) actions.push('shop');
    if (shortRestsRemaining.value > 0) actions.push('rest');
    if (availableRecruits.value.length > 0) actions.push('recruit');
    if (room.bossRoom) actions.push('boss_challenge');
    actions.push('continue');
  } 
  // Hazard room
  else if (room.type === 'hazard') {
    actions.push('disarm', 'trigger', 'skip');
  }
  // Ally room  
  else if (room.type === 'ally') {
    if (availableRecruits.value.length > 0) actions.push('recruit');
    actions.push('continue');
  }
  // Default - just continue
  else {
    actions.push('continue');
  }
  
  return actions;
});

/** Show game over overlay */
export const showGameOver = computed(() => 
  isGameOver.value || alivePartyMembers.value.length === 0
);

/** Show victory overlay */
export const showVictory = computed(() => 
  gameState.value?.victory === true
);

/** Show shrine boon message */
export const showShrineBoon = computed(() => 
  gameState.value?.shrineBoon !== null && gameState.value?.shrineBoon !== undefined
);

/** Show pending boss reward */
export const showBossReward = computed(() => 
  gameState.value?.pendingBossReward === true
);

/** Current game phase for UI routing */
export const gamePhase = computed(() => {
  if (!gameState.value) return 'menu';
  if (showGameOver.value) return 'gameover';
  if (showVictory.value) return 'victory';
  if (isInCombat.value) return 'combat';
  if (isAtIntermission.value) return 'intermission';
  if (isAtShrine.value) return 'shrine';
  if (isAtHazard.value) return 'hazard';
  return 'exploration';
});

/** Room type display name */
export const roomTypeName = computed(() => {
  const room = currentRoom.value;
  if (!room) return 'Unknown';
  
  const typeNames: Record<string, string> = {
    combat: 'Combat',
    elite: 'Elite Combat',
    hazard: 'Hazard',
    trader: 'Trader',
    ally: 'Ally',
    shrine: 'Shrine',
    intermission: 'Rest Stop',
    boss: 'Boss'
  };
  
  return typeNames[room.type] ?? room.type;
});
