import { buildMatchMarkdown } from "../../../../lib/markdown.js";
import { fetchMatchById, isValidMatchId } from "../../../../lib/opendota.js";
import { requestMatchAnalysisFromOpenAI } from "../../../../lib/openai.js";

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
