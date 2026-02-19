import {
  formatDuration,
  formatUnixDate,
  getLaneRoleLabel,
  safeMarkdownText,
  summarizeAdvantage
} from "./opendota.js";
import { getHeroNameById } from "./heroes.js";

function isRadiantPlayer(player) {
  if (typeof player?.isRadiant === "boolean") return player.isRadiant;
  return Number(player?.player_slot) < 128;
}

function pickFirstNumber(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function asNumberOrNA(...values) {
  const value = pickFirstNumber(...values);
  return value === null ? "N/A" : value;
}

function asPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

function playerKp(player, teamKills) {
  if (!Number.isFinite(teamKills) || teamKills <= 0) return null;
  const kills = Number(player?.kills) || 0;
  const assists = Number(player?.assists) || 0;
  return ((kills + assists) * 100) / teamKills;
}

function sumBy(players, selector) {
  return players.reduce((acc, player) => {
    const value = Number(selector(player));
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function playerRow(player, index, selectedHeroId) {
  const team = isRadiantPlayer(player) ? "Radiant" : "Dire";
  const name = safeMarkdownText(player.personaname || `Player ${index + 1}`);
  const isFocusHero = Number(selectedHeroId) > 0 && Number(player?.hero_id) === Number(selectedHeroId);
  const marker = isFocusHero ? " (YOU)" : "";
  const heroName = safeMarkdownText(getHeroNameById(player?.hero_id));
  const gpm = asNumberOrNA(player.gpm, player.gold_per_min);
  const xpm = asNumberOrNA(player.xpm, player.xp_per_min);
  const denies = asNumberOrNA(player.denies);
  const heroDamage = asNumberOrNA(player.hero_damage);
  const towerDamage = asNumberOrNA(player.tower_damage);
  const wardsPlaced = asNumberOrNA(player.obs_placed);
  const wardsDestroyed = asNumberOrNA(player.obs_kills);
  return `| ${team} | ${name}${marker} | ${heroName} | ${player.kills ?? 0}/${player.deaths ?? 0}/${player.assists ?? 0} | ${gpm} | ${xpm} | ${player.last_hits ?? "N/A"} | ${denies} | ${player.net_worth ?? "N/A"} | ${heroDamage} | ${towerDamage} | ${wardsPlaced} | ${wardsDestroyed} | ${getLaneRoleLabel(player)} |`;
}

function objectiveLine(objective) {
  const type = safeMarkdownText(objective?.type);
  const minute = Number.isFinite(objective?.time)
    ? `${Math.floor(objective.time / 60)}:${String(objective.time % 60).padStart(2, "0")}`
    : "N/A";
  const key = safeMarkdownText(objective?.key || objective?.slot || "");
  return `- ${minute} - ${type}${key !== "N/A" && key !== "" ? ` (${key})` : ""}`;
}

function objectiveTypeSummary(objectives) {
  const counts = {};
  for (const objective of objectives) {
    const type = objective?.type || "UNKNOWN";
    counts[type] = (counts[type] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "- No objectives data available.";
  return entries.map(([type, count]) => `- ${type}: ${count}`).join("\n");
}

function getItemList(player) {
  const itemIds = [
    player?.item_0,
    player?.item_1,
    player?.item_2,
    player?.item_3,
    player?.item_4,
    player?.item_5,
    player?.backpack_0,
    player?.backpack_1,
    player?.backpack_2
  ]
    .map((value) => (Number.isFinite(value) ? value : null))
    .filter((value) => value !== null && value > 0);
  return itemIds.length > 0 ? itemIds.join(", ") : "N/A";
}

function playerDeepDiveLine(player, index, teamKills) {
  const team = isRadiantPlayer(player) ? "Radiant" : "Dire";
  const name = safeMarkdownText(player.personaname || `Player ${index + 1}`);
  const kp = asPercent(playerKp(player, teamKills));
  const stuns = asNumberOrNA(player.stuns);
  const campsStacked = asNumberOrNA(player.camps_stacked);
  const runePickups = asNumberOrNA(player.rune_pickups);
  const healing = asNumberOrNA(player.hero_healing);
  const level = asNumberOrNA(player.level);
  const laneEff = Number.isFinite(player?.lane_efficiency_pct)
    ? `${Number(player.lane_efficiency_pct).toFixed(1)}%`
    : "N/A";

  return `- ${team} - ${name} (Hero ${player.hero_id ?? "N/A"}): level ${level}, KP ${kp}, stuns ${stuns}, healing ${healing}, camps stacked ${campsStacked}, rune pickups ${runePickups}, lane efficiency ${laneEff}, items [${getItemList(player)}]`;
}

export function buildMatchMarkdown(match, options = {}) {
  const selectedHeroId = Number(options?.selectedHeroId) > 0 ? Number(options.selectedHeroId) : null;
  const selectedHeroName = safeMarkdownText(options?.selectedHeroName || "");
  const players = Array.isArray(match?.players) ? match.players : [];
  const objectives = Array.isArray(match?.objectives) ? match.objectives.slice(0, 15) : [];
  const allObjectives = Array.isArray(match?.objectives) ? match.objectives : [];
  const picksBans = Array.isArray(match?.picks_bans) ? match.picks_bans : [];

  const winner = match?.radiant_win ? "Radiant" : "Dire";
  const goldAdv = summarizeAdvantage(match?.radiant_gold_adv || []);
  const xpAdv = summarizeAdvantage(match?.radiant_xp_adv || []);
  const radiantPlayers = players.filter((player) => isRadiantPlayer(player));
  const direPlayers = players.filter((player) => !isRadiantPlayer(player));
  const radiantKills = Number(match?.radiant_score) || 0;
  const direKills = Number(match?.dire_score) || 0;

  const teamTotalsTable = [
    "| Team | Net Worth | Last Hits | Hero Damage | Tower Damage | Healing | Obs Placed | Sentry Placed |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    `| Radiant | ${sumBy(radiantPlayers, (p) => p.net_worth)} | ${sumBy(radiantPlayers, (p) => p.last_hits)} | ${sumBy(radiantPlayers, (p) => p.hero_damage)} | ${sumBy(radiantPlayers, (p) => p.tower_damage)} | ${sumBy(radiantPlayers, (p) => p.hero_healing)} | ${sumBy(radiantPlayers, (p) => p.obs_placed)} | ${sumBy(radiantPlayers, (p) => p.sen_placed)} |`,
    `| Dire | ${sumBy(direPlayers, (p) => p.net_worth)} | ${sumBy(direPlayers, (p) => p.last_hits)} | ${sumBy(direPlayers, (p) => p.hero_damage)} | ${sumBy(direPlayers, (p) => p.tower_damage)} | ${sumBy(direPlayers, (p) => p.hero_healing)} | ${sumBy(direPlayers, (p) => p.obs_placed)} | ${sumBy(direPlayers, (p) => p.sen_placed)} |`
  ].join("\n");

  const playerTable = [
    "| Team | Player | Hero | K/D/A | GPM | XPM | LH | DN | Net Worth | Hero DMG | Tower DMG | Obs Placed | Obs Kills | Lane |",
    "|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...players.map((player, idx) => playerRow(player, idx, selectedHeroId))
  ].join("\n");

  const selectedHeroPlayers = selectedHeroId
    ? players.filter((player) => Number(player?.hero_id) === selectedHeroId)
    : [];
  const selectedHeroSection = selectedHeroId
    ? selectedHeroPlayers.length > 0
      ? selectedHeroPlayers
          .map((player, idx) => {
            const team = isRadiantPlayer(player) ? "Radiant" : "Dire";
            const name = safeMarkdownText(player.personaname || `Player ${idx + 1}`);
            const heroName = safeMarkdownText(getHeroNameById(player?.hero_id));
            const gpm = asNumberOrNA(player.gpm, player.gold_per_min);
            const xpm = asNumberOrNA(player.xpm, player.xp_per_min);
            const heroDamage = asNumberOrNA(player.hero_damage);
            return `- ${name} (${team}) - Hero ${heroName}, K/D/A ${player.kills ?? 0}/${player.deaths ?? 0}/${player.assists ?? 0}, GPM ${gpm}, XPM ${xpm}, Hero damage ${heroDamage}, Net worth ${player.net_worth ?? "N/A"}`;
          })
          .join("\n")
      : "- Hero selected by user was not found in this match payload."
    : "- No focus hero selected.";

  const objectiveLines = objectives.length > 0
    ? objectives.map(objectiveLine).join("\n")
    : "- No objectives data available.";
  const objectiveSummary = objectiveTypeSummary(allObjectives);
  const pickBanLines = picksBans.length > 0
    ? picksBans
        .map((entry, idx) => {
          const action = entry.is_pick ? "Pick" : "Ban";
          const team = entry.team === 0 ? "Radiant" : "Dire";
          const heroName = safeMarkdownText(getHeroNameById(entry.hero_id));
          return `- #${idx + 1} ${team} ${action}: ${heroName}`;
        })
        .join("\n")
    : "- No draft data available.";
  const deepDiveLines = players.length > 0
    ? players
        .map((player, idx) =>
          playerDeepDiveLine(player, idx, isRadiantPlayer(player) ? radiantKills : direKills)
        )
        .join("\n")
    : "- No player data available.";

  return `# Dota 2 Match Report

## Match Metadata
- Match ID: ${match?.match_id ?? "N/A"}
- Start time (UTC): ${formatUnixDate(match?.start_time)}
- Duration: ${formatDuration(match?.duration)}
- Game mode: ${match?.game_mode ?? "N/A"}
- Lobby type: ${match?.lobby_type ?? "N/A"}
- Region/Cluster: ${match?.region ?? "N/A"} / ${match?.cluster ?? "N/A"}
- First blood time: ${Number.isFinite(match?.first_blood_time) ? `${match.first_blood_time}s` : "N/A"}

## Team Summary
- Winner: ${winner}
- Radiant score: ${match?.radiant_score ?? "N/A"}
- Dire score: ${match?.dire_score ?? "N/A"}

## Focus Hero (User Selection)
- Selected hero: ${selectedHeroId ? `${selectedHeroName}` : "N/A"}
${selectedHeroSection}

## Team Economy and Impact Totals
${teamTotalsTable}

## Players
${playerTable}

## Draft (Picks/Bans)
${pickBanLines}

## Timeline Signals
- Radiant gold max lead: ${Math.round(goldAdv.maxLead)}
- Radiant gold max deficit: ${Math.round(goldAdv.maxDeficit)}
- Gold swing: ${Math.round(goldAdv.swing)}
- Radiant XP max lead: ${Math.round(xpAdv.maxLead)}
- Radiant XP max deficit: ${Math.round(xpAdv.maxDeficit)}
- XP swing: ${Math.round(xpAdv.swing)}

## Objective Type Counts
${objectiveSummary}

## Objectives (Top 15)
${objectiveLines}

## Per Player Detailed Notes
${deepDiveLines}

## Technical Context for LLM
- Hero names are already resolved in this report.
- Use objective timings + KP + damage split + vision metrics to identify decision quality.

## Prompt for LLM (STRICT OUTPUT FORMAT)
Respond ONLY in Spanish and ONLY with these 5 sections:
1. Que hice bien
2. Que hice mal
3. Que puedo mejorar
4. Analisis breve de items comprados
5. Responsable principal del resultado

Rules:
- Use hero NAMES from this report, never hero IDs.
- Be concrete and concise.
- In section 3, include 3 actionable improvements.
- In section 4, give a brief itemization critique for my hero.
- In section 5, use exactly this heading if the team won: "Principal responsable de la victoria".
- In section 5, use exactly this heading if the team lost: "Principal responsable de la derrota".
- In section 5, indicate who that player was and why.
`;
}
