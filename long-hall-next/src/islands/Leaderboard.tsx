/**
 * Leaderboard Island Component
 * 
 * Fetches and displays high scores from the API, supports category tabs
 * (daily/weekly/all-time), shows current run score, and handles score 
 * submission on game over.
 * 
 * Hydration: client:idle (non-critical, loads after main thread idle)
 * 
 * @module islands/Leaderboard
 * @see {@link file://./../state/gameState.ts} for state signals
 * @see {@link file://./../state/derived.ts} for derived state
 * @see {@link file://./../../server/src/routes/scores.ts} for API endpoints
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import type { FunctionalComponent, JSX } from 'preact';

// State signals
import { gameState } from '../state/gameState';
import { showGameOver, showVictory } from '../state/derived';

// ============================================================================
// Types
// ============================================================================

/** Score entry from API */
export interface ScoreEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  score: number;
  depth: number;
  gold: number;
  total_kills: number;
  highest_hit: number;
  critical_hits: number;
  max_level: number;
  created_at: string;
}

/** Score submission payload */
export interface ScoreSubmission {
  runData: {
    seed: string;
    depth: number;
    party: {
      gold: number;
      members: Array<{
        level: number;
        equipment: Record<string, unknown>;
      }>;
    };
    inventory: {
      items: Array<{
        type: string;
        stats?: {
          kills: number;
          damageDealt: number;
          highestHit: number;
          criticalHits: number;
        };
      }>;
    };
  };
  displayName: string;
}

/** Leaderboard category types */
export type LeaderboardCategory = 'daily' | 'weekly' | 'allTime';

/** Props for Leaderboard component */
export interface LeaderboardProps {
  /** Default category to display */
  category?: LeaderboardCategory;
  /** Current run score (for highlighting and submit) */
  currentScore?: number;
  /** Show submit form (on game over) */
  showSubmit?: boolean;
  /** Callback after successful submit */
  onSubmit?: (entry: ScoreEntry) => void;
  /** Maximum number of scores to display */
  limit?: number;
}

/** Props for ScoreRow sub-component */
interface ScoreRowProps {
  entry: ScoreEntry;
  rank: number;
  isCurrentUser?: boolean;
  isNewEntry?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Category display names */
const CATEGORY_NAMES: Record<LeaderboardCategory, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  allTime: 'All-Time',
};

/** API category mapping */
const API_CATEGORY_MAP: Record<LeaderboardCategory, string> = {
  daily: 'score',
  weekly: 'score',
  allTime: 'score',
};

/** Local storage key for username */
const USERNAME_STORAGE_KEY = 'leaderboard-username';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple hash function for basic client-side verification
 * Server should do proper validation
 */
function hashScore(score: number, depth: number, seed: string): string {
  const data = `${score}:${depth}:${seed}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Format relative time for display
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

/**
 * Get username from localStorage with safety check
 */
function getSavedUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Save username to localStorage with safety check
 */
function saveUsername(username: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERNAME_STORAGE_KEY, username);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// ScoreRow Sub-component
// ============================================================================

/**
 * Individual score row with rank styling
 */
const ScoreRow: FunctionalComponent<ScoreRowProps> = ({
  entry,
  rank,
  isCurrentUser = false,
  isNewEntry = false,
}) => {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  
  return (
    <div 
      class={`score-row ${rankClass} ${isCurrentUser ? 'current-user' : ''} ${isNewEntry ? 'new-entry' : ''}`}
      role="row"
    >
      <span class="rank" role="cell">
        {rank <= 3 ? (
          <span class="rank-medal">
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          `#${rank}`
        )}
      </span>
      <span class="username" role="cell" title={entry.display_name ?? 'Anonymous'}>
        {entry.display_name ?? 'Anonymous'}
      </span>
      <span class="score" role="cell">
        {entry.score.toLocaleString()}
      </span>
      <span class="depth" role="cell">
        Depth {entry.depth}
      </span>
      <span class="date" role="cell" title={new Date(entry.created_at).toLocaleString()}>
        {formatRelativeTime(entry.created_at)}
      </span>
    </div>
  );
};

// ============================================================================
// Main Component Implementation
// ============================================================================

/**
 * Leaderboard - High scores display and submission island
 * 
 * @example Usage in Astro
 * ```astro
 * ---
 * import Leaderboard from '@islands/Leaderboard';
 * ---
 * <Leaderboard client:idle category="allTime" showSubmit={true} />
 * ```
 */
