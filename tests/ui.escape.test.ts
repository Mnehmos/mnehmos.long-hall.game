import { describe, it, expect } from 'vitest';
import { esc, tooltipToHtml } from '../src/ui/escape';
import { renderLeaderboard } from '../src/ui/leaderboard';
import type { ScoreEntry, WeaponEntry } from '../src/api/client';

const XSS = `<img src=x onerror=alert(1)>`;
const ATTR_BREAK = `" onmouseover="alert(1)`;

describe('esc', () => {
    it('neutralises tag characters', () => {
        expect(esc(XSS)).not.toContain('<');
        expect(esc(XSS)).not.toContain('>');
        expect(esc(XSS)).toContain('&lt;img');
    });

    it('neutralises quote characters so attributes cannot be broken out of', () => {
        const out = esc(ATTR_BREAK);
        expect(out).not.toContain('"');
        expect(out).not.toContain("'");
        expect(out).not.toContain('`');
    });

    it('escapes ampersands so entities cannot be smuggled', () => {
        expect(esc('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
    });

    it('handles null and undefined without printing them', () => {
        expect(esc(null)).toBe('');
        expect(esc(undefined)).toBe('');
    });
});

describe('tooltipToHtml', () => {
    it('only allows newlines through as markup', () => {
        const out = tooltipToHtml(`line one\n${XSS}`);
        expect(out).toContain('<br>');
        expect(out).not.toContain('<img');
        expect(out).toContain('&lt;img');
    });
});

describe('leaderboard rendering', () => {
    const score = (name: string): ScoreEntry => ({
        user_id: 'u1', display_name: name, score: 10, depth: 1, gold: 0,
        total_kills: 0, highest_hit: 0, critical_hits: 0, max_level: 1,
        created_at: '2026-01-01',
    });

    const weapon = (name: string, owner: string): WeaponEntry => ({
        name, rarity: 'common', kills: 1, damageDealt: 1,
        highestHit: 1, criticalHits: 0, owner,
    });

    it('escapes player-supplied weapon names', () => {
        // This is the stored-XSS path: one player renames an item, the run is
        // uploaded, and every other player renders the name on this board.
        const html = renderLeaderboard([], 'weapons', [weapon(XSS, 'Bob')]);
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img');
    });

    it('escapes weapon rarity, which lands inside a class attribute', () => {
        const html = renderLeaderboard([], 'weapons', [
            { ...weapon('Sword', 'Bob'), rarity: `common" onload="alert(1)` },
        ]);
        expect(html).not.toContain('onload="alert(1)"');
    });

    it('escapes display names on the score board', () => {
        const html = renderLeaderboard([score(XSS)], 'score', []);
        expect(html).not.toContain('<img src=x');
    });

    it('escapes weapon owner names', () => {
        const html = renderLeaderboard([], 'weapons', [weapon('Sword', XSS)]);
        expect(html).not.toContain('<img src=x');
    });
});
