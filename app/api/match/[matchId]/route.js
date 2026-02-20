import { buildMatchMarkdown } from "../../../../lib/markdown.js";
import { fetchItemNameByIdMap, fetchMatchById, isValidMatchId } from "../../../../lib/opendota.js";
import { requestMatchAnalysisFromOpenAI } from "../../../../lib/openai.js";
import { consumeRateLimit } from "../../../../lib/rate-limit.js";
import { appendRequestLog } from "../../../../lib/request-log.js";

export const runtime = "nodejs";

async function jsonWithRequestLog(payload, context) {
  const {
    status,
    headers,
    matchId,
    clientIp,
    forwardedFor,
    method,
    path,
    queryParams,
    userAgent,
    referer,
    requestId,
    startedAt
  } = context;

  try {
    await appendRequestLog({
      ipOrigen: clientIp,
      forwardedFor,
      matchId,
      method,
      path,
      queryParams,
      userAgent,
      referer,
      statusCode: status,
      latencyMs: Date.now() - startedAt,
      requestId
    });
  } catch (error) {
    console.error("No se pudo guardar request log en MySQL.", error);
  }

  return Response.json(payload, { status, headers });
}

export async function GET(request, { params }) {
  const startedAt = Date.now();
  const { matchId } = await params;
  const parsedUrl = new URL(request.url);
  const { searchParams } = parsedUrl;
  const selectedHeroId = searchParams.get("heroId");
  const selectedHeroName = searchParams.get("heroName");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "anonymous";
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const requestId = request.headers.get("x-request-id");
  const queryParams = Object.fromEntries(searchParams.entries());
  const logContext = {
    matchId,
    clientIp,
    forwardedFor,
    method: request.method,
    path: parsedUrl.pathname,
    queryParams,
    userAgent,
    referer,
    requestId,
    startedAt
  };

  if (!isValidMatchId(matchId)) {
    return jsonWithRequestLog(
      { error: "match_id invalido. Debe ser numerico (8 a 20 digitos)." },
      { ...logContext, status: 400 }
    );
  }

  const rate = consumeRateLimit(clientIp);
  if (!rate.allowed) {
    return jsonWithRequestLog(
      { error: "Rate limit excedido: maximo 5 consultas por hora." },
      {
        ...logContext,
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) }
      }
    );
  }

  try {
    const match = await fetchMatchById(matchId);
    const itemNamesById = await fetchItemNameByIdMap();
    const markdown = buildMatchMarkdown(match, {
      selectedHeroId,
      selectedHeroName,
      itemNamesById
    });
    const llmResult = await requestMatchAnalysisFromOpenAI(markdown);

    return jsonWithRequestLog(
      {
        matchId: String(matchId),
        analysis: llmResult.analysis,
        metadata: llmResult.metadata,
        source: "opendota-free"
      },
      { ...logContext, status: 200 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const fallbackMessage = "Error inesperado procesando el analisis.";

    return jsonWithRequestLog(
      {
        error: error?.message || fallbackMessage
      },
      { ...logContext, status }
    );
  }
}
