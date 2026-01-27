// Token usage tracking with daily limit warnings
// Tracks approximate token usage and warns when approaching daily free tier

interface UsageEntry {
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

// In-memory storage (resets on server restart, but that's fine for daily tracking)
const usageByClient = new Map<string, UsageEntry>();

// OpenAI free tier: 250K tokens/day for most models
const DAILY_FREE_LIMIT = 250_000;
const WARNING_THRESHOLD = 0.8; // Warn at 80% usage

export interface TokenUsageResult {
  allowed: boolean;
  currentUsage: number;
  dailyLimit: number;
  percentUsed: number;
  warning?: string;
  overLimit: boolean;
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function trackTokenUsage(
  clientId: string,
  inputTokens: number,
  outputTokens: number
): TokenUsageResult {
  const today = getTodayKey();
  const key = `${clientId}:${today}`;
  
  let entry = usageByClient.get(key);
  
  // Reset if it's a new day
  if (!entry || entry.date !== today) {
    entry = {
      date: today,
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
    };
  }
  
  // Update usage
  entry.inputTokens += inputTokens;
  entry.outputTokens += outputTokens;
  entry.requests += 1;
  usageByClient.set(key, entry);
  
  const totalTokens = entry.inputTokens + entry.outputTokens;
  const percentUsed = (totalTokens / DAILY_FREE_LIMIT) * 100;
  const overLimit = totalTokens > DAILY_FREE_LIMIT;
  
  let warning: string | undefined;
  
  if (overLimit) {
    const overBy = totalTokens - DAILY_FREE_LIMIT;
    // Approximate cost: ~$0.002 per 1K tokens for gpt-4o-mini, ~$0.01 for gpt-4o
    const estimatedCost = (overBy / 1000) * 0.005; // Average estimate
    warning = `⚠️ OVER DAILY LIMIT: ${totalTokens.toLocaleString()} / ${DAILY_FREE_LIMIT.toLocaleString()} tokens (${percentUsed.toFixed(1)}%). Estimated extra cost: $${estimatedCost.toFixed(2)}`;
  } else if (percentUsed >= WARNING_THRESHOLD * 100) {
    warning = `⚠️ Approaching limit: ${totalTokens.toLocaleString()} / ${DAILY_FREE_LIMIT.toLocaleString()} tokens (${percentUsed.toFixed(1)}%)`;
  }
  
  return {
    allowed: true, // We always allow, just warn
    currentUsage: totalTokens,
    dailyLimit: DAILY_FREE_LIMIT,
    percentUsed,
    warning,
    overLimit,
  };
}

// Estimate tokens before making a request (rough approximation)
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// Get current usage without adding to it
export function getCurrentUsage(clientId: string): TokenUsageResult {
  const today = getTodayKey();
  const key = `${clientId}:${today}`;
  const entry = usageByClient.get(key);
  
  if (!entry || entry.date !== today) {
    return {
      allowed: true,
      currentUsage: 0,
      dailyLimit: DAILY_FREE_LIMIT,
      percentUsed: 0,
      overLimit: false,
    };
  }
  
  const totalTokens = entry.inputTokens + entry.outputTokens;
  const percentUsed = (totalTokens / DAILY_FREE_LIMIT) * 100;
  const overLimit = totalTokens > DAILY_FREE_LIMIT;
  
  let warning: string | undefined;
  if (overLimit) {
    const overBy = totalTokens - DAILY_FREE_LIMIT;
    const estimatedCost = (overBy / 1000) * 0.005;
    warning = `⚠️ OVER DAILY LIMIT: ${totalTokens.toLocaleString()} tokens. Estimated extra cost: $${estimatedCost.toFixed(2)}`;
  } else if (percentUsed >= WARNING_THRESHOLD * 100) {
    warning = `⚠️ Approaching limit: ${percentUsed.toFixed(1)}% used`;
  }
  
  return {
    allowed: true,
    currentUsage: totalTokens,
    dailyLimit: DAILY_FREE_LIMIT,
    percentUsed,
    warning,
    overLimit,
  };
}

// Clean up old entries (call periodically)
export function cleanupOldUsage(): void {
  const today = getTodayKey();
  const entries = Array.from(usageByClient.entries());
  for (const [key, entry] of entries) {
    if (entry.date !== today) {
      usageByClient.delete(key);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldUsage, 60 * 60 * 1000);
