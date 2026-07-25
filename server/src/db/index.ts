import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail loudly at boot rather than on the first query.
  throw new Error('DATABASE_URL is not set');
}

/**
 * Decide whether to negotiate TLS.
 *
 * This used to key off `NODE_ENV === 'production'`, which is the wrong signal:
 * Railway's private-network host (`*.railway.internal`) does not terminate TLS,
 * so a production build pointed at the internal URL would fail to connect,
 * while a local run against a TLS-only managed database would fail the other
 * way. Decide from the connection target instead.
 *
 * PGSSLMODE overrides the heuristic when it needs to be forced either way.
 */
function shouldUseSsl(url: string): boolean {
  const mode = process.env.PGSSLMODE?.toLowerCase();
  if (mode === 'disable') return false;
  if (mode && mode !== 'prefer') return true;

  // Explicit in the URL wins.
  if (/[?&]sslmode=disable/i.test(url)) return false;
  if (/[?&]ssl(mode)?=/i.test(url)) return true;

  try {
    const host = new URL(url).hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const isPrivate = host.endsWith('.railway.internal') || host.endsWith('.internal');
    return !isLocal && !isPrivate;
  } catch {
    return false;
  }
}

const useSsl = shouldUseSsl(connectionString);

export const pool = new Pool({
  connectionString,
  // Managed Postgres providers front the database with a certificate that
  // doesn't chain to a public root, so verification is relaxed rather than
  // disabled entirely.
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

console.log(`Postgres pool configured (ssl=${useSsl})`);

// A pooled client dying in the background shouldn't take the process down --
// `pg` replaces the client and the next query reconnects. The old handler
// called process.exit(-1), turning a transient blip into a hard restart.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err);
});
