const OPENDOTA_BASE_URL = "https://api.opendota.com/api";
const ITEMS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedItemNamesById = null;
let cachedItemNamesAt = 0;

function toStatusMessage(status) {
  if (status === 404) return "Match no encontrado. Revisa el match_id.";
  if (status === 429) return "Rate limit alcanzado en OpenDota. Intenta luego.";
  if (status >= 500) return "OpenDota no disponible temporalmente.";
  return "No fue posible obtener la partida desde OpenDota.";
}

export function isValidMatchId(value) {
  return /^[0-9]{8,20}$/.test(String(value).trim());
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

export function formatUnixDate(unixSeconds) {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "N/A";
  return new Date(unixSeconds * 1000).toISOString();
}

export function getLaneRoleLabel(player = {}) {
  if (player.lane_role === 1) return "Safe lane";
  if (player.lane_role === 2) return "Mid lane";
  if (player.lane_role === 3) return "Off lane";
  if (player.lane_role === 4) return "Jungle";
  return "Unknown";
}

export function safeMarkdownText(value) {
  if (value === null || value === undefined) return "N/A";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export async function fetchMatchById(matchId) {
  const url = `${OPENDOTA_BASE_URL}/matches/${matchId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const err = new Error(toStatusMessage(response.status));
    err.status = response.status;
    throw err;
  }

  return response.json();
}

function toReadableItemName(rawKey = "") {
  return String(rawKey)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function fetchItemNameByIdMap() {
  const now = Date.now();
  if (cachedItemNamesById && now - cachedItemNamesAt < ITEMS_CACHE_TTL_MS) {
    return cachedItemNamesById;
  }

  try {
    const response = await fetch(`${OPENDOTA_BASE_URL}/constants/items`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) return cachedItemNamesById || {};

    const constants = await response.json();
    const map = {};

    for (const [key, value] of Object.entries(constants || {})) {
      const id = Number(value?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const displayName = value?.dname || toReadableItemName(key);
      map[id] = displayName;
    }

    cachedItemNamesById = map;
    cachedItemNamesAt = now;
    return cachedItemNamesById;
  } catch (error) {
    console.warn("No se pudo cargar el mapeo de items de OpenDota.", error);
    return cachedItemNamesById || {};
  }
}

export function summarizeAdvantage(series = []) {
  if (!Array.isArray(series) || series.length === 0) {
    return { maxLead: 0, maxDeficit: 0, swing: 0 };
  }

  let maxLead = Number.NEGATIVE_INFINITY;
  let maxDeficit = Number.POSITIVE_INFINITY;

  for (const item of series) {
    const value = Number(item);
    if (!Number.isFinite(value)) continue;
    if (value > maxLead) maxLead = value;
    if (value < maxDeficit) maxDeficit = value;
  }

  if (maxLead === Number.NEGATIVE_INFINITY) maxLead = 0;
  if (maxDeficit === Number.POSITIVE_INFINITY) maxDeficit = 0;

  return {
    maxLead,
    maxDeficit,
    swing: maxLead - maxDeficit
  };
}
