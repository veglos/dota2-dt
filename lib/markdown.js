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

function getRoleHint(player) {
  const lane = getLaneRoleLabel(player);
  const gpm = pickFirstNumber(player?.gpm, player?.gold_per_min) ?? 0;
  const lastHits = Number(player?.last_hits) || 0;
  const observerWards = Number(player?.obs_placed) || 0;
  const sentryWards = Number(player?.sen_placed) || 0;
  const totalWards = observerWards + sentryWards;

  if (lane === "Mid lane") return "Core (mid)";
  if (lane === "Safe lane") {
    if (totalWards >= 6 && gpm < 450) return "Support (safe)";
    return "Core (carry)";
  }
  if (lane === "Off lane") {
    if (totalWards >= 6 && gpm < 430) return "Support (roaming/pos4)";
    return "Core (offlane)";
  }

  if (gpm >= 500 || lastHits >= 180) return "Core";
  if (totalWards >= 8 || (gpm < 400 && lastHits < 90)) return "Support";
  return "Flexible/Unknown";
}

function getTimelineValueAtMinute(series, minute) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const idx = Math.min(Math.max(0, minute), series.length - 1);
  const value = Number(series[idx]);
  return Number.isFinite(value) ? value : null;
}

function toFiniteOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getOpposingLaneLabel(laneLabel) {
  if (laneLabel === "Safe lane") return "Off lane";
  if (laneLabel === "Off lane") return "Safe lane";
  if (laneLabel === "Mid lane") return "Mid lane";
  return laneLabel;
}

function isDirectLaneOpponent(player, candidate) {
  if (!player || !candidate) return false;
  if (isRadiantPlayer(player) === isRadiantPlayer(candidate)) return false;

  const playerLane = getLaneRoleLabel(player);
  const candidateLane = getLaneRoleLabel(candidate);

  if (playerLane === "Mid lane") return candidateLane === "Mid lane";
  if (playerLane === "Safe lane") {
    return candidateLane === "Off lane" || candidate?.is_roaming === true;
  }
  if (playerLane === "Off lane") {
    return candidateLane === "Safe lane" || candidate?.is_roaming === true;
  }

  if (playerLane === "Jungle") return candidate?.is_roaming === true;
  return candidateLane === playerLane;
}

function getDirectLaneOpponents(player, allPlayers) {
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) return [];
  return allPlayers.filter((candidate) => isDirectLaneOpponent(player, candidate));
}

function formatLaneOpponent(opponent) {
  const heroName = safeMarkdownText(getHeroNameById(opponent?.hero_id));
  const lane = safeMarkdownText(getLaneRoleLabel(opponent));
  const lh10 = asNumberOrNA(getTimelineValueAtMinute(opponent?.lh_t, 10));
  const dn10 = asNumberOrNA(getTimelineValueAtMinute(opponent?.dn_t, 10));
  const laneEff = Number.isFinite(opponent?.lane_efficiency_pct)
    ? `${Number(opponent.lane_efficiency_pct).toFixed(1)}%`
    : "N/A";
  return `${heroName} (${lane}, LH@10 ${lh10}, DN@10 ${dn10}, lane efficiency ${laneEff})`;
}

function formatLaneTeammate(teammate) {
  const heroName = safeMarkdownText(getHeroNameById(teammate?.hero_id));
  const lh10 = asNumberOrNA(getTimelineValueAtMinute(teammate?.lh_t, 10));
  const dn10 = asNumberOrNA(getTimelineValueAtMinute(teammate?.dn_t, 10));
  const laneEff = Number.isFinite(teammate?.lane_efficiency_pct)
    ? `${Number(teammate.lane_efficiency_pct).toFixed(1)}%`
    : "N/A";
  return `${heroName} (LH@10 ${lh10}, DN@10 ${dn10}, lane efficiency ${laneEff})`;
}

function laneTeamSummary(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return { lh10: 0, dn10: 0, laneEffAvg: 0, count: 0 };
  }

  const totals = players.reduce(
    (acc, player) => {
      acc.lh10 += toFiniteOrZero(getTimelineValueAtMinute(player?.lh_t, 10));
      acc.dn10 += toFiniteOrZero(getTimelineValueAtMinute(player?.dn_t, 10));
      acc.laneEff += toFiniteOrZero(player?.lane_efficiency_pct);
      acc.count += 1;
      return acc;
    },
    { lh10: 0, dn10: 0, laneEff: 0, count: 0 }
  );

  return {
    lh10: totals.lh10,
    dn10: totals.dn10,
    laneEffAvg: totals.count > 0 ? totals.laneEff / totals.count : 0,
    count: totals.count
  };
}

