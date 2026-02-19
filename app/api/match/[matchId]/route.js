import { buildMatchMarkdown } from "../../../../lib/markdown.js";
import { fetchMatchById, isValidMatchId } from "../../../../lib/opendota.js";
import { requestMatchAnalysisFromOpenAI } from "../../../../lib/openai.js";
import { consumeRateLimit } from "../../../../lib/rate-limit.js";
import { appendRequestLog } from "../../../../lib/request-log.js";

export const runtime = "nodejs";

async function jsonWithRequestLog(
  payload,
  { status, headers, matchId, clientIp }
) {
  try {
    await appendRequestLog({
      date: new Date().toISOString(),
      matchId,
      clientIp,
      httpStatus: status
    });
  } catch (error) {
    console.error("No se pudo guardar request log en Redis.", error);
  }

  return Response.json(payload, { status, headers });
}

export async function GET(request, { params }) {
  const { matchId } = await params;
  const { searchParams } = new URL(request.url);
  const selectedHeroId = searchParams.get("heroId");
  const selectedHeroName = searchParams.get("heroName");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "anonymous";

  if (!isValidMatchId(matchId)) {
    return jsonWithRequestLog(
      { error: "match_id invalido. Debe ser numerico (8 a 20 digitos)." },
      { status: 400, matchId, clientIp }
    );
  }

  const rate = consumeRateLimit(clientIp);
  if (!rate.allowed) {
    return jsonWithRequestLog(
      { error: "Rate limit excedido: maximo 5 consultas por hora." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
        matchId,
        clientIp
      }
    );
  }

  try {
    const match = await fetchMatchById(matchId);
    const markdown = buildMatchMarkdown(match, {
      selectedHeroId,
      selectedHeroName
    });
    const llmResult = await requestMatchAnalysisFromOpenAI(markdown);

    return jsonWithRequestLog(
      {
        matchId: String(matchId),
        analysis: llmResult.analysis,
        metadata: llmResult.metadata,
        source: "opendota-free"
      },
      { status: 200, matchId, clientIp }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const fallbackMessage = "Error inesperado procesando el analisis.";

    return jsonWithRequestLog(
      {
        error: error?.message || fallbackMessage
      },
      { status, matchId, clientIp }
    );
  }
}
