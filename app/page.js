"use client";

import { useMemo, useState } from "react";
import { HEROES } from "../lib/heroes.js";

function isInputValid(matchId) {
  return /^[0-9]{8,20}$/.test(matchId);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown) {
  if (!markdown || markdown.trim().length === 0) {
    return "<p>Aun no hay analisis.</p>";
  }

  const lines = escapeHtml(markdown).split(/\r?\n/);
  const html = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<p>${inlineMarkdown(line)}</p>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }

  return html.join("");
}

export default function HomePage() {
  const [matchId, setMatchId] = useState("");
  const [heroes] = useState(HEROES);
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [metadata, setMetadata] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");

  const canSubmit = useMemo(() => isInputValid(matchId), [matchId]);
  const hasResult = analysis.length > 0;
  const selectedHeroName = useMemo(() => {
    const hero = heroes.find((item) => String(item.id) === selectedHeroId);
    return hero?.name || "";
  }, [heroes, selectedHeroId]);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setAnalysis("");
    setMetadata("");

    try {
      const query = new URLSearchParams();
      if (selectedHeroId) query.set("heroId", selectedHeroId);
      if (selectedHeroName) query.set("heroName", selectedHeroName);
      const queryString = query.toString();
      const url = queryString ? `/api/match/${matchId}?${queryString}` : `/api/match/${matchId}`;
      const response = await fetch(url, { method: "GET" });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setError(data?.error || "No se pudo analizar la partida.");
        return;
      }

      setAnalysis(data.analysis || "");
      setMetadata(data.metadata || "");
      setStatus("success");
    } catch (_err) {
      setStatus("error");
      setError("Error de red al consultar servicios de analisis.");
    }
  }

  return (
    <main>
      <h1>Dota 2 Match Analyzer</h1>
      <p className="muted">
        Ingresa un match_id, consulta OpenDota y recibe analisis directo de la partida.
      </p>
      <p className="muted">
        No sabes tu match_id? Buscalo en{" "}
        <a href="https://www.opendota.com/" target="_blank" rel="noreferrer">
          OpenDota
        </a>
        .
      </p>

      <section className="panel">
        <form onSubmit={onSubmit}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej: 8078821463"
            value={matchId}
            onChange={(event) => setMatchId(event.target.value.trim())}
            aria-label="Match ID"
          />
          <select
            value={selectedHeroId}
            onChange={(event) => setSelectedHeroId(event.target.value)}
            aria-label="Heroe jugado"
          >
            <option value="">Selecciona tu heroe (opcional)</option>
            {heroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                {hero.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!canSubmit || status === "loading"}>
            {status === "loading" ? "Analizando..." : "Analizar partida"}
          </button>
        </form>
        {!canSubmit && matchId.length > 0 ? (
          <p className="error">El match_id debe ser numerico (8 a 20 digitos).</p>
        ) : null}
        {status === "error" && error ? <p className="error">{error}</p> : null}
        {status === "success" ? <p className="success">Analisis generado.</p> : null}
      </section>

      <section className="panel">
        <div className="tabs">
          <button
            type="button"
            className={activeTab === "analysis" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("analysis")}
          >
            Resultado del análisis
          </button>
          <button
            type="button"
            className={activeTab === "metadata" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("metadata")}
          >
            Metadata
          </button>
        </div>

        {status === "loading" ? (
          <div className="result-box" role="status" aria-live="polite" aria-label="Analizando">
            <div className="spinner" />
          </div>
        ) : activeTab === "analysis" ? (
          <article
            className="markdown-output"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(hasResult ? analysis : "") }}
          />
        ) : (
          <pre className="metadata-output">{metadata.length > 0 ? metadata : "Aun no hay metadata."}</pre>
        )}
      </section>
    </main>
  );
}
