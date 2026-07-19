import { describe, expect, test } from "@jest/globals";

import {
  ServerInstancePgRepository,
  type ServerInstanceRow,
} from "../../../src/module/server-instance/server-instance.pg-repository.js";
import { createRecordingDb } from "../test-db.js";

const serverId = "00000000-0000-0000-0000-000000000001";
const instanceId = "00000000-0000-0000-0000-000000000002";
const oldInstanceId = "00000000-0000-0000-0000-000000000003";
const mojangIdA = "00000000-0000-0000-0000-000000000004";
const mojangIdB = "00000000-0000-0000-0000-000000000005";

function serverInstanceRow(input: Partial<ServerInstanceRow> = {}): ServerInstanceRow {
  return {
    id: input.id ?? instanceId,
    server_id: input.server_id ?? serverId,
    server_type: input.server_type ?? "velocity",
    state: input.state ?? "active",
    runtime_port: input.runtime_port ?? null,
    version: input.version ?? null,
    started_at_ms: input.started_at_ms ?? "1000",
    draining_at_ms: input.draining_at_ms ?? null,
    stopped_at_ms: input.stopped_at_ms ?? null,
    lost_at_ms: input.lost_at_ms ?? null,
    superseded_at_ms: input.superseded_at_ms ?? null,
    last_heartbeat_at_ms: input.last_heartbeat_at_ms ?? "1000",
    heartbeat_interval_ms: input.heartbeat_interval_ms ?? "60000",
    last_event_sequence: input.last_event_sequence ?? "0",
    is_synthetic_backfill: input.is_synthetic_backfill ?? false,
    created_at_ms: input.created_at_ms ?? "1000",
    updated_at_ms: input.updated_at_ms ?? null,
  };
}

