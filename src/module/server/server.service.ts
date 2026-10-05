import {
  ServerAlreadyExistsError,
  ServerLockdownAlreadyExistsError,
  ServerNotFoundError,
} from "@/module/server/server.errors.js";
import {
  toAccessResponse,
  toLockdownResponse,
  toServerResponse,
} from "@/module/server/server.mapper.js";
import type {
  AccessResponse,
  LockdownResponse,
  NetworkSessionResponse,
  ServerHeartbeatResponse,
  BackendSessionResponse,
  ServerResponse,
} from "@/module/server/server.response.types.js";
import type { ServerPgRepository } from "@/module/server/server.pg-repository.js";
import type {
  AuthenticatedCreateLockdownBody,
  CreatePlayerSessionBody,
  CreateServerBody,
  ReplaceServerAccessBody,
  ServerHeartbeatBody,
  UpdateLockdownBody,
  UpdateServerBody,
} from "@/module/server/server.schemas.js";
import type { RedisClient } from "@/redis/index.js";
import { config } from "@/config.js";
import { createMinecraftSessionToken } from "@/module/auth/auth.crypto.js";
import {
  minecraftSessionPlayerKey,
  minecraftSessionTokenKey,
  type MinecraftSessionState,
} from "@/module/auth/auth.service.js";
import type { PlayerService } from "@/module/player/player.service.js";
import { ConflictError, ValidationError } from "@/error/app-error.js";
import { isPgErrorCode, PgErrorCode } from "@/shared/db/pg-error.utils.js";

export class ServerService {
  constructor(
    private readonly repo: ServerPgRepository,
    private readonly redis: RedisClient,
    private readonly players: PlayerService,
  ) {}

  async registerServer(input: CreateServerBody): Promise<ServerResponse> {
    const server = await this.repo.registerServer(input);

    return toServerResponse(server);
  }

  async listServers(): Promise<ServerResponse[]> {
    const servers = await this.repo.listServers();

    return servers.map(toServerResponse);
  }

