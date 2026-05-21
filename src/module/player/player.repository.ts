import type { Selectable } from "kysely";

import type { PlayerBadges, PlayerProfiles, PlayerRanks, Players } from "../../db/types.js";
import type { CreatePlayerBody, ListPlayersQuery, UpdatePlayerBody } from "./player.schemas.js";

export type PlayerSummaryRecord = Pick<
  Selectable<Players>,
  "id" | "username" | "flags" | "orbs" | "chat_channel"
>;

export type PlayerRecord = Pick<
  Selectable<Players>,
  | "id"
  | "username"
  | "flags"
  | "orbs"
  | "chat_channel"
  | "last_server_id"
  | "created_at_ms"
  | "last_seen_at_ms"
>;

export type PlayerProfileRecord = Pick<
  Selectable<PlayerProfiles>,
  "bio" | "pronouns" | "featured_badge_id" | "locale" | "preferences"
>;

export type PlayerRankAssignmentRecord = Pick<Selectable<PlayerRanks>, "group_key" | "rank_key">;

export type PlayerBadgeAssignmentRecord = Pick<Selectable<PlayerBadges>, "badge_id">;

export type PlayerDetailsRecord = {
  player: PlayerRecord;
  profile: PlayerProfileRecord | null;
  rankAssignments: PlayerRankAssignmentRecord[];
  badgeAssignments: PlayerBadgeAssignmentRecord[];
};

export type CreatePlayerResult =
  | { status: "created"; player: PlayerDetailsRecord }
  | { status: "player_exists" };

export type DeletePlayerOptions = {
  hard: boolean;
};

export interface PlayerRepository {
  listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryRecord[]>;
  findPlayerById(id: string): Promise<PlayerDetailsRecord | null>;
  createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult>;
  updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerDetailsRecord | null>;
  deletePlayer(id: string, options: DeletePlayerOptions): Promise<boolean>;
}
