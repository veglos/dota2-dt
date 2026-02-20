import mysql from "mysql2/promise";

const LOG_TABLE = "dota2_dt_log_consultas";

let pool;
let warnedAboutConfig = false;

function resolveDbConfig() {
  const host = process.env.MYSQL_HOST;
  const portRaw = process.env.MYSQL_PORT;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    return null;
  }

  const parsedPort = Number.parseInt(portRaw ?? "", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 3306;

  return { host, port, user, password: password || "", database };
}

function getPool() {
  const config = resolveDbConfig();
  if (!config) {
    if (!warnedAboutConfig) {
      warnedAboutConfig = true;
      console.warn("Request log MySQL deshabilitado: faltan variables MYSQL_*.");
    }
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0
    });
  }

  return pool;
}

function normalizeMatchId(matchId) {
  const parsed = Number.parseInt(String(matchId ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export async function appendRequestLog({
  ipOrigen,
  forwardedFor,
  matchId,
  method,
  path,
  queryParams,
  userAgent,
  referer,
  statusCode,
  latencyMs,
  requestId
}) {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  const query = `
    INSERT INTO \`${LOG_TABLE}\`
    (
      ip_origen,
      x_forwarded_for,
      match_id,
      method,
      path,
      query_params,
      user_agent,
      referer,
      status_code,
      latency_ms,
      request_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await activePool.execute(query, [
    ipOrigen || "anonymous",
    forwardedFor || null,
    normalizeMatchId(matchId),
    method || "GET",
    path || "",
    queryParams ? JSON.stringify(queryParams) : null,
    userAgent || null,
    referer || null,
    Number(statusCode) || 0,
    Number.isFinite(latencyMs) ? latencyMs : null,
    requestId || null
  ]);
}
