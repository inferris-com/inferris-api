import { PlayerAlreadyExistsError, PlayerNotFoundError } from "./player.errors.js";
import {
  toPlayerProfileResponse,
  toPlayerRankAssignmentResponse,
  toPlayerResponse,
  toPlayerSummaryResponse,
} from "./player.mapper.js";
import type { DeletePlayerOptions } from "./player.repository.js";
import type {
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSummaryResponse,
} from "./player.response.types.js";
import type {
  CreatePlayerBody,
  ListPlayersQuery,
  ReplaceRankAssignmentBody,
  UpdatePlayerBody,
  UpdateProfileBody,
} from "./player.schemas.js";
import type { PlayerPgRepository } from "./player.pg-repository.js";

export class PlayerService {
  constructor(private readonly repository: PlayerPgRepository) {}

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

  async getProfile(playerId: string): Promise<PlayerProfileResponse> {
    const player = await this.repository.findProfileByPlayerId(playerId);

    if (!player) {
      throw new PlayerNotFoundError(playerId);
    }

    return toPlayerProfileResponse(player);
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

  async updateProfile(id: string, input: UpdateProfileBody): Promise<PlayerProfileResponse> {
    const player = await this.repository.updateProfile(id, input);

    if (!player) {
      throw new PlayerNotFoundError(id);
    }
    return toPlayerProfileResponse(player);
  }

  async updateRankAssignment(
    playerId: string,
    groupKey: string,
    rankKey: string,
    input: ReplaceRankAssignmentBody,
  ): Promise<PlayerRankAssignmentResponse> {
    const assignment = await this.repository.replaceRankAssignment(
      playerId,
      groupKey,
      rankKey,
      input,
    );

    if (!assignment) {
      throw new PlayerNotFoundError(playerId);
    }

    return toPlayerRankAssignmentResponse(assignment);
  }

  async deletePlayer(id: string, options: DeletePlayerOptions): Promise<void> {
    const deleted = await this.repository.deletePlayer(id, options);

    if (!deleted) {
      throw new PlayerNotFoundError(id);
    }
  }

  async deleteRankAssignment(playerId: string, groupKey: string, rankKey: string): Promise<void> {
    const deleted = await this.repository.deleteRankAssignment(playerId, groupKey, rankKey);

    if (!deleted) {
      throw new PlayerNotFoundError(playerId);
    }
  }
}
