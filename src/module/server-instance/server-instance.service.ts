import { createServerInstanceToken } from "../auth/auth.crypto.js";
import type { PlayerService } from "../player/player.service.js";
import {
  ProxyInstanceRequiredError,
  ServerInstanceEventConflictError,
  ServerInstanceNotFoundError,
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
  ) {}

  async registerInstance(input: RegisterServerInstanceBody): Promise<RegisterServerInstanceResponse> {
    const token = createServerInstanceToken();
    const result = await this.repo.registerInstance(input, token.tokenHash);

    if (result.status === "not_found") {
      throw new ServerInstanceNotFoundError(input.serverId);
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
    return this.repo.heartbeat(auth, input);
  }

  async recordMetrics(
    auth: AuthenticatedServerInstance,
    input: ServerInstanceMetricsBody,
  ): Promise<ServerInstanceMetricsResponse> {
    return this.repo.recordMetrics(auth, input);
  }

  reconcilePresence(
    auth: AuthenticatedServerInstance,
    input: ServerInstancePresenceBody,
  ): Promise<ServerInstancePresenceResponse> {
    return Promise.resolve(this.repo.reconcilePresence(auth, input));
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

    return {
      serverInstanceId: result.serverInstanceId,
      eventId: result.eventId,
      sequence: result.sequence,
      type: result.type,
      idempotent: result.status === "idempotent",
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
      serverId: stringPayload(payload.backendServerId) ?? stringPayload(payload.proxyServerId) ?? "",
    });

    return {
      playerId: player.id,
      actorId: player.actor_id,
      mojangId: player.mojang_id,
    };
  }
}

function stringPayload(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
