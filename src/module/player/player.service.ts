import {
  BadgeNotFoundError,
  PlayerAlreadyExistsError,
  PlayerNicknameConflictError,
  PlayerNicknameNotFoundError,
  PlayerNotFoundError,
  PlayerUsernameConflictError,
  RankNotFoundError,
} from "@/module/player/player.errors.js";
import {
  encodePlayerFlags,
  toBitmaskResponse,
  toPlayerFlagDefinitionResponse,
  UnknownPlayerFlagError,
  type PlayerFlagBitmaskResponse,
  type PlayerFlagDefinitionResponse,
} from "@/module/player/player-flags.js";
import {
  toPlayerBadgeAssignmentResponse,
  toPlayerNicknameResponse,
  toPlayerProfileResponse,
  toPlayerRankAssignmentResponse,
  toPlayerResponse,
  toPlayerSearchResultResponse,
  toPlayerSummaryResponse,
} from "@/module/player/player.mapper.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerNicknameResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSearchResultResponse,
  PlayerSummaryResponse,
} from "@/module/player/player.response.types.js";
import type {
  CreatePlayerBody,
  CreatePlayerBadgeAssignmentBody,
  AssignPlayerNicknameBody,
  DecodePlayerFlagsQuery,
  EncodePlayerFlagsQuery,
  ListPlayersQuery,
  ListPlayerFlagDefinitionsQuery,
  ReplaceRankAssignmentInput,
  SearchPlayersQuery,
  UpdatePlayerBody,
  UpdateProfileBody,
} from "@/module/player/player.schemas.js";
import type { PlayerPgRepository } from "@/module/player/player.pg-repository.js";
import { ValidationError } from "@/error/app-error.js";
import { isPgErrorCode, PgErrorCode } from "@/shared/db/pg-error.utils.js";

export class PlayerService {
  constructor(private readonly repository: PlayerPgRepository) {}

  async listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryResponse[]> {
    const players = await this.repository.listPlayers(query);
    return players.map(toPlayerSummaryResponse);
  }

  async searchPlayers(query: SearchPlayersQuery): Promise<PlayerSearchResultResponse[]> {
    const players = await this.repository.searchPlayers(query);
    return players.map(toPlayerSearchResultResponse);
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
    const result = await this.repository.createPlayer(input).catch(rethrowIdentityConflict);

    if (result.status === "player_exists") {
      throw new PlayerAlreadyExistsError(input.mojangId);
    }

    return toPlayerResponse(result.player);
  }

  async ensureMinecraftPlayerIdentity(input: {
    mojangId: string;
    username: string;
    serverId: string;
  }) {
    return this.repository.ensureMinecraftPlayerIdentity(input).catch(rethrowIdentityConflict);
  }

  async getPlayerIdentityByMojangId(mojangId: string) {
    return this.repository.getPlayerIdentityByMojangId(mojangId);
  }

  async getPlayerByMojangId(mojangId: string): Promise<PlayerResponse> {
    const identity = await this.repository.getPlayerIdentityByMojangId(mojangId);

    if (!identity) {
      throw new PlayerNotFoundError(mojangId);
    }

    return this.getPlayer(identity.id);
  }

  async updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerResponse> {
    const player = await this.repository.updatePlayer(id, input).catch(rethrowIdentityConflict);

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

  async listNicknames(playerId: string): Promise<PlayerNicknameResponse[]> {
    const nicknames = await this.repository.listNicknames(playerId);

    if (!nicknames) {
      throw new PlayerNotFoundError(playerId);
    }

    return nicknames.map(toPlayerNicknameResponse);
  }

  async assignNickname(
    playerId: string,
    input: AssignPlayerNicknameBody,
  ): Promise<PlayerNicknameResponse> {
    const result = await this.repository.assignNickname(playerId, {
      nickname: input.nickname,
      coverRankKey: input.coverRankKey ?? null,
      meta: input.meta,
    });

    if (result.status === "player_not_found") {
      throw new PlayerNotFoundError(playerId);
    }

    if (result.status === "rank_not_found") {
      throw new RankNotFoundError(input.coverRankKey ?? "");
    }

    if (result.status === "nickname_conflict") {
      throw new PlayerNicknameConflictError(input.nickname);
    }

    return toPlayerNicknameResponse(result.nickname);
  }

  async revokeActiveNickname(
    playerId: string,
    revokedByActorId: string,
  ): Promise<PlayerNicknameResponse> {
    const result = await this.repository.revokeActiveNickname(playerId, revokedByActorId);

    if (result.status === "player_not_found") {
      throw new PlayerNotFoundError(playerId);
    }

    if (result.status === "nickname_not_found") {
      throw new PlayerNicknameNotFoundError(playerId);
    }

    return toPlayerNicknameResponse(result.nickname);
  }

  async deletePlayer(id: string): Promise<void> {
    const deleted = await this.repository.deletePlayer(id);

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

function rethrowIdentityConflict(error: unknown): never {
  if (
    isPgErrorCode(error, PgErrorCode.UniqueViolation) &&
    error.constraint === "players_username_key"
  ) {
    throw new PlayerUsernameConflictError();
  }
  throw error;
}
