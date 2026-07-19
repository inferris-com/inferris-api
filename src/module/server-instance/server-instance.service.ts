import { config } from "../../config.js";
import type { RedisClient } from "../../redis/index.js";
import { createMinecraftSessionToken, createServerInstanceToken } from "../auth/auth.crypto.js";
import {
  minecraftSessionPlayerKey,
  minecraftSessionTokenKey,
  type MinecraftSessionState,
} from "../auth/auth.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { PlayerService } from "../player/player.service.js";
import {
  InvalidServerEventPayloadError,
  ServerInstanceInactiveError,
  ProxyInstanceRequiredError,
  ServerInstanceEventConflictError,
  ServerInstanceNotFoundError,
  ServerInstanceRegistrationForbiddenError,
  ServerInstanceSequenceGapError,
} from "./server-instance.errors.js";
import { toServerInstanceResponse } from "./server-instance.mapper.js";
import type { ServerInstancePgRepository } from "./server-instance.pg-repository.js";
import type {
  RegisterServerInstanceBody,
  ServerInstanceEventBody,
  ServerInstanceHeartbeatBody,
  ServerInstanceMetricsBody,
  ServerInstancePresenceBody,
} from "./server-instance.schemas.js";
import type {
  RegisterServerInstanceResponse,
  ServerInstanceEventResponse,
  ServerInstanceHeartbeatResponse,
  ServerInstanceMetricsResponse,
  ServerInstancePresenceResponse,
  ServerInstanceResponse,
} from "./server-instance.response-types.js";

type MinecraftSessionIssueInput = Omit<MinecraftSessionState, "issuedAtMs">;

export type AuthenticatedServerInstance = {
  id: string;
  serverId: string;
  serverType: string;
  state: string;
};

export class ServerInstanceService {
  constructor(
    private readonly repo: ServerInstancePgRepository,
    private readonly players: PlayerService,
    private readonly redis: RedisClient,
  ) {}

  async registerInstance(
    input: RegisterServerInstanceBody,
    auth: AuthContext | undefined,
  ): Promise<RegisterServerInstanceResponse> {
    const token = createServerInstanceToken();
    const result = await this.repo.registerInstance(input, token.tokenHash, {
      apiKeyId: auth?.apiKey?.id ?? null,
      bypassServerBinding: auth?.apiKey === undefined,
    });

    if (result.status === "not_found") {
      throw new ServerInstanceNotFoundError(input.serverId);
    }

    if (result.status === "forbidden") {
      throw new ServerInstanceRegistrationForbiddenError();
    }

    return {
      ...toServerInstanceResponse(result.instance),
      token: token.token,
    };
  }

  async getInstance(serverInstanceId: string): Promise<ServerInstanceResponse> {
    const instance = await this.repo.getInstance(serverInstanceId);

    if (!instance) {
      throw new ServerInstanceNotFoundError(serverInstanceId);
    }

    return toServerInstanceResponse(instance);
  }

  async heartbeat(
    auth: AuthenticatedServerInstance,
    input: ServerInstanceHeartbeatBody,
  ): Promise<ServerInstanceHeartbeatResponse> {
    const result = await this.repo.heartbeat(auth, input);

    if (result.status === "inactive") {
      throw new ServerInstanceInactiveError();
    }

    return result;
  }

  async recordMetrics(
    auth: AuthenticatedServerInstance,
    input: ServerInstanceMetricsBody,
  ): Promise<ServerInstanceMetricsResponse> {
    const result = await this.repo.recordMetrics(auth, input);

    if (result.status === "inactive") {
      throw new ServerInstanceInactiveError();
    }

    return result;
  }

  async reconcilePresence(
    auth: AuthenticatedServerInstance,
    input: ServerInstancePresenceBody,
  ): Promise<ServerInstancePresenceResponse> {
    const result = await this.repo.reconcilePresence(auth, input);

    if (result.status === "inactive") {
      throw new ServerInstanceInactiveError();
    }

    for (const session of result.closedSessions) {
      await this.revokeMinecraftSession(session.playerId);
    }

    for (const session of result.observedSessions) {
      await this.refreshMinecraftSession(session.playerId);
    }

    return {
      serverInstanceId: result.serverInstanceId,
      observedAtMs: result.observedAtMs,
      idempotent: result.status === "stale",
      observedPlayerCount: result.observedPlayerCount,
      closedNetworkSessionCount: result.closedNetworkSessionCount,
      closedBackendSessionCount: result.closedBackendSessionCount,
    };
  }

