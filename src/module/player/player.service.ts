import {
  BadgeNotFoundError,
  PlayerAlreadyExistsError,
  PlayerNotFoundError,
} from "./player.errors.js";
import {
  encodePlayerFlags,
  toBitmaskResponse,
  toPlayerFlagDefinitionResponse,
  UnknownPlayerFlagError,
  type PlayerFlagBitmaskResponse,
  type PlayerFlagDefinitionResponse,
} from "./player-flags.js";
import {
  toPlayerBadgeAssignmentResponse,
  toPlayerProfileResponse,
  toPlayerRankAssignmentResponse,
  toPlayerResponse,
  toPlayerSummaryResponse,
} from "./player.mapper.js";
import type { DeletePlayerOptions } from "./player.repository.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSummaryResponse,
} from "./player.response.types.js";
import type {
  CreatePlayerBody,
  CreatePlayerBadgeAssignmentBody,
  DecodePlayerFlagsQuery,
  EncodePlayerFlagsQuery,
  ListPlayersQuery,
  ListPlayerFlagDefinitionsQuery,
  ReplaceRankAssignmentInput,
  UpdatePlayerBody,
  UpdateProfileBody,
} from "./player.schemas.js";
import type { PlayerPgRepository } from "./player.pg-repository.js";
import { ValidationError } from "../../error/app-error.js";

export class PlayerService {
  constructor(private readonly repository: PlayerPgRepository) {}

  async listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryResponse[]> {
    const players = await this.repository.listPlayers(query);
    return players.map(toPlayerSummaryResponse);
  }

  async listFlagDefinitions(
    query: ListPlayerFlagDefinitionsQuery,
  ): Promise<PlayerFlagDefinitionResponse[]> {
    const definitions = await this.repository.listFlagDefinitions(query.includeInactive);

    return definitions.map(toPlayerFlagDefinitionResponse);
  }

  async encodeFlags(query: EncodePlayerFlagsQuery): Promise<PlayerFlagBitmaskResponse> {
    const definitions = await this.repository.listFlagDefinitions(query.includeInactive);

    try {
      return toBitmaskResponse(definitions, encodePlayerFlags(definitions, query.flags));
    } catch (error) {
      if (error instanceof UnknownPlayerFlagError) {
        throw new ValidationError({
          code: "UNKNOWN_PLAYER_FLAG",
          message: error.message,
          details: {
            flagKey: error.flagKey,
            knownFlags: error.knownFlags,
          },
        });
      }

      throw error;
    }
  }

  async decodeFlags(query: DecodePlayerFlagsQuery): Promise<PlayerFlagBitmaskResponse> {
    const definitions = await this.repository.listFlagDefinitions(query.includeInactive);

    return toBitmaskResponse(definitions, BigInt(query.value));
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

  async listBadgeAssignments(playerId: string): Promise<PlayerBadgeAssignmentResponse[]> {
    const badges = await this.repository.listBadgeAssignments(playerId);

    if (!badges) {
      throw new PlayerNotFoundError(playerId);
    }

    return badges.map(toPlayerBadgeAssignmentResponse);
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
    input: ReplaceRankAssignmentInput,
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

  async createBadgeAssignment(
    playerId: string,
    input: CreatePlayerBadgeAssignmentBody,
  ): Promise<PlayerBadgeAssignmentResponse> {
    const result = await this.repository.createBadgeAssignment(playerId, input);

    if (result.status === "player_not_found") {
      throw new PlayerNotFoundError(playerId);
    }

    if (result.status === "badge_not_found") {
      throw new BadgeNotFoundError(input.badgeId);
    }

    return toPlayerBadgeAssignmentResponse(result.badge);
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

  async deleteBadgeAssignment(playerId: string, badgeId: number): Promise<void> {
    const result = await this.repository.deleteBadgeAssignment(playerId, badgeId);

    if (result.status === "player_not_found") {
      throw new PlayerNotFoundError(playerId);
    }

    if (result.status === "badge_not_found") {
      throw new BadgeNotFoundError(badgeId);
    }
  }
}
