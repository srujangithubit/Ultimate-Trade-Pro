/**
 * Token-bucket rate limiter for third-party API calls.
 * Configurable max tokens, refill rate, and retry-after logic.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number = 60,
    private readonly refillRate: number = 60, // tokens per second
    private readonly refillInterval: number = 1000, // ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(
      (elapsed / this.refillInterval) * this.refillRate,
    );

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Attempt to consume a token. Returns true if allowed, false if rate-limited.
   */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   */
  async waitForToken(): Promise<void> {
    while (!this.tryConsume()) {
      const waitTime = Math.ceil(this.refillInterval / this.refillRate);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Returns the number of milliseconds to wait before retrying.
   */
  getRetryAfterMs(): number {
    this.refill();
    if (this.tokens > 0) return 0;
    return Math.ceil(this.refillInterval / this.refillRate);
  }

  /**
   * Get current available tokens.
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Reset the rate limiter to full capacity.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

/**
 * Per-key rate limiter map — useful for per-user or per-endpoint limiting.
 */
export class RateLimiterMap {
  private readonly limiters = new Map<string, RateLimiter>();

  constructor(
    private readonly maxTokens: number = 60,
    private readonly refillRate: number = 60,
    private readonly refillInterval: number = 1000,
  ) {}

  getLimiter(key: string): RateLimiter {
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(
        this.maxTokens,
        this.refillRate,
        this.refillInterval,
      );
      this.limiters.set(key, limiter);
    }
    return limiter;
  }

  async waitForToken(key: string): Promise<void> {
    return this.getLimiter(key).waitForToken();
  }

  tryConsume(key: string): boolean {
    return this.getLimiter(key).tryConsume();
  }
}
