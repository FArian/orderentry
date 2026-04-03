/**
 * NonceCache — in-memory replay-attack prevention for deep-link tokens.
 *
 * Each token carries a unique nonce (JWT jti or HMAC timestamp+random).
 * Once a nonce is seen it is stored until its TTL expires.
 * A second request with the same nonce is rejected as a replay attack.
 *
 * Storage: process-local Map — sufficient for a single-instance deployment.
 * For multi-replica deployments replace with a shared Redis SETNX.
 */

interface NonceCacheEntry {
  readonly expiresAt: number; // Unix milliseconds
}

export class NonceCache {
  private readonly store = new Map<string, NonceCacheEntry>();
  /** Sweep expired entries every N ms to avoid unbounded growth. */
  private readonly sweepIntervalMs: number;

  constructor(sweepIntervalMs = 60_000) {
    this.sweepIntervalMs = sweepIntervalMs;
    // Lazy timer — only start when first nonce is registered.
  }

  /**
   * Attempt to consume a nonce.
   * Returns true if the nonce is fresh (first use); false if already seen.
   * @param nonce        The unique token identifier (JWT jti or HMAC nonce).
   * @param ttlSeconds   How long to remember this nonce.
   */
  consume(nonce: string, ttlSeconds: number): boolean {
    this.sweep();
    if (this.store.has(nonce)) return false;
    this.store.set(nonce, { expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  /** Remove all expired entries. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  /** Visible for testing. */
  get size(): number {
    this.sweep();
    return this.store.size;
  }
}

/** Module-level singleton — shared across all deep-link requests. */
export const nonceCache = new NonceCache();
