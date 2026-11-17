import { expect, jest, test } from "@jest/globals";
import {
  createIssueSchema,
  updateIssueSchema,
  listIssuesQuerySchema,
} from "@/module/issues/issues.schemas.js";
import { IssueService } from "@/module/issues/issues.service.js";
import { IssuesPgRepository } from "@/module/issues/issues.pg-repository.js";
import { createRecordingDb } from "@tests/unit/test-db.js";
import { openApiDocument } from "@/openapi/openapi.js";

const id = "00000000-0000-0000-0000-000000000001";
const actor = "00000000-0000-0000-0000-000000000002";
const input = createIssueSchema.parse({ platform: "argus", title: "Broken page" });
const row = {
  id,
  platform: "argus",
  title: "Broken page",
  description: "No description",
  status: "open",
  severity: null,
  created_by_actor_id: actor,
  assigned_to_actor_id: null,
  closed_by_actor_id: null,
  closed_at_ms: null,
  created_at_ms: "1000",
  updated_at_ms: null,
};

test("creation defaults status, severity and description and trims text", () => {
  expect(createIssueSchema.parse({ platform: "argus", title: "  Broken page  " })).toEqual(input);
  expect(createIssueSchema.safeParse({ ...input, title: "a".repeat(255) }).success).toBe(true);
  expect(createIssueSchema.safeParse({ ...input, title: "a".repeat(256) }).success).toBe(false);
});

test.each([
  {},
  { title: "   " },
  { closedByActorId: actor },
  { createdByActorId: actor },
  { status: "unknown" },
  { assignedToActorId: "bad" },
])("patch rejects invalid or privileged fields: %j", (value) => {
  expect(updateIssueSchema.safeParse(value).success).toBe(false);
});

test("patch preserves omissions and accepts explicit nulls", () => {
  expect(updateIssueSchema.parse({ title: "Updated" })).toEqual({ title: "Updated" });
  expect(
    updateIssueSchema.parse({ description: null, severity: null, assignedToActorId: null }),
  ).toEqual({ description: null, severity: null, assignedToActorId: null });
});

test.each([{ limit: 0 }, { offset: -1 }, { limit: 101 }, { search: " " }, { unknown: "x" }])(
  "list rejects invalid filters: %j",
  (value) => {
    expect(listIssuesQuerySchema.safeParse(value).success).toBe(false);
  },
);

test("repository creates a returned row with authenticated creator and description fallback", async () => {
  const { db, queries } = createRecordingDb([{ rows: [row] }]);
  expect(
    await new IssuesPgRepository(db).createIssue({ ...input, description: null }, actor),
  ).toEqual(row);
  expect(queries[0]?.sql).toContain('"created_by_actor_id"');
  expect(queries[0]?.sql).toContain("returning *");
  expect(queries[0]?.parameters).toContain(actor);
  expect(queries[0]?.parameters).toContain("No description");
});

test.each(["resolved", "duplicate", "invalid", "closed"] as const)(
  "creation stamps closure for %s",
  async (status) => {
    const { db, queries } = createRecordingDb([{ rows: [row] }]);
    await new IssuesPgRepository(db).createIssue({ ...input, status }, actor);
    expect(queries[0]?.sql).toMatch(/get_unix_ms\s*\(\)/);
    expect(queries[0]?.parameters.filter((value) => value === actor)).toHaveLength(2);
  },
);

