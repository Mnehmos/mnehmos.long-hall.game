import type { RunState } from '../engine/types';

// Use environment variable or default to production URL
const API_URL = import.meta.env.VITE_API_URL || 'https://the-long-hall-production.up.railway.app';
const API_BASE = `${API_URL}/api`; // All routes are under /api

export interface ScoreEntry {
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

export interface WeaponEntry {
  name: string;
  rarity: string;
  kills: number;
  damageDealt: number;
  highestHit: number;
  criticalHits: number;
  owner: string;
}

export type LeaderboardCategory = 'score' | 'depth' | 'gold' | 'kills' | 'hit' | 'crits' | 'level';

/** Cloud saves keep less scroll-back than the local save; the client caps at 100. */
const CLOUD_HISTORY_LIMIT = 50;

async function request(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export const apiClient = {
  async saveGame(token: string, state: RunState): Promise<{ success: boolean; hash?: string }> {
    try {
      const payload = { ...state, history: state.history.slice(-CLOUD_HISTORY_LIMIT) };

      // The server reads `data`. This used to send `{ state: ... }`, so every
      // cloud save returned 400 and the error was swallowed by the catch below
      // -- cloud saving had never worked.
      const response = await request('/saves', {
        method: 'POST',
        body: JSON.stringify({ data: payload }),
      }, token);

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Save error:', error);
      return { success: false };
    }
  },

  async loadGame(token: string): Promise<RunState | null> {
    try {
      const response = await request('/saves', {}, token);

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Load failed: ${response.status}`);

      // The server responds with { data, save_hash, updated_at }. This used to
      // read `.state`, which is always undefined -- so cloud loads silently
      // returned null even when a save existed.
      const body = await response.json();
      return (body?.data as RunState) ?? null;
    } catch (error) {
      console.error('Load error:', error);
      return null;
    }
  },

  async submitScore(token: string, state: RunState, displayName?: string): Promise<boolean> {
    try {
      const response = await request('/scores', {
        method: 'POST',
        body: JSON.stringify({ runData: state, displayName }),
      }, token);

      return response.ok;
    } catch (error) {
      console.error('Score submission error:', error);
      return false;
    }
  },

  async getHighScores(limit = 10, category: LeaderboardCategory = 'score'): Promise<ScoreEntry[]> {
    try {
        const response = await request(
          `/scores?limit=${encodeURIComponent(limit)}&category=${encodeURIComponent(category)}`
        );
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Get scores error:', error);
        return [];
    }
  },

  async getTopWeapons(limit = 10): Promise<WeaponEntry[]> {
    try {
        const response = await request(`/scores/weapons?limit=${encodeURIComponent(limit)}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Get weapons error:', error);
        return [];
    }
  }
};
