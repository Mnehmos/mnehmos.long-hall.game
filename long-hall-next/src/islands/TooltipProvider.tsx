/**
 * TooltipProvider Island Component
 * 
 * Global tooltip context provider that displays hover tooltips for items,
 * abilities, enemies, and skills. Handles positioning to avoid viewport
 * edges and provides delay show/hide for stability.
 * 
 * Hydration: client:only (no SSR, browser-only for hover detection)
 * 
 * @module islands/TooltipProvider
 * @see {@link file://./../engine/types.ts} for Item, AbilityDef, Enemy, Skills types
 */

import { createContext } from 'preact';
import { 
  useContext, 
  useState, 
  useCallback, 
  useMemo, 
  useRef, 
  useEffect,
  useLayoutEffect,
} from 'preact/hooks';
import type { FunctionalComponent, ComponentChildren } from 'preact';
import type { Item, AbilityDef, Enemy } from '../engine/types';

// ============================================================================
// Types
// ============================================================================

/** Types of content that can be displayed in a tooltip */
export type TooltipType = 'item' | 'ability' | 'enemy' | 'skill' | 'text';

/** Skill information for skill tooltips */
export interface SkillInfo {
  name: string;
  value: number;
  description: string;
}

/** Data structure for tooltip content and positioning */
export interface TooltipData {
  type: TooltipType;
  data: Item | AbilityDef | Enemy | SkillInfo | string;
  position: { x: number; y: number };
}

/** Context value providing tooltip control functions */
export interface TooltipContextValue {
  /** Show tooltip at position */
  show: (data: TooltipData) => void;
  /** Hide current tooltip */
  hide: () => void;
  /** Update position (for following cursor) */
  updatePosition: (x: number, y: number) => void;
  /** Current tooltip data */
  current: TooltipData | null;
}

/** Props for TooltipProvider component */
export interface TooltipProviderProps {
  /** Child components to wrap with tooltip context */
  children?: ComponentChildren;
}

// ============================================================================
// Constants
// ============================================================================

/** Delay before showing tooltip (prevents flicker on quick mouse-overs) */
const SHOW_DELAY = 200;

/** Delay before hiding tooltip (allows moving to tooltip) */
const HIDE_DELAY = 100;

/** Padding from viewport edges */
const VIEWPORT_PADDING = 12;

/** Offset from cursor position */
const CURSOR_OFFSET = 12;

/** Maximum tooltip width */
const MAX_WIDTH = 300;

// ============================================================================
// Context
// ============================================================================

/**
 * TooltipContext provides tooltip control functions to child islands.
 * Use the `useTooltip` hook to consume this context.
 */
export const TooltipContext = createContext<TooltipContextValue | null>(null);

/**
 * Hook to access the tooltip context from child components.
 * Must be used within a TooltipProvider.
 * 
 * @throws Error if used outside of TooltipProvider
 * 
 * @example
 * ```tsx
 * const { show, hide } = useTooltip();
 * 
 * <button 
 *   onMouseEnter={(e) => show({ type: 'text', data: 'Hello!', position: { x: e.clientX, y: e.clientY } })}
 *   onMouseLeave={hide}
 * >
 *   Hover me
 * </button>
 * ```
 */
export function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) {
    throw new Error('[TooltipProvider] useTooltip must be used within a TooltipProvider component');
  }
  return ctx;
}

/**
 * Helper hook for tooltip triggering on mouse events.
 * Returns event handlers to attach to hoverable elements.
 * 
 * @param type - Type of tooltip content
 * @param data - Data to display in tooltip
 * 
 * @example
 * ```tsx
 * const tooltipHandlers = useTooltipTrigger('item', myItem);
 * 
 * <div {...tooltipHandlers}>
 *   Hover for item details
 * </div>
 * ```
 */
export function useTooltipTrigger<T extends TooltipData['data']>(
  type: TooltipType,
  data: T
) {
  const { show, hide, updatePosition } = useTooltip();

  return useMemo(() => ({
    onMouseEnter: (e: MouseEvent) => {
      show({ type, data, position: { x: e.clientX, y: e.clientY } });
    },
    onMouseMove: (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    },
    onMouseLeave: () => {
      hide();
    },
  }), [type, data, show, hide, updatePosition]);
}

// ============================================================================
// Tooltip Content Components
// ============================================================================

interface TooltipContentProps {
  data: TooltipData;
}

