import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import request from "supertest";

import type { DB } from "@/db/types.js";
import { up as createTables } from "@/db/migrations/20260506000000_create_dev_tables.js";
import { ServerPgRepository } from "@/module/server/server.pg-repository.js";
import { ServerService } from "@/module/server/server.service.js";
import type { RedisClient } from "@/redis/index.js";
import type { PlayerService } from "@/module/player/player.service.js";
import type { AuthenticatedCreateLockdownBody } from "@/module/server/server.schemas.js";
import { lockdownResponseSchema } from "@/module/server/server.response.types.js";
import type { AppDependencies } from "@/app/app.dependencies.js";
import { createApp } from "@/server.js";
import { createTestDependencies } from "@tests/integration/app-test-utils.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseTests = databaseUrl ? describe : describe.skip;

databaseTests("server policies and lockdowns (PostgreSQL)", () => {
  const schema = `server_policy_${randomUUID().replaceAll("-", "")}`;
  let admin: Kysely<DB>;
  let db: Kysely<DB>;
  let repo: ServerPgRepository;
  let service: ServerService;
  let issuer: string;

  beforeAll(async () => {
    admin = new Kysely<DB>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseUrl }) }),
    });
    await admin.schema.createSchema(schema).execute();
    const migrationDb = new Kysely<unknown>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
          options: `-c search_path=${schema},public`,
        }),
      }),
    });
    db = migrationDb.withTables<{ [Table in keyof DB]: DB[Table] }>();
    await createTables(migrationDb);
    await db.insertInto("groups").values({ key: "test", label: "Test" }).execute();
    await db
      .insertInto("ranks")
      .values({ key: "test", label: "Test", group_key: "test" })
      .execute();
    issuer = (
      await db
        .insertInto("actors")
        .values({ name: "Policy tests", type: "system" })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    repo = new ServerPgRepository(db);
    service = new ServerService(repo, {} as RedisClient, {} as PlayerService);
  }, 30_000);

  afterAll(async () => {
    if (db) await db.destroy();
    if (admin) {
      await admin.schema.dropSchema(schema).ifExists().cascade().execute();
      await admin.destroy();
    }
  });

  async function server() {
    return service.createServer({
      name: randomUUID(),
      type: "paper",
      environment: "development",
      port: null,
    });
  }

  function lockdown(
    overrides: Partial<AuthenticatedCreateLockdownBody> = {},
  ): AuthenticatedCreateLockdownBody {
    return {
      scope: "local",
      requiredRankKey: "test",
      reason: "Test",
      startsAtMs: "1000",
      isActive: true,
      issuedByActorId: issuer,
      ...overrides,
    };
  }

  const open = {
    mode: "open",
    requiredPermissionId: null,
    requiredRankKey: null,
    note: null,
  } as const;

  test("admin creation has open access; PUT recreates a deleted policy and replaces it repeatedly", async () => {
    const created = await server();
    expect(await service.getAccessPolicy(created.id)).toMatchObject({ mode: "open" });
    await service.deletePolicy(created.id);
    const first = await service.updateAccessPolicy(created.id, {
      ...open,
      mode: "min_rank",
      requiredRankKey: "test",
    });
    expect(first).toMatchObject({ mode: "min_rank", requiredRankKey: "test" });
    const replaced = await service.updateAccessPolicy(created.id, open);
    expect(replaced).toMatchObject({
      mode: "open",
      requiredRankKey: null,
      requiredPermissionId: null,
    });
    expect(replaced.createdAtMs).toBe(first.createdAtMs);
    expect(replaced.updatedAtMs).not.toBeNull();
  });

  test("HTTP policy lifecycle uses the real service and database", async () => {
    const dependencies = createTestDependencies();
    const client = request(
      createApp({
        ...dependencies,
        services: { ...dependencies.services, server: service },
      } as unknown as AppDependencies),
    );
    const auth = "ApiKey service-actor-token";
    const created = await client
      .post("/servers")
      .set("Authorization", auth)
      .send({ name: randomUUID(), type: "paper", environment: "development", port: null });
    expect(created.status).toBe(200);
    const serverId = (created.body as { data: { id: string } }).data.id;
    expect(
      (await client.delete(`/servers/${serverId}/access`).set("Authorization", auth)).status,
    ).toBe(204);
    const replaced = await client
      .put(`/servers/${serverId}/access`)
      .set("Authorization", auth)
      .send({ ...open, mode: "min_rank", requiredRankKey: "test" });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({ data: { requiredRankKey: "test" } });
    const invalid = await client
      .put(`/servers/${serverId}/access`)
      .set("Authorization", auth)
      .send({ ...open, mode: "min_rank", requiredRankKey: "missing" });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect((await client.delete(`/servers/${serverId}`).set("Authorization", auth)).status).toBe(
      204,
    );
    expect((await client.delete(`/servers/${serverId}`).set("Authorization", auth)).status).toBe(
      404,
    );
  });

  test("PUT on a legacy server without a policy creates exactly one row, including concurrent replacements", async () => {
    const created = await db
      .insertInto("servers")
      .values({ name: randomUUID() })
      .returning("id")
      .executeTakeFirstOrThrow();
    await Promise.all([
      service.updateAccessPolicy(created.id, open),
      service.updateAccessPolicy(created.id, open),
    ]);
    const rows = await db
      .selectFrom("server_access_policies")
      .selectAll()
      .where("server_id", "=", created.id)
      .execute();
    expect(rows).toHaveLength(1);
  });

  test("missing servers return 404 and unknown policy requirements return 400", async () => {
    await expect(service.updateAccessPolicy(randomUUID(), open)).rejects.toMatchObject({
      kind: "not_found",
    });
    const created = await server();
    await expect(
      service.updateAccessPolicy(created.id, {
        ...open,
        mode: "min_rank",
        requiredRankKey: "missing",
      }),
    ).rejects.toMatchObject({ kind: "validation" });
    await expect(
      service.updateAccessPolicy(created.id, {
        ...open,
        mode: "permission",
        requiredPermissionId: randomUUID(),
      }),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(await service.getAccessPolicy(created.id)).toMatchObject({ mode: "open" });
  });

  test("PATCH changes only the selected lockdown, preserves other servers and historical rows, and can reactivate", async () => {
    const a = await server();
    const b = await server();
    const historic = await service.createLockdown(
      a.id,
      lockdown({ isActive: false, reason: "History" }),
    );
    const current = await service.createLockdown(a.id, lockdown({ startsAtMs: "2000" }));
    const unrelated = await service.createLockdown(b.id, lockdown({ reason: "Other server" }));
    const updated = await service.patchLockdown(a.id, { reason: "Changed", isActive: false });
    expect(lockdownResponseSchema.safeParse(updated).success).toBe(true);
    expect(updated.id).toBe(current.id);
    expect(await service.getLockdownById(historic.id)).toMatchObject({
      reason: "History",
      isActive: false,
    });
    expect(await service.getLockdownById(unrelated.id)).toMatchObject({
      reason: "Other server",
      isActive: true,
    });
    expect(await service.patchLockdown(a.id, { isActive: true })).toMatchObject({
      id: current.id,
      isActive: true,
    });
  });

  test("future local and global lockdowns are excluded from active lookups", async () => {
    const created = await server();
    const future = (Date.now() + 60_000).toString();
    await service.createLockdown(created.id, lockdown({ startsAtMs: future }));
    expect(await repo.findLockdownByServerId(created.id)).toBeNull();
    const global = await service.createLockdown(
      created.id,
      lockdown({ scope: "global", startsAtMs: future }),
    );
    expect(global.serverId).toBeNull();
    expect(await repo.findActiveGlobalLockdown()).toBeNull();
    await db.deleteFrom("lockdowns").where("id", "=", global.id).execute();
  });

  test("duplicate active lockdown is 409; invalid time windows including partial PATCH are 400", async () => {
    const created = await server();
    await service.createLockdown(created.id, lockdown({ endsAtMs: "3000" }));
    await expect(service.createLockdown(created.id, lockdown())).rejects.toMatchObject({
      kind: "conflict",
    });
    await expect(service.patchLockdown(created.id, { startsAtMs: "4000" })).rejects.toMatchObject({
      kind: "validation",
    });
    expect(
      await repo.findLockdownByLockdownId(
        (await service.patchLockdown(created.id, { endsAtMs: null })).id,
      ),
    ).toMatchObject({ starts_at_ms: "1000", ends_at_ms: null });
    const other = await server();
    await expect(
      service.createLockdown(other.id, lockdown({ endsAtMs: "999" })),
    ).rejects.toMatchObject({ kind: "validation" });
    await expect(service.createLockdown(randomUUID(), lockdown())).rejects.toMatchObject({
      kind: "not_found",
    });
  });

  test("DELETE reports missing servers and missing child resources", async () => {
    for (const remove of [
      service.deleteServer.bind(service),
      service.deletePolicy.bind(service),
      service.deleteLockdown.bind(service),
    ]) {
      await expect(remove(randomUUID())).rejects.toMatchObject({ kind: "not_found" });
    }
    const created = await server();
    await service.deletePolicy(created.id);
    await expect(service.deletePolicy(created.id)).rejects.toMatchObject({ kind: "not_found" });
    await expect(service.deleteLockdown(created.id)).rejects.toMatchObject({ kind: "not_found" });
    await service.deleteServer(created.id);
    await expect(service.deleteServer(created.id)).rejects.toMatchObject({ kind: "not_found" });
  });

  test("name collisions and deletion of referenced servers return conflicts", async () => {
    const a = await server();
    const b = await server();
    await expect(service.patchServer(a.id, { name: b.name })).rejects.toMatchObject({
      kind: "conflict",
      code: "SERVER_ALREADY_EXISTS",
    });
    await db.insertInto("chat_channels").values({ key: "global" }).execute();
    await db
      .insertInto("chat_messages")
      .values({
        actor_id: issuer,
        producer_message_id: randomUUID(),
        message: "Test reference",
        channel_key: "global",
        origin_server_id: a.id,
      })
      .execute();
    await expect(service.deleteServer(a.id)).rejects.toMatchObject({
      kind: "conflict",
      code: "SERVER_IN_USE",
    });
    expect(await service.getServer(a.id)).toMatchObject({ name: a.name });
  });
});
