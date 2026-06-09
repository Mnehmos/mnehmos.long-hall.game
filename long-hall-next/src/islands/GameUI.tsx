/**
 * GameUI Island Component - Full Game Interface
 * 
 * Main game UI that renders the complete game interface matching the original:
 * - Party status sidebar (left)
 * - Main room/combat view (center)
 * - Combat log (right)
 * - Action buttons
 * 
 * @module islands/GameUI
 */

import { useCallback, useEffect, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

// Context and state
import { useGameEngine } from '../state/gameContext';
import {
  gameState,
  currentRoom,
  currentDepth,
  gold,
  partyMembers,
  historyLog,
  isInCombat,
  isRoomResolved,
  alivePartyMembers,
} from '../state/gameState';
import {
  roomTypeName,
  availableActions,
  shortRestsRemaining,
  showGameOver,
  showVictory,
  aliveEnemies,
  isPlayerTurn,
  canActThisRound,
} from '../state/derived';

// Types
import type { Actor, Enemy, Room, Item } from '../engine/types';

// ============================================================================
// Character Sprite Component
// ============================================================================

function CharacterSprite({ 
  name, 
  isEnemy = false,
  isDead = false,
  isAttacking = false,
  isHurt = false,
}: { 
  name: string;
  isEnemy?: boolean;
  isDead?: boolean;
  isAttacking?: boolean;
  isHurt?: boolean;
}) {
  // Simple pixel-art style character using CSS
  const baseColor = isEnemy ? '#ef4444' : '#22c55e';
  const animation = isAttacking ? 'attack' : isHurt ? 'hurt' : isDead ? 'death' : 'idle';
  
  return (
    <div 
      class={`character-sprite ${animation} ${isDead ? 'dead' : ''}`}
      style={{ '--char-color': baseColor } as any}
    >
      <div class="sprite-body">
        <div class="sprite-head"></div>
        <div class="sprite-torso"></div>
        <div class="sprite-arms"></div>
        <div class="sprite-legs"></div>
      </div>
      <div class="sprite-name">{name}</div>
    </div>
  );
}

// ============================================================================
// HP Bar Component
// ============================================================================

function HPBar({ current, max, showText = true }: { current: number; max: number; showText?: boolean }) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const color = percentage > 50 ? '#22c55e' : percentage > 25 ? '#eab308' : '#ef4444';
  
  return (
    <div class="hp-bar-container">
      <div class="hp-bar-bg">
        <div 
          class="hp-bar-fill" 
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
      {showText && <span class="hp-text">{current}/{max}</span>}
    </div>
  );
}

// ============================================================================
// Party Member Card
// ============================================================================

function PartyMemberCard({ member }: { member: Actor }) {
  const hpPercent = (member.hp.current / member.hp.max) * 100;
  const xpToLevel = (member.level + 1) * 100; // Simplified XP calc
  const xpPercent = Math.min(100, (member.xp / xpToLevel) * 100);
  
  return (
    <div class={`party-member ${!member.isAlive ? 'dead' : ''}`}>
      <div class="member-header">
        <span class="member-name">{member.name}</span>
        <span class="member-level">Lv.{member.level}</span>
      </div>
      
      <div class="member-stats">
        <div class="stat-row">
          <span class="stat-label">HP</span>
          <HPBar current={member.hp.current} max={member.hp.max} />
        </div>
        <div class="stat-row">
          <span class="stat-label">XP</span>
          <div class="xp-bar">
            <div class="xp-fill" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </div>
      
      <CharacterSprite name={member.role} isDead={!member.isAlive} />
    </div>
  );
}

// ============================================================================
// Enemy Card
// ============================================================================

