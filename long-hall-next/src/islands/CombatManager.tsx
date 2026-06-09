/**
 * CombatManager Island Component
 * 
 * Combat UI that renders enemies with animated sprites, handles target selection,
 * displays ability cooldowns, and manages combat flow including attack animations.
 * 
 * Hydration: client:visible (hydrates when scrolled into view)
 * 
 * @module islands/CombatManager
 * @see {@link file://./../hooks/useCharacterAnimation.ts} for animation system
 * @see {@link file://./../state/derived.ts} for combat state signals
 */

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

// Context and state
import { useGameEngine } from './GameEngine';
import {
  aliveEnemies,
  isPlayerTurn,
  canActThisRound,
  combatRound,
  showVictory,
} from '../state/derived';
import { currentRoom } from '../state/gameState';

// Components
import CharacterSprite from './CharacterSprite';
import type { CharacterName, AnimationState } from '../hooks/useCharacterAnimation';

// Types
import type { Enemy, Actor, AbilityState, Action } from '../engine/types';

// ============================================================================
// Types
// ============================================================================

export interface CombatManagerProps {
  /** Compact mode for sidebar placement */
  compact?: boolean;
}

interface AbilityButtonProps {
  ability: AbilityState;
  actor: Actor;
  targetId: string | null;
  onUse: (action: Action) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize enemy name to match SVG filename convention
 * e.g., "Goblin Warrior" -> "goblin", "Dark Knight" -> "dark-knight"
 */
function normalizeEnemyName(name: string): CharacterName {
  // Map common enemy names to their SVG file names
  const nameMap: Record<string, CharacterName> = {
    'goblin': 'goblin',
    'skeleton': 'skeleton',
    'orc': 'orc',
    'troll': 'troll',
    'dark knight': 'dark-knight',
    'dark-knight': 'dark-knight',
    'dragon': 'dragon',
  };

  const lowerName = name.toLowerCase();
  
  // Check for direct matches or partial matches
  for (const [key, value] of Object.entries(nameMap)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  // Default fallback - convert to kebab-case
  return lowerName.replace(/\s+/g, '-') as CharacterName;
}

// ============================================================================
// AbilityButton Sub-component
// ============================================================================

/**
 * Button for using character abilities with cooldown display
 */
function AbilityButton({ ability, actor, targetId, onUse }: AbilityButtonProps) {
  const isReady = ability.currentCooldown === 0;
  
  // Format ability name for display (convert snake_case to Title Case)
  const displayName = ability.abilityId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const handleClick = useCallback(() => {
    if (!isReady) return;
    
    onUse({
      type: 'USE_ABILITY',
      actorId: actor.id,
      abilityId: ability.abilityId,
      targetId: targetId ?? undefined,
    });
  }, [isReady, onUse, actor.id, ability.abilityId, targetId]);

  return (
    <button
      class={`ability-btn ${isReady ? '' : 'on-cooldown'}`}
      onClick={handleClick}
      disabled={!isReady}
      title={isReady ? `Use ${displayName}` : `${ability.currentCooldown} turns remaining`}
    >
      <span class="ability-name">{displayName}</span>
      {!isReady && (
        <span class="cooldown-badge">{ability.currentCooldown}</span>
      )}
    </button>
  );
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * CombatManager - Combat UI island with enemy display and action controls
 * 
 * @example Usage in Astro
 * ```astro
 * ---
 * import CombatManager from '@islands/CombatManager';
 * ---
 * <CombatManager client:visible compact={false} />
 * ```
 */
const CombatManager: FunctionalComponent<CombatManagerProps> = ({ compact = false }) => {
  const { dispatchAction } = useGameEngine();
  
  // Read reactive state from signals
  const enemies = aliveEnemies.value;
  const allEnemies = currentRoom.value?.enemies ?? [];
  const isMyTurn = isPlayerTurn.value;
  const actingMembers = canActThisRound.value;
  const round = combatRound.value;
  const hasVictory = showVictory.value;
  
  // Local state
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [animatingEnemies, setAnimatingEnemies] = useState<Set<string>>(new Set());
  
  // Auto-select first enemy when entering combat or when selection becomes invalid
  useEffect(() => {
    if (enemies.length > 0) {
      // Check if current selection is still valid
      const selectionValid = enemies.some(e => e.id === selectedTarget);
      if (!selectionValid) {
        setSelectedTarget(enemies[0].id);
      }
    } else {
      setSelectedTarget(null);
    }
  }, [enemies, selectedTarget]);

  /**
   * Handle attack action with visual feedback
   */
  const handleAttack = useCallback((attackerId: string) => {
    if (!selectedTarget) return;
    
    // Mark enemy as animating for hurt animation
    setAnimatingEnemies(prev => new Set(prev).add(selectedTarget));
    
    // Dispatch attack action
    dispatchAction({
      type: 'ATTACK',
      attackerId,
      targetId: selectedTarget,
    });
    
    // Clear animation state after a short delay
    setTimeout(() => {
      setAnimatingEnemies(prev => {
        const next = new Set(prev);
        next.delete(selectedTarget);
        return next;
      });
    }, 300);
  }, [selectedTarget, dispatchAction]);

  /**
   * Handle flee attempt
   */
  const handleFlee = useCallback(() => {
    dispatchAction({ type: 'ESCAPE' });
  }, [dispatchAction]);

  /**
   * Handle target selection
   */
  const handleTargetSelect = useCallback((enemyId: string, isDead: boolean) => {
    if (!isDead) {
      setSelectedTarget(enemyId);
    }
  }, []);

  /**
   * Determine animation state for an enemy
   */
  const getEnemyAnimationState = useCallback((enemy: Enemy): AnimationState => {
    if (enemy.hp <= 0) return 'death';
    if (animatingEnemies.has(enemy.id)) return 'hurt';
    return 'idle';
  }, [animatingEnemies]);

  /**
   * Render an enemy card with sprite
   */
  function renderEnemyCard(enemy: Enemy) {
    const isSelected = enemy.id === selectedTarget;
    const isDead = enemy.hp <= 0;
    const hpPercentage = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const animationState = getEnemyAnimationState(enemy);
    const spriteName = normalizeEnemyName(enemy.name);

    return (
      <div
        key={enemy.id}
        class={`enemy-card ${isSelected ? 'selected' : ''} ${isDead ? 'dead' : ''}`}
        onClick={() => handleTargetSelect(enemy.id, isDead)}
        role="button"
        tabIndex={isDead ? -1 : 0}
        aria-label={`${enemy.name}${isDead ? ' (defeated)' : ''}`}
        aria-pressed={isSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleTargetSelect(enemy.id, isDead);
          }
        }}
      >
        <div class="enemy-sprite-container">
          <CharacterSprite
            type="enemy"
            name={spriteName}
            initialState={animationState}
            flip={false}
          />
        </div>
        
        <div class="enemy-info">
          <span class="enemy-name">{enemy.name}</span>
          
          <div class="hp-bar">
            <div 
              class="hp-fill" 
              style={{ width: `${hpPercentage}%` }}
              aria-valuenow={enemy.hp}
              aria-valuemin={0}
              aria-valuemax={enemy.maxHp}
            />
            <span class="hp-text">{enemy.hp}/{enemy.maxHp}</span>
          </div>
          
          <div class="enemy-stats">
            <span class="stat ac" title="Armor Class">🛡️ {enemy.ac}</span>
            <span class="stat damage" title="Damage">⚔️ {enemy.damage}</span>
          </div>
        </div>
        
        {isSelected && !isDead && (
          <div class="target-indicator" aria-hidden="true">🎯</div>
        )}
      </div>
    );
  }

  // Get the primary actor (first one who can act)
  const primaryActor = actingMembers.length > 0 ? actingMembers[0] : null;

  return (
    <div class={`combat-manager ${compact ? 'compact' : ''}`}>
      {/* Victory Overlay */}
      {hasVictory && (
        <div class="victory-overlay">
          <span class="victory-text">⚔️ Victory!</span>
        </div>
      )}

      {/* Round Indicator */}
      <div class="round-indicator">
        <span class="round-label">Round</span>
        <span class="round-number">{round}</span>
      </div>

      {/* Enemy Grid */}
      <div class="enemy-grid" role="list" aria-label="Enemies">
        {allEnemies.map(renderEnemyCard)}
      </div>

      {/* Action Bar - Only show on player's turn with acting members */}
      {isMyTurn && primaryActor && (
        <div class="action-bar" role="toolbar" aria-label="Combat actions">
          {/* Attack Button */}
          <button
            class="attack-btn primary"
            onClick={() => handleAttack(primaryActor.id)}
            disabled={!selectedTarget || enemies.length === 0}
            title={selectedTarget ? 'Attack selected target' : 'Select a target first'}
          >
            <span class="btn-icon">⚔️</span>
            <span class="btn-text">Attack</span>
          </button>

          {/* Ability Buttons */}
          {primaryActor.abilities.map((ability) => (
            <AbilityButton
              key={ability.abilityId}
              ability={ability}
              actor={primaryActor}
              targetId={selectedTarget}
              onUse={dispatchAction}
            />
          ))}

          {/* Flee Button */}
          <button
            class="flee-btn"
            onClick={handleFlee}
            title="Attempt to flee (may fail)"
          >
            <span class="btn-icon">🏃</span>
            <span class="btn-text">Flee</span>
          </button>
        </div>
      )}

      {/* Turn Indicator when not player's turn */}
      {!isMyTurn && enemies.length > 0 && (
        <div class="turn-indicator enemy-turn">
          <span>Enemy Turn...</span>
        </div>
      )}

      {/* Scoped Styles */}
      <style>{`
        .combat-manager {
          display: flex;
          flex-direction: column;
          gap: var(--space-4, 1rem);
          padding: var(--space-4, 1rem);
          background: var(--surface-1, #1a1a2e);
          border-radius: var(--radius-lg, 0.75rem);
          position: relative;
        }

        .combat-manager.compact {
          padding: var(--space-2, 0.5rem);
          gap: var(--space-2, 0.5rem);
        }

        /* Round Indicator */
        .round-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          justify-content: center;
          padding: var(--space-2, 0.5rem);
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-md, 0.5rem);
        }

        .round-label {
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-muted, #9ca3af);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .round-number {
          font-size: var(--text-xl, 1.25rem);
          font-weight: bold;
          color: var(--text-primary, #f9fafb);
        }

        /* Enemy Grid - Mobile first */
        .enemy-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-2, 0.5rem);
        }
        
        @media (min-width: 640px) {
          .enemy-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: var(--space-3, 0.75rem);
          }
        }

        .compact .enemy-grid {
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: var(--space-2, 0.5rem);
        }

        /* Enemy Card */
        .enemy-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-3, 0.75rem);
          background: var(--surface-2, #25294a);
          border: 2px solid transparent;
          border-radius: var(--radius-lg, 0.75rem);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .enemy-card:hover:not(.dead) {
          background: var(--surface-3, #2d325c);
          transform: translateY(-2px);
        }

        .enemy-card:focus {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 2px;
        }

        .enemy-card.selected {
          border-color: var(--accent, #6366f1);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
        }

        .enemy-card.dead {
          opacity: 0.5;
          filter: grayscale(0.8);
          cursor: not-allowed;
          pointer-events: none;
        }

        /* Enemy Sprite Container */
        .enemy-sprite-container {
          width: 80px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .compact .enemy-sprite-container {
          width: 60px;
          height: 75px;
        }

        /* Enemy Info */
        .enemy-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1, 0.25rem);
          width: 100%;
        }

        .enemy-name {
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          color: var(--text-primary, #f9fafb);
          text-align: center;
        }

        /* HP Bar */
        .hp-bar {
          width: 100%;
          height: 12px;
          background: var(--surface-3, #2d325c);
          border-radius: var(--radius-sm, 0.25rem);
          position: relative;
          overflow: hidden;
        }

        .hp-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--damage, #ef4444), var(--health, #22c55e));
          background-size: 200% 100%;
          background-position: 100% 0;
          transition: width 0.3s ease;
        }

        .hp-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: var(--text-xs, 0.75rem);
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        /* Enemy Stats */
        .enemy-stats {
          display: flex;
          gap: var(--space-3, 0.75rem);
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        /* Target Indicator */
        .target-indicator {
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 1.25rem;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        /* Action Bar - Mobile first with horizontal scroll */
        .action-bar {
          display: flex;
          gap: var(--space-2, 0.5rem);
          justify-content: flex-start;
          padding-top: var(--space-3, 0.75rem);
          border-top: 1px solid var(--border, #374151);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          padding-bottom: var(--space-1, 0.25rem);
        }
        
        .action-bar::-webkit-scrollbar {
          display: none;
        }
        
        @media (min-width: 640px) {
          .action-bar {
            flex-wrap: wrap;
            justify-content: center;
            overflow-x: visible;
            scroll-snap-type: none;
          }
        }

        .action-bar button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-1, 0.25rem);
          padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          border-radius: var(--radius-md, 0.5rem);
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 44px;
          min-width: 44px;
          flex-shrink: 0;
          scroll-snap-align: start;
        }

        .action-bar button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .action-bar button:active:not(:disabled) {
          transform: scale(0.97);
        }

        /* Attack Button */
        .attack-btn.primary {
          background: var(--accent, #6366f1);
          color: white;
        }

        .attack-btn.primary:hover:not(:disabled) {
          background: var(--accent-hover, #4f46e5);
          transform: translateY(-1px);
        }

        /* Ability Button */
        .ability-btn {
          background: var(--surface-3, #2d325c);
          color: var(--text-primary, #f9fafb);
          position: relative;
        }

        .ability-btn:hover:not(:disabled) {
          background: var(--surface-4, #3d4370);
        }

        .ability-btn.on-cooldown {
          background: var(--surface-2, #25294a);
          color: var(--text-muted, #9ca3af);
        }

        .cooldown-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          background: var(--damage, #ef4444);
          color: white;
          font-size: var(--text-xs, 0.75rem);
          font-weight: bold;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Flee Button */
        .flee-btn {
          background: var(--surface-3, #2d325c);
          color: var(--text-muted, #9ca3af);
        }

        .flee-btn:hover {
          background: var(--warning, #f59e0b);
          color: white;
        }

        /* Turn Indicator */
        .turn-indicator {
          display: flex;
          justify-content: center;
          padding: var(--space-3, 0.75rem);
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-muted, #9ca3af);
          font-style: italic;
        }

        .turn-indicator.enemy-turn {
          animation: blink 1.5s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Victory Overlay */
        .victory-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          border-radius: var(--radius-lg, 0.75rem);
          z-index: 10;
          animation: fadeIn 0.3s ease;
        }

        .victory-text {
          font-size: var(--text-2xl, 1.5rem);
          font-weight: bold;
          color: var(--gold, #fbbf24);
          text-shadow: 0 2px 8px rgba(251, 191, 36, 0.5);
          animation: scaleIn 0.4s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        /* Button text hiding in compact mode */
        .compact .btn-text {
          display: none;
        }

        .compact .action-bar button {
          padding: var(--space-2, 0.5rem);
        }

        /* Mobile responsive adjustments */
        @media (max-width: 639px) {
          .combat-manager {
            padding: var(--space-2, 0.5rem);
            gap: var(--space-2, 0.5rem);
          }
          
          .enemy-card {
            padding: var(--space-2, 0.5rem);
          }

          .enemy-sprite-container {
            width: 50px;
            height: 62px;
          }
          
          .enemy-name {
            font-size: var(--text-xs, 0.75rem);
          }

          .btn-text {
            display: none;
          }
          
          .action-bar button {
            padding: var(--space-2, 0.5rem);
          }
          
          .round-indicator {
            padding: var(--space-1, 0.25rem);
          }
          
          .round-label {
            font-size: var(--text-xs, 0.75rem);
          }
          
          .round-number {
            font-size: var(--text-lg, 1.125rem);
          }
        }
        
        /* Smaller mobile (375px and below) */
        @media (max-width: 375px) {
          .enemy-grid {
            gap: var(--space-1, 0.25rem);
          }
          
          .enemy-sprite-container {
            width: 40px;
            height: 50px;
          }
          
          .enemy-card {
            padding: var(--space-1, 0.25rem);
          }
          
          .hp-bar {
            height: 10px;
          }
          
          .hp-text {
            font-size: 0.625rem;
          }
        }
      `}</style>
    </div>
  );
};

// Export as default for Astro island usage
export default CombatManager;

// Also export named for flexibility
export { CombatManager };
