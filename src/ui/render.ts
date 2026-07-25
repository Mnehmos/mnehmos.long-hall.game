import type { RunState, Item } from '../engine/types';
import { clerk } from '../auth';
import { getAbilityById } from '../content/abilities';
import { getEnemyArt, getHeroArt, renderHpBar, renderStatBar, EQUIPMENT_ICONS } from '../content/art';
import { calculateEscapeDC } from '../engine/generateRoom';
import type { ScoreEntry } from '../api/client';
import { esc, escAttr } from './escape';

// UI State (not game state - just for navigation)
let cachedHighScores: ScoreEntry[] = [];

export function setCachedHighScores(scores: ScoreEntry[]) {
  cachedHighScores = scores;
}

function renderHighScoresPanel(): string {
  let html = `<div class="highscores-panel">
    <h3>🏆 High Scores</h3>`;
  
  if (cachedHighScores.length === 0) {
    html += `<div class="highscores-empty">No scores yet!<br/>Be the first!</div>`;
  } else {
    html += `<ul class="highscores-list">`;
    cachedHighScores.slice(0, 10).forEach((score, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const displayName = score.display_name || 'Anonymous';
      html += `
        <li class="highscore-entry">
          <span class="highscore-rank ${rankClass}">#${i + 1}</span>
          <span class="highscore-name">${esc(displayName)}</span>
          <span class="highscore-score">${score.score}</span>
        </li>`;
    });
    html += `</ul>`;
  }
  
  html += `</div>`;
  return html;
}

function formatItemStats(item: Item, showMastery: boolean = false): string {
    let parts = [`Cost: ${item.cost}g`];
    if (item.baseStats.attackBonus) parts.push(`ATK +${item.baseStats.attackBonus}`);
    if (item.baseStats.damageBonus) parts.push(`DMG +${item.baseStats.damageBonus}`);
    if (item.baseStats.acBonus) parts.push(`AC +${item.baseStats.acBonus}`);
    if (item.baseStats.maxHpBonus) parts.push(`HP +${item.baseStats.maxHpBonus}`);

    // Enchantment
    if (item.enchantment) {
        const e = item.enchantment.effect;
        if (e.attackBonus) parts.push(`✨+${e.attackBonus} Hit`);
        if (e.damageBonus) parts.push(`✨+${e.damageBonus} Dmg`);
        if (e.acBonus) parts.push(`✨+${e.acBonus} AC`);
        if (e.maxHpBonus) parts.push(`✨+${e.maxHpBonus} HP`);
    }

    // Mastery stats (for tooltips)
    if (showMastery && item.stats) {
        parts.push(`\n━━ Mastery ━━`);
        parts.push(`⚔️ Kills: ${item.stats.kills}`);
        parts.push(`💥 Damage: ${item.stats.damageDealt}`);
        parts.push(`🎯 Best Hit: ${item.stats.highestHit}`);
        if (item.stats.criticalHits > 0) parts.push(`💫 Crits: ${item.stats.criticalHits}`);
        parts.push(`📊 Battles: ${item.stats.encountersUsed}`);
    }

    return parts.join(showMastery ? '\n' : ', ') || 'No stats';
}

function formatItemHistory(item: Item): string {
    if (!item.history || item.history.length === 0) return '';
    return '\n━━ History ━━\n' + item.history.slice(-5).join('\n');
}

function renderShopSection(state: RunState): string {
    // Only ever show what the room actually stocks. The old fallback invented a
    // random shelf at render time, which meant the displayed stock changed on
    // every repaint and never matched what BUY_ITEM would accept.
    const forSale = state.currentRoom?.shopItems ?? [];

    if (forSale.length === 0) {
        return `<div class="shop-section"><h4>🛒 Shop</h4><p>Sold out!</p></div>`;
    }
    
    let html = `<div class="shop-section">
        <h4>🛒 Shop</h4>
        <div class="shop-list">`;
    
    for (const item of forSale) {
        const cost = item.cost || 20;
        const canAfford = state.party.gold >= cost;
        const disabled = !canAfford ? 'disabled' : '';
        const rarity = item.rarity;
        
        html += `
        <div class="shop-item ${rarity} ${disabled}">
            <div class="item-name">${esc(item.name)}</div>
            <div class="item-slot">${esc(item.type.toUpperCase())}</div>
            <div class="item-stats">${esc(formatItemStats(item))}</div>
            <div class="item-cost">💰 ${cost} gold</div>
            <button class="btn-buy" data-item="${esc(item.id)}" ${disabled}>Buy</button>
        </div>`;
    }
    
    html += `</div></div>`;
    return html;
}

function renderRecruitSection(state: RunState): string {
    // Use room's pre-generated recruits
    const room = state.currentRoom;
    const available = room?.availableRecruits || [];

    if (available.length === 0) {
        return `<div class="recruit-section"><h4>🧑‍🤝‍🧑 Recruits</h4><p>No recruits available.</p></div>`;
    }

    let html = `<div class="recruit-section">
        <h4>🧑‍🤝‍🧑 Recruits Available</h4>
        <div class="recruit-list">`;

    for (const recruit of available) {
        const canAfford = state.party.gold >= recruit.cost;
        const partyFull = state.party.members.length >= 4;
        const disabled = !canAfford || partyFull ? 'disabled' : '';

        html += `
        <div class="recruit-card ${disabled}">
            <div class="recruit-name">${esc(recruit.name)}</div>
            <div class="recruit-role">${esc(recruit.role.toUpperCase())} <span class="recruit-level">Lv.${esc(recruit.level)}</span></div>
            <div class="recruit-desc">${esc(recruit.description)}</div>
            <div class="recruit-cost">💰 ${recruit.cost} gold</div>
            <button class="btn-hire" data-recruit="${esc(recruit.id)}" ${disabled}>Hire</button>
        </div>`;
    }

    html += `</div></div>`;
    return html;
}