test.each(["resolved", "duplicate", "invalid", "closed"] as const)(
  "patch atomically preserves first closure for %s",
  async (status) => {
    const { db, queries } = createRecordingDb([{ rows: [row] }]);
    await new IssuesPgRepository(db).updateIssue(id, { status }, actor);
    expect(queries[0]?.sql).toMatch(/coalesce\(\s*closed_by_actor_id,/);
    expect(queries[0]?.sql).toMatch(/coalesce\(closed_at_ms, get_unix_ms\s*\(\)\)/);
    expect(queries[0]?.parameters).toContain(actor);
    expect(queries[0]?.parameters).toContain(id);
  },
);

test("reopening clears both closure fields and sets update timestamp", async () => {
  const { db, queries } = createRecordingDb([{ rows: [row] }]);
  await new IssuesPgRepository(db).updateIssue(id, { status: "open" }, actor);
  expect(queries[0]?.parameters.filter((value) => value === null)).toHaveLength(2);
  expect(queries[0]?.sql).toMatch(/"updated_at_ms" = get_unix_ms\s*\(\)/);
});

test("partial patch clears nullable values without overwriting status or closure", async () => {
  const { db, queries } = createRecordingDb([{ rows: [row] }]);
  await new IssuesPgRepository(db).updateIssue(
    id,
    { severity: null, assignedToActorId: null },
    actor,
  );
  expect(queries[0]?.sql).not.toContain('"status" =');
  expect(queries[0]?.sql).not.toContain('"closed_at_ms" =');
  expect(queries[0]?.parameters).toEqual([null, null, id]);
});

test("list filters both count and rows with parameterized search and stable pagination", async () => {
  const { db, queries } = createRecordingDb([{ rows: [row] }, { rows: [{ total: "8" }] }]);
  const query = listIssuesQuerySchema.parse({
    platform: "argus",
    status: "open",
    severity: "high",
    createdByActorId: actor,
    assignedToActorId: actor,
    search: "broken ' page",
    limit: "2",
    offset: "3",
  });
  const result = await new IssuesPgRepository(db).listIssues(query);
  expect(result).toMatchObject({ total: 8, limit: 2, offset: 3 });
  expect(queries).toHaveLength(2);
  for (const query of queries) {
    expect(query.sql).toContain("plainto_tsquery('english', $");
    expect(query.sql).not.toContain("broken ' page");
    expect(query.parameters).toContain("broken ' page");
    expect(query.sql).toContain('"assigned_to_actor_id" =');
  }
  expect(queries[0]?.sql).toContain('order by "created_at_ms" desc, "id" desc');
});

test("service maps timestamps and missing issues to typed errors", async () => {
  const { db } = createRecordingDb([{ rows: [row] }, { rows: [] }, { rows: [] }]);
  const service = new IssueService(new IssuesPgRepository(db));
  expect(await service.getIssueById(id)).toMatchObject({
    createdAtMs: "1000",
    createdByActorId: actor,
    closedAtMs: null,
  });
  await expect(service.getIssueById(id)).rejects.toMatchObject({ code: "ISSUE_NOT_FOUND" });
  await expect(service.updateIssue(id, { title: "Updated" }, actor)).rejects.toMatchObject({
    code: "ISSUE_NOT_FOUND",
  });
});

test("service returns list envelope including totals for empty pages", async () => {
  const { db } = createRecordingDb([{ rows: [] }, { rows: [{ total: "8" }] }]);
  expect(
    await new IssueService(new IssuesPgRepository(db)).listIssues({ limit: 25, offset: 10 }),
  ).toEqual({ data: [], meta: { count: 0, total: 8, limit: 25, offset: 10 } });
});

test("service translates actor FK failures and propagates unexpected failures", async () => {
  const failure = new Error("offline");
  const repo = {
    createIssue: jest
      .fn<IssuesPgRepository["createIssue"]>()
      .mockRejectedValueOnce({ code: "23503" })
      .mockRejectedValueOnce(failure),
    updateIssue: jest.fn<IssuesPgRepository["updateIssue"]>().mockRejectedValue({ code: "23503" }),
  };
  const service = new IssueService(repo as unknown as IssuesPgRepository);
  await expect(service.createIssue(input, actor)).rejects.toMatchObject({
    code: "ISSUE_ACTOR_NOT_FOUND",
  });
  await expect(service.updateIssue(id, { assignedToActorId: actor }, actor)).rejects.toMatchObject({
    code: "ISSUE_ACTOR_NOT_FOUND",
  });
  await expect(service.createIssue(input, actor)).rejects.toBe(failure);
});

test("OpenAPI includes all Issues operations", () => {
  expect(openApiDocument.paths?.["/issues"]?.get?.operationId).toBe("listIssues");
  expect(openApiDocument.paths?.["/issues"]?.post?.operationId).toBe("createIssue");
  expect(openApiDocument.paths?.["/issues/{id}"]?.get?.operationId).toBe("getIssue");
  expect(openApiDocument.paths?.["/issues/{id}"]?.patch?.operationId).toBe("updateIssue");
});