describe("ServerInstancePgRepository", () => {
  test("registerInstance closes sessions owned by a superseded proxy instance", async () => {
    const { db, queries } = createRecordingDb([
      { rows: [{ id: serverId }] },
      { rows: [] },
      { rows: [{ id: oldInstanceId, server_type: "velocity" }] },
      { rows: [] },
      { rows: [] },
      { rows: [serverInstanceRow()] },
      { rows: [] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    const result = await repo.registerInstance(
      { serverId, bootId: "boot-1", heartbeatIntervalMs: 60_000 },
      "token-hash",
    );

    expect(result.status).toBe("created");
    const closeProxyIndex = queries.findIndex((query) =>
      query.sql.includes("UPDATE network_sessions"),
    );
    const insertInstanceIndex = queries.findIndex((query) =>
      query.sql.includes("INSERT INTO server_instances"),
    );

    expect(closeProxyIndex).toBeGreaterThan(-1);
    expect(closeProxyIndex).toBeLessThan(insertInstanceIndex);
    expect(queries[closeProxyIndex]?.sql).toContain("proxy_server_instance_id IN");
    expect(queries[closeProxyIndex]?.parameters).toContain("proxy_superseded");
  });

  test("registerInstance closes sessions owned by a superseded backend instance", async () => {
    const { db, queries } = createRecordingDb([
      { rows: [{ id: serverId }] },
      { rows: [] },
      { rows: [{ id: oldInstanceId, server_type: "paper" }] },
      { rows: [] },
      { rows: [] },
      { rows: [serverInstanceRow({ server_type: "paper" })] },
      { rows: [] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    await repo.registerInstance({ serverId, bootId: "boot-1" }, "token-hash");

    const closeBackendQuery = queries.find((query) =>
      query.sql.includes("UPDATE backend_sessions"),
    );

    expect(closeBackendQuery?.sql).toContain("backend_server_instance_id IN");
    expect(closeBackendQuery?.parameters).toContain("backend_superseded");
  });

  test("reconcilePresence closes proxy sessions absent from the observed player list", async () => {
    const { db, queries } = createRecordingDb([
      { rows: [{ id: instanceId }] },
      { rows: [{ id: instanceId }] },
      { rows: [] },
      { rows: [{ player_id: "player-a" }, { player_id: "player-b" }] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    const result = await repo.reconcilePresence(
      { id: instanceId, serverId, serverType: "velocity", state: "active" },
      {
        observedAtMs: "2000",
        snapshotSequence: 1,
        onlineMojangIds: [mojangIdA, mojangIdA, mojangIdB],
      },
    );

    const closeQuery = queries.find((query) => query.sql.includes("UPDATE network_sessions"));

    expect(result).toEqual({
      status: "active",
      serverInstanceId: instanceId,
      observedAtMs: "2000",
      observedPlayerCount: 2,
      closedNetworkSessionCount: 2,
      closedBackendSessionCount: 0,
      observedSessions: [],
      closedSessions: [{ playerId: "player-a" }, { playerId: "player-b" }],
    });
    expect(closeQuery?.sql).toContain("ns.proxy_server_instance_id");
    expect(closeQuery?.sql).toContain("uuid[]");
    expect(closeQuery?.sql).toContain("presence_absent");
    expect(closeQuery?.parameters).toContainEqual([mojangIdA, mojangIdB]);
  });

  test("reconcilePresence closes backend sessions absent from the observed player list", async () => {
    const { db, queries } = createRecordingDb([
      { rows: [{ id: instanceId }] },
      { rows: [{ id: instanceId }] },
      { rows: [{ player_id: "player-a" }] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    const result = await repo.reconcilePresence(
      { id: instanceId, serverId, serverType: "paper", state: "active" },
      { observedAtMs: "3000", snapshotSequence: 1, onlineMojangIds: [] },
    );

    const closeQuery = queries.find((query) => query.sql.includes("UPDATE backend_sessions"));

    expect(result).toEqual({
      status: "active",
      serverInstanceId: instanceId,
      observedAtMs: "3000",
      observedPlayerCount: 0,
      closedNetworkSessionCount: 0,
      closedBackendSessionCount: 1,
      observedSessions: [],
      closedSessions: [{ playerId: "player-a" }],
    });
    expect(closeQuery?.sql).toContain("bs.backend_server_instance_id");
    expect(closeQuery?.sql).toContain("uuid[]");
    expect(closeQuery?.sql).toContain("presence_absent");
    expect(closeQuery?.parameters).toContainEqual([]);
  });

  test("registerInstance with same bootId reuses the active instance without superseding", async () => {
    const { db, queries } = createRecordingDb([
      { rows: [{ id: serverId }] },
      { rows: [serverInstanceRow()] },
      { rows: [] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    const result = await repo.registerInstance({ serverId, bootId: "boot-1" }, "token-hash");

    expect(result.status).toBe("idempotent");
    expect(queries.some((query) => query.sql.includes("UPDATE server_instances"))).toBe(false);
    expect(queries.some((query) => query.sql.includes("server_instance_tokens"))).toBe(true);
  });

  test("processEvent enforces proxy ownership and backend attribution for backend connections", async () => {
    const networkSessionId = "00000000-0000-0000-0000-000000000006";
    const backendServerId = "00000000-0000-0000-0000-000000000007";
    const backendInstanceId = "00000000-0000-0000-0000-000000000008";
    const { db, queries } = createRecordingDb([
      { rows: [] },
      { rows: [{ last_event_sequence: "0" }] },
      { rows: [{ ok: 1 }] },
      { rows: [] },
      { rows: [{ id: "00000000-0000-0000-0000-000000000009" }] },
      { rows: [] },
      { rows: [] },
    ]);
    const repo = new ServerInstancePgRepository(db);

    const result = await repo.processEvent(
      { id: instanceId, serverId, serverType: "velocity", state: "active" },
      {
        eventId: "evt-1",
        sequence: 1,
        type: "BACKEND_CONNECTED",
        occurredAtMs: "2000",
        payload: { networkSessionId, backendServerId, backendServerInstanceId: backendInstanceId },
      },
      () => Promise.resolve(null),
    );

    expect(result.status).toBe("processed");
    expect(queries.some((query) => query.sql.includes("ns.proxy_server_instance_id"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("bsi.server_id = backend.id"))).toBe(true);
  });
});
