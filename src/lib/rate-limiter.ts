// Simple in-memory rate limiter to prevent excessive API calls
// This helps protect against runaway auto-heal loops

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per key
const COOLDOWN_MS = 5000; // 5 second cooldown between requests

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  reason?: string;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimits.get(key);
  
  // No entry - first request
  if (!entry) {
    rateLimits.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetIn: WINDOW_MS,
    };
  }
  
  // Check if window has reset
  if (now - entry.firstRequest > WINDOW_MS) {
    rateLimits.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetIn: WINDOW_MS,
    };
  }
  
  // Check cooldown between requests
  const timeSinceLastRequest = now - entry.lastRequest;
  if (timeSinceLastRequest < COOLDOWN_MS) {
    return {
      allowed: false,
      remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
      resetIn: COOLDOWN_MS - timeSinceLastRequest,
      reason: `Cooldown: wait ${Math.ceil((COOLDOWN_MS - timeSinceLastRequest) / 1000)}s`,
    };
  }
  
  // Check if over rate limit
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetIn = WINDOW_MS - (now - entry.firstRequest);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      reason: `Rate limit exceeded: ${entry.count}/${MAX_REQUESTS_PER_WINDOW} requests. Reset in ${Math.ceil(resetIn / 1000)}s`,
    };
  }
  
  // Allowed - update entry
  entry.count++;
  entry.lastRequest = now;
  rateLimits.set(key, entry);
  
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetIn: WINDOW_MS - (now - entry.firstRequest),
  };
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimits.entries());
  for (const [key, entry] of entries) {
    if (now - entry.firstRequest > WINDOW_MS * 2) {
      rateLimits.delete(key);
    }
  }
}, WINDOW_MS);

// Export for testing
export function resetRateLimits(): void {
  rateLimits.clear();
}
