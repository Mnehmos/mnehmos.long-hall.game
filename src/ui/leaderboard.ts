import type { ScoreEntry, WeaponEntry, LeaderboardCategory } from '../api/client';

// Leaderboard category definitions
export const CATEGORIES = [
  { id: 'score' as LeaderboardCategory, icon: '🎒', label: 'Total Score', valueKey: 'score' },
  { id: 'depth' as LeaderboardCategory, icon: '🏆', label: 'Deepest', valueKey: 'depth' },
  { id: 'gold' as LeaderboardCategory, icon: '💰', label: 'Richest', valueKey: 'gold' },
  { id: 'kills' as LeaderboardCategory, icon: '⚔️', label: 'Most Kills', valueKey: 'total_kills' },
  { id: 'hit' as LeaderboardCategory, icon: '💥', label: 'Biggest Hit', valueKey: 'highest_hit' },
  { id: 'crits' as LeaderboardCategory, icon: '🎯', label: 'Crit Master', valueKey: 'critical_hits' },
  { id: 'level' as LeaderboardCategory, icon: '📊', label: 'Max Level', valueKey: 'max_level' },
] as const;

export function renderLeaderboard(
  scores: ScoreEntry[], 
  activeCategory: LeaderboardCategory | 'weapons' = 'score', 
  weapons: WeaponEntry[] = []
): string {
  // Build tab buttons
  const tabs = CATEGORIES.map(cat => 
    `<button class="tab-btn ${cat.id === activeCategory ? 'active' : ''}" data-category="${cat.id}">
      ${cat.icon} <span class="tab-label">${cat.label}</span>
    </button>`
  ).join('');
  
  // Find active category config
  const category = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  
  // Build score rows
  const rows = scores.length === 0 
    ? '<tr><td colspan="3" class="empty-row">No scores yet! Be the first!</td></tr>'
    : scores.map((s, i) => {
        const value = (s as any)[category.valueKey] ?? 0;
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
          <tr>
            <td class="rank ${rankClass}">${i + 1}</td>
            <td class="player-name">${s.display_name || 'Anonymous'}</td>
            <td class="stat-value">${formatValue(value, category.id)}</td>
          </tr>
        `;
      }).join('');
  
  // Build weapon rows
  const weaponRows = weapons.length === 0
    ? '<tr><td colspan="4" class="empty-row">No legendary weapons yet!</td></tr>'
    : weapons.slice(0, 10).map((w, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
          <tr>
            <td class="rank ${rankClass}">${i + 1}</td>
            <td class="weapon-name rarity-${w.rarity}">${w.name}</td>
            <td class="stat-value">${w.kills}</td>
            <td class="player-name">${w.owner}</td>
          </tr>
        `;
      }).join('');

  return `
    <div class="overlay" id="leaderboard-overlay">
      <div class="popup leaderboard-popup">
        <h2>🏛️ Hall of Fame</h2>
        
        <div class="leaderboard-tabs">
          ${tabs}
          <button class="tab-btn weapons-tab ${activeCategory === 'weapons' ? 'active' : ''}" data-category="weapons">
            ⚔️ <span class="tab-label">Weapons</span>
          </button>
        </div>
        
        ${activeCategory === 'weapons' ? `
          <table class="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Weapon</th>
                <th>Kills</th>
                <th>Wielder</th>
              </tr>
            </thead>
            <tbody>${weaponRows}</tbody>
          </table>
        ` : `
          <table class="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>${category.icon} ${category.label}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `}
        
        <div class="actions">
          <button id="btn-close-leaderboard" class="btn">Close</button>
        </div>
      </div>
    </div>
  `;
}

// Format values based on category
function formatValue(value: number, categoryId: LeaderboardCategory): string {
  switch (categoryId) {
    case 'gold':
      return `${value.toLocaleString()}g`;
    case 'score':
      return value.toLocaleString();
    default:
      return value.toLocaleString();
  }
}
