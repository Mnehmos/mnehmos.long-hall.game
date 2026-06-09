/**
 * InventoryManager Island Component
 * 
 * Inventory and equipment management island with paper doll display,
 * inventory grid, item tooltips, drag & drop equipping, and item comparison.
 * 
 * Hydration: client:visible (hydrates when scrolled into view)
 * 
 * @module islands/InventoryManager
 * @see {@link file://./../state/gameState.ts} for state signals
 * @see {@link file://./../state/derived.ts} for derived state
 */

import { useState, useCallback, useMemo } from 'preact/hooks';
import type { FunctionalComponent, JSX } from 'preact';

// Context and state
import { useGameEngine } from './GameEngine';
import { partyMembers, inventoryItems, gold } from '../state/gameState';
import { allEquippedItems, itemsByType } from '../state/derived';

// Types
import type { Item, Actor, EquipmentSlot } from '../engine/types';

// ============================================================================
// Types
// ============================================================================

export interface InventoryManagerProps {
  /** View mode: 'compact' for sidebar, 'full' for modal */
  mode: 'compact' | 'full';
  /** Selected party member ID (for equipment display) */
  selectedMemberId?: string;
}

interface EquipmentSlotProps {
  slot: EquipmentSlot;
  item: Item | undefined;
  onUnequip: () => void;
  onDrop: (item: Item) => void;
  isDragOver?: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}

interface InventoryItemProps {
  item: Item;
  isSelected: boolean;
  onSelect: () => void;
  onEquip: () => void;
  onSell: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}

interface ItemDetailsProps {
  item: Item;
  compareWith?: Item;
}

// ============================================================================
// Constants
// ============================================================================

/** Equipment slots in display order */
const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'head', 'neck', 'chest', 'legs', 'feet',
  'main_hand', 'off_hand', 'ring1', 'ring2'
];

/** Slot display names */
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  head: 'Head',
  neck: 'Neck',
  chest: 'Chest',
  legs: 'Legs',
  feet: 'Feet',
  main_hand: 'Main Hand',
  off_hand: 'Off Hand',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

/** Slot icons for visual display */
const SLOT_ICONS: Record<EquipmentSlot, string> = {
  head: '🪖',
  neck: '📿',
  chest: '🎽',
  legs: '👖',
  feet: '👢',
  main_hand: '⚔️',
  off_hand: '🛡️',
  ring1: '💍',
  ring2: '💍',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an item can be equipped to a specific slot
 */
function canEquipToSlot(item: Item, slot: EquipmentSlot): boolean {
  const typeToSlots: Record<string, EquipmentSlot[]> = {
    weapon: ['main_hand'],
    shield: ['off_hand'],
    ring: ['ring1', 'ring2'],
    head: ['head'],
    neck: ['neck'],
    chest: ['chest'],
    legs: ['legs'],
    feet: ['feet'],
    armor: ['chest'], // General armor goes to chest by default
  };
  return typeToSlots[item.type]?.includes(slot) ?? false;
}

/**
 * Get CSS color variable for rarity
 */
function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'var(--text-muted, #9ca3af)',
    uncommon: 'var(--uncommon, #2ecc71)',
    rare: 'var(--rare, #3498db)',
    epic: 'var(--epic, #9b59b6)',
    legendary: 'var(--legendary, #f39c12)',
    godly: 'var(--godly, #e74c3c)',
  };
  return colors[rarity] ?? colors.common;
}

/**
 * Get CSS class name for rarity
 */
function getRarityClass(rarity: string): string {
  return `rarity-${rarity}`;
}

/**
 * Calculate total stats from item (base + enchantment)
 */
function getTotalItemStats(item: Item) {
  const base = item.baseStats ?? {};
  const enchant = item.enchantment?.effect ?? {};
  
  return {
    attackBonus: (base.attackBonus ?? 0) + (enchant.attackBonus ?? 0),
    damageBonus: (base.damageBonus ?? 0) + (enchant.damageBonus ?? 0),
    acBonus: (base.acBonus ?? 0) + (enchant.acBonus ?? 0),
    maxHpBonus: (base.maxHpBonus ?? 0) + (enchant.maxHpBonus ?? 0),
    escapeBonus: enchant.escapeBonus ?? 0,
    lootBonus: enchant.lootBonus ?? 0,
    goldBonus: enchant.goldBonus ?? 0,
  };
}