function computeLaneOutcomeAnchor(allies, opponents) {
  const ally = laneTeamSummary(allies);
  const enemy = laneTeamSummary(opponents);

  const farmDelta = ally.lh10 - enemy.lh10;
  const denyDelta = ally.dn10 - enemy.dn10;
  const effDelta = ally.laneEffAvg - enemy.laneEffAvg;

  const score = farmDelta * 1.0 + denyDelta * 1.5 + effDelta * 1.2;
  let result = "Empate";
  if (score >= 12) result = "Ganada";
  if (score <= -12) result = "Perdida";

  return {
    result,
    score: Number(score.toFixed(1)),
    ally,
    enemy
  };
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
  const roleHint = safeMarkdownText(getRoleHint(player));
  const gpm = asNumberOrNA(player.gpm, player.gold_per_min);
  const xpm = asNumberOrNA(player.xpm, player.xp_per_min);
  const denies = asNumberOrNA(player.denies);
  const heroDamage = asNumberOrNA(player.hero_damage);
  const towerDamage = asNumberOrNA(player.tower_damage);
  const wardsPlaced = asNumberOrNA(player.obs_placed);
  const wardsDestroyed = asNumberOrNA(player.obs_kills);
  return `| ${team} | ${name}${marker} | ${heroName} | ${player.kills ?? 0}/${player.deaths ?? 0}/${player.assists ?? 0} | ${gpm} | ${xpm} | ${player.last_hits ?? "N/A"} | ${denies} | ${player.net_worth ?? "N/A"} | ${heroDamage} | ${towerDamage} | ${wardsPlaced} | ${wardsDestroyed} | ${getLaneRoleLabel(player)} | ${roleHint} |`;
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

function formatItemLabel(itemId, itemNamesById) {
  const id = Number(itemId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const itemName = itemNamesById?.[id];
  if (!itemName) return `Unknown Item [${id}]`;
  return `${safeMarkdownText(itemName)} [${id}]`;
}

function getItemList(player, itemNamesById = {}) {
  const itemIds = [
    player?.item_0,
    player?.item_1,
    player?.item_2,
    player?.item_3,
    player?.item_4,
    player?.item_5,
    player?.backpack_0,
    player?.backpack_1,
    player?.backpack_2,
    player?.item_neutral
  ]
    .map((value) => (Number.isFinite(value) ? value : null))
    .filter((value) => value !== null && value > 0);
  const labels = itemIds
    .map((itemId) => formatItemLabel(itemId, itemNamesById))
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "N/A";
}

function playerDeepDiveLine(player, index, teamKills, itemNamesById) {
  const team = isRadiantPlayer(player) ? "Radiant" : "Dire";
  const name = safeMarkdownText(player.personaname || `Player ${index + 1}`);
  const roleHint = safeMarkdownText(getRoleHint(player));
  const kp = asPercent(playerKp(player, teamKills));
  const stuns = asNumberOrNA(player.stuns);
  const campsStacked = asNumberOrNA(player.camps_stacked);
  const runePickups = asNumberOrNA(player.rune_pickups);
  const healing = asNumberOrNA(player.hero_healing);
  const level = asNumberOrNA(player.level);
  const laneEff = Number.isFinite(player?.lane_efficiency_pct)
    ? `${Number(player.lane_efficiency_pct).toFixed(1)}%`
    : "N/A";

  return `- ${team} - ${name} (Hero ${player.hero_id ?? "N/A"}, role hint ${roleHint}): level ${level}, KP ${kp}, stuns ${stuns}, healing ${healing}, camps stacked ${campsStacked}, rune pickups ${runePickups}, lane efficiency ${laneEff}, items [${getItemList(player, itemNamesById)}]`;
}

function playerLanePhaseLine(player, index, allPlayers) {
  const team = isRadiantPlayer(player) ? "Radiant" : "Dire";
  const name = safeMarkdownText(player.personaname || `Player ${index + 1}`);
  const heroName = safeMarkdownText(getHeroNameById(player?.hero_id));
  const roleHint = safeMarkdownText(getRoleHint(player));
  const lane = safeMarkdownText(getLaneRoleLabel(player));
  const laneEff = Number.isFinite(player?.lane_efficiency_pct)
    ? `${Number(player.lane_efficiency_pct).toFixed(1)}%`
    : "N/A";
  const lh10 = asNumberOrNA(getTimelineValueAtMinute(player?.lh_t, 10));
  const dn10 = asNumberOrNA(getTimelineValueAtMinute(player?.dn_t, 10));
  const laneKills = asNumberOrNA(player?.lane_kills);
  const isRoaming = player?.is_roaming === true ? "yes" : "no";
  const campsStacked = asNumberOrNA(player?.camps_stacked);
  const creepsStacked = asNumberOrNA(player?.creeps_stacked);
  const directLaneOpponents = getDirectLaneOpponents(player, allPlayers);
  const laneAllies = allPlayers.filter(
    (candidate) =>
      candidate !== player &&
      isRadiantPlayer(candidate) === isRadiantPlayer(player) &&
      getLaneRoleLabel(candidate) === getLaneRoleLabel(player)
  );
  const laneAlliesText =
    laneAllies.length > 0 ? laneAllies.map((teammate) => formatLaneTeammate(teammate)).join("; ") : "N/A";
  const directOpponentsText = directLaneOpponents.length > 0
    ? directLaneOpponents.map((opponent) => formatLaneOpponent(opponent)).join("; ")
    : "N/A";

  return `- ${team} - ${name} (${heroName}): lane ${lane}, role hint ${roleHint}, lane efficiency ${laneEff}, LH@10 ${lh10}, DN@10 ${dn10}, lane kills ${laneKills}, roaming ${isRoaming}, camps stacked ${campsStacked}, creeps stacked ${creepsStacked}, lane allies [${laneAlliesText}], direct lane opponents [${directOpponentsText}]`;
}

function buildSelectedLaneContext(players, selectedHeroPlayers) {
  if (!Array.isArray(selectedHeroPlayers) || selectedHeroPlayers.length === 0) {
    return "- No selected-hero lane context available.";
  }

  return selectedHeroPlayers
    .map((player, idx) => {
      const teamIsRadiant = isRadiantPlayer(player);
      const team = teamIsRadiant ? "Radiant" : "Dire";
      const lane = getLaneRoleLabel(player);
      const enemyLane = getOpposingLaneLabel(lane);
      const heroName = safeMarkdownText(getHeroNameById(player?.hero_id));

      const laneAllies = players.filter(
        (candidate) =>
          isRadiantPlayer(candidate) === teamIsRadiant && getLaneRoleLabel(candidate) === lane
      );
      const directOpponents = players.filter(
        (candidate) =>
          isRadiantPlayer(candidate) !== teamIsRadiant &&
          (getLaneRoleLabel(candidate) === enemyLane ||
            (candidate?.is_roaming === true && (lane === "Safe lane" || lane === "Off lane")))
      );

      const alliesText =
        laneAllies.length > 0 ? laneAllies.map((teammate) => formatLaneTeammate(teammate)).join("; ") : "N/A";
      const opponentsText =
        directOpponents.length > 0
          ? directOpponents.map((opponent) => formatLaneOpponent(opponent)).join("; ")
          : "N/A";

      return `- Focus #${idx + 1}: ${heroName} (${team}, ${lane}) -> evaluate this lane as a team unit. Allied lane participants [${alliesText}] vs direct lane opponents [${opponentsText}]`;
    })
    .join("\n");
}

function buildSelectedLaneOutcomeAnchor(players, selectedHeroPlayers) {
  if (!Array.isArray(selectedHeroPlayers) || selectedHeroPlayers.length === 0) {
    return "- Resultado ancla no disponible: no selected-hero lane context.";
  }

  const player = selectedHeroPlayers[0];
  const teamIsRadiant = isRadiantPlayer(player);
  const lane = getLaneRoleLabel(player);
  const enemyLane = getOpposingLaneLabel(lane);

  const laneAllies = players.filter(
    (candidate) =>
      isRadiantPlayer(candidate) === teamIsRadiant && getLaneRoleLabel(candidate) === lane
  );
  const directOpponents = players.filter(
    (candidate) =>
      isRadiantPlayer(candidate) !== teamIsRadiant &&
      (getLaneRoleLabel(candidate) === enemyLane ||
        (candidate?.is_roaming === true && (lane === "Safe lane" || lane === "Off lane")))
  );

  const anchor = computeLaneOutcomeAnchor(laneAllies, directOpponents);

  return `- Resultado ancla calculado para la lane seleccionada: ${anchor.result}
- Puntaje ancla (deterministico): ${anchor.score}
- Aliados lane (sum/avg): LH@10 ${anchor.ally.lh10}, DN@10 ${anchor.ally.dn10}, lane efficiency avg ${anchor.ally.laneEffAvg.toFixed(1)}%
- Rivales lane (sum/avg): LH@10 ${anchor.enemy.lh10}, DN@10 ${anchor.enemy.dn10}, lane efficiency avg ${anchor.enemy.laneEffAvg.toFixed(1)}%`;
}

export function buildMatchMarkdown(match, options = {}) {
  const selectedHeroId = Number(options?.selectedHeroId) > 0 ? Number(options.selectedHeroId) : null;
  const selectedHeroName = safeMarkdownText(options?.selectedHeroName || "");
  const itemNamesById = options?.itemNamesById || {};
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
    "| Team | Player | Hero | K/D/A | GPM | XPM | LH | DN | Net Worth | Hero DMG | Tower DMG | Obs Placed | Obs Kills | Lane | Role Hint |",
    "|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
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
          playerDeepDiveLine(player, idx, isRadiantPlayer(player) ? radiantKills : direKills, itemNamesById)
        )
        .join("\n")
    : "- No player data available.";
  const lanePhaseLines = players.length > 0
    ? players.map((player, idx) => playerLanePhaseLine(player, idx, players)).join("\n")
    : "- No player lane-phase data available.";
  const selectedLaneContext = buildSelectedLaneContext(players, selectedHeroPlayers);
  const selectedLaneOutcomeAnchor = buildSelectedLaneOutcomeAnchor(players, selectedHeroPlayers);

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

## Lane Phase Details (0-10 min focus)
${lanePhaseLines}

## Selected Hero Lane Matchup Context (Team-Based)
${selectedLaneContext}

## Selected Lane Outcome Anchor (Deterministic)
${selectedLaneOutcomeAnchor}

## Technical Context for LLM
- Hero names are already resolved in this report.
- Item names are resolved in detailed notes as "Name [ID]".
- Lane Phase Details include lane efficiency, LH@10, DN@10, lane kills, roaming, stacks, lane allies, and direct lane opponents.
- "Selected Lane Outcome Anchor (Deterministic)" is the canonical lane result for section 1.
- Use objective timings + KP + damage split + vision metrics to identify decision quality.
- "Role Hint" is a heuristic signal (not absolute truth) to guide fair evaluation by role.

## Prompt for LLM (STRICT OUTPUT FORMAT)
Respond ONLY in Spanish and ONLY with these 6 sections and exact headings:
1. ## 🛣️ Análisis de fase de línea
2. ## ✅ Que hice bien
3. ## ❌ Que hice mal
4. ## 🛠️ Que puedo mejorar
5. ## 🧰 Análisis breve de items comprados
6. ## 🏆 Principal responsable de la victoria (if win) OR ## ⚠️ Principal responsable de la derrota (if loss)

Rules:
- Use hero NAMES from this report, never hero IDs.
- Be concrete and concise.
- In section 1, state clearly if the lane phase was won, lost, or tied, and explain the reason with concrete lane evidence.
- In section 1, the first non-empty line MUST be exactly this format: "Resultado: Ganada" OR "Resultado: Empate" OR "Resultado: Perdida".
- In section 1, the result MUST match exactly the "Resultado ancla calculado para la lane seleccionada".
- In section 1, evaluate lane phase at TEAM level for the selected hero lane (allies in lane vs direct lane opponents), not only individual hero stats.
- In section 1, prioritize lane-phase evidence: positioning, stacks, LH@10, DN@10, lane efficiency, lane kills, rune control, and roaming impact.
- Compare lane performance against direct lane opponents listed in "direct lane opponents"; do not compare against non-lane opponents.
- If a metric is unavailable, say it is unavailable instead of inventing data.
- Judge performance according to role context (lane + role hint + economy + vision + itemization).
- Do not over-penalize carries/cores for low warding numbers.
- Do not over-penalize supports for low kills/last hits/net worth when they provide vision, utility, saves, stacks, disables, or high assists.
- Flag role-item mismatches when relevant (for example: carry/core buying too many pure support items, or support skipping needed utility and rushing greedy carry-only itemization).
- In section 4, include 3 actionable improvements.
- In section 4, do not use bold formatting in the heading.
- In section 5, give a brief itemization critique for my hero.
- In section 5, evaluate items based on my hero role context, not only raw KDA.
- In section 5, if possible, mention one not-purchased item that would have been better and why.
- In section 6, use exactly this heading if the team won: "## 🏆 Principal responsable de la victoria".
- In section 6, use exactly this heading if the team lost: "## ⚠️ Principal responsable de la derrota".
- In section 6, indicate who that player was and why.
`;
}
