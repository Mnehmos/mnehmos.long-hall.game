/**
 * Combat-log helpers.
 *
 * The log is part of RunState and gets persisted (and uploaded), so it has to
 * be bounded. The UI only shows the last 20 entries; we keep 100 for
 * scroll-back.
 */
export const MAX_HISTORY_LENGTH = 100;

export function cappedHistory(history: string[]): string[] {
    return history.length > MAX_HISTORY_LENGTH
        ? history.slice(-MAX_HISTORY_LENGTH)
        : history;
}
