# `opendota_sample.json` — guía rápida de estructura

Este archivo es un **ejemplo de respuesta JSON de OpenDota para una partida (match)**. La raíz del JSON es un **objeto** con **43 claves** (secciones). Algunas secciones son “datos crudos” del match y otras son **estadísticas calculadas** por OpenDota a partir del replay / parseo.

## Estructura general (raíz)

La raíz es un objeto con estas claves (orden alfabético):

- `all_word_counts`
- `barracks_status_dire`
- `barracks_status_radiant`
- `chat`
- `cluster`
- `cosmetics`
- `dire_score`
- `draft_timings`
- `duration`
- `engine`
- `first_blood_time`
- `flags`
- `game_mode`
- `human_players`
- `leagueid`
- `lobby_type`
- `loss`
- `match_id`
- `match_seq_num`
- `metadata`
- `my_word_counts`
- `objectives`
- `od_data`
- `patch`
- `pauses`
- `picks_bans`
- `players`
- `pre_game_duration`
- `radiant_gold_adv`
- `radiant_score`
- `radiant_win`
- `radiant_xp_adv`
- `region`
- `replay_salt`
- `replay_url`
- `series_id`
- `series_type`
- `start_time`
- `teamfights`
- `throw`
- `tower_status_dire`
- `tower_status_radiant`
- `version`

## 1) Identidad y tiempos de la partida

- `**match_id`**: id único del match en Valve/OpenDota.
- `**start_time**`: timestamp Unix (segundos).
- `**duration**`: duración en segundos (ej. `2700` = 45 min).
- `**pre_game_duration**`: “tiempo previo” en segundos (fase antes del minuto 0).
- `**first_blood_time**`: segundo del first blood desde el inicio del juego.
- `**version**`: versión del esquema/parseo (de OpenDota).
- `**engine**`: motor/replay engine (típicamente `1`).
- `**patch**`: versión/parche (número interno de OpenDota).

## 2) Resultado y marcador

- `**radiant_win**`: `true/false` si ganó Radiant.
- `**radiant_score**`, `**dire_score**`: kills finales de cada equipo.
- `**throw**`, `**loss**`: métricas de “throw/loss” (cambios bruscos de ventaja). Son números que OpenDota calcula; no es un campo de Valve “puro”.

## 3) Estado de edificios (torres y barracas)

Estos campos suelen ser **bitmasks** (enteros con bits) que codifican qué estructuras siguen vivas:

- `**tower_status_radiant`**, `**tower_status_dire**`
- `**barracks_status_radiant**`, `**barracks_status_dire**`

Si necesitas decodificarlos, normalmente se interpreta cada bit como “torre X viva / barraca melee/ranged viva” por lane.

## 4) Contexto del lobby/servidor

- `**game_mode**`: modo de juego (número).
- `**lobby_type**`: tipo de lobby (ranked, normal, etc. como número).
- `**region**`: región del servidor (número).
- `**cluster**`: cluster del servidor de Valve (número).
- `**leagueid**`: id de liga (0 si no aplica).
- `**series_id**`, `**series_type**`: datos de serie (Bo1/Bo3, etc.) si aplica.
- `**match_seq_num**`: contador secuencial de matches (Valve).
- `**flags**`: flags del match (entero con bits; depende de Valve/OpenDota).

## 5) Replay

- `**replay_url**`: URL para descargar el replay (`.dem.bz2`).
- `**replay_salt**`: valor numérico que acompaña el replay (según datos de Valve/OpenDota).

## 6) Draft (picks/bans)

- `**picks_bans**`: array con el orden del draft. Cada elemento suele tener:
  - `is_pick`: `true` si es pick, `false` si es ban
  - `hero_id`: id del héroe
  - `team`: equipo (0/1)
  - `order`: orden (0..N)
- `**draft_timings**`: tiempos del draft (en este sample viene vacío `[]`).

## 7) Jugadores (`players`) — la sección más grande

- `**players**`: array de longitud 10 (un objeto por jugador).

Cada jugador trae muchísima información. A nivel “mental model”, se puede ver en grupos:

- **Identidad / equipo / héroe**
  - `account_id`, `personaname`, `name`
  - `isRadiant`, `player_slot`, `team_number`, `team_slot`
  - `hero_id`, `hero_variant`, `level`, `lane`, `lane_role`
- **Items**
  - `item_0..item_5`, `backpack_0..backpack_2`, `item_neutral`, `item_neutral2`
  - `purchase`, `purchase_log`, `neutral_item_history`
- **Estadísticas de combate y economía**
  - `kills`, `deaths`, `assists`, `kda`
  - `gold_per_min`, `xp_per_min`, `net_worth`
  - `hero_damage`, `tower_damage`, `hero_healing`
- **Habilidades y acciones**
  - `ability_uses`, `ability_targets`, `ability_upgrades_arr`
  - `actions`, `pings`
- **Logs / series temporales**
  - `kills_log` (kills con `{time, key}`)
  - `gold_t`, `xp_t`, `lh_t`, `dn_t` (arrays “por tiempo”)
  - `runes_log`, `obs_log`, `sen_log`, etc.
- **Mapas de calor / posiciones**
  - `lane_pos`, `life_state_dead`, `damage_taken` (según el parseo)

## 8) Ventaja de oro/XP por tiempo

- `**radiant_gold_adv`**: array numérico. Cada entrada suele representar la ventaja de oro de Radiant a lo largo del match (frecuentemente por minuto).
- `**radiant_xp_adv**`: lo mismo pero para experiencia.

En este sample ambas series tienen longitud `46`.

## 9) Peleas por equipos (`teamfights`)

- `**teamfights**`: array (en este sample longitud `12`).

Cada teamfight incluye:

- `start`, `end`: segundo de inicio/fin
- `last_death`: último segundo con muerte dentro de esa pelea
- `deaths`: muertes totales en el segmento
- `players`: array con 10 entradas (una por jugador) con resumen dentro de esa pelea:
  - `ability_uses`, `item_uses`, `killed`, `deaths`, `damage`, `healing`, `gold_delta`, `xp_delta`, etc.

## 10) Objetivos y eventos (`objectives`)

- `**objectives**`: array de eventos del match (en este sample longitud `24`).

Los eventos suelen tener:

- `time`: segundo del evento
- `type`: tipo de evento (ej. `building_kill`, `CHAT_MESSAGE_FIRSTBLOOD`, pérdida de courier, etc.)
- campos extra según el tipo (`key`, `unit`, `team`, `value`, `player_slot`, etc.)

## 11) Chat (`chat`) y conteo de palabras

- `**chat**`: array de mensajes/eventos de chat (en este sample longitud `90`).
  - cada entrada suele tener `time`, `type` (chatwheel, allchat, etc.), `key` (texto/código), `player_slot`, etc.
- `**all_word_counts**`: objeto `palabra -> cantidad` agregando lo dicho en el chat.
- `**my_word_counts**`: lo mismo pero “tuyo” (en este sample viene vacío `{}`).

## 12) Pausas

- `**pauses**`: array con pausas. En este sample viene vacío `[]`.

## 13) Estado de parseo en OpenDota (`od_data`)

- `**od_data**`: objeto con flags booleanos del backend de OpenDota:
  - `has_api`
  - `has_gcdata`
  - `has_parsed`
  - `has_archive`

## 14) Campos vacíos o nulos en este sample

En este archivo concreto:

- `**metadata**`: `null`
- `**cosmetics**`: `{}` (objeto vacío)
- `**draft_timings**`: `[]`
- `**pauses**`: `[]`

Esto no significa que “no existan” en general; depende del match y de qué tan completo fue el parseo.