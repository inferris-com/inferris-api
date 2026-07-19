import { describe, expect, jest, test } from "@jest/globals";

import { ServerInstanceService } from "../../../src/module/server-instance/server-instance.service.js";

const serverId = "00000000-0000-0000-0000-000000000001";
const instanceId = "00000000-0000-0000-0000-000000000002";
const playerId = "00000000-0000-0000-0000-000000000003";
const closedPlayerId = "00000000-0000-0000-0000-000000000004";
const mojangId = "00000000-0000-0000-0000-000000000005";
const networkSessionId = "00000000-0000-0000-0000-000000000006";

function createRedis() {
  return {
    get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    set: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    del: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    expire: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
}

describe("ServerInstanceService", () => {
  test("processEvent issues a Redis-backed Minecraft session token for session starts", async () => {
    const repo = {
      processEvent: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        status: "processed",
        serverInstanceId: instanceId,
        eventId: "evt-1",
        sequence: "1",
        type: "NETWORK_SESSION_STARTED",
        closedSessions: [],
        startedSession: {
          actorId: playerId,
          playerId,
          mojangId,
          proxyServerId: serverId,
          networkSessionId,
        },
      }),
    };
    const redis = createRedis();
    redis.get.mockResolvedValue("old-token-hash");
    const service = new ServerInstanceService(repo as never, {} as never, redis as never);

    const result = await service.processEvent(
      { id: instanceId, serverId, serverType: "velocity", state: "active" },
      {
        eventId: "evt-1",
        sequence: 1,
        type: "NETWORK_SESSION_STARTED",
        occurredAtMs: "2000",
        payload: { networkSessionId, mojangId, username: "Developer" },
      },
    );

    expect(result.minecraftSession).toMatchObject({
      playerId,
      mojangId,
      proxyServerId: serverId,
      networkSessionId,
    });
    expect(result.minecraftSession?.token).toEqual(expect.any(String));
    expect(redis.del).toHaveBeenCalledWith("auth:minecraft-session:token:old-token-hash");
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:minecraft-session:token:/),
      expect.stringContaining(networkSessionId),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      `auth:minecraft-session:player:${playerId}`,
      expect.any(String),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
  });

  test("reconcilePresence refreshes observed tokens and revokes closed tokens", async () => {
    const repo = {
      reconcilePresence: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        status: "active",
        serverInstanceId: instanceId,
        observedAtMs: "2000",
        observedPlayerCount: 1,
        closedNetworkSessionCount: 1,
        closedBackendSessionCount: 0,
        observedSessions: [
          { actorId: playerId, playerId, mojangId, proxyServerId: serverId, networkSessionId },
        ],
        closedSessions: [{ playerId: closedPlayerId }],
      }),
    };
    const redis = createRedis();
    redis.get
      .mockResolvedValueOnce("closed-token-hash")
      .mockResolvedValueOnce("observed-token-hash");
    const service = new ServerInstanceService(repo as never, {} as never, redis as never);

    const result = await service.reconcilePresence(
      { id: instanceId, serverId, serverType: "velocity", state: "active" },
      { observedAtMs: "2000", snapshotSequence: 1, onlineMojangIds: [mojangId] },
    );

    expect(result.closedNetworkSessionCount).toBe(1);
    expect(redis.del).toHaveBeenCalledWith("auth:minecraft-session:token:closed-token-hash");
    expect(redis.del).toHaveBeenCalledWith(`auth:minecraft-session:player:${closedPlayerId}`);
    expect(redis.expire).toHaveBeenCalledWith(
      `auth:minecraft-session:player:${playerId}`,
      expect.any(Number),
    );
    expect(redis.expire).toHaveBeenCalledWith(
      "auth:minecraft-session:token:observed-token-hash",
      expect.any(Number),
    );
  });
});