function renderItemStats(item: Item): string {
    const s = item.baseStats;
    const parts = [];
    if (s.attackBonus) parts.push(`ATK+${s.attackBonus}`);
    if (s.damageBonus) parts.push(`DMG+${s.damageBonus}`);
    if (s.acBonus) parts.push(`AC+${s.acBonus}`);
    if (s.maxHpBonus) parts.push(`HP+${s.maxHpBonus}`);
    return parts.join(', ');
}

function renderSidebar(state: RunState): string {
    let html = `<div class="sidebar-left">`;

    // ASCII Header
    html += `
    <div class="sidebar-header">
      <pre class="ascii-art" style="color:red; margin:0; padding:0; background:none;">
 ╔═════════════╗
 ║ PARTY STATUS║
 ╚═════════════╝
      </pre>
    </div>`;

    state.party.members.forEach((member, index) => {
        // XP Bar
        const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200];
        const nextXp = member.level < XP_THRESHOLDS.length - 1 ? XP_THRESHOLDS[member.level] : XP_THRESHOLDS[XP_THRESHOLDS.length - 1];

        // Calculate HP percentage for color
        const hpPercent = member.hp.current / member.hp.max;
        let hpColor = '';
        if (!member.isAlive) {
            hpColor = 'color: #666;'; // Gray for dead
        } else if (hpPercent <= 0.25) {
            hpColor = 'color: #ff3333;'; // Red when critical
        } else if (hpPercent <= 0.5) {
            hpColor = 'color: #ff8800;'; // Orange when low
        } else if (hpPercent <= 0.75) {
            hpColor = 'color: #ffcc00;'; // Yellow when moderate
        }

        const hpBar = renderStatBar(member.hp.current, member.hp.max, 10, '█', '░');
        const xpBar = renderStatBar(member.xp, nextXp, 10, '▒', '░');

        const statusIcons = member.statuses?.map(s => {
            if (s === 'hidden') return '👁️‍🗨️';
            return '•';
        }).join('') || '';

        const deadClass = !member.isAlive ? 'dead' : '';

        html += `
        <div class="sidebar-member ${deadClass}" data-party-index="${index}" style="${hpColor}">
            <div class="sidebar-name">${esc(member.name)} <span style="float:right">${member.isAlive ? 'Lv.'+member.level : 'DEAD'}</span></div>
            <div class="sidebar-status-ascii">
 HP [${hpBar}]
 XP [${xpBar}]
 ${statusIcons}
            </div>
        </div>`;
    });

    html += `</div>`;
    return html;
}

