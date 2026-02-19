import Redis from "ioredis";

const REQUEST_LOG_KEY = "dota2-dt:request-logs";
const DEFAULT_MAX_ENTRIES = 50000;

let redisClient;

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true
    });
  }

  return redisClient;
}

function resolveMaxEntries() {
  const raw = process.env.REQUEST_LOG_MAX_ENTRIES;
  if (!raw) {
    return DEFAULT_MAX_ENTRIES;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_ENTRIES;
  }

  return parsed;
}

export async function appendRequestLog({ date, matchId, clientIp, httpStatus }) {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  const payload = JSON.stringify({
    date: date || new Date().toISOString(),
    matchId: String(matchId ?? ""),
    clientIp: clientIp || "anonymous",
    httpStatus: Number(httpStatus) || 0
  });

  const maxEntries = resolveMaxEntries();

  await client
    .multi()
    .lpush(REQUEST_LOG_KEY, payload)
    .ltrim(REQUEST_LOG_KEY, 0, maxEntries - 1)
    .exec();
}
