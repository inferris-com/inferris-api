import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "@/db/types.js";
import { up as createTables } from "@/db/migrations/20260506000000_create_dev_tables.js";
import { up as createIssues } from "@/db/migrations/20261116220340_create_issues.js";
import { IssuesPgRepository } from "@/module/issues/issues.pg-repository.js";
import { createIssueSchema, listIssuesQuerySchema } from "@/module/issues/issues.schemas.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseTests = databaseUrl ? describe : describe.skip;

databaseTests("Issues PostgreSQL lifecycle and migrations", () => {
  const schema = `issues_test_${randomUUID().replaceAll("-", "")}`;
  let admin: Kysely<unknown>;
  let db: Kysely<DB>;
  let migrationDb: Kysely<unknown>;
  let repo: IssuesPgRepository;
  let creator: string;
  let closer: string;
  let issueId: string;

  beforeAll(async () => {
    admin = new Kysely({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseUrl }) }),
    });
    await admin.schema.createSchema(schema).execute();
    migrationDb = new Kysely<unknown>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
          options: `-c search_path=${schema},public`,
        }),
      }),
    });
    db = migrationDb.withTables<{ [Table in keyof DB]: DB[Table] }>();
    await createTables(migrationDb);
    await createIssues(migrationDb);
    creator = (
      await db
        .insertInto("actors")
        .values({ type: "system", name: "Issue creator" })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    closer = (
      await db
        .insertInto("actors")
        .values({ type: "system", name: "Issue closer" })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    repo = new IssuesPgRepository(db);
  });

  afterAll(async () => {
    if (db) await db.destroy();
    if (admin) {
      await admin.schema.dropSchema(schema).ifExists().cascade().execute();
      await admin.destroy();
    }
  });

  test("create, search, assign, close, edit, reopen and close again", async () => {
    const issue = await repo.createIssue(
      createIssueSchema.parse({
        platform: "argus",
        title: "a".repeat(255),
        description: "Unique searchable crash",
      }),
      creator,
    );
    issueId = issue.id;
    expect(issue.closed_at_ms).toBeNull();
    const list = await repo.listIssues(
      listIssuesQuerySchema.parse({ search: "searchable crash", platform: "argus" }),
    );
    expect(list.total).toBe(1);
    expect(list.rows[0]?.id).toBe(issue.id);
    await repo.updateIssue(issue.id, { assignedToActorId: closer }, creator);
    const closed = await repo.updateIssue(issue.id, { status: "resolved" }, closer);
    expect(closed?.closed_by_actor_id).toBe(closer);
    expect(closed?.closed_at_ms).not.toBeNull();
    const edited = await repo.updateIssue(
      issue.id,
      { status: "closed", severity: "high" },
      creator,
    );
    expect(edited?.closed_by_actor_id).toBe(closer);
    expect(edited?.closed_at_ms).toBe(closed?.closed_at_ms);
    const reopened = await repo.updateIssue(
      issue.id,
      { status: "in_progress", assignedToActorId: null },
      creator,
    );
    expect(reopened?.closed_by_actor_id).toBeNull();
    expect(reopened?.closed_at_ms).toBeNull();
    expect(reopened?.assigned_to_actor_id).toBeNull();
    const reclosed = await repo.updateIssue(issue.id, { status: "invalid" }, creator);
    expect(reclosed?.closed_by_actor_id).toBe(creator);
  });

  test("database rejects invalid assignment and inconsistent closure", async () => {
    await expect(
      repo.updateIssue(issueId, { assignedToActorId: randomUUID() }, creator),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db.updateTable("issues").set({ closed_at_ms: null }).where("id", "=", issueId).execute(),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("missing updates return undefined", async () => {
    expect(await repo.updateIssue(randomUUID(), { title: "Missing" }, creator)).toBeUndefined();
  });

  test("fresh schema enforces required creators, platforms and closure metadata", async () => {
    await expect(
      sql`
        INSERT INTO
          issues (platform, title, description)
        VALUES
          ('minecraft', 'Missing creator', 'No actor')
      `.execute(db),
    ).rejects.toMatchObject({ code: "23502" });

    await expect(
      sql`
        INSERT INTO
          issues (title, description, created_by_actor_id)
        VALUES
          (
            'Missing platform',
            'No platform',
            ${creator}::uuid
          )
      `.execute(db),
    ).rejects.toMatchObject({ code: "23502" });

    await expect(
      sql`
        INSERT INTO
          issues (
            platform,
            title,
            description,
            status,
            created_by_actor_id
          )
        VALUES
          (
            'minecraft',
            'Terminal without closer',
            'No closure metadata',
            'resolved',
            ${creator}::uuid
          )
      `.execute(db),
    ).rejects.toMatchObject({ code: "23514" });

    expect((await repo.findIssueById(issueId))?.title).toHaveLength(255);
  });
});