/**
 * Get the slot type for an item (for auto-equip detection)
 */
function getSlotForItem(item: Item): EquipmentSlot | null {
  const typeToSlot: Record<string, EquipmentSlot> = {
    weapon: 'main_hand',
    shield: 'off_hand',
    head: 'head',
    neck: 'neck',
    chest: 'chest',
    legs: 'legs',
    feet: 'feet',
    ring: 'ring1', // Default to ring1
    armor: 'chest',
  };
  return typeToSlot[item.type] ?? null;
}

/**
 * Get equipped item for a slot from an actor
 */
function getEquippedInSlot(actor: Actor | undefined, itemType: string): Item | undefined {
  if (!actor) return undefined;
  
  // Map item type to equipment slot for comparison
  const typeToSlots: Record<string, EquipmentSlot[]> = {
    weapon: ['main_hand'],
    shield: ['off_hand'],
    ring: ['ring1', 'ring2'],
    head: ['head'],
    neck: ['neck'],
    chest: ['chest'],
    legs: ['legs'],
    feet: ['feet'],
    armor: ['chest'],
  };
  
  const slots = typeToSlots[itemType];
  if (!slots) return undefined;
  
  for (const slot of slots) {
    if (actor.equipment[slot]) {
      return actor.equipment[slot];
    }
  }
  return undefined;
}

// ============================================================================
// EquipmentSlotComponent Sub-component
// ============================================================================

/**
 * Equipment slot in paper doll with drop zone support
 */
