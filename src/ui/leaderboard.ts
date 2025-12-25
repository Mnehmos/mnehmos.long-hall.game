import { ScoreEntry } from '../api/client';

export function renderLeaderboard(scores: ScoreEntry[]): string {
  if (scores.length === 0) {
      return `
      <div class="overlay" id="leaderboard-overlay">
        <div class="popup leaderboard-popup">
          <h2>High Scores</h2>
          <p>No scores yet! Be the first!</p>
          <button id="btn-close-leaderboard" class="btn">Close</button>
        </div>
      </div>
      `;
  }

  const rows = scores.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>User ${s.user_id.slice(-4)}</td>
      <td>${s.score}</td>
      <td>${new Date(s.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');

  return `
    <div class="overlay" id="leaderboard-overlay">
      <div class="popup leaderboard-popup">
        <h2>High Scores</h2>
        <table class="score-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="actions">
            <button id="btn-close-leaderboard" class="btn">Close</button>
        </div>
      </div>
    </div>
  `;
}
