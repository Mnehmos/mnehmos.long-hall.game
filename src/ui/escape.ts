/**
 * HTML escaping for the string-template renderer.
 *
 * The whole UI is built by concatenating strings and assigning them to
 * `innerHTML`, and several interpolated values are attacker-controlled:
 *
 *  - `item.customName` comes straight from a `prompt()` and is uploaded with
 *    the run, then served back to EVERY player on the weapons leaderboard.
 *    That made it a stored XSS vector, not just a self-XSS one.
 *  - `display_name` / weapon names arrive from the API.
 *  - Combat-log lines embed item and character names.
 *  - The Clerk profile name is user-set.
 *
 * Escape at the point of interpolation. `esc` is safe in both text and
 * quoted-attribute contexts because it covers quotes as well as angle
 * brackets.
 */
const ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
};

/** Escape a value for interpolation into HTML text or a quoted attribute. */
export function esc(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`]/g, ch => ENTITIES[ch]);
}

/**
 * Escape for a `title="..."` tooltip, preserving newlines.
 * Tooltip text is later re-rendered as HTML by the mobile tooltip handler, so
 * it has to survive one extra round trip through the DOM.
 */
export function escAttr(value: unknown): string {
    return esc(value);
}

/**
 * Convert already-escaped tooltip text into HTML for the mobile tooltip modal.
 * Only newlines become markup; everything else stays inert.
 */
export function tooltipToHtml(raw: string): string {
    return esc(raw).replace(/\n/g, '<br>');
}
