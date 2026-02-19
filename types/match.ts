export type OpenDotaPlayer = {
  account_id?: number;
  personaname?: string;
  player_slot: number;
  hero_id?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  gpm?: number;
  xpm?: number;
  last_hits?: number;
  net_worth?: number;
  isRadiant?: boolean;
};

export type OpenDotaObjective = {
  type?: string;
  time?: number;
  slot?: number;
  key?: string;
  player_slot?: number;
  team?: number;
};

export type OpenDotaMatch = {
  match_id: number;
  start_time?: number;
  duration?: number;
  game_mode?: number;
  lobby_type?: number;
  radiant_win?: boolean;
  radiant_score?: number;
  dire_score?: number;
  radiant_gold_adv?: number[] | null;
  radiant_xp_adv?: number[] | null;
  players?: OpenDotaPlayer[];
  objectives?: OpenDotaObjective[];
};
