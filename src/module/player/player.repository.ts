import type { Selectable } from "kysely";

import type {
  PlayerBadges,
  PlayerNicknames,
  PlayerProfiles,
  PlayerRanks,
  Players,
} from "@/db/types.js";
import type {
  CreatePlayerBody,
  ListPlayersQuery,
  UpdatePlayerBody,
} from "@/module/player/player.schemas.js";

export type PlayerSummaryRecord = Pick<
  Selectable<Players>,
  "id" | "mojang_id" | "actor_id" | "username" | "flags" | "orbs" | "active_channel_key"
>;

export type PlayerSearchRecord = Pick<
  Selectable<Players>,
  "id" | "mojang_id" | "actor_id" | "username" | "deleted_at_ms"
> & {
  active_nickname: string | null;
  active_nickname_cover_rank_key: string | null;
};

export type PlayerRecord = Pick<
  Selectable<Players>,
  | "id"
  | "mojang_id"
  | "actor_id"
  | "username"
  | "flags"
  | "orbs"
  | "active_channel_key"
  | "last_server_id"
  | "created_at_ms"
  | "last_seen_at_ms"
> & {
  active_nickname: string | null;
  active_nickname_cover_rank_key: string | null;
};
export type PlayerIdentityRecord = Pick<
  Selectable<Players>,
  "id" | "mojang_id" | "actor_id" | "username"
>;

export type PlayerProfileRecord = Pick<
  Selectable<PlayerProfiles>,
  "bio" | "pronouns" | "featured_badge_id" | "locale" | "preferences"
>;

export type PlayerRankAssignmentRecord = Pick<Selectable<PlayerRanks>, "group_key" | "rank_key">;

export type PlayerBadgeAssignmentRecord = Pick<Selectable<PlayerBadges>, "badge_id">;
export type PlayerNicknameRecord = Selectable<PlayerNicknames>;

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

// Rank assignments
export type PlayerRankRow = Selectable<PlayerRanks>;
export type PlayerBadgeRow = Selectable<PlayerBadges>;
export type PlayerProfileRow = Selectable<PlayerProfiles>;

export interface PlayerRepository {
  listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryRecord[]>;
  findPlayerById(id: string): Promise<PlayerDetailsRecord | null>;
  createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult>;
  updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerDetailsRecord | null>;
  deletePlayer(id: string, options: DeletePlayerOptions): Promise<boolean>;
}
export class PlayerRanksRecord {}