  async startNetworkSession(
    serverId: string,
    input: CreatePlayerSessionBody,
  ): Promise<NetworkSessionResponse> {
    const server = await this.repo.findServerById(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    const player = await this.players.ensureMinecraftPlayerIdentity({
      mojangId: input.mojangId,
      username: input.username,
      serverId,
    });
    const session = await this.repo.startNetworkSession(serverId, {
      playerId: player.id,
      actorId: player.actor_id,
      mojangId: player.mojang_id,
    });

    if (!session) {
      throw new ServerNotFoundError(serverId);
    }

    const existingTokenHash = await this.redis.get(minecraftSessionPlayerKey(session.playerId));
    if (existingTokenHash) {
      await this.redis.del(minecraftSessionTokenKey(existingTokenHash));
    }

    const token = createMinecraftSessionToken();
    const issuedAtMs = Date.now();
    const state: MinecraftSessionState = {
      actorId: session.actorId,
      playerId: session.playerId,
      mojangId: session.mojangId,
      proxyServerId: session.proxyServerId,
      networkSessionId: session.networkSessionId,
      issuedAtMs,
    };

    await this.redis.set(minecraftSessionTokenKey(token.tokenHash), JSON.stringify(state), {
      EX: config.minecraft.sessionTtlSeconds,
    });
    await this.redis.set(minecraftSessionPlayerKey(session.playerId), token.tokenHash, {
      EX: config.minecraft.sessionTtlSeconds,
    });

    return {
      ...session,
      token: token.token,
      expiresAtMs: (issuedAtMs + config.minecraft.sessionTtlSeconds * 1000).toString(),
    };
  }

  async endNetworkSession(serverId: string, mojangId: string): Promise<void> {
    const player = await this.players.getPlayerIdentityByMojangId(mojangId);
    if (!player) {
      return;
    }

    const session = await this.repo.endNetworkSession(
      serverId,
      {
        playerId: player.id,
        actorId: player.actor_id,
        mojangId: player.mojang_id,
      },
      "disconnect",
    );

    if (!session) {
      return;
    }

    const tokenHash = await this.redis.get(minecraftSessionPlayerKey(session.playerId));
    if (tokenHash) {
      await this.redis.del(minecraftSessionTokenKey(tokenHash));
    }
    await this.redis.del(minecraftSessionPlayerKey(session.playerId));
  }

  async startBackendSession(
    serverId: string,
    input: CreatePlayerSessionBody,
  ): Promise<BackendSessionResponse> {
    const player = await this.players.getPlayerIdentityByMojangId(input.mojangId);
    if (!player) {
      throw new ServerNotFoundError(serverId);
    }

    const visit = await this.repo.startBackendSession(serverId, {
      playerId: player.id,
      actorId: player.actor_id,
      mojangId: player.mojang_id,
    });

    if (!visit) {
      throw new ServerNotFoundError(serverId);
    }

    return visit;
  }

  async endBackendSession(serverId: string, mojangId: string): Promise<void> {
    const player = await this.players.getPlayerIdentityByMojangId(mojangId);
    if (!player) {
      return;
    }

    await this.repo.endBackendSession(
      serverId,
      {
        playerId: player.id,
        actorId: player.actor_id,
        mojangId: player.mojang_id,
      },
      "leave",
    );
  }

  async startPlayerSession(
    serverId: string,
    input: CreatePlayerSessionBody,
  ): Promise<NetworkSessionResponse> {
    return this.startNetworkSession(serverId, input);
  }

  async endPlayerSession(serverId: string, mojangId: string): Promise<void> {
    await this.endNetworkSession(serverId, mojangId);
  }

  async heartbeat(serverId: string, input: ServerHeartbeatBody): Promise<ServerHeartbeatResponse> {
    const sessions = await this.repo.heartbeat(serverId, input);

    if (!sessions) {
      throw new ServerNotFoundError(serverId);
    }

    const refreshedMojangIds: string[] = [];
    const missing = new Set(input.onlineMojangIds);

    for (const session of sessions) {
      const playerKey = minecraftSessionPlayerKey(session.playerId);
      const tokenHash = await this.redis.get(playerKey);

      if (!tokenHash) {
        continue;
      }

      await this.redis.expire(playerKey, config.minecraft.sessionTtlSeconds);
      await this.redis.expire(
        minecraftSessionTokenKey(tokenHash),
        config.minecraft.sessionTtlSeconds,
      );
      refreshedMojangIds.push(session.mojangId);
      missing.delete(session.mojangId);
    }

    return {
      refreshedMojangIds,
      missingMojangIds: [...missing],
    };
  }

  async expireInactiveServers(): Promise<number> {
    const inactiveBeforeMs = (
      Date.now() -
      config.minecraft.heartbeatStaleSeconds * 1000
    ).toString();

    return this.repo.expireInactiveServers(inactiveBeforeMs);
  }

  async createServer(input: CreateServerBody): Promise<ServerResponse> {
    const result = await this.repo.createServer(input);

    if (result.status === "conflict") {
      throw new ServerAlreadyExistsError(input.name);
    }

    return toServerResponse(result.data);
  }

  async createAccessPolicy(
    serverId: string,
    input: ReplaceServerAccessBody,
  ): Promise<AccessResponse> {
    const result = await this.repo.createAccessPolicy(serverId, input);

    return toAccessResponse(result);
  }

  async createLockdown(
    serverId: string,
    input: AuthenticatedCreateLockdownBody,
  ): Promise<LockdownResponse> {
    if (!(await this.repo.findServerById(serverId))) {
      throw new ServerNotFoundError(serverId);
    }
    const result = await this.repo.createLockdown(serverId, input).catch((error: unknown) => {
      if (isPgErrorCode(error, PgErrorCode.UniqueViolation)) {
        throw new ServerLockdownAlreadyExistsError(serverId);
      }
      return rethrowServerInputError(error);
    });

    if (result.status === "conflict") {
      throw new ServerLockdownAlreadyExistsError(serverId);
    }

    return toLockdownResponse(result.data);
  }

  async patchServer(id: string, input: UpdateServerBody): Promise<ServerResponse> {
    const server = await this.repo.updateServerById(id, input).catch((error: unknown) => {
      if (isPgErrorCode(error, PgErrorCode.UniqueViolation)) {
        throw new ServerAlreadyExistsError(input.name ?? id);
      }
      throw error;
    });

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return toServerResponse(server);
  }

  async updateAccessPolicy(id: string, input: ReplaceServerAccessBody): Promise<AccessResponse> {
    const policy = await this.repo
      .updateAccessPolicyByServerId(id, input)
      .catch(rethrowServerInputError);

    if (!policy) {
      throw new ServerNotFoundError(id);
    }
    return toAccessResponse(policy);
  }

  async patchLockdown(id: string, input: UpdateLockdownBody): Promise<LockdownResponse> {
    const lockdown = await this.repo.updateLockdownByServerId(id, input).catch((error: unknown) => {
      if (isPgErrorCode(error, PgErrorCode.UniqueViolation)) {
        throw new ServerLockdownAlreadyExistsError(id);
      }
      return rethrowServerInputError(error);
    });

    if (!lockdown) {
      throw new ServerNotFoundError(id);
    }

    return toLockdownResponse(lockdown);
  }

  async getServer(id: string): Promise<ServerResponse> {
    const server = await this.repo.findServerById(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return toServerResponse(server);
  }

  async getServerByName(name: string): Promise<ServerResponse> {
    const server = await this.repo.findServerByName(name);

    if (!server) {
      throw new ServerNotFoundError(name);
    }

    return toServerResponse(server);
  }

  async getAccessPolicy(id: string): Promise<AccessResponse> {
    const server = await this.repo.findAccessPolicyByServerId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toAccessResponse(server);
  }

  async getLockdownByServer(id: string): Promise<LockdownResponse> {
    const server = await this.repo.findLockdownByServerId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toLockdownResponse(server);
  }

  async getActiveGlobalLockdown(): Promise<LockdownResponse> {
    const server = await this.repo.findActiveGlobalLockdown();

    if (!server) {
      throw new ServerNotFoundError("global");
    }
    return toLockdownResponse(server);
  }

  async getLockdownById(id: string): Promise<LockdownResponse> {
    const server = await this.repo.findLockdownByLockdownId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toLockdownResponse(server);
  }

  async deleteServer(id: string): Promise<boolean> {
    const server = await this.repo.deleteServerById(id).catch((error: unknown) => {
      if (
        isPgErrorCode(error, PgErrorCode.ForeignKeyViolation) ||
        isPgErrorCode(error, PgErrorCode.RestrictViolation)
      ) {
        throw new ConflictError({
          code: "SERVER_IN_USE",
          message: "Server is referenced by other records.",
        });
      }
      throw error;
    });

    if (server.status !== "deleted") {
      throw new ServerNotFoundError(id);
    }
    return true;
  }

  async deletePolicy(serverId: string): Promise<boolean> {
    const server = await this.repo.deletePolicyByServerId(serverId);

    if (server.status !== "deleted") {
      throw new ServerNotFoundError(serverId);
    }
    return true;
  }

  async deleteLockdown(serverId: string): Promise<boolean> {
    const server = await this.repo.deleteLockdownByServerId(serverId);

    if (server.status !== "deleted") {
      throw new ServerNotFoundError(serverId);
    }
    return true;
  }
}

function rethrowServerInputError(error: unknown): never {
  if (isPgErrorCode(error, PgErrorCode.ForeignKeyViolation)) {
    throw new ValidationError({
      code: "VALIDATION_ERROR",
      message: "Referenced server, rank, permission, or actor does not exist.",
    });
  }
  if (isPgErrorCode(error, PgErrorCode.CheckViolation)) {
    throw new ValidationError({
      code: "VALIDATION_ERROR",
      message: "Invalid access policy or lockdown requirements.",
    });
  }
  throw error;
}