function EnemyCard({ 
  enemy, 
  isSelected,
  onSelect,
  onAttack,
}: { 
  enemy: Enemy;
  isSelected: boolean;
  onSelect: () => void;
  onAttack: () => void;
}) {
  const isDead = enemy.hp <= 0;
  
  return (
    <div 
      class={`enemy-card ${isSelected ? 'selected' : ''} ${isDead ? 'dead' : ''}`}
      onClick={onSelect}
    >
      <CharacterSprite name={enemy.name} isEnemy isDead={isDead} />
      
      <div class="enemy-info">
        <span class="enemy-name">{enemy.name}</span>
        <HPBar current={enemy.hp} max={enemy.maxHp} />
        <div class="enemy-stats">
          <span>🛡️ {enemy.ac}</span>
          <span>⚔️ {enemy.damage}</span>
        </div>
      </div>
      
      {!isDead && isSelected && (
        <button class="attack-btn" onClick={(e) => { e.stopPropagation(); onAttack(); }}>
          ⚔️ Attack
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Combat View
// ============================================================================

function CombatView() {
  const { dispatchAction } = useGameEngine();
  const enemies = aliveEnemies.value;
  const allEnemies = currentRoom.value?.enemies ?? [];
  const party = alivePartyMembers.value;
  const playerTurn = isPlayerTurn.value;
  const actingMembers = canActThisRound.value;
  
  const [selectedEnemy, setSelectedEnemy] = useState<string | null>(
    enemies.length > 0 ? enemies[0].id : null
  );
  
  // Auto-select first enemy when enemies change
  useEffect(() => {
    if (enemies.length > 0 && !enemies.find(e => e.id === selectedEnemy)) {
      setSelectedEnemy(enemies[0].id);
    } else if (enemies.length === 0) {
      setSelectedEnemy(null);
    }
  }, [enemies, selectedEnemy]);
  
  const handleAttack = useCallback((attackerId: string, targetId: string) => {
    dispatchAction({
      type: 'ATTACK',
      attackerId,
      targetId,
    });
  }, [dispatchAction]);
  
  const handleFlee = useCallback(() => {
    dispatchAction({ type: 'ESCAPE' });
  }, [dispatchAction]);
  
  const handleAbility = useCallback((actorId: string, abilityId: string) => {
    dispatchAction({
      type: 'USE_ABILITY',
      actorId,
      abilityId,
      targetId: selectedEnemy ?? undefined,
    });
  }, [dispatchAction, selectedEnemy]);
  
  const primaryActor = actingMembers[0];
  
  return (
    <div class="combat-view">
      {/* Enemy Grid */}
      <div class="enemy-grid">
        {allEnemies.map(enemy => (
          <EnemyCard
            key={enemy.id}
            enemy={enemy}
            isSelected={enemy.id === selectedEnemy}
            onSelect={() => setSelectedEnemy(enemy.id)}
            onAttack={() => primaryActor && selectedEnemy && handleAttack(primaryActor.id, selectedEnemy)}
          />
        ))}
      </div>
      
      {/* Action Bar */}
      {playerTurn && primaryActor && (
        <div class="combat-actions">
          <button 
            class="action-btn primary"
            onClick={() => selectedEnemy && handleAttack(primaryActor.id, selectedEnemy)}
            disabled={!selectedEnemy}
          >
            ⚔️ Attack
          </button>
          
          {primaryActor.abilities.map(ability => (
            <button
              key={ability.abilityId}
              class={`action-btn ability ${ability.currentCooldown > 0 ? 'on-cooldown' : ''}`}
              onClick={() => handleAbility(primaryActor.id, ability.abilityId)}
              disabled={ability.currentCooldown > 0}
              title={ability.currentCooldown > 0 ? `${ability.currentCooldown} turns` : ability.abilityId}
            >
              {ability.abilityId.replace(/_/g, ' ')}
              {ability.currentCooldown > 0 && <span class="cooldown">{ability.currentCooldown}</span>}
            </button>
          ))}
          
          <button class="action-btn flee" onClick={handleFlee}>
            🏃 Flee
          </button>
        </div>
      )}
      
      {!playerTurn && enemies.length > 0 && (
        <div class="turn-indicator">Enemy Turn...</div>
      )}
    </div>
  );
}

// ============================================================================
// Room Content View
// ============================================================================

function RoomContentView() {
  const { dispatchAction } = useGameEngine();
  const room = currentRoom.value;
  const actions = availableActions.value;
  const rests = shortRestsRemaining.value;
  const members = partyMembers.value;
  
  const handleContinue = useCallback(() => {
    dispatchAction({ type: 'ADVANCE_ROOM' });
  }, [dispatchAction]);
  
  const handleRest = useCallback(() => {
    const healTargets = members
      .filter(m => m.hp.current < m.hp.max && m.hitDice.current > 0)
      .map(m => m.id);
    
    if (healTargets.length > 0) {
      dispatchAction({ type: 'TAKE_SHORT_REST', actorIdsToHeal: healTargets });
    }
  }, [members, dispatchAction]);
  
  const handlePray = useCallback(() => {
    dispatchAction({ type: 'PRAY_AT_SHRINE' });
  }, [dispatchAction]);
  
  const handleDisarm = useCallback(() => {
    dispatchAction({ type: 'DISARM_TRAP' });
  }, [dispatchAction]);
  
  const handleTrigger = useCallback(() => {
    dispatchAction({ type: 'TRIGGER_TRAP' });
  }, [dispatchAction]);
  
  const roomIcons: Record<string, string> = {
    shrine: '🏛️',
    trader: '🏪',
    hazard: '⚠️',
    intermission: '🏕️',
    ally: '🤝',
    combat: '⚔️',
    elite: '💀',
    boss: '👹',
  };
  
  return (
    <div class="room-content-view">
      <div class="room-icon">{roomIcons[room?.type ?? 'combat']}</div>
      
      {room?.type === 'shrine' && (
        <p class="room-text">A mysterious shrine glows before you. Will you pray?</p>
      )}
      
      {room?.type === 'hazard' && (
        <p class="room-text">A deadly trap blocks your path!</p>
      )}
      
      {room?.type === 'trader' && (
        <p class="room-text">A merchant offers their wares.</p>
      )}
      
      {room?.type === 'intermission' && (
        <p class="room-text">A moment of respite. Rest or continue?</p>
      )}
      
      <div class="room-actions">
        {actions.includes('continue') && (
          <button class="action-btn primary" onClick={handleContinue}>
            Advance →
          </button>
        )}
        
        {actions.includes('rest') && (
          <button 
            class="action-btn secondary" 
            onClick={handleRest}
            disabled={rests <= 0}
          >
            Short Rest ({rests})
          </button>
        )}
        
        {actions.includes('pray') && (
          <button class="action-btn" onClick={handlePray}>
            🙏 Pray
          </button>
        )}
        
        {actions.includes('disarm') && (
          <button class="action-btn" onClick={handleDisarm}>
            🔧 Disarm Trap
          </button>
        )}
        
        {actions.includes('trigger') && (
          <button class="action-btn danger" onClick={handleTrigger}>
            💥 Trigger Trap
          </button>
        )}
        
        {actions.includes('skip') && (
          <button class="action-btn secondary" onClick={handleContinue}>
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Combat Log
// ============================================================================

function CombatLog() {
  const history = historyLog.value;
  const recent = history.slice(-20);
  
  return (
    <div class="combat-log">
      <h3 class="log-header">📜 COMBAT LOG</h3>
      <div class="log-entries">
        {recent.map((entry, i) => (
          <div key={i} class={`log-entry ${getEntryClass(entry)}`}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}

function getEntryClass(entry: string): string {
  if (entry.includes('HIT!') || entry.includes('damage')) return 'hit';
  if (entry.includes('MISS') || entry.includes('missed')) return 'miss';
  if (entry.includes('defeated') || entry.includes('Victory')) return 'victory';
  if (entry.includes('gold') || entry.includes('XP')) return 'reward';
  if (entry.includes('CRITICAL')) return 'critical';
  return '';
}

// ============================================================================
// Game Over / Victory Overlays
// ============================================================================

function GameOverOverlay({ onRestart }: { onRestart: () => void }) {
  return (
    <div class="game-overlay">
      <div class="overlay-content game-over">
        <h2>💀 GAME OVER</h2>
        <p>Your party has fallen in The Long Hall...</p>
        <button class="overlay-btn" onClick={onRestart}>Try Again</button>
      </div>
    </div>
  );
}

function VictoryOverlay({ onRestart }: { onRestart: () => void }) {
  return (
    <div class="game-overlay">
      <div class="overlay-content victory">
        <h2>🏆 VICTORY!</h2>
        <p>You have conquered The Long Hall!</p>
        <button class="overlay-btn" onClick={onRestart}>Play Again</button>
      </div>
    </div>
  );
}

// ============================================================================
// Main GameUI Component
// ============================================================================

const GameUI: FunctionalComponent = () => {
  const state = gameState.value;
  const room = currentRoom.value;
  const depth = currentDepth.value;
  const currentGold = gold.value;
  const members = partyMembers.value;
  const inCombat = isInCombat.value;
  const rests = shortRestsRemaining.value;
  const gameOver = showGameOver.value;
  const victory = showVictory.value;
  
  const floor = Math.floor(depth / 10) + 1;
  const roomNum = (depth % 10) + 1;
  
  const handleRestart = useCallback(() => {
    // Clear saved game to start fresh
    try {
      localStorage.removeItem('long-hall-save');
    } catch (e) {
      console.warn('Failed to clear saved game:', e);
    }
    // Force new game with new seed
    const newSeed = Date.now().toString();
    window.location.href = `/play?seed=${newSeed}&fresh=1`;
  }, []);
  
  // Loading state
  if (!state) {
    return (
      <div class="game-loading">
        <div class="loading-spinner"></div>
        <p>Preparing your adventure...</p>
      </div>
    );
  }
  
  // Overlays
  if (gameOver) {
    return <GameOverOverlay onRestart={handleRestart} />;
  }
  
  // NOTE: The `victory` flag means "room cleared", NOT "game won".
  // The game is infinite procedural - there is no game-win condition.
  // VictoryOverlay would only be shown if we add a final boss at depth 100+.
  
  return (
    <div class="game-ui">
      {/* Header Bar */}
      <header class="game-header">
        <div class="header-left">
          <span class="depth">📍 Depth: {depth}</span>
          <span class="gold">💰 Gold: {currentGold}</span>
          <span class="rests">🏕️ Rests: {rests}</span>
        </div>
        <div class="header-center">
          <h1>Room {roomNum}: {roomTypeName.value.toUpperCase()}</h1>
        </div>
        <div class="header-right">
          <span class="floor">Floor {floor}</span>
        </div>
      </header>
      
      {/* Main Layout */}
      <div class="game-layout">
        {/* Left Sidebar - Party Status */}
        <aside class="party-sidebar">
          <h2 class="sidebar-title">PARTY STATUS</h2>
          <div class="party-list">
            {members.map(member => (
              <PartyMemberCard key={member.id} member={member} />
            ))}
          </div>
        </aside>
        
        {/* Center - Main Content */}
        <main class="main-content">
          {inCombat ? (
            <CombatView />
          ) : (
            <RoomContentView />
          )}
        </main>
        
        {/* Right Sidebar - Combat Log */}
        <aside class="log-sidebar">
          <CombatLog />
        </aside>
      </div>
      
      {/* Styles */}
      <style>{`
        .game-ui {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface-1, #0f0f1a);
          color: white;
          font-family: 'Share Tech Mono', monospace;
        }
        
        /* Header */
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: linear-gradient(180deg, #1a1a2e, #0f0f1a);
          border-bottom: 2px solid #b87333;
        }
        
        .header-left, .header-right {
          display: flex;
          gap: 1.5rem;
          font-size: 0.875rem;
        }
        
        .header-center h1 {
          font-size: 1.25rem;
          color: #fbbf24;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        .depth { color: #22c55e; }
        .gold { color: #fbbf24; }
        .rests { color: #60a5fa; }
        .floor { color: #a78bfa; }
        
        /* Main Layout */
        .game-layout {
          display: grid;
          grid-template-columns: 250px 1fr 280px;
          gap: 0;
          flex: 1;
          overflow: hidden;
        }
        
        /* Party Sidebar */
        .party-sidebar {
          background: #1a1a2e;
          border-right: 1px solid #374151;
          overflow-y: auto;
          padding: 1rem;
        }
        
        .sidebar-title {
          font-size: 0.75rem;
          color: #ef4444;
          border: 1px solid #ef4444;
          padding: 0.25rem 0.5rem;
          margin: 0 0 1rem 0;
          display: inline-block;
        }
        
        .party-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        /* Party Member Card */
        .party-member {
          background: #0f0f1a;
          border: 1px solid #374151;
          padding: 0.75rem;
          border-radius: 4px;
        }
        
        .party-member.dead {
          opacity: 0.5;
          filter: grayscale(0.8);
        }
        
        .member-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        
        .member-name {
          color: #22c55e;
          font-weight: bold;
        }
        
        .member-level {
          color: #9ca3af;
        }
        
        .member-stats {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }
        
        .stat-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .stat-label {
          font-size: 0.75rem;
          color: #9ca3af;
          width: 24px;
        }
        
        /* HP Bar */
        .hp-bar-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
        
        .hp-bar-bg {
          flex: 1;
          height: 10px;
          background: #374151;
          border-radius: 2px;
          overflow: hidden;
        }
        
        .hp-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }
        
        .hp-text {
          font-size: 0.65rem;
          color: #9ca3af;
          min-width: 50px;
          text-align: right;
        }
        
        .xp-bar {
          flex: 1;
          height: 6px;
          background: #374151;
          border-radius: 2px;
          overflow: hidden;
        }
        
        .xp-fill {
          height: 100%;
          background: #60a5fa;
        }
        
        /* Character Sprite */
        .character-sprite {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem;
        }
        
        .sprite-body {
          width: 40px;
          height: 50px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }
        
        .sprite-head {
          width: 16px;
          height: 16px;
          background: var(--char-color, #22c55e);
          border: 2px solid rgba(255,255,255,0.3);
        }
        
        .sprite-torso {
          width: 20px;
          height: 14px;
          background: var(--char-color, #22c55e);
          border: 2px solid rgba(255,255,255,0.3);
          margin-top: -2px;
        }
        
        .sprite-arms {
          position: absolute;
          top: 18px;
          width: 30px;
          height: 8px;
          background: var(--char-color, #22c55e);
          border: 2px solid rgba(255,255,255,0.3);
        }
        
        .sprite-legs {
          display: flex;
          gap: 4px;
          margin-top: -2px;
        }
        
        .sprite-legs::before,
        .sprite-legs::after {
          content: '';
          width: 6px;
          height: 12px;
          background: var(--char-color, #22c55e);
          border: 2px solid rgba(255,255,255,0.3);
        }
        
        .sprite-name {
          font-size: 0.625rem;
          color: #9ca3af;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }
        
        .character-sprite.dead {
          opacity: 0.3;
          filter: grayscale(1);
        }
        
        .character-sprite.idle .sprite-body {
          animation: bob 2s ease-in-out infinite;
        }
        
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        /* Main Content */
        .main-content {
          background: #1a1a2e;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        
        /* Combat View */
        .combat-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .enemy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }
        
        .enemy-card {
          background: #0f0f1a;
          border: 2px solid #374151;
          padding: 1rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        
        .enemy-card:hover:not(.dead) {
          border-color: #ef4444;
        }
        
        .enemy-card.selected {
          border-color: #ef4444;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }
        
        .enemy-card.dead {
          opacity: 0.4;
          filter: grayscale(1);
          cursor: not-allowed;
        }
        
        .enemy-info {
          text-align: center;
          width: 100%;
        }
        
        .enemy-name {
          color: #ef4444;
          font-weight: bold;
          display: block;
          margin-bottom: 0.25rem;
        }
        
        .enemy-stats {
          display: flex;
          gap: 1rem;
          justify-content: center;
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.25rem;
        }
        
        .attack-btn {
          padding: 0.5rem 1rem;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          margin-top: 0.5rem;
        }
        
        .attack-btn:hover {
          background: #dc2626;
        }
        
        /* Combat Actions */
        .combat-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
          padding: 1rem;
          background: #0f0f1a;
          border-radius: 4px;
          border: 1px solid #374151;
        }
        
        .action-btn {
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: bold;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          min-width: 100px;
        }
        
        .action-btn.primary {
          background: #6366f1;
          color: white;
        }
        
        .action-btn.primary:hover {
          background: #4f46e5;
        }
        
        .action-btn.secondary {
          background: #374151;
          color: #d1d5db;
        }
        
        .action-btn.secondary:hover:not(:disabled) {
          background: #4b5563;
        }
        
        .action-btn.ability {
          background: #1e3a5f;
          color: #60a5fa;
          position: relative;
        }
        
        .action-btn.ability:hover:not(:disabled) {
          background: #1e4976;
        }
        
        .action-btn.ability.on-cooldown {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .action-btn .cooldown {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ef4444;
          color: white;
          font-size: 0.625rem;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .action-btn.flee {
          background: #374151;
          color: #fbbf24;
        }
        
        .action-btn.flee:hover {
          background: #4b5563;
        }
        
        .action-btn.danger {
          background: #dc2626;
          color: white;
        }
        
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .turn-indicator {
          text-align: center;
          padding: 1rem;
          color: #9ca3af;
          font-style: italic;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Room Content View */
        .room-content-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          min-height: 300px;
        }
        
        .room-icon {
          font-size: 4rem;
        }
        
        .room-text {
          color: #d1d5db;
          text-align: center;
          max-width: 400px;
        }
        
        .room-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
        }
        
        /* Combat Log Sidebar */
        .log-sidebar {
          background: #0f0f1a;
          border-left: 1px solid #374151;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .combat-log {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .log-header {
          font-size: 0.75rem;
          color: #60a5fa;
          padding: 0.75rem 1rem;
          margin: 0;
          border-bottom: 1px solid #374151;
          background: #1a1a2e;
        }
        
        .log-entries {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .log-entry {
          font-size: 0.75rem;
          color: #9ca3af;
          padding: 0.25rem 0.5rem;
          border-left: 2px solid #374151;
        }
        
        .log-entry.hit { border-color: #ef4444; color: #fca5a5; }
        .log-entry.miss { border-color: #6b7280; }
        .log-entry.victory { border-color: #22c55e; color: #86efac; }
        .log-entry.reward { border-color: #fbbf24; color: #fde68a; }
        .log-entry.critical { border-color: #f97316; color: #fdba74; }
        
        /* Loading */
        .game-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #9ca3af;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #374151;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Overlays */
        .game-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        
        .overlay-content {
          text-align: center;
          padding: 2rem 3rem;
          background: #1a1a2e;
          border-radius: 8px;
        }
        
        .overlay-content.game-over {
          border: 2px solid #ef4444;
        }
        
        .overlay-content.victory {
          border: 2px solid #fbbf24;
        }
        
        .overlay-content h2 {
          font-size: 2rem;
          margin: 0 0 1rem 0;
        }
        
        .overlay-content.game-over h2 { color: #ef4444; }
        .overlay-content.victory h2 { color: #fbbf24; }
        
        .overlay-content p {
          color: #d1d5db;
          margin: 0 0 1.5rem 0;
        }
        
        .overlay-btn {
          padding: 0.75rem 2rem;
          font-size: 1rem;
          font-weight: bold;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .overlay-btn:hover {
          background: #4f46e5;
        }
        
        /* Mobile Responsive */
        @media (max-width: 1024px) {
          .game-layout {
            grid-template-columns: 200px 1fr 220px;
          }
        }
        
        @media (max-width: 768px) {
          .game-layout {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
          }
          
          .party-sidebar {
            border-right: none;
            border-bottom: 1px solid #374151;
          }
          
          .party-list {
            flex-direction: row;
            overflow-x: auto;
          }
          
          .party-member {
            min-width: 180px;
          }
          
          .log-sidebar {
            border-left: none;
            border-top: 1px solid #374151;
            max-height: 200px;
          }
        }
      `}</style>
    </div>
  );
};

export default GameUI;
