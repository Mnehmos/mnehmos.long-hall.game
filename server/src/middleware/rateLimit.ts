import type { Request, Response, NextFunction } from 'express';

/**
 * Minimal fixed-window rate limiter.
 *
 * There was no throttling of any kind: score submission, save writes and the
 * unauthenticated leaderboard reads were all unbounded. Kept dependency-free
 * and in-process deliberately -- it's a single Railway dyno. If this ever runs
 * on more than one instance, move the counters to Redis or Postgres, because
 * per-process windows stop being meaningful.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const { windowMs, max, keyPrefix = '' } = options;
  const buckets = new Map<string, Bucket>();

  // Drop expired buckets so the map can't grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    // Prefer the authenticated user; fall back to IP for public routes.
    const identity = req.auth?.userId || req.ip || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests', retryAfter });
      return;
    }

    next();
  };
}