const Leaderboard: FunctionalComponent<LeaderboardProps> = ({
  category: initialCategory = 'daily',
  currentScore,
  showSubmit = false,
  onSubmit,
  limit = 10,
}) => {
  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────

  const [category, setCategory] = useState<LeaderboardCategory>(initialCategory);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(() => getSavedUsername());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [newEntryId, setNewEntryId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Fetch Scores
  // ─────────────────────────────────────────────────────────────

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiCategory = API_CATEGORY_MAP[category];
      const res = await fetch(`/api/scores?category=${apiCategory}&limit=${limit}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch scores: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Handle both array and object response formats
      const scoreList = Array.isArray(data) ? data : (data.scores ?? []);
      setScores(scoreList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch scores';
      setError(message);
      console.error('[Leaderboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [category, limit]);

  // Fetch scores on mount and category change
  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // ─────────────────────────────────────────────────────────────
  // Score Submission
  // ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter a username');
      return;
    }
    
    const state = gameState.value;
    if (!state) {
      setError('No game state available');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const submission: ScoreSubmission = {
        runData: {
          seed: state.seed,
          depth: state.depth,
          party: state.party,
          inventory: state.inventory,
        },
        displayName: trimmedUsername,
      };
      
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Submit failed: ${res.status}`);
      }
      
      const result = await res.json();
      
      // Save username for next time
      saveUsername(trimmedUsername);
      setSubmitted(true);
      
      // Mark new entry for animation
      if (result.newHighScore) {
        setNewEntryId(result.id ?? null);
      }
      
      // Callback
      onSubmit?.(result);
      
      // Refresh scores to show new entry
      await fetchScores();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit score';
      setError(message);
      console.error('[Leaderboard] Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [username, onSubmit, fetchScores]);

  // ─────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────

  // Calculate rank preview based on current score
  const rankPreview = useMemo(() => {
    if (currentScore === undefined || currentScore === null) return null;
    const rank = scores.filter(s => s.score > currentScore).length + 1;
    return rank;
  }, [scores, currentScore]);

  // Get derived states for conditional rendering
  const isGameOver = showGameOver.value;
  const isVictory = showVictory.value;

  // ─────────────────────────────────────────────────────────────
  // Input Handlers
  // ─────────────────────────────────────────────────────────────

  const handleUsernameInput = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
    setUsername(e.currentTarget.value);
    setError(null); // Clear error on input
  }, []);

  const handleCategoryChange = useCallback((newCategory: LeaderboardCategory) => {
    setCategory(newCategory);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div class="leaderboard">
      {/* Category Tabs */}
      <div class="category-tabs" role="tablist" aria-label="Leaderboard categories">
        {(Object.keys(CATEGORY_NAMES) as LeaderboardCategory[]).map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            aria-controls="score-list-panel"
            class={`tab ${category === cat ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {CATEGORY_NAMES[cat]}
          </button>
        ))}
      </div>

      {/* Current Score Display */}
      {currentScore !== undefined && currentScore !== null && (
        <div class="current-score">
          <span class="label">Your Score:</span>
          <span class="score-value">{currentScore.toLocaleString()}</span>
          {rankPreview !== null && (
            <span class="rank-preview">
              {rankPreview <= scores.length 
                ? `Would be Rank #${rankPreview}` 
                : `Rank #${rankPreview}`
              }
            </span>
          )}
        </div>
      )}

      {/* Submit Form */}
      {showSubmit && !submitted && (isGameOver || isVictory) && (
        <form class="submit-form" onSubmit={handleSubmit}>
          <div class="form-row">
            <input
              type="text"
              placeholder="Enter your name"
              value={username}
              onInput={handleUsernameInput}
              maxLength={20}
              required
              disabled={submitting}
              aria-label="Username for leaderboard"
              class="username-input"
            />
            <button 
              type="submit" 
              disabled={submitting || !username.trim()}
              class="submit-btn"
            >
              {submitting ? (
                <>
                  <span class="spinner" aria-hidden="true">⏳</span>
                  Submitting...
                </>
              ) : (
                <>
                  <span aria-hidden="true">🏆</span>
                  Submit Score
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Submit Success Message */}
      {submitted && (
        <div class="submit-success" role="alert">
          <span class="success-icon" aria-hidden="true">✅</span>
          Score submitted successfully!
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div class="loading" role="status" aria-live="polite">
          <span class="spinner" aria-hidden="true">⏳</span>
          Loading scores...
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div class="error" role="alert">
          <span class="error-icon" aria-hidden="true">⚠️</span>
          <span class="error-message">{error}</span>
          <button class="retry-btn" onClick={fetchScores} type="button">
            Retry
          </button>
        </div>
      )}

      {/* Score List */}
      {!loading && !error && (
        <div 
          id="score-list-panel"
          class="score-list" 
          role="table" 
          aria-label="High scores"
        >
          {/* Header Row */}
          <div class="score-row header" role="row">
            <span class="rank" role="columnheader">Rank</span>
            <span class="username" role="columnheader">Player</span>
            <span class="score" role="columnheader">Score</span>
            <span class="depth" role="columnheader">Depth</span>
            <span class="date" role="columnheader">Date</span>
          </div>

          {/* Score Rows */}
          {scores.length === 0 ? (
            <div class="empty" role="row">
              <span class="empty-icon" aria-hidden="true">🎮</span>
              <span class="empty-text">No scores yet. Be the first!</span>
            </div>
          ) : (
            scores.map((entry, index) => (
              <ScoreRow
                key={entry.id ?? `score-${index}`}
                entry={entry}
                rank={index + 1}
                isCurrentUser={entry.display_name === username.trim()}
                isNewEntry={entry.id === newEntryId}
              />
            ))
          )}
        </div>
      )}

      {/* Scoped Styles */}
      <style>{`
        .leaderboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 0.75rem);
          padding: var(--space-4, 1rem);
          background: var(--surface-1, #1a1a2e);
          border-radius: var(--radius-lg, 0.75rem);
          max-width: 600px;
          width: 100%;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Category Tabs */
        /* ─────────────────────────────────────────────────────────── */

        .category-tabs {
          display: flex;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-1, 0.25rem);
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-md, 0.5rem);
        }

        .tab {
          flex: 1;
          padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm, 0.25rem);
          color: var(--text-muted, #9ca3af);
          font-size: var(--text-sm, 0.875rem);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab:hover {
          color: var(--text-primary, #f9fafb);
          background: var(--surface-3, #2d325c);
        }

        .tab.active {
          color: var(--text-primary, #f9fafb);
          background: var(--accent, #6366f1);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Current Score Display */
        /* ─────────────────────────────────────────────────────────── */

        .current-score {
          display: flex;
          align-items: center;
          gap: var(--space-3, 0.75rem);
          padding: var(--space-3, 0.75rem);
          background: linear-gradient(135deg, var(--surface-2, #25294a), var(--surface-3, #2d325c));
          border: 2px solid var(--accent, #6366f1);
          border-radius: var(--radius-md, 0.5rem);
        }

        .current-score .label {
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-muted, #9ca3af);
        }

        .current-score .score-value {
          font-size: var(--text-xl, 1.25rem);
          font-weight: 700;
          color: var(--gold, #fbbf24);
        }

        .current-score .rank-preview {
          margin-left: auto;
          font-size: var(--text-sm, 0.875rem);
          color: var(--accent, #6366f1);
          background: rgba(99, 102, 241, 0.15);
          padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
          border-radius: var(--radius-sm, 0.25rem);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Submit Form */
        /* ─────────────────────────────────────────────────────────── */

        .submit-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-2, 0.5rem);
        }

        .form-row {
          display: flex;
          gap: var(--space-2, 0.5rem);
        }

        .username-input {
          flex: 1;
          padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
          background: var(--surface-2, #25294a);
          border: 2px solid var(--border, #374151);
          border-radius: var(--radius-md, 0.5rem);
          color: var(--text-primary, #f9fafb);
          font-size: var(--text-sm, 0.875rem);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .username-input:focus {
          border-color: var(--accent, #6366f1);
        }

        .username-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .username-input::placeholder {
          color: var(--text-muted, #9ca3af);
        }

        .submit-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
          background: var(--accent, #6366f1);
          border: none;
          border-radius: var(--radius-md, 0.5rem);
          color: white;
          font-size: var(--text-sm, 0.875rem);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .submit-btn:hover:not(:disabled) {
          background: var(--accent-hover, #4f46e5);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Submit Success */
        /* ─────────────────────────────────────────────────────────── */

        .submit-success {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-3, 0.75rem);
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid var(--health, #22c55e);
          border-radius: var(--radius-md, 0.5rem);
          color: var(--health, #22c55e);
          font-weight: 500;
        }

        .success-icon {
          font-size: 1.25rem;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Loading State */
        /* ─────────────────────────────────────────────────────────── */

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-6, 1.5rem);
          color: var(--text-muted, #9ca3af);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Error State */
        /* ─────────────────────────────────────────────────────────── */

        .error {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-3, 0.75rem);
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid var(--damage, #ef4444);
          border-radius: var(--radius-md, 0.5rem);
          color: var(--damage, #ef4444);
        }

        .error-icon {
          font-size: 1.25rem;
        }

        .error-message {
          flex: 1;
          font-size: var(--text-sm, 0.875rem);
        }

        .retry-btn {
          padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
          background: var(--damage, #ef4444);
          border: none;
          border-radius: var(--radius-sm, 0.25rem);
          color: white;
          font-size: var(--text-sm, 0.875rem);
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .retry-btn:hover {
          background: #dc2626;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Score List */
        /* ─────────────────────────────────────────────────────────── */

        .score-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-1, 0.25rem);
          max-height: 400px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--border, #374151) transparent;
        }

        .score-list::-webkit-scrollbar {
          width: 6px;
        }

        .score-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .score-list::-webkit-scrollbar-thumb {
          background: var(--border, #374151);
          border-radius: 3px;
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Score Row */
        /* ─────────────────────────────────────────────────────────── */

        .score-row {
          display: grid;
          grid-template-columns: 60px 1fr 100px 80px 80px;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
          background: var(--surface-2, #25294a);
          border-radius: var(--radius-sm, 0.25rem);
          transition: all 0.15s ease;
        }

        .score-row:not(.header):hover {
          background: var(--surface-3, #2d325c);
        }

        .score-row.header {
          background: transparent;
          font-size: var(--text-xs, 0.75rem);
          font-weight: 600;
          color: var(--text-muted, #9ca3af);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .score-row .rank {
          font-weight: 600;
          color: var(--text-secondary, #d1d5db);
        }

        .score-row .rank-medal {
          font-size: 1.25rem;
        }

        .score-row .username {
          font-weight: 500;
          color: var(--text-primary, #f9fafb);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .score-row .score {
          font-weight: 700;
          color: var(--gold, #fbbf24);
          text-align: right;
        }

        .score-row .depth {
          font-size: var(--text-sm, 0.875rem);
          color: var(--text-muted, #9ca3af);
          text-align: center;
        }

        .score-row .date {
          font-size: var(--text-xs, 0.75rem);
          color: var(--text-muted, #9ca3af);
          text-align: right;
        }

        /* Top 3 Styling */
        .score-row.gold {
          background: linear-gradient(90deg, rgba(251, 191, 36, 0.15), transparent);
          border-left: 3px solid var(--gold, #fbbf24);
        }

        .score-row.gold .username {
          color: var(--gold, #fbbf24);
        }

        .score-row.silver {
          background: linear-gradient(90deg, rgba(192, 192, 192, 0.15), transparent);
          border-left: 3px solid #c0c0c0;
        }

        .score-row.silver .username {
          color: #c0c0c0;
        }

        .score-row.bronze {
          background: linear-gradient(90deg, rgba(205, 127, 50, 0.15), transparent);
          border-left: 3px solid #cd7f32;
        }

        .score-row.bronze .username {
          color: #cd7f32;
        }

        /* Current User Highlight */
        .score-row.current-user {
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.2), transparent);
          border-left: 3px solid var(--accent, #6366f1);
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
        }

        .score-row.current-user .username {
          color: var(--accent, #6366f1);
        }

        /* New Entry Animation */
        .score-row.new-entry {
          animation: slideIn 0.5s ease-out, glow 1s ease-in-out 0.5s 2;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
          }
          50% {
            box-shadow: 0 0 16px rgba(99, 102, 241, 0.6);
          }
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Empty State */
        /* ─────────────────────────────────────────────────────────── */

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-8, 2rem);
          color: var(--text-muted, #9ca3af);
        }

        .empty-icon {
          font-size: 2.5rem;
          opacity: 0.5;
        }

        .empty-text {
          font-size: var(--text-sm, 0.875rem);
        }

        /* ─────────────────────────────────────────────────────────── */
        /* Responsive */
        /* ─────────────────────────────────────────────────────────── */

        @media (max-width: 600px) {
          .leaderboard {
            padding: var(--space-3, 0.75rem);
          }

          .score-row {
            grid-template-columns: 50px 1fr 80px;
          }

          .score-row .depth,
          .score-row .date {
            display: none;
          }

          .score-row.header .depth,
          .score-row.header .date {
            display: none;
          }

          .current-score {
            flex-wrap: wrap;
          }

          .current-score .rank-preview {
            width: 100%;
            margin-left: 0;
            margin-top: var(--space-2, 0.5rem);
            text-align: center;
          }

          .form-row {
            flex-direction: column;
          }

          .submit-btn {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

// Export as default for Astro island usage
export default Leaderboard;

// Also export named for flexibility
export { Leaderboard, ScoreRow };
