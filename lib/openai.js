function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const fragments = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const chunk of content) {
      if (typeof chunk?.text === "string" && chunk.text.trim().length > 0) {
        fragments.push(chunk.text.trim());
      }
    }
  }

  return fragments.join("\n\n").trim();
}

export const DOTA_COACH_SYSTEM_PROMPT =
  "Eres un coach experto de Dota 2. Evalua segun el rol del heroe y el contexto de la partida; para supports, prioriza vision, asistencias, supervivencia, posicionamiento y utilidad, no solo kills. Responde solo en espanol, usando exclusivamente 5 secciones con estos encabezados exactos: '## ✅ Que hice bien', '## ❌ Que hice mal', '## 🛠️ Que puedo mejorar', '## 🧰 Analisis breve de items comprados' y en la quinta seccion usa exactamente '## 🏆 Principal responsable de la victoria' cuando el equipo gane o '## ⚠️ Principal responsable de la derrota' cuando el equipo pierda. Importante: el encabezado '## 🛠️ Que puedo mejorar' no debe estar en negrita, solo como heading normal. En el punto 4, ademas de criticar brevemente los items comprados, indica que item no comprado hubiera servido mas (si es posible) y por que. En el punto 5 explica por que ese jugador fue el principal responsable. No agregues secciones extra.";

function buildOpenAIInput(reportMarkdown) {
  return [
    {
      role: "system",
      content: DOTA_COACH_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: reportMarkdown
    }
  ];
}

export async function requestMatchAnalysisFromOpenAI(reportMarkdown) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1";

  if (!apiKey) {
    const err = new Error("Falta OPENAI_API_KEY en .env.");
    err.status = 500;
    throw err;
  }

  const input = buildOpenAIInput(reportMarkdown);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input
    })
  });

  if (!response.ok) {
    const message = `OpenAI API error: ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  const text = extractResponseText(payload);

  if (!text) {
    const err = new Error("OpenAI no devolvio texto de analisis.");
    err.status = 502;
    throw err;
  }

  const metadata = ["system_prompt:", DOTA_COACH_SYSTEM_PROMPT, "", "user_input:", reportMarkdown].join(
    "\n"
  );

  return {
    analysis: text,
    metadata
  };
}