export function renderGame(state: RunState): string {
  const room = state.currentRoom;
  
  // Check for Game Over overlay
  if (state.gameOver) {
    return renderGameOver(state);
  }
  
  // Check for Victory popup
  if (state.victory) {
    return renderVictoryPopup(state);
  }

  // Check for Shrine Blessing popup
  if (state.shrineBoon) {
    return renderShrineBlessingPopup(state);
  }
  
  // Header
  let html = `
    <div class="header">
      <div class="header-top">
         <h1>The Long Hall</h1>
         <div class="header-controls">
             <button id="btn-leaderboard" class="btn-sm">🏆 High Scores</button>
             <div class="auth-controls">
            ${clerk.user 
                ? `<span class="user-tag">👤 ${esc(clerk.user.firstName)}</span> <button id="btn-logout" class="btn-sm">Logout</button>`
                : `<button id="btn-login" class="btn-sm btn-primary">Login / Sign Up</button>`
            }
         </div>
      </div>
      </div>
      <div class="stats">
        <span class="stat-depth">🗺️ Depth: ${state.depth}</span>
        <span class="stat-gold">💰 Gold: ${state.party.gold}</span>
        <span class="stat-rests">⛺ Rests: ${state.shortRestsRemaining}</span>
      </div>
    </div>

  `;

  // Sidebar (Left)
  html += renderSidebar(state);

  // Main content area (center)
  html += `<div class="main-content">`;  

  // Room Area
  html += `<div class="room-container">`;
  
  
  if (state.depth === 0) {
      html += `
        <div class="room-desc">
          <h2>⚔️ The Entrance</h2>
          <p>You stand at the entrance of the Long Hall. Darkness stretches ahead.</p>
          <pre class="ascii-art">
    ╔════════════════════════╗
    ║ THE LONG HALL          ║
    ║    ⬇️ ENTER ⬇️          ║
    ╚════════════════════════╝
          </pre>
        </div>
      `;
  } else if (room) {
      html += `
        <div class="room-desc">
          <h2>Room ${state.depth}: ${room.type.toUpperCase()}</h2>
          ${renderRoomContent(room, state)}
        </div>
      `;
  }
  
  html += `</div>`; // End room-container

  // Actions
  html += `<div class="actions">`;
  
  // Intermission always shows its own UI
  if (room?.type === 'intermission') {
      // Intermission - long rest, shop, recruits, optional boss
      html += `<button id="btn-long-rest" class="btn-success">🛏️ Take Long Rest</button>`;
      html += renderShopSection(state);
      html += renderRecruitSection(state);
      
      // Boss Room interaction
      if (state.pendingBossReward) {
          html += `<div class="boss-challenge">
              <h4>🏆 Boss Defeated!</h4>
              <p>A powerful shrine has appeared from the boss's remains.</p>
              <button id="btn-pray-shrine-boss" class="btn-primary">🙏 Pray at Boss Shrine</button>
          </div>`;
      } else if (room.bossRoom) {
          const bossCount = room.bossRoom.enemies?.length || 0;
          const lootCount = room.bossRoom.loot?.length || 0;
          html += `<div class="boss-challenge">
              <h4>⚔️ Boss Challenge Available!</h4>
              <p>Face a powerful boss (${bossCount} enemies) for rare+ loot only (${lootCount} items) and a guaranteed rare+ shrine blessing!</p>
              <button id="btn-enter-boss" class="btn-danger">👹 Enter Boss Room</button>
          </div>`;
      }
      
      html += `<div class="intermission-advance"><button id="btn-advance-confirm" class="btn-warning">⚔️ Continue to Next Segment</button></div>`;
  } else if (state.roomResolved) {
      html += `<button id="btn-advance">Advance →</button>`;
      if (state.shortRestsRemaining > 0) {
           html += `<button id="btn-rest" class="secondary">Short Rest</button>`;
      }
   } else if (room) {
      // Check if there are enemies to fight (combat, elite, OR guarded shrine/hazard)
      const hasEnemies = room.enemies && room.enemies.length > 0;
      if (hasEnemies) {
          // Combat in progress - show each party member's actions
          html += `<div class="combat-panel">`;

          // Show attack options for each alive party member
          const aliveMembers = state.party.members.filter(m => m.isAlive);
          const actedThisRound = state.actedThisRound || [];

          // Check if there are extra actions available (from Action Surge)
          const hasExtraActions = (state.extraActions || 0) > 0;

          for (const member of aliveMembers) {
              const hasActed = actedThisRound.includes(member.id);
              // If extra actions available, acted members can act again
              const canAct = !hasActed || hasExtraActions;
              const actedClass = (hasActed && !hasExtraActions) ? 'acted' : '';

              html += `<div class="member-actions ${actedClass}">`;
              const statusText = member.statuses?.includes('hidden') ? ' <span class="status-hidden">(Hidden)</span>' : '';
              const actedText = hasActed && !hasExtraActions ? ' <span class="status-acted">(Done)</span>' : '';
              const surgeText = hasActed && hasExtraActions ? ' <span class="status-surge">(Surging!)</span>' : '';
              html += `<div class="member-name">${esc(member.name)} (${esc(member.role)})${statusText}${actedText}${surgeText}</div>`;

              // Attack buttons - disabled if already acted (unless extra actions available)
              html += `<div class="member-targets">`;
              room.enemies.forEach((e) => {
                  const disabled = canAct ? '' : 'disabled';
                  html += `<button class="btn-attack" data-attacker="${esc(member.id)}" data-target="${esc(e.id)}" ${disabled}>⚔️ Attack ${esc(e.name)}</button>`;
              });
              html += `</div>`;

              // Ability buttons
              if (member.abilities && member.abilities.length > 0) {
                  html += `<div class="member-abilities">`;
                  for (const abilityState of member.abilities) {
                      const ability = getAbilityById(abilityState.abilityId);
                      if (!ability) continue;

                      const isReady = abilityState.currentCooldown === 0;
                      // Action Surge can be used even after acting (it grants extra action)
                      const isFreeAction = ability.id === 'action_surge' || ability.id === 'cunning_action' || ability.id === 'camouflage';
                      // Check if usable: ready AND (can act OR is a free action)
                      let isUsable = isReady && (canAct || isFreeAction);
                      let extraText = '';
                      if (ability.id === 'sneak_attack' && !member.statuses?.includes('hidden')) {
                           isUsable = false;
                           extraText = ' (Needs Hidden)';
                      }

                      // Show "Rest" for rest-cooldown abilities (999), otherwise show turn count
                      const cooldownText = isReady ? '' : (abilityState.currentCooldown >= 999 ? ' (Rest)' : ` (${abilityState.currentCooldown})`);
                      const disabled = isUsable ? '' : 'disabled';
                      const btnClass = isUsable ? 'btn-ability' : 'btn-ability cooldown';

                      // For abilities that target enemies, show enemy selector
                      if (ability.effect.target === 'enemy') {
                          room.enemies.forEach((e) => {
                              html += `<button class="${btnClass}" data-actor="${esc(member.id)}" data-ability="${esc(ability.id)}" data-target="${esc(e.id)}" ${disabled} title="${escAttr(ability.description)}">✨ ${esc(ability.name)}${cooldownText}${extraText} → ${esc(e.name)}</button>`;
                          });
                      } else if (ability.effect.target === 'ally') {
                          // For ally-targeting abilities (like heals), show party member selector
                          state.party.members.filter(m => m.isAlive).forEach((ally) => {
                              const hpInfo = ally.hp.current < ally.hp.max ? ` (${ally.hp.current}/${ally.hp.max})` : '';
                              html += `<button class="${btnClass}" data-actor="${esc(member.id)}" data-ability="${esc(ability.id)}" data-target="${esc(ally.id)}" ${disabled} title="${escAttr(ability.description)}">✨ ${esc(ability.name)}${cooldownText} → ${esc(ally.name)}${hpInfo}</button>`;
                          });
                      } else {
                          html += `<button class="${btnClass}" data-actor="${esc(member.id)}" data-ability="${esc(ability.id)}" ${disabled} title="${escAttr(ability.description)}">✨ ${esc(ability.name)}${cooldownText}${extraText}</button>`;
                      }
                  }
                  html += `</div>`;
              }
              
              html += `</div>`;
          }
          
          html += `</div>`;
          // Calculate dynamic escape DC
          const escapeAliveMembers = state.party.members.filter(m => m.isAlive);
          const partyAgility = Math.max(...escapeAliveMembers.map(m => m.skills.agility), 0);
          const hasRogue = escapeAliveMembers.some(m => m.role === 'rogue');
          const aliveEnemyCount = room.enemies.filter(e => e.hp > 0).length;
          const isEliteRoom = room.type === 'elite';
          const { dc: escapeDC } = calculateEscapeDC(state.depth, aliveEnemyCount, isEliteRoom, partyAgility, hasRogue);
          html += `<button id="btn-escape" class="btn-danger">🏃 Escape (DC ${escapeDC})</button>`;
      } else if (room.type === 'hazard') {
          // Trap room - choice
          html += `<button id="btn-disarm" class="btn-success">🔧 Attempt to Disarm (DC 12)</button>`;
          html += `<button id="btn-trigger" class="btn-danger">💥 Trigger Trap</button>`;
      } else if (room.type === 'shrine') {
          // Shrine - pray button
          html += `<button id="btn-pray" class="btn-shrine">🙏 Pray at Shrine</button>`;
      } else if (room.type === 'trader') {
          // Trader - show shop + rest option + advance
          html += renderShopSection(state);
          html += `<div class="trader-actions">`;
          if (state.shortRestsRemaining > 0) {
               html += `<button id="btn-rest" class="secondary">☕ Short Rest (${state.shortRestsRemaining} left)</button>`;
          }
          html += `<button id="btn-advance" class="btn-primary">Advance →</button>`;
          html += `</div>`;
      }
  }
  html += `</div>`;

  // Panels: Hero & Info
  html += `<div class="panels">`;
  
  // Hero Panel - render all party members
  for (const member of state.party.members) {
    const aliveClass = member.isAlive ? '' : 'dead';
    const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200];
    const nextLevelXp = member.level < XP_THRESHOLDS.length - 1 ? XP_THRESHOLDS[member.level] : XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
    // const prevLevelXp = member.level > 1 ? XP_THRESHOLDS[member.level - 1] : 0;
    // const xpProgress = nextLevelXp > prevLevelXp ? Math.floor(((member.xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100) : 100;
    
    // Calculate combat stats from equipment + level bonus
    // Calculate aggregate stats
    // Calculate combat stats from Skills + Equipment
    const skills = member.skills || { strength: 0, attack: 0, defense: 0, magic: 0, ranged: 0, faith: 0, agility: 0 };
    
    // Determine primary weapon type for display
    const weapon = member.equipment.main_hand;
    const weaponName = weapon?.name.toLowerCase() || '';
    let type: 'melee' | 'ranged' | 'magic' = 'melee';
    if (weaponName.includes('bow') || weaponName.includes('crossbow') || weaponName.includes('sling')) type = 'ranged';
    else if (weaponName.includes('staff') || weaponName.includes('wand') || weaponName.includes('tome')) type = 'magic';
    
    // Track bonuses from skills vs equipment separately
    let skillAtkBonus = 0;
    let skillDmgBonus = 0;
    let skillAtkName = 'ATK';
    let skillDmgName = 'STR';

    switch (type) {
        case 'melee':
            skillAtkBonus = skills.attack;
            skillDmgBonus = skills.strength;
            skillAtkName = 'ATK';
            skillDmgName = 'STR';
            break;
        case 'ranged':
            skillAtkBonus = skills.ranged;
            skillDmgBonus = skills.ranged;
            skillAtkName = 'RNG';
            skillDmgName = 'RNG';
            break;
        case 'magic':
            skillAtkBonus = skills.magic;
            skillDmgBonus = skills.magic;
            skillAtkName = 'MAG';
            skillDmgName = 'MAG';
            break;
    }

    // Sum stats from all equipped items and track per-item contributions
    let equipAtkBonus = 0;
    let equipDmgBonus = 0;
    let equipAcBonus = 0;
    const atkBreakdownLines: string[] = [];
    const dmgBreakdownLines: string[] = [];
    const acBreakdownLines: string[] = [];

    // Start with skill contribution
    if (skillAtkBonus > 0) atkBreakdownLines.push(`+${skillAtkBonus} from ${skillAtkName} skill`);
    if (skillDmgBonus > 0) dmgBreakdownLines.push(`+${skillDmgBonus} from ${skillDmgName} skill`);
    acBreakdownLines.push('10 Base AC');
    if (skills.defense > 0) acBreakdownLines.push(`+${skills.defense} from DEF skill`);

    Object.entries(member.equipment).forEach(([_slot, item]) => {
        if (!item) return;
        const baseAtk = item.baseStats.attackBonus || 0;
        const enchantAtk = item.enchantment?.effect?.attackBonus || 0;
        const baseDmg = item.baseStats.damageBonus || 0;
        const enchantDmg = item.enchantment?.effect?.damageBonus || 0;
        const baseAc = item.baseStats.acBonus || 0;
        const enchantAc = item.enchantment?.effect?.acBonus || 0;

        const itemAtk = baseAtk + enchantAtk;
        const itemDmg = baseDmg + enchantDmg;
        const itemAc = baseAc + enchantAc;

        equipAtkBonus += itemAtk;
        equipDmgBonus += itemDmg;
        equipAcBonus += itemAc;

        // Get display name
        const displayName = item.customName || item.name;
        
        // Add breakdown lines for each item
        if (baseAtk > 0) atkBreakdownLines.push(`+${baseAtk} from ${displayName}`);
        if (enchantAtk > 0) atkBreakdownLines.push(`+${enchantAtk} from ${displayName} enchant`);
        if (baseDmg > 0) dmgBreakdownLines.push(`+${baseDmg} from ${displayName}`);
        if (enchantDmg > 0) dmgBreakdownLines.push(`+${enchantDmg} from ${displayName} enchant`);
        if (baseAc > 0) acBreakdownLines.push(`+${baseAc} from ${displayName}`);
        if (enchantAc > 0) acBreakdownLines.push(`+${enchantAc} from ${displayName} enchant`);
    });

    // Total stats
    const atkBonus = skillAtkBonus + equipAtkBonus;
    const dmgBonus = skillDmgBonus + equipDmgBonus;
    const ac = 10 + skills.defense + equipAcBonus;

    // Build breakdown tooltips with vertical per-item details (use \n for newlines in title)
    const atkBreakdown = atkBreakdownLines.length > 0 
        ? `ATTACK BONUS: +${atkBonus}\n─────────────\n${atkBreakdownLines.join('\n')}`
        : `ATTACK BONUS: +${atkBonus}\n(no bonuses)`;
    const dmgBreakdown = dmgBreakdownLines.length > 0 
        ? `DAMAGE BONUS: +${dmgBonus}\n─────────────\n${dmgBreakdownLines.join('\n')}`
        : `DAMAGE BONUS: +${dmgBonus}\n(no bonuses)`;
    const acBreakdown = `ARMOR CLASS: ${ac}\n────────────\n${acBreakdownLines.join('\n')}`;

    const typeIcon = type === 'ranged' ? '🏹' : type === 'magic' ? '✨' : '⚔️';
    
    // Skills Grid with descriptions
    let skillsHtml = '<div class="skills-grid">';
    const skillKeys: (keyof typeof skills)[] = ['strength', 'attack', 'defense', 'magic', 'ranged', 'faith', 'agility'];
    const shortNames = { strength: 'STR', attack: 'ATK', defense: 'DEF', magic: 'MAG', ranged: 'RNG', faith: 'FTH', agility: 'AGI' };
    const skillDescriptions: Record<string, string> = {
        strength: 'STRENGTH\n+Melee damage bonus\nIncreases damage dealt with swords, axes, maces',
        attack: 'ATTACK\n+Melee hit chance\nIncreases accuracy with melee weapons',
        defense: 'DEFENSE\n+Armor Class (AC)\nMakes you harder to hit',
        magic: 'MAGIC\n+Spell hit & damage\nIncreases staff/wand attacks and spell power',
        ranged: 'RANGED\n+Ranged hit & damage\nIncreases bow/crossbow accuracy and damage',
        faith: 'FAITH\n+Healing & shrine luck\nBetter heals and higher chance of rare shrine boons',
        agility: 'AGILITY\n+Escape chance & initiative\nBetter odds to flee and act first'
    };
    
    skillKeys.forEach(key => {
        const val = skills[key];
        let btn = '';
        if ((member.statPoints || 0) > 0) {
            btn = `<button class="btn-stat-up" data-actor="${esc(member.id)}" data-stat="${esc(key)}" title="Spend Stat Point">+</button>`;
        }
        const tooltip = skillDescriptions[key];
        skillsHtml += `<div class="skill-item" title="${escAttr(tooltip)}"><span class="skill-label">${shortNames[key]}</span> <span class="skill-val">${val}</span> ${btn}</div>`;
    });
    skillsHtml += '</div>';
    
    if ((member.statPoints || 0) > 0) {
        skillsHtml += `<div class="stat-points-avail">Points Available: ${member.statPoints}</div>`;
    }

    // Helper to render a slot with ASCII art icon
    const renderSlot = (slotKey: string, label: string, item?: Item) => {
        const itemClass = item ? 'equipped' : 'empty';
        const icon = EQUIPMENT_ICONS[slotKey] || '?';
        const displayName = item ? (item.customName || item.name) : 'Empty';
        // Show mastery stats and history in tooltip for equipped items
        const tooltip = item
            ? `${displayName}\n${item.name !== displayName ? '('+item.name+')\n' : ''}${formatItemStats(item, true)}${formatItemHistory(item)}`
            : label;

        let actionsBtn = '';
        if (item) {
             // Rename button
             actionsBtn += `<button class="btn-icon btn-rename" data-rename="${esc(item.id)}" title="Rename Item">✎</button>`;
             // Unequip button
             actionsBtn += `<button class="btn-icon btn-unequip" data-actor="${esc(member.id)}" data-slot="${esc(slotKey)}" title="Unequip Item">✕</button>`;
        }

        return `<div class="equipment-slot ${itemClass}" title="${escAttr(tooltip)}">
            <pre class="slot-icon">${icon}</pre>
            <span class="slot-label">${esc(displayName)}</span>
            <div class="slot-actions">${actionsBtn}</div>
        </div>`;
    };

    html += `
    <div class="panel hero-panel ${member.role} ${aliveClass}">
      <div class="hero-header">
          <div class="hero-title-border">╔════════════════════╗</div>
          <h3>${esc(member.name)} ${!member.isAlive ? '☠️' : ''}</h3>
          <div class="member-level">Lv.${esc(member.level)} ${esc(member.role.toUpperCase())}</div>
          <div class="hero-title-border">╚════════════════════╝</div>
      </div>
      <pre class="ascii-art">${getHeroArt(member.role)}</pre>

      <div class="hero-stats-bar">
         <div class="stat-group hp">❤️ [${renderStatBar(member.hp.current, member.hp.max, 8)}] ${member.hp.current}/${member.hp.max}</div>
         <div class="stat-group xp">✨ [${renderStatBar(member.xp, nextLevelXp, 8, '▓', '░')}] ${member.xp}/${nextLevelXp}</div>
      </div>

      <div class="combat-stats-row">
        <div class="c-stat" title="${escAttr(atkBreakdown)}">${typeIcon} +${atkBonus}</div>
        <div class="c-stat" title="${escAttr(dmgBreakdown)}">💥 +${dmgBonus}</div>
        <div class="c-stat" title="${escAttr(acBreakdown)}">🛡️ ${ac}</div>
      </div>
      ${skillsHtml}

      <div class="paper-doll-grid">
         <div class="pd-row">
            ${renderSlot('head', 'Head', member.equipment.head)}
         </div>
         <div class="pd-row">
            ${renderSlot('ring1', 'Ring', member.equipment.ring1)}
            ${renderSlot('neck', 'Neck', member.equipment.neck)}
            ${renderSlot('ring2', 'Ring', member.equipment.ring2)}
         </div>
         <div class="pd-row">
            ${renderSlot('main_hand', 'Main', member.equipment.main_hand)}
            ${renderSlot('chest', 'Chest', member.equipment.chest)}
            ${renderSlot('off_hand', 'Off', member.equipment.off_hand)}
         </div>
         <div class="pd-row">
            ${renderSlot('legs', 'Legs', member.equipment.legs)}
         </div>
         <div class="pd-row">
            ${renderSlot('feet', 'Feet', member.equipment.feet)}
         </div>
      </div>
    </div>
  `;
  }

  // Inventory Panel - show in resolved rooms, trader, or intermission
  const showInventory = state.roomResolved || room?.type === 'trader' || room?.type === 'intermission';
  if (showInventory) {
    html += `
      <div class="panel inventory-panel">
        <h3>Inventory</h3>
        <ul>
          ${state.inventory.items.length === 0 ? '<li class="empty">Empty</li>' : 
            state.inventory.items.map(i => {
              // Show equip buttons for each alive party member
              const equipButtons = state.party.members
                .filter(m => m.isAlive)
                .map(m => {
                    // Special buttons for rings? For now just generic Equip which auto-slots
                    let btns = `<button class="btn-equip-to" data-equip="${esc(i.id)}" data-actor="${esc(m.id)}">${esc(m.name)}</button>`;
                    if (i.type === 'ring') {
                        // Optional: explicit buttons for Ring 1 / Ring 2?
                        // btns = `<button ... data-slot="ring1">R1</button> <button ... data-slot="ring2">R2</button>`;
                        // Sticking to auto-slot for MVP to save space
                    }
                    return btns;
                })
                .join('');
              return `
              <li class="item-row">
                <span class="item-info">
                    <span class="item-name ${esc(i.rarity)}">${esc(i.customName || i.name)}</span> 
                    <span class="item-type-tag">${esc(i.type)}</span>
                    <span class="item-stats-preview">${esc(renderItemStats(i))}</span>
                </span>
                <div class="equip-buttons">
                  <span class="equip-label">Equip:</span>
                  ${equipButtons}
                </div>
              </li>
            `;}).join('')}
        </ul>
      </div>
    `;
  }
  
  html += `</div>`; // End panels
  
  html += `</div>`; // End main-content

  // Activity Log (right side) - formatted with colors
  const formatLogEntry = (raw: string): string => {
    // Log lines embed item and character names, which are player-controlled.
    const text = esc(raw);
    // Round separators
    if (text.includes('━━━ ROUND')) {
      return `<div class="log-round">⚔️ ${text} ⚔️</div>`;
    }
    // Room entries - separators
    if (text.startsWith('Entered room')) {
      return `<div class="log-room">━━━ ${text} ━━━</div>`;
    }
    // Hero hits (green)
    if (text.includes('Hero attacks') && text.includes('HIT!')) {
      return `<div class="log-hero-hit">⚔️ ${text}</div>`;
    }
    // Hero misses (blue/purple)
    if (text.includes('Hero attacks') && text.includes('MISS!')) {
      return `<div class="log-hero-miss">💨 ${text}</div>`;
    }
    // Enemy hits (red)
    if (text.includes('HIT!')) {
      return `<div class="log-hit">💥 ${text}</div>`;
    }
    // Enemy misses (gray)
    if (text.includes('MISS!')) {
      return `<div class="log-miss">💨 ${text}</div>`;
    }
    // Damage to hero
    if (text.includes('has fallen') || text.includes('Game Over')) {
      return `<div class="log-death">☠️ ${text}</div>`;
    }
    // Victory/rewards
    if (text.includes('Victory') || text.includes('defeated') || text.includes('gold') || text.includes('XP')) {
      return `<div class="log-reward">✨ ${text}</div>`;
    }
    // Level up
    if (text.includes('leveled up')) {
      return `<div class="log-levelup">🎉 ${text}</div>`;
    }
    // Enchantment
    if (text.includes('Enchantment')) {
      return `<div class="log-enchant">✨ ${text}</div>`;
    }
    // Healing
    if (text.includes('Heal') || text.includes('restored') || text.includes('rest')) {
      return `<div class="log-heal">💚 ${text}</div>`;
    }
    // Default
    return `<div class="log-default">› ${text}</div>`;
  };
  
  html += `
    <div class="history terminal">
      <div class="terminal-header">📜 Combat Log</div>
      <div class="log-content" id="log-content">
        ${state.history.slice(-20).map(l => formatLogEntry(l)).join('')}
      </div>
    </div>
  `;

  // High Scores Panel (rightmost column)
  html += renderHighScoresPanel();

  return html;
}

