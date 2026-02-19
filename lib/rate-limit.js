const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;

const requestStore = new Map();

function cleanupExpired(now) {
  for (const [key, value] of requestStore.entries()) {
    if (now - value.windowStart >= ONE_HOUR_MS) {
      requestStore.delete(key);
    }
  }
}

export function consumeRateLimit(identifier) {
  const key = identifier || "anonymous";
  const now = Date.now();
  cleanupExpired(now);

  const current = requestStore.get(key);
  if (!current || now - current.windowStart >= ONE_HOUR_MS) {
    requestStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_HOUR - 1,
      retryAfterSeconds: 0
    };
  }

  if (current.count >= MAX_REQUESTS_PER_HOUR) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((ONE_HOUR_MS - (now - current.windowStart)) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds
    };
  }

  current.count += 1;
  requestStore.set(key, current);
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_HOUR - current.count,
    retryAfterSeconds: 0
  };
}

export function resetRateLimitStore() {
  requestStore.clear();
}