  async processEvent(
    auth: AuthenticatedServerInstance,
    input: ServerInstanceEventBody,
  ): Promise<ServerInstanceEventResponse> {
    const result = await this.repo.processEvent(auth, input, (payload) =>
      this.resolvePlayerIdentity(payload),
    );

    if (result.status === "sequence_gap") {
      throw new ServerInstanceSequenceGapError(result.expectedSequence);
    }

    if (result.status === "conflict") {
      throw new ServerInstanceEventConflictError();
    }

    if (result.status === "forbidden") {
      throw new ProxyInstanceRequiredError();
    }

    if (result.status === "inactive") {
      throw new ServerInstanceInactiveError();
    }

    if (result.status === "invalid") {
      throw new InvalidServerEventPayloadError(result.message);
    }

    for (const session of result.closedSessions) {
      await this.revokeMinecraftSession(session.playerId);
    }

    const minecraftSession = result.startedSession
      ? await this.issueMinecraftSession(result.startedSession)
      : undefined;

    return {
      serverInstanceId: result.serverInstanceId,
      eventId: result.eventId,
      sequence: result.sequence,
      type: result.type,
      idempotent: result.status === "idempotent",
      ...(minecraftSession ? { minecraftSession } : {}),
    };
  }

  private async resolvePlayerIdentity(payload: Record<string, unknown>) {
    const mojangId = stringPayload(payload.mojangId);
    const username = stringPayload(payload.username);

    if (!mojangId) {
      const playerId = stringPayload(payload.playerId);

      if (!playerId) {
        return null;
      }

      return {
        playerId,
        actorId: stringPayload(payload.actorId) ?? playerId,
        mojangId: stringPayload(payload.playerMojangId) ?? playerId,
      };
    }

    if (!username) {
      const player = await this.players.getPlayerIdentityByMojangId(mojangId);
      return player
        ? {
            playerId: player.id,
            actorId: player.actor_id,
            mojangId: player.mojang_id,
          }
        : null;
    }

    const player = await this.players.ensureMinecraftPlayerIdentity({
      mojangId,
      username,
      serverId:
        stringPayload(payload.backendServerId) ?? stringPayload(payload.proxyServerId) ?? "",
    });

    return {
      playerId: player.id,
      actorId: player.actor_id,
      mojangId: player.mojang_id,
    };
  }

  private async issueMinecraftSession(session: MinecraftSessionIssueInput) {
    const existingTokenHash = await this.redis.get(minecraftSessionPlayerKey(session.playerId));
    if (existingTokenHash) {
      await this.redis.del(minecraftSessionTokenKey(existingTokenHash));
    }

    const token = createMinecraftSessionToken();
    const issuedAtMs = Date.now();
    const state: MinecraftSessionState = {
      ...session,
      issuedAtMs,
    };

    await this.redis.set(minecraftSessionTokenKey(token.tokenHash), JSON.stringify(state), {
      EX: config.minecraft.sessionTtlSeconds,
    });
    await this.redis.set(minecraftSessionPlayerKey(session.playerId), token.tokenHash, {
      EX: config.minecraft.sessionTtlSeconds,
    });

    return {
      token: token.token,
      expiresAtMs: (issuedAtMs + config.minecraft.sessionTtlSeconds * 1000).toString(),
      playerId: session.playerId,
      mojangId: session.mojangId,
      proxyServerId: session.proxyServerId,
      networkSessionId: session.networkSessionId,
    };
  }

  private async refreshMinecraftSession(playerId: string): Promise<void> {
    const tokenHash = await this.redis.get(minecraftSessionPlayerKey(playerId));

    if (!tokenHash) {
      return;
    }

    await this.redis.expire(
      minecraftSessionPlayerKey(playerId),
      config.minecraft.sessionTtlSeconds,
    );
    await this.redis.expire(
      minecraftSessionTokenKey(tokenHash),
      config.minecraft.sessionTtlSeconds,
    );
  }

  private async revokeMinecraftSession(playerId: string): Promise<void> {
    const tokenHash = await this.redis.get(minecraftSessionPlayerKey(playerId));

    if (tokenHash) {
      await this.redis.del(minecraftSessionTokenKey(tokenHash));
    }

    await this.redis.del(minecraftSessionPlayerKey(playerId));
  }
}

function stringPayload(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