function renderRoomContent(room: any, state: RunState): string {
    // Check if this is a GUARDED room (shrine or hazard with enemies)
    // If so, show combat first - trap/shrine comes AFTER guards are defeated
    const hasLivingEnemies = room.enemies && room.enemies.length > 0 && room.enemies.some((e: any) => e.hp > 0);
    
    if ((room.type === 'hazard' || room.type === 'shrine') && hasLivingEnemies) {
        // Guarded room - show enemies that need to be defeated first
        let guardHtml = '<div class="guarded-room">';
        guardHtml += `<p class="guard-warning">⚠️ Enemies guard this ${room.type === 'shrine' ? 'shrine' : 'area'}! Defeat them first.</p>`;
        guardHtml += '<div class="enemy-display">';
        for (const enemy of room.enemies.filter((e: any) => e.hp > 0)) {
            guardHtml += `
              <div class="enemy-card">
                <pre class="ascii-art">${getEnemyArt(enemy.id)}</pre>
                <div class="enemy-name">${esc(enemy.name)}</div>
                <div class="enemy-hp">${renderHpBar(enemy.hp, enemy.maxHp, 8)} ${enemy.hp}/${enemy.maxHp}</div>
              </div>
            `;
        }
        guardHtml += '</div></div>';
        return guardHtml;
    }
    
    // Combat rooms - show cleared state or active enemies
    if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
        if (state.roomResolved || room.enemies.length === 0) {
            // Room cleared - victory state
            return `
            <div class="room-cleared">
              <pre class="ascii-art victory-art">
    ╔═══════════════════════════════╗
    ║     ⚔️  ROOM CLEARED  ⚔️     ║
    ╠═══════════════════════════════╣
    ║                               ║
    ║   ░░░░░░░░░░░░░░░░░░░░░░░     ║
    ║   All enemies defeated!       ║
    ║   ░░░░░░░░░░░░░░░░░░░░░░░     ║
    ║                               ║
    ╚═══════════════════════════════╝
              </pre>
              <p>The room is safe. You may rest or continue forward.</p>
            </div>`;
        }
        
        // Active combat
        let enemyHtml = '<div class="enemy-display">';
        for (const enemy of room.enemies) {
            enemyHtml += `
              <div class="enemy-card">
                <pre class="ascii-art">${getEnemyArt(enemy.id)}</pre>
                <div class="enemy-name">${esc(enemy.name)}</div>
                <div class="enemy-hp">${renderHpBar(enemy.hp, enemy.maxHp, 8)} ${enemy.hp}/${enemy.maxHp}</div>
              </div>
            `;
        }
        enemyHtml += '</div>';
        return enemyHtml;
    }
    
    if (room.type === 'hazard') {
        // Check if trap was already resolved (disarmed or triggered)
        if (state.roomResolved) {
            return `
            <div class="trap-display disarmed">
              <pre class="ascii-art trap-art-safe">
    ╔═══════════════════════════════╗
    ║     ✅  TRAP DISARMED  ✅ ║
    ╠═══════════════════════════════╣
    ║                               ║
    ║   ░░░░░░░░░░░░░░░░░░░░░░░     ║
    ║     SAFE TO PROCEED           ║
    ║   ░░░░░░░░░░░░░░░░░░░░░░░     ║
    ║                               ║
    ╚═══════════════════════════════╝
              </pre>
              <p>The trap has been neutralized. You may proceed.</p>
            </div>`;
        }
        
        return `
        <div class="trap-display">
          <pre class="ascii-art trap-art">
    ╔═══════════════════════════════╗
    ║     ⚠️  DANGER  ⚠️             ║
    ╠═══════════════════════════════╣
    ║                               ║
    ║   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲     ║
    ║   ▼ SPIKE TRAP DETECTED ▼     ║
    ║   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲     ║
    ║                               ║
    ╚═══════════════════════════════╝
          </pre>
          <p>A deadly trap blocks your path!</p>
          <p class="hint">Disarm (DC 12): Success = safe passage. Fail = 1d6 damage.</p>
          <p class="hint">Trigger: Take 2d6 damage but proceed.</p>
        </div>`;
    }
    
    if (room.type === 'shrine') {
        if (state.roomResolved) {
            return `
            <div class="shrine-display blessed">
              <pre class="ascii-art shrine-art-blessed">
    ╔═══════════════════════════════╗
    ║     ✨  SHRINE BLESSED  ✨     ║
    ╠═══════════════════════════════╣
    ║           ╱╲                  ║
    ║          ╱  ╲                 ║
    ║         ╱ ⊕ ╲                ║
    ║        ╱____╲               ║
    ║                               ║
    ╚═══════════════════════════════╝
              </pre>
              <p>You have received the shrine's blessing.</p>
            </div>`;
        }
        
        return `
        <div class="shrine-display">
          <pre class="ascii-art shrine-art">
    ╔═══════════════════════════════╗
    ║     🙏  ANCIENT SHRINE  🙏    ║
    ╠═══════════════════════════════╣
    ║           ╱╲                  ║
    ║          ╱  ╲                 ║
    ║         ╱ ◇ ╲                ║
    ║        ╱____╲               ║
    ║                               ║
    ╚═══════════════════════════════╝
          </pre>
          <p>A mystical shrine radiates ancient power.</p>
          <p class="hint">Pray to receive a random blessing.</p>
        </div>`;
    }
    
    if (room.type === 'trader') {
        return `<pre class="ascii-art">
     _______
    |TRADER|
    |  $$$  |
    |_______|
        </pre>
        <p>A wandering merchant offers their wares.</p>`;
    }
    
    if (room.type === 'intermission') {
        const segment = Math.floor((state.depth - 1) / 10) + 1;
        return `
        <div class="intermission-display">
          <pre class="ascii-art intermission-art">
    ╔═══════════════════════════════════════╗
    ║     🏕️  SEGMENT ${segment} COMPLETE  🏕️      ║
    ╠═══════════════════════════════════════╣
    ║                                       ║
    ║   A safe haven between segments.      ║
    ║   Rest, resupply, and recruit.        ║
    ║                                       ║
    ║   🛏️ Long Rest Available              ║
    ║   🛒 Shop & Recruits Below            ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
          </pre>
          <p>You've reached a waystation. Prepare for the next segment!</p>
        </div>`;
    }
    
    return `<p>The hallway stretches on in silence...</p>`;
}