/** Render tooltip content based on type */
function TooltipContent({ data }: TooltipContentProps): preact.JSX.Element | null {
  switch (data.type) {
    case 'item':
      return <ItemTooltip item={data.data as Item} />;
    case 'ability':
      return <AbilityTooltip ability={data.data as AbilityDef} />;
    case 'enemy':
      return <EnemyTooltip enemy={data.data as Enemy} />;
    case 'skill':
      return <SkillTooltip skill={data.data as SkillInfo} />;
    case 'text':
      return <TextTooltip text={data.data as string} />;
    default:
      return null;
  }
}

/** Item tooltip with rarity colors and stats */
function ItemTooltip({ item }: { item: Item }): preact.JSX.Element {
  const hasBaseStats = item.baseStats && (
    item.baseStats.attackBonus ||
    item.baseStats.damageBonus ||
    item.baseStats.acBonus ||
    item.baseStats.maxHpBonus
  );

  const hasMasteryStats = item.stats && item.stats.kills > 0;

  return (
    <div class={`tooltip tooltip-item rarity-${item.rarity}`}>
      <div class="tooltip-header">
        <span class="name">{item.customName ?? item.name}</span>
        <span class="type">{item.type}</span>
      </div>
      <div class="tooltip-rarity">{item.rarity}</div>

      {/* Base Stats */}
      {hasBaseStats && (
        <div class="tooltip-stats">
          {item.baseStats.attackBonus !== undefined && item.baseStats.attackBonus !== 0 && (
            <span>+{item.baseStats.attackBonus} Attack</span>
          )}
          {item.baseStats.damageBonus !== undefined && item.baseStats.damageBonus !== 0 && (
            <span>+{item.baseStats.damageBonus} Damage</span>
          )}
          {item.baseStats.acBonus !== undefined && item.baseStats.acBonus !== 0 && (
            <span>+{item.baseStats.acBonus} AC</span>
          )}
          {item.baseStats.maxHpBonus !== undefined && item.baseStats.maxHpBonus !== 0 && (
            <span>+{item.baseStats.maxHpBonus} Max HP</span>
          )}
        </div>
      )}

      {/* Enchantment */}
      {item.enchantment && (
        <div class="tooltip-enchantment">
          <span class="enchant-name">{item.enchantment.name}</span>
          <span class="enchant-desc">{item.enchantment.description}</span>
        </div>
      )}

      {/* Mastery Stats */}
      {hasMasteryStats && (
        <div class="tooltip-mastery">
          <span>Kills: {item.stats!.kills}</span>
          <span>Highest Hit: {item.stats!.highestHit}</span>
        </div>
      )}

      <div class="tooltip-cost">Value: {item.cost}g</div>
    </div>
  );
}

/** Ability tooltip with cooldown and effect info */
function AbilityTooltip({ ability }: { ability: AbilityDef }): preact.JSX.Element {
  return (
    <div class="tooltip tooltip-ability">
      <div class="tooltip-header">
        <span class="name">{ability.name}</span>
        <span class="role">{ability.role}</span>
      </div>
      <p class="description">{ability.description}</p>
      <div class="cooldown">
        Cooldown: {ability.cooldownValue} {ability.cooldownType}
      </div>
      <div class="effect">
        {ability.effect.type}: {ability.effect.target}
        {ability.effect.dice && ` (${ability.effect.dice})`}
      </div>
    </div>
  );
}

/** Enemy tooltip with combat stats */
function EnemyTooltip({ enemy }: { enemy: Enemy }): preact.JSX.Element {
  return (
    <div class="tooltip tooltip-enemy">
      <div class="tooltip-header">
        <span class="name">{enemy.name}</span>
      </div>
      <div class="stats">
        <span>HP: {enemy.hp}/{enemy.maxHp}</span>
        <span>AC: {enemy.ac}</span>
        <span>DMG: {enemy.damage}</span>
        <span>XP: {enemy.xp}</span>
      </div>
    </div>
  );
}

/** Skill tooltip with value and description */
function SkillTooltip({ skill }: { skill: SkillInfo }): preact.JSX.Element {
  return (
    <div class="tooltip tooltip-skill">
      <div class="tooltip-header">
        <span class="name">{skill.name}</span>
        <span class="value">{skill.value}</span>
      </div>
      <p class="description">{skill.description}</p>
    </div>
  );
}

/** Simple text tooltip */
function TextTooltip({ text }: { text: string }): preact.JSX.Element {
  return <div class="tooltip tooltip-text">{text}</div>;
}

// ============================================================================
// Styles Component
// ============================================================================

