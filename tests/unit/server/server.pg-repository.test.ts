import { describe, expect, test } from "@jest/globals";

import { ServerPgRepository } from "@/module/server/server.pg-repository.js";
import { createRecordingDb } from "@tests/unit/test-db.js";

describe("ServerPgRepository", () => {
  test("expireInactiveServers cleans open sessions left on already inactive instances", async () => {
    const { db, queries } = createRecordingDb([{ rows: [] }, { rows: [] }, { rows: [] }]);
    const repo = new ServerPgRepository(db);

    const expiredCount = await repo.expireInactiveServers("2000");

    expect(expiredCount).toBe(0);
    const cleanupNetworkQuery = queries.find((query) =>
      query.sql.includes("UPDATE network_sessions ns"),
    );
    const cleanupBackendQuery = queries.find((query) =>
      query.sql.includes("UPDATE backend_sessions bs"),
    );

    expect(cleanupNetworkQuery?.sql).toContain("si.state IN ('stopped', 'lost', 'superseded')");
    expect(cleanupNetworkQuery?.sql).toContain("proxy_superseded");
    expect(cleanupNetworkQuery?.sql).toContain("ns.disconnected_at_ms IS NULL");
    expect(cleanupBackendQuery?.sql).toContain("si.state IN ('stopped', 'lost', 'superseded')");
    expect(cleanupBackendQuery?.sql).toContain("backend_superseded");
    expect(cleanupBackendQuery?.sql).toContain("bs.left_at_ms IS NULL");
  });

  test("expireInactiveServers still closes sessions for stale active proxy and backend instances", async () => {
    const proxyInstanceId = "00000000-0000-0000-0000-000000000001";
    const backendInstanceId = "00000000-0000-0000-0000-000000000002";
    const { db, queries } = createRecordingDb([
      { rows: [] },
      { rows: [] },
      {
        rows: [
          { id: proxyInstanceId, type: "velocity" },
          { id: backendInstanceId, type: "paper" },
        ],
      },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 2 },
      { rows: [], rowCount: 2 },
    ]);
    const repo = new ServerPgRepository(db);

    const expiredCount = await repo.expireInactiveServers("2000");

    expect(expiredCount).toBe(2);
    expect(
      queries.some(
        (query) =>
          query.sql.includes('update "network_sessions"') &&
          query.sql.includes('"proxy_server_instance_id" in') &&
          query.parameters.includes("proxy_lost"),
      ),
    ).toBe(true);
    expect(
      queries.some(
        (query) =>
          query.sql.includes('update "backend_sessions"') &&
          query.sql.includes('"backend_server_instance_id" in') &&
          query.parameters.includes("backend_lost"),
      ),
    ).toBe(true);
  });
});
