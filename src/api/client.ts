import type { RunState } from '../engine/types';

// Use environment variable or default to production URL
const API_URL = import.meta.env.VITE_API_URL || 'https://the-long-hall-production.up.railway.app';

export interface ScoreEntry {
  username: string;
  score: number;
  run_date: string;
}

export const apiClient = {
  async saveGame(token: string, state: RunState): Promise<{ success: boolean; hash?: string }> {
    try {
      const response = await fetch(`${API_URL}/saves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state })
      });
      
      if (!response.ok) throw new Error('Failed to save game');
      return await response.json();
    } catch (error) {
      console.error('Save error:', error);
      return { success: false };
    }
  },

  async loadGame(token: string): Promise<RunState | null> {
    try {
      const response = await fetch(`${API_URL}/saves`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to load game');
      
      const data = await response.json();
      return data.state;
    } catch (error) {
      console.error('Load error:', error);
      return null;
    }
  },

  async submitScore(token: string, state: RunState): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ runData: state })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Score submission error:', error);
      return false;
    }
  },

  async getHighScores(limit = 10): Promise<ScoreEntry[]> {
    try {
        const response = await fetch(`${API_URL}/scores?limit=${limit}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Get scores error:', error);
        return [];
    }
  }
};