function renderGameOver(state: RunState): string {
    // Get last 15 log entries for death recap
    const deathLog = state.history.slice(-15).map(l => `<div class="death-log-entry">${esc(l)}</div>`).join('');
    
    return `
    <div class="overlay game-over-overlay">
      <div class="popup game-over-popup">
        <pre class="ascii-art game-over-art">
   ╔═══════════════════════════════════╗
   ║                                   ║
   ║     ☠️  GAME OVER  ☠️              ║
   ║                                   ║
   ║   You have fallen in the          ║
   ║   depths of the Long Hall.        ║
   ║                                   ║
   ║   Final Depth: ${String(state.depth).padStart(3, ' ')}                 ║
   ║   Gold: ${String(state.party.gold).padStart(4, ' ')}                   ║
   ║                                   ║
   ╚═══════════════════════════════════╝
        </pre>
        <div class="death-log">
          <h4>💀 Death Recap</h4>
          <div class="death-log-content">${deathLog}</div>
        </div>
        <button id="btn-restart" class="btn-restart">🔄 Start New Run</button>
      </div>
    </div>
    `;
}

function renderVictoryPopup(state: RunState): string {
    const room = state.currentRoom;
    
    return `
    <div class="overlay victory-overlay">
      <div class="popup victory-popup">
        <pre class="ascii-art victory-art">
   ╔═══════════════════════════════════╗
   ║                                   ║
   ║     ⚔️  VICTORY!  ⚔️               ║
   ║                                   ║
   ║   You have cleared Room ${String(state.depth).padStart(2, ' ')}!      ║
   ║                                   ║
   ║   ${room?.type === 'hazard' ? 'Trap Disarmed!' : 'All enemies defeated!'}      ║
   ║                                   ║
   ║   Total Gold: ${String(state.party.gold).padStart(4, ' ')}              ║
   ║                                   ║
   ╚═══════════════════════════════════╝
        </pre>
        <button id="btn-continue" class="btn-continue">Continue →</button>
      </div>
    </div>
    `;
}

function renderShrineBlessingPopup(state: RunState): string {
    const boonMessage = state.shrineBoon || 'The shrine remains silent...';
    const isStartingShrine = state.depth === 0;

    return `
    <div class="overlay shrine-overlay">
      <div class="popup shrine-popup">
        <pre class="ascii-art shrine-art">
   ╔═══════════════════════════════════╗
   ║                                   ║
   ║     🙏  SHRINE BLESSING  🙏       ║
   ║                                   ║
   ║${isStartingShrine ? '   The ancient shrine welcomes you  ' : '   You kneel before the shrine...   '}║
   ║                                   ║
   ╚═══════════════════════════════════╝
        </pre>
        <div class="shrine-boon-message">
          ${esc(boonMessage)}
        </div>
        <button id="btn-continue" class="btn-continue">Continue →</button>
      </div>
    </div>
    `;
}