function EquipmentSlotComponent({
  slot,
  item,
  onUnequip,
  onDrop,
  isDragOver,
  onDragEnter,
  onDragLeave,
}: EquipmentSlotProps) {
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const itemData = e.dataTransfer?.getData('application/json');
    if (itemData) {
      try {
        const droppedItem = JSON.parse(itemData) as Item;
        if (canEquipToSlot(droppedItem, slot)) {
          onDrop(droppedItem);
        }
      } catch {
        console.warn('[InventoryManager] Failed to parse dropped item data');
      }
    }
    onDragLeave();
  }, [slot, onDrop, onDragLeave]);

  const handleDragEnterEvent = useCallback((e: DragEvent) => {
    e.preventDefault();
    onDragEnter();
  }, [onDragEnter]);

  const handleDragLeaveEvent = useCallback((e: DragEvent) => {
    e.preventDefault();
    onDragLeave();
  }, [onDragLeave]);

  const handleClick = useCallback(() => {
    if (item) {
      onUnequip();
    }
  }, [item, onUnequip]);

  return (
    <div
      class={`equipment-slot slot-${slot} ${item ? 'filled' : 'empty'} ${isDragOver ? 'drag-over' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnterEvent}
      onDragLeave={handleDragLeaveEvent}
      role="button"
      tabIndex={0}
      aria-label={`${SLOT_NAMES[slot]}: ${item ? item.customName ?? item.name : 'Empty'}`}
      title={item ? `Click to unequip ${item.customName ?? item.name}` : `${SLOT_NAMES[slot]} (empty)`}
    >
      {item ? (
        <div
          class={`equipped-item ${getRarityClass(item.rarity)}`}
          style={{ borderColor: getRarityColor(item.rarity) }}
        >
          <span class="item-icon">{SLOT_ICONS[slot]}</span>
          <span class="item-name">{item.customName ?? item.name}</span>
        </div>
      ) : (
        <div class="empty-slot">
          <span class="slot-icon">{SLOT_ICONS[slot]}</span>
          <span class="slot-name">{SLOT_NAMES[slot]}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// InventoryItemComponent Sub-component
// ============================================================================

/**
 * Item card in inventory grid with drag support
 */
function InventoryItemComponent({
  item,
  isSelected,
  onSelect,
  onEquip,
  onSell,
  onDragStart,
  onDragEnd,
}: InventoryItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [confirmSell, setConfirmSell] = useState(false);
  
  const stats = getTotalItemStats(item);
  const sellPrice = Math.floor(item.cost / 2);
  const isRareOrBetter = ['rare', 'epic', 'legendary', 'godly'].includes(item.rarity);

  const handleDoubleClick = useCallback(() => {
    onEquip();
  }, [onEquip]);

  const handleSellClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    if (isRareOrBetter && !confirmSell) {
      setConfirmSell(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmSell(false), 3000);
    } else {
      onSell();
      setConfirmSell(false);
    }
  }, [isRareOrBetter, confirmSell, onSell]);

  const handleDragStartEvent = useCallback((e: DragEvent) => {
    e.dataTransfer!.setData('application/json', JSON.stringify(item));
    e.dataTransfer!.effectAllowed = 'move';
    onDragStart(e);
  }, [item, onDragStart]);

  return (
    <div
      class={`inventory-item ${getRarityClass(item.rarity)} ${isSelected ? 'selected' : ''}`}
      style={{ borderColor: getRarityColor(item.rarity) }}
      onClick={onSelect}
      onDblClick={handleDoubleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => { setShowTooltip(false); setConfirmSell(false); }}
      draggable
      onDragStart={handleDragStartEvent}
      onDragEnd={onDragEnd}
      role="button"
      tabIndex={0}
      aria-label={`${item.customName ?? item.name} (${item.rarity})`}
      aria-pressed={isSelected}
    >
      <div class="item-header">
        <span class="item-name">{item.customName ?? item.name}</span>
        <span class="item-type">{item.type}</span>
      </div>

      {/* Quick stats preview */}
      <div class="item-quick-stats">
        {stats.attackBonus > 0 && <span class="stat">+{stats.attackBonus} ATK</span>}
        {stats.damageBonus > 0 && <span class="stat">+{stats.damageBonus} DMG</span>}
        {stats.acBonus > 0 && <span class="stat">+{stats.acBonus} AC</span>}
        {stats.maxHpBonus > 0 && <span class="stat">+{stats.maxHpBonus} HP</span>}
      </div>

      {/* Sell button */}
      <button
        class={`sell-btn ${confirmSell ? 'confirm' : ''}`}
        onClick={handleSellClick}
        title={confirmSell ? 'Click again to confirm' : `Sell for ${sellPrice} gold`}
      >
        {confirmSell ? '⚠️ Confirm?' : `💰 ${sellPrice}`}
      </button>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div class="item-tooltip" role="tooltip">
          <div class="tooltip-header" style={{ color: getRarityColor(item.rarity) }}>
            {item.customName ?? item.name}
          </div>
          <div class="tooltip-type">{item.type} • {item.rarity}</div>
          
          {/* Base stats */}
          <div class="tooltip-section">
            <div class="section-title">Stats</div>
            {stats.attackBonus !== 0 && <div>Attack: {stats.attackBonus > 0 ? '+' : ''}{stats.attackBonus}</div>}
            {stats.damageBonus !== 0 && <div>Damage: {stats.damageBonus > 0 ? '+' : ''}{stats.damageBonus}</div>}
            {stats.acBonus !== 0 && <div>AC: {stats.acBonus > 0 ? '+' : ''}{stats.acBonus}</div>}
            {stats.maxHpBonus !== 0 && <div>Max HP: {stats.maxHpBonus > 0 ? '+' : ''}{stats.maxHpBonus}</div>}
          </div>

          {/* Enchantment */}
          {item.enchantment && (
            <div class="tooltip-section enchantment">
              <div class="section-title" style={{ color: 'var(--magic, #a855f7)' }}>
                ✨ {item.enchantment.name}
              </div>
              <div class="enchant-desc">{item.enchantment.description}</div>
            </div>
          )}

          {/* Mastery stats */}
          {item.stats && item.stats.kills > 0 && (
            <div class="tooltip-section mastery">
              <div class="section-title">Mastery</div>
              <div>Kills: {item.stats.kills}</div>
              <div>Damage Dealt: {item.stats.damageDealt}</div>
              {item.stats.highestHit > 0 && <div>Highest Hit: {item.stats.highestHit}</div>}
            </div>
          )}

          <div class="tooltip-footer">
            <span>Double-click to equip</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ItemDetails Sub-component
// ============================================================================

/**
 * Detailed item view with comparison panel
 */
function ItemDetails({ item, compareWith }: ItemDetailsProps) {
  const itemStats = getTotalItemStats(item);
  const compareStats = compareWith ? getTotalItemStats(compareWith) : null;

  const renderStatComparison = (
    label: string,
    current: number,
    compare: number | undefined
  ) => {
    const diff = compare !== undefined ? current - compare : 0;
    const diffClass = diff > 0 ? 'better' : diff < 0 ? 'worse' : 'same';
    
    return (
      <div class="stat-row">
        <span class="stat-label">{label}</span>
        <span class="stat-value">{current > 0 ? '+' : ''}{current}</span>
        {compare !== undefined && diff !== 0 && (
          <span class={`stat-diff ${diffClass}`}>
            ({diff > 0 ? '+' : ''}{diff})
          </span>
        )}
      </div>
    );
  };

  return (
    <div class="item-details-panel">
      <div class="details-header" style={{ borderColor: getRarityColor(item.rarity) }}>
        <h3 style={{ color: getRarityColor(item.rarity) }}>
          {item.customName ?? item.name}
        </h3>
        <span class="item-meta">{item.type} • {item.rarity}</span>
      </div>

      <div class="stats-comparison">
        <div class="comparison-column">
          <h4>Selected Item</h4>
          {renderStatComparison('Attack', itemStats.attackBonus, compareStats?.attackBonus)}
          {renderStatComparison('Damage', itemStats.damageBonus, compareStats?.damageBonus)}
          {renderStatComparison('AC', itemStats.acBonus, compareStats?.acBonus)}
          {renderStatComparison('Max HP', itemStats.maxHpBonus, compareStats?.maxHpBonus)}
          {itemStats.escapeBonus > 0 && renderStatComparison('Escape %', itemStats.escapeBonus, compareStats?.escapeBonus)}
          {itemStats.lootBonus > 0 && renderStatComparison('Loot %', itemStats.lootBonus, compareStats?.lootBonus)}
          {itemStats.goldBonus > 0 && renderStatComparison('Gold %', itemStats.goldBonus, compareStats?.goldBonus)}
        </div>

        {compareWith && (
          <div class="comparison-column equipped">
            <h4>Currently Equipped</h4>
            <div class="equipped-item-name" style={{ color: getRarityColor(compareWith.rarity) }}>
              {compareWith.customName ?? compareWith.name}
            </div>
          </div>
        )}
      </div>

      {item.enchantment && (
        <div class="enchantment-details">
          <h4 style={{ color: 'var(--magic, #a855f7)' }}>✨ {item.enchantment.name}</h4>
          <p>{item.enchantment.description}</p>
        </div>
      )}

      {item.history && item.history.length > 0 && (
        <div class="item-history">
          <h4>History</h4>
          <ul>
            {item.history.slice(-5).map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component Implementation
// ============================================================================

/**
 * InventoryManager - Equipment and inventory management island
 * 
 * @example Usage in Astro
 * ```astro
 * ---
 * import InventoryManager from '@islands/InventoryManager';
 * ---
 * <InventoryManager client:visible mode="full" selectedMemberId="hero-1" />
 * ```
 */
const InventoryManager: FunctionalComponent<InventoryManagerProps> = ({
  mode,
  selectedMemberId,
}) => {
  const { dispatchAction } = useGameEngine();

  // Read reactive state from signals
  const members = partyMembers.value;
  const items = inventoryItems.value;
  const currentGold = gold.value;

  // Local state
  const [selectedMember, setSelectedMember] = useState<string>(
    selectedMemberId ?? members[0]?.id ?? ''
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);

  // Get active member
  const activeMember = useMemo(
    () => members.find(m => m.id === selectedMember),
    [members, selectedMember]
  );

  // ─────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────

  const handleEquip = useCallback((itemId: string, slot?: EquipmentSlot) => {
    if (!activeMember) return;
    dispatchAction({
      type: 'EQUIP_ITEM',
      actorId: activeMember.id,
      itemId,
      slot,
    });
    setSelectedItem(null);
  }, [activeMember, dispatchAction]);

  const handleUnequip = useCallback((slot: EquipmentSlot) => {
    if (!activeMember) return;
    dispatchAction({
      type: 'UNEQUIP_ITEM',
      actorId: activeMember.id,
      slot,
    });
  }, [activeMember, dispatchAction]);

  const handleSell = useCallback((itemId: string) => {
    dispatchAction({
      type: 'SELL_ITEM',
      itemId,
    });
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  }, [dispatchAction, selectedItem]);

  const handleDragStart = useCallback((item: Item) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverSlot(null);
  }, []);

  const handleSlotDragEnter = useCallback((slot: EquipmentSlot) => {
    if (draggedItem && canEquipToSlot(draggedItem, slot)) {
      setDragOverSlot(slot);
    }
  }, [draggedItem]);

  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleSlotDrop = useCallback((slot: EquipmentSlot) => (item: Item) => {
    if (activeMember && canEquipToSlot(item, slot)) {
      handleEquip(item.id, slot);
    }
  }, [activeMember, handleEquip]);

  // Determine comparison item for selected item
  const comparisonItem = useMemo(() => {
    if (!selectedItem || !activeMember) return undefined;
    return getEquippedInSlot(activeMember, selectedItem.type);
  }, [selectedItem, activeMember]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div class={`inventory-manager mode-${mode}`}>
      {/* Party member tabs (if multiple members) */}
      {members.length > 1 && (
        <div class="member-tabs" role="tablist">
          {members.map(m => (
            <button
              key={m.id}
              role="tab"
              class={`member-tab ${m.id === selectedMember ? 'active' : ''} ${!m.isAlive ? 'dead' : ''}`}
              onClick={() => setSelectedMember(m.id)}
              aria-selected={m.id === selectedMember}
              aria-controls="equipment-panel"
              disabled={!m.isAlive}
            >
              <span class="member-name">{m.name}</span>
              <span class="member-role">{m.role}</span>
            </button>
          ))}
        </div>
      )}

      <div class="inventory-content">
        {/* Paper Doll (Equipment Slots) */}
        <div class="paper-doll" id="equipment-panel" role="tabpanel">
          <h3 class="section-title">Equipment</h3>
          <div class="equipment-grid">
            {EQUIPMENT_SLOTS.map(slot => (
              <EquipmentSlotComponent
                key={slot}
                slot={slot}
                item={activeMember?.equipment[slot]}
                onUnequip={() => handleUnequip(slot)}
                onDrop={handleSlotDrop(slot)}
                isDragOver={dragOverSlot === slot && draggedItem !== null && canEquipToSlot(draggedItem, slot)}
                onDragEnter={() => handleSlotDragEnter(slot)}
                onDragLeave={handleSlotDragLeave}
              />
            ))}
          </div>
        </div>

        {/* Inventory Grid */}
        <div class="inventory-section">
          <div class="inventory-header">
            <h3 class="section-title">Inventory ({items.length})</h3>
            <span class="gold-display">💰 {currentGold}</span>
          </div>
          
          {items.length > 0 ? (
            <div class="inventory-grid" role="list">
              {items.map(item => (
                <InventoryItemComponent
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  onSelect={() => setSelectedItem(item)}
                  onEquip={() => handleEquip(item.id)}
                  onSell={() => handleSell(item.id)}
                  onDragStart={() => handleDragStart(item)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          ) : (
            <div class="empty-inventory">
              <span class="empty-icon">🎒</span>
              <span class="empty-text">No items in inventory</span>
            </div>
          )}
        </div>

        {/* Item Details Panel (full mode only) */}
        {mode === 'full' && selectedItem && (
          <ItemDetails
            item={selectedItem}
            compareWith={comparisonItem}
          />
        )}
      </div>

      {/* Scoped Styles */}
      <style>{`
        .inventory-manager {
          display: flex;
          flex-direction: column;
          gap: var(--space-4, 1rem);
          padding: var(--space-4, 1rem);
          background: var(--surface-1, #1a1a2e);
          border-radius: var(--radius-lg, 0.75rem);
        }

        .inventory-manager.mode-compact {
          padding: var(--space-2, 0.5rem);
          gap: var(--space-2, 0.5rem);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Member Tabs */
        /* ─────────────────────────────────────────────────────────── */

        .member-tabs {
          display: flex;
          gap: var(--space-2, 0.5rem);
          padding-bottom: var(--space-2, 0.5rem);
          border-bottom: 1px solid var(--border, #374151);
          overflow-x: auto;
        }

        .member-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
          background: var(--surface-2, #25294a);
          border: 2px solid transparent;
          border-radius: var(--radius-md, 0.5rem);
          cursor: pointer;
          transition: all 0.15s ease;
          min-width: 80px;
        }

        .member-tab:hover:not(:disabled) {
          background: var(--surface-3, #2d325c);
        }

        .member-tab.active {
          border-color: var(--accent, #6366f1);
          background: var(--surface-3, #2d325c);
        }

        .member-tab.dead {
          opacity: 0.5;
          filter: grayscale(0.8);
        }

        .member-tab:disabled {
          cursor: not-allowed;
        }

        .member-name {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          color: var(--text-primary, #f9fafb);
        }

        .member-role {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          text-transform: capitalize;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Content Layout */
        /* ─────────────────────────────────────────────────────────── */

        .inventory-content {
          display: grid;
          gap: var(--space-4, 1rem);
        }

        .mode-full .inventory-content {
          grid-template-columns: 250px 1fr 300px;
        }

        .mode-compact .inventory-content {
          grid-template-columns: 1fr;
        }

        .section-title {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          color: var(--text-muted, #9ca3af);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-2, 0.5rem);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Paper Doll / Equipment Slots */
        /* ─────────────────────────────────────────────────────────── */

        .paper-doll {
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-lg, 0.75rem);
          padding: var(--space-3, 0.75rem);
        }

        .equipment-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2, 0.5rem);
        }

        .mode-compact .equipment-grid {
          grid-template-columns: repeat(5, 1fr);
        }

        .equipment-slot {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-1, 0.25rem);
          padding: var(--space-2, 0.5rem);
          background: var(--surface-3, #2d325c);
          border: 2px dashed var(--border, #374151);
          border-radius: var(--radius-md, 0.5rem);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          text-align: center;
        }

        .equipment-slot:hover {
          background: var(--surface-4, #3d4370);
        }

        .equipment-slot.filled {
          border-style: solid;
          border-width: 2px;
        }

        .equipment-slot.drag-over {
          background: var(--accent-dim, rgba(99, 102, 241, 0.2));
          border-color: var(--accent, #6366f1);
          border-style: solid;
        }

        .empty-slot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          opacity: 0.6;
        }

        .slot-icon {
          font-size: 1.5rem;
        }

        .mode-compact .slot-icon {
          font-size: 1rem;
        }

        .slot-name {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
        }

        .mode-compact .slot-name {
          display: none;
        }

        .equipped-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 100%;
        }

        .equipped-item .item-icon {
          font-size: 1.5rem;
        }

        .mode-compact .equipped-item .item-icon {
          font-size: 1rem;
        }

        .equipped-item .item-name {
          font-size: var(--text-xs, 0.75rem);
          font-weight: 500;
          color: var(--text-primary, #f9fafb);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 100%;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Inventory Section */
        /* ─────────────────────────────────────────────────────────── */

        .inventory-section {
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-lg, 0.75rem);
          padding: var(--space-3, 0.75rem);
        }

        .inventory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3, 0.75rem);
        }

        .gold-display {
          font-size: var(--text-lg, 1.125rem);
          font-weight: 600;
          color: var(--gold, #fbbf24);
        }

        .inventory-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: var(--space-2, 0.5rem);
          max-height: 400px;
          overflow-y: auto;
        }

        .mode-compact .inventory-grid {
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          max-height: 200px;
        }

        .empty-inventory {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-8, 2rem);
          color: var(--text-muted, #9ca3af);
        }

        .empty-icon {
          font-size: 2rem;
          opacity: 0.5;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Inventory Item */
        /* ─────────────────────────────────────────────────────────── */

        .inventory-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-1, 0.25rem);
          padding: var(--space-2, 0.5rem);
          background: var(--surface-3, #2d325c);
          border: 2px solid;
          border-radius: var(--radius-md, 0.5rem);
          cursor: grab;
          transition: all 0.15s ease;
          position: relative;
        }

        .inventory-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .inventory-item.selected {
          box-shadow: 0 0 0 2px var(--accent, #6366f1);
        }

        .inventory-item:active {
          cursor: grabbing;
        }

        .item-header {
          display: flex;
          flex-direction: column;
        }

        .inventory-item .item-name {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          color: var(--text-primary, #f9fafb);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .item-type {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          text-transform: capitalize;
        }

        .item-quick-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .item-quick-stats .stat {
          font-size: var(--text-xs, 0.75rem);
          color: var(--health, #22c55e);
          background: rgba(34, 197, 94, 0.15);
          padding: 1px 4px;
          border-radius: var(--radius-sm, 0.25rem);
        }

        .sell-btn {
          margin-top: auto;
          padding: var(--space-1, 0.25rem);
          background: var(--surface-4, #3d4370);
          border: none;
          border-radius: var(--radius-sm, 0.25rem);
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sell-btn:hover {
          background: var(--gold, #fbbf24);
          color: black;
        }

        .sell-btn.confirm {
          background: var(--warning, #f59e0b);
          color: white;
          animation: pulse 0.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Rarity Colors */
        /* ─────────────────────────────────────────────────────────── */

        .rarity-common { border-color: var(--text-muted, #9ca3af); }
        .rarity-uncommon { border-color: var(--uncommon, #2ecc71); }
        .rarity-rare { border-color: var(--rare, #3498db); }
        .rarity-epic { border-color: var(--epic, #9b59b6); }
        .rarity-legendary { border-color: var(--legendary, #f39c12); }
        .rarity-godly { border-color: var(--godly, #e74c3c); }

        /* ─────────────────────────────────────────────────────────── */
        /* Item Tooltip */
        /* ─────────────────────────────────────────────────────────── */

        .item-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          width: 200px;
          padding: var(--space-3, 0.75rem);
          background: var(--surface-1, #1a1a2e);
          border: 1px solid var(--border, #374151);
          border-radius: var(--radius-md, 0.5rem);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .tooltip-header {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          margin-bottom: 2px;
        }

        .tooltip-type {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          margin-bottom: var(--space-2, 0.5rem);
        }

        .tooltip-section {
          margin-bottom: var(--space-2, 0.5rem);
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-secondary, #d1d5db);
        }

        .tooltip-section .section-title {
          font-size: var(--text-xs, 0.75rem);
          margin-bottom: 2px;
        }

        .tooltip-section.enchantment {
          padding: var(--space-1, 0.25rem);
          background: rgba(168, 85, 247, 0.1);
          border-radius: var(--radius-sm, 0.25rem);
        }

        .enchant-desc {
          font-style: italic;
        }

        .tooltip-footer {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          font-style: italic;
          text-align: center;
          padding-top: var(--space-2, 0.5rem);
          border-top: 1px solid var(--border, #374151);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Item Details Panel */
        /* ─────────────────────────────────────────────────────────── */

        .item-details-panel {
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-lg, 0.75rem);
          padding: var(--space-4, 1rem);
        }

        .details-header {
          border-left: 3px solid;
          padding-left: var(--space-3, 0.75rem);
          margin-bottom: var(--space-4, 1rem);
        }

        .details-header h3 {
          font-size: var(--text-lg, 1.125rem);
          font-weight: 600;
          margin: 0 0 var(--space-1, 0.25rem) 0;
        }

        .item-meta {
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-muted, #9ca3af);
          text-transform: capitalize;
        }

        .stats-comparison {
          display: flex;
          gap: var(--space-4, 1rem);
          margin-bottom: var(--space-4, 1rem);
        }

        .comparison-column {
          flex: 1;
        }

        .comparison-column h4 {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          color: var(--text-muted, #9ca3af);
          margin-bottom: var(--space-2, 0.5rem);
        }

        .stat-row {
          display: flex;
          gap: var(--space-2, 0.5rem);
          font-size: var(--text-sm, 0.875rem);
          padding: var(--space-1, 0.25rem) 0;
        }

        .stat-label {
          color: var(--text-muted, #9ca3af);
        }

        .stat-value {
          color: var(--text-primary, #f9fafb);
          font-weight: 500;
        }

        .stat-diff {
          font-weight: 600;
        }

        .stat-diff.better {
          color: var(--health, #22c55e);
        }

        .stat-diff.worse {
          color: var(--damage, #ef4444);
        }

        .stat-diff.same {
          color: var(--text-muted, #9ca3af);
        }

        .equipped-item-name {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 500;
        }

        .enchantment-details {
          padding: var(--space-3, 0.75rem);
          background: rgba(168, 85, 247, 0.1);
          border-radius: var(--radius-md, 0.5rem);
          margin-bottom: var(--space-3, 0.75rem);
        }

        .enchantment-details h4 {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          margin-bottom: var(--space-1, 0.25rem);
        }

        .enchantment-details p {
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-secondary, #d1d5db);
          margin: 0;
          font-style: italic;
        }

        .item-history {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
        }

        .item-history h4 {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          margin-bottom: var(--space-1, 0.25rem);
        }

        .item-history ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .item-history li {
          padding: var(--space-1, 0.25rem) 0;
          border-bottom: 1px solid var(--border, #374151);
        }

        .item-history li:last-child {
          border-bottom: none;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Responsive - Mobile First */
        /* ─────────────────────────────────────────────────────────── */

        @media (max-width: 767px) {
          /* Full-screen inventory on mobile */
          .inventory-manager.mode-full {
            position: fixed;
            inset: 0;
            z-index: 50;
            padding: 0;
            border-radius: 0;
            display: flex;
            flex-direction: column;
            padding-top: env(safe-area-inset-top, 0);
            padding-bottom: env(safe-area-inset-bottom, 0);
          }
          
          .mode-full .inventory-content {
            grid-template-columns: 1fr;
            flex: 1;
            overflow-y: auto;
            padding: var(--space-3, 0.75rem);
          }

          .item-details-panel {
            order: -1;
            position: sticky;
            top: 0;
            z-index: 10;
            border-radius: 0;
          }
          
          /* Member tabs horizontal scroll */
          .member-tabs {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: var(--space-2, 0.5rem);
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          
          .member-tabs::-webkit-scrollbar {
            display: none;
          }
          
          .member-tab {
            min-width: 70px;
            flex-shrink: 0;
          }
        }

        @media (max-width: 639px) {
          .inventory-manager {
            padding: var(--space-2, 0.5rem);
            gap: var(--space-2, 0.5rem);
          }
          
          .equipment-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .inventory-grid {
            grid-template-columns: repeat(2, 1fr);
            max-height: none;
          }
          
          /* Larger touch targets for items */
          .inventory-item {
            padding: var(--space-3, 0.75rem);
            min-height: 80px;
          }
          
          .equipment-slot {
            min-height: 60px;
          }
          
          .sell-btn {
            min-height: 36px;
            padding: var(--space-2, 0.5rem);
          }
          
          /* Paper doll compact on mobile */
          .paper-doll {
            padding: var(--space-2, 0.5rem);
          }
          
          .section-title {
            font-size: var(--text-xs, 0.75rem);
          }
          
          /* Item tooltip adjustments for mobile */
          .item-tooltip {
            position: fixed;
            bottom: auto;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 280px;
            max-width: 90vw;
            z-index: 200;
          }
        }
        
        /* Extra small screens (375px and below) */
        @media (max-width: 375px) {
          .equipment-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: var(--space-1, 0.25rem);
          }
          
          .equipment-slot {
            padding: var(--space-1, 0.25rem);
            min-height: 50px;
          }
          
          .slot-icon {
            font-size: 1.25rem;
          }
          
          .inventory-grid {
            gap: var(--space-1, 0.25rem);
          }
          
          .inventory-item {
            padding: var(--space-2, 0.5rem);
          }
          
          .inventory-item .item-name {
            font-size: var(--text-xs, 0.75rem);
          }
        }
        
        /* Touch device optimizations */
        @media (hover: none) and (pointer: coarse) {
          .inventory-item:hover {
            transform: none; /* Disable hover lift on touch */
          }
          
          .inventory-item:active {
            transform: scale(0.98);
          }
          
          .equipment-slot:active {
            background: var(--surface-4, #3d4370);
          }
          
          /* Show tooltip on tap, not hover */
          .item-tooltip {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

// Export as default for Astro island usage
export default InventoryManager;

// Also export named for flexibility
export { InventoryManager };
