import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";

import type { DB } from "@/db/types.js";
import { up as createTables } from "@/db/migrations/20260506000000_create_dev_tables.js";
import { up as allowDisplayLabels } from "@/db/migrations/20260906000000_actor_display_labels.js";
import { ActorPgRepository } from "@/module/actor/actor.pg-repository.js";
import { PlayerPgRepository } from "@/module/player/player.pg-repository.js";
import { PlayerService } from "@/module/player/player.service.js";
import { PunishmentPgRepository } from "@/module/punishment/punishment.pg-repository.js";
import type { PunishmentPublisher } from "@/module/punishment/punishment.publisher.js";
import { PunishmentService } from "@/module/punishment/punishment.service.js";

// Explicit opt-in. All fixtures live in a disposable schema; no existing actors,
// accounts, credentials, or gameplay records are read or changed.
const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseTests = databaseUrl ? describe : describe.skip;

databaseTests("actor and player identity (PostgreSQL)", () => {
  const schema = `actor_identity_${randomUUID().replaceAll("-", "")}`;
  let admin: Kysely<DB>;
  let db: Kysely<DB>;
  let players: PlayerPgRepository;
  let service: PlayerService;
  let actors: ActorPgRepository;
  let punishments: PunishmentService;
  let serverId: string;
  let issuerActorId: string;

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
    await allowDisplayLabels(migrationDb);
    await db.insertInto("chat_channels").values({ key: "global" }).execute();
    await db.insertInto("groups").values({ key: "test", label: "Test" }).execute();
    await db
      .insertInto("ranks")
      .values({ key: "test", label: "Test", group_key: "test" })
      .execute();
    await db.insertInto("badges").values({ id: 1, key: "test", label: "Test" }).execute();
    serverId = (
      await db
        .insertInto("servers")
        .values({ name: "Test proxy" })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    issuerActorId = (
      await db
        .insertInto("actors")
        .values({ name: "Automation", type: "system" })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    players = new PlayerPgRepository(db);
    service = new PlayerService(players);
    actors = new ActorPgRepository(db);
    punishments = new PunishmentService(new PunishmentPgRepository(db), {
      publish: jest.fn<PunishmentPublisher["publish"]>().mockResolvedValue(undefined),
    } as unknown as PunishmentPublisher);
  }, 30_000);

  afterAll(async () => {
    if (db) await db.destroy();
    if (admin) {
      await admin.schema.dropSchema(schema).ifExists().cascade().execute();
      await admin.destroy();
    }
  });

  async function createPlayer(username: string) {
    return service.createPlayer({
      mojangId: randomUUID(),
      username,
      flags: "0",
      chatChannel: "global",
    });
  }

  test("a player never adopts an existing system or human actor with the same label", async () => {
    const player = await createPlayer("Automation");
    expect(player.actorId).not.toBe(issuerActorId);
    const otherActor = await db
      .insertInto("actors")
      .values({ name: "Unlinked", type: "user" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const identity = await players.ensureMinecraftPlayerIdentity({
      mojangId: randomUUID(),
      username: "Unlinked",
      serverId,
    });
    expect(identity.actor_id).not.toBe(otherActor.id);
    expect((await actors.findActorById(issuerActorId))?.type).toBe("system");
  });

  test("archival and explicit restoration preserve identity, gameplay state, and moderation history", async () => {
    const player = await createPlayer("Archived");
    await service.updatePlayer(player.id, { flags: "8", orbs: "1234" });
    await db
      .updateTable("player_profiles")
      .set({ bio: "Keep me" })
      .where("player_id", "=", player.id)
      .execute();
    await db
      .insertInto("player_ranks")
      .values({ player_id: player.id, group_key: "test", rank_key: "test" })
      .execute();
    await db.insertInto("player_badges").values({ player_id: player.id, badge_id: 1 }).execute();
    const punishment = await punishments.createPunishment(
      { subjectPlayerId: player.id, type: "ban", isSilent: false },
      issuerActorId,
    );

    await service.deletePlayer(player.id);
    expect(await players.findPlayerById(player.id)).toBeNull();
    expect((await actors.findActorById(player.actorId))?.player_id).toBe(player.id);
    expect(await players.deletePlayer(player.id)).toBe(false);

    const restored = await service.createPlayer({
      id: randomUUID(),
      mojangId: player.mojangId,
      username: "Restored",
      flags: "0",
      orbs: "500",
      chatChannel: "global",
    });
    expect(restored).toMatchObject({
      id: player.id,
      actorId: player.actorId,
      mojangId: player.mojangId,
      username: "Restored",
      flags: "8",
      orbs: "1234",
    });
    expect(
      await db
        .selectFrom("player_profiles")
        .select("bio")
        .where("player_id", "=", player.id)
        .executeTakeFirst(),
    ).toEqual({ bio: "Keep me" });
    expect(
      await db.selectFrom("player_ranks").selectAll().where("player_id", "=", player.id).execute(),
    ).toHaveLength(1);
    expect(
      await db.selectFrom("player_badges").selectAll().where("player_id", "=", player.id).execute(),
    ).toHaveLength(1);
    expect(await punishments.getPunishment(punishment.id)).toMatchObject({
      subjectActorId: player.actorId,
      issuerActorId,
      isActive: true,
    });
  });

  test("a returning Mojang identity restores the same actor and respects its independent display label", async () => {
    const player = await createPlayer("Returning");
    await actors.updateActorById(player.actorId, { name: "Staff display" });
    await service.deletePlayer(player.id);
    // Also cover archives made by the older implementation, which deleted profiles.
    await db.deleteFrom("player_profiles").where("player_id", "=", player.id).execute();
    const identity = await players.ensureMinecraftPlayerIdentity({
      mojangId: player.mojangId,
      username: "NewUsername",
      serverId,
    });
    expect(identity).toMatchObject({
      id: player.id,
      actor_id: player.actorId,
      mojang_id: player.mojangId,
      username: "NewUsername",
    });
    expect((await actors.findActorById(player.actorId))?.name).toBe("Staff display");
    expect(await service.getProfile(player.id)).toBeDefined();
  });

  test("a different Mojang identity cannot take over a player by presenting its username", async () => {
    const player = await createPlayer("Occupied");
    const countBefore = await db
      .selectFrom("actors")
      .select((eb) => eb.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();
    await expect(
      service.ensureMinecraftPlayerIdentity({
        mojangId: randomUUID(),
        username: player.username,
        serverId,
      }),
    ).rejects.toMatchObject({ code: "PLAYER_USERNAME_CONFLICT" });
    expect(await players.getPlayerIdentityByMojangId(player.mojangId)).toMatchObject({
      id: player.id,
      actor_id: player.actorId,
    });
    expect(
      await db
        .selectFrom("actors")
        .select((eb) => eb.fn.countAll().as("count"))
        .executeTakeFirstOrThrow(),
    ).toEqual(countBefore);

    // Once the old player renames, username reuse creates a distinct identity even
    // though the old actor retains that display label.
    await service.updatePlayer(player.id, { username: "MovedOn" });
    const newcomer = await service.ensureMinecraftPlayerIdentity({
      mojangId: randomUUID(),
      username: "Occupied",
      serverId,
    });
    expect(newcomer.id).not.toBe(player.id);
    expect(newcomer.actor_id).not.toBe(player.actorId);
  });

  test("actor edits preserve player links and names across list, search, lookup, and patch projections", async () => {
    const player = await createPlayer("Projection");
    const before = await actors.findActorById(player.actorId);
    const updated = await actors.updateActorById(player.actorId, { name: "Independent label" });
    expect(updated).toMatchObject({
      id: player.actorId,
      player_id: player.id,
      type: "user",
      created_at_ms: before?.created_at_ms,
    });
    expect(updated?.last_updated_at_ms).not.toBeNull();
    expect((await service.getPlayer(player.id)).username).toBe("Projection");
    expect(
      (await actors.listActors({ name: "Independent label", limit: 25, offset: 0 }))?.rows[0],
    ).toMatchObject({ player_id: player.id });
    expect((await actors.searchActors({ q: "Independent label", limit: 10 }))[0]).toMatchObject({
      player_id: player.id,
    });
    expect(await actors.updateActorById(player.actorId, { name: null })).toMatchObject({
      name: null,
      player_id: player.id,
    });
  });

  test("Minecraft punishments reject system and unlinked human targets, but allow system issuers and archived player targets", async () => {
    const unlinked = await db
      .insertInto("actors")
      .values({ name: "Staff only", type: "user" })
      .returning("id")
      .executeTakeFirstOrThrow();
    for (const subjectActorId of [issuerActorId, unlinked.id, randomUUID()]) {
      await expect(
        punishments.createPunishment(
          { subjectActorId, type: "kick", isSilent: false },
          issuerActorId,
        ),
      ).rejects.toMatchObject({ code: "INVALID_PUNISHMENT_SUBJECT" });
    }
    const player = await createPlayer("Moderated");
    await service.deletePlayer(player.id);
    const punishment = await punishments.createPunishment(
      { subjectActorId: player.actorId, type: "mute", isSilent: false },
      issuerActorId,
    );
    expect(punishment).toMatchObject({
      subjectActorId: player.actorId,
      issuerActorId,
      isActive: true,
    });
    expect(await punishments.revokePunishment(punishment.id, {}, issuerActorId)).toMatchObject({
      liftedByActorId: issuerActorId,
      isActive: false,
    });
  });

  test("migration changes only label uniqueness", async () => {
    const constraints = await sql<{ constraint_name: string }>`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = ${schema} AND table_name = 'players' AND constraint_type = 'UNIQUE'
    `.execute(db);
    expect(constraints.rows.map((row) => row.constraint_name)).toEqual(
      expect.arrayContaining([
        "players_actor_id_key",
        "players_mojang_id_key",
        "players_username_key",
      ]),
    );
  });
});
