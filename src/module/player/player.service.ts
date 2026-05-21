import { PlayerAlreadyExistsError, PlayerNotFoundError } from "./player.errors.js";
import { toPlayerResponse, toPlayerSummaryResponse } from "./player.mapper.js";
import type { DeletePlayerOptions, PlayerRepository } from "./player.repository.js";
import type { PlayerResponse, PlayerSummaryResponse } from "./player.response.types.js";
import type { CreatePlayerBody, ListPlayersQuery, UpdatePlayerBody } from "./player.schemas.js";

export class PlayerService {
  constructor(private readonly repository: PlayerRepository) {}

  async listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryResponse[]> {
    const players = await this.repository.listPlayers(query);
    return players.map(toPlayerSummaryResponse);
  }

  async getPlayer(id: string): Promise<PlayerResponse> {
    const player = await this.repository.findPlayerById(id);

    if (!player) {
      throw new PlayerNotFoundError(id);
    }

    return toPlayerResponse(player);
  }

  async createPlayer(input: CreatePlayerBody): Promise<PlayerResponse> {
    const result = await this.repository.createPlayer(input);

    if (result.status === "player_exists") {
      throw new PlayerAlreadyExistsError(input.id);
    }

    return toPlayerResponse(result.player);
  }

  async updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerResponse> {
    const player = await this.repository.updatePlayer(id, input);

    if (!player) {
      throw new PlayerNotFoundError(id);
    }

    return toPlayerResponse(player);
  }

  async deletePlayer(id: string, options: DeletePlayerOptions): Promise<void> {
    const deleted = await this.repository.deletePlayer(id, options);

    if (!deleted) {
      throw new PlayerNotFoundError(id);
    }
  }
}