/** Inline styles for tooltip (scoped to avoid global pollution) */
function TooltipStyles(): preact.JSX.Element {
  return (
    <style>{`
      /* Tooltip Overlay Container */
      .tooltip-overlay {
        position: fixed;
        z-index: 9999;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 150ms ease-out, transform 150ms ease-out;
        max-width: ${MAX_WIDTH}px;
      }

      .tooltip-overlay.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* Base Tooltip Styling */
      .tooltip {
        background: var(--color-surface-elevated, #1a1a2e);
        border: 1px solid var(--color-border, #3a3a5e);
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--color-text, #e0e0e0);
        box-shadow: 
          0 4px 12px rgba(0, 0, 0, 0.4),
          0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      }

      /* Tooltip Header */
      .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }

      .tooltip-header .name {
        font-weight: 600;
        font-size: 14px;
      }

      .tooltip-header .type,
      .tooltip-header .role,
      .tooltip-header .value {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
      }

      /* Rarity Colors for Items */
      .tooltip-item.rarity-common {
        border-color: #808080;
      }
      .tooltip-item.rarity-common .name {
        color: #c0c0c0;
      }

      .tooltip-item.rarity-uncommon {
        border-color: #1eff00;
      }
      .tooltip-item.rarity-uncommon .name {
        color: #1eff00;
      }

      .tooltip-item.rarity-rare {
        border-color: #0070dd;
      }
      .tooltip-item.rarity-rare .name {
        color: #0070dd;
      }

      .tooltip-item.rarity-epic {
        border-color: #a335ee;
      }
      .tooltip-item.rarity-epic .name {
        color: #a335ee;
      }

      .tooltip-item.rarity-legendary {
        border-color: #ff8000;
      }
      .tooltip-item.rarity-legendary .name {
        color: #ff8000;
      }

      .tooltip-item.rarity-godly {
        border-color: #e6cc80;
        box-shadow: 
          0 4px 12px rgba(0, 0, 0, 0.4),
          0 0 8px rgba(230, 204, 128, 0.3);
      }
      .tooltip-item.rarity-godly .name {
        color: #e6cc80;
      }

      /* Rarity Badge */
      .tooltip-rarity {
        font-size: 11px;
        text-transform: capitalize;
        opacity: 0.8;
        margin-bottom: 8px;
      }

      /* Stats Block */
      .tooltip-stats {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 8px;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
      }

      .tooltip-stats span {
        color: #4ade80;
        font-size: 12px;
      }

      /* Enchantment Block */
      .tooltip-enchantment {
        margin-bottom: 8px;
        padding: 6px 8px;
        background: linear-gradient(135deg, rgba(163, 53, 238, 0.1), rgba(163, 53, 238, 0.05));
        border-left: 2px solid #a335ee;
        border-radius: 0 4px 4px 0;
      }

      .tooltip-enchantment .enchant-name {
        display: block;
        color: #a335ee;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .tooltip-enchantment .enchant-desc {
        display: block;
        font-size: 12px;
        opacity: 0.9;
        font-style: italic;
      }

      /* Mastery Stats (muted) */
      .tooltip-mastery {
        display: flex;
        gap: 12px;
        font-size: 11px;
        opacity: 0.6;
        margin-bottom: 6px;
      }

      /* Cost/Value */
      .tooltip-cost {
        font-size: 12px;
        color: #fbbf24;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 6px;
        margin-top: 6px;
      }

      /* Ability Tooltip */
      .tooltip-ability .description {
        margin: 0 0 8px 0;
        opacity: 0.9;
      }

      .tooltip-ability .cooldown {
        font-size: 12px;
        color: #60a5fa;
        margin-bottom: 4px;
      }

      .tooltip-ability .effect {
        font-size: 12px;
        opacity: 0.8;
      }

      /* Enemy Tooltip */
      .tooltip-enemy .stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 12px;
        font-size: 12px;
      }

      .tooltip-enemy .stats span:nth-child(1) {
        color: #ef4444;
      }

      .tooltip-enemy .stats span:nth-child(2) {
        color: #60a5fa;
      }

      .tooltip-enemy .stats span:nth-child(3) {
        color: #f97316;
      }

      .tooltip-enemy .stats span:nth-child(4) {
        color: #a855f7;
      }

      /* Skill Tooltip */
      .tooltip-skill .description {
        margin: 0;
        opacity: 0.9;
      }

      .tooltip-skill .value {
        font-weight: 600;
        color: #4ade80;
      }

      /* Text Tooltip */
      .tooltip-text {
        max-width: 200px;
      }
    `}</style>
  );
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * TooltipProvider - Global tooltip context provider
 * 
 * This Preact island component provides tooltip functionality to all child
 * components. It handles show/hide delays, viewport edge detection, and
 * renders different tooltip content based on type.
 * 
 * @example Usage in Astro
 * ```astro
 * ---
 * import TooltipProvider from '@islands/TooltipProvider';
 * ---
 * <TooltipProvider client:only="preact">
 *   <YourGameUI />
 * </TooltipProvider>
 * ```
 */
const TooltipProvider: FunctionalComponent<TooltipProviderProps> = ({ children }) => {
  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState({ top: 0, left: 0 });

  // Refs for timeouts and DOM measurement
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────
  // Timeout Management
  // ─────────────────────────────────────────────────────────────

  /** Clear all pending timeouts */
  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current !== null) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (fadeTimeoutRef.current !== null) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  // ─────────────────────────────────────────────────────────────
  // Position Calculation
  // ─────────────────────────────────────────────────────────────

  /** Calculate tooltip position avoiding viewport edges */
  const calculatePosition = useCallback((x: number, y: number): { top: number; left: number } => {
    if (!tooltipRef.current) {
      // Fallback position before we can measure
      return { top: y + CURSOR_OFFSET, left: x + CURSOR_OFFSET };
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + CURSOR_OFFSET;
    let top = y + CURSOR_OFFSET;

    // Flip horizontally if would overflow right
    if (left + rect.width + VIEWPORT_PADDING > viewportWidth) {
      left = x - rect.width - CURSOR_OFFSET;
    }

    // Flip vertically if would overflow bottom
    if (top + rect.height + VIEWPORT_PADDING > viewportHeight) {
      top = y - rect.height - CURSOR_OFFSET;
    }

    // Clamp to viewport bounds
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, viewportWidth - rect.width - VIEWPORT_PADDING)
    );
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, viewportHeight - rect.height - VIEWPORT_PADDING)
    );

    return { top, left };
  }, []);

  // Update position when tooltip data changes or becomes visible
  useLayoutEffect(() => {
    if (tooltip && tooltipRef.current) {
      const pos = calculatePosition(tooltip.position.x, tooltip.position.y);
      setCalculatedPosition(pos);
    }
  }, [tooltip, isVisible, calculatePosition]);

  // ─────────────────────────────────────────────────────────────
  // Context Actions
  // ─────────────────────────────────────────────────────────────

  /** Show tooltip with delay */
  const show = useCallback((data: TooltipData) => {
    clearTimeouts();

    showTimeoutRef.current = window.setTimeout(() => {
      setTooltip(data);
      setIsVisible(true);
    }, SHOW_DELAY);
  }, [clearTimeouts]);

  /** Hide tooltip with delay (allows moving to tooltip) */
  const hide = useCallback(() => {
    clearTimeouts();

    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      
      // Keep tooltip data briefly for fade-out animation
      fadeTimeoutRef.current = window.setTimeout(() => {
        setTooltip(null);
      }, 150);
    }, HIDE_DELAY);
  }, [clearTimeouts]);

  /** Update cursor position for following behavior */
  const updatePosition = useCallback((x: number, y: number) => {
    setTooltip(prev => {
      if (!prev) return null;
      return { ...prev, position: { x, y } };
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Context Value
  // ─────────────────────────────────────────────────────────────

  const contextValue = useMemo<TooltipContextValue>(() => ({
    show,
    hide,
    updatePosition,
    current: tooltip,
  }), [show, hide, updatePosition, tooltip]);

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────

  /** Keep tooltip visible when hovering over it */
  const handleTooltipMouseEnter = useCallback(() => {
    clearTimeouts();
  }, [clearTimeouts]);

  /** Hide tooltip when leaving it */
  const handleTooltipMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <TooltipContext.Provider value={contextValue}>
      <TooltipStyles />
      
      {children}

      {/* Tooltip Overlay */}
      {tooltip && (
        <div
          ref={tooltipRef}
          class={`tooltip-overlay ${isVisible ? 'visible' : ''}`}
          style={{
            top: `${calculatedPosition.top}px`,
            left: `${calculatedPosition.left}px`,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <TooltipContent data={tooltip} />
        </div>
      )}
    </TooltipContext.Provider>
  );
};

// Export as default for Astro island usage
export default TooltipProvider;

// Also export named for flexibility
export { TooltipProvider };

// Re-export types for consumers
export type { Item, AbilityDef, Enemy } from '../engine/types';
