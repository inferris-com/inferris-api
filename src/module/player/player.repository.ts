import type { CreatePlayerBody, ListPlayersQuery, UpdatePlayerBody } from "./player.schemas.js";
import type { PlayerResponse, PlayerSummaryResponse } from "./player.response.types.js";

export type CreatePlayerResult =
  | { status: "created"; player: PlayerResponse }
  | { status: "player_exists" };

export type DeletePlayerOptions = {
  hard: boolean;
};

export interface PlayerRepository {
  listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryResponse[]>;
  findPlayerById(id: string): Promise<PlayerResponse | null>;
  createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult>;
  updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerResponse | null>;
  deletePlayer(id: string, options: DeletePlayerOptions): Promise<boolean>;
}
