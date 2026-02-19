import { buildMatchMarkdown } from "../../../../lib/markdown.js";
import { fetchMatchById, isValidMatchId } from "../../../../lib/opendota.js";
import { requestMatchAnalysisFromOpenAI } from "../../../../lib/openai.js";
import { consumeRateLimit } from "../../../../lib/rate-limit.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { matchId } = await params;
  const { searchParams } = new URL(request.url);
  const selectedHeroId = searchParams.get("heroId");
  const selectedHeroName = searchParams.get("heroName");

  if (!isValidMatchId(matchId)) {
    return Response.json(
      { error: "match_id invalido. Debe ser numerico (8 a 20 digitos)." },
      { status: 400 }
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "anonymous";
  const rate = consumeRateLimit(clientIp);
  if (!rate.allowed) {
    return Response.json(
      { error: "Rate limit excedido: maximo 5 consultas por hora." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const match = await fetchMatchById(matchId);
    const markdown = buildMatchMarkdown(match, {
      selectedHeroId,
      selectedHeroName
    });
    const llmResult = await requestMatchAnalysisFromOpenAI(markdown);

    return Response.json(
      {
        matchId: String(matchId),
        analysis: llmResult.analysis,
        metadata: llmResult.metadata,
        source: "opendota-free"
      },
      { status: 200 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const fallbackMessage = "Error inesperado procesando el analisis.";

    return Response.json(
      {
        error: error?.message || fallbackMessage
      },
      { status }
    );
  }
}
