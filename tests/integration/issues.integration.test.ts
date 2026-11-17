import { expect, test } from "@jest/globals";
import { createTestApp, ids } from "@tests/integration/app-test-utils.js";
import { IssueNotFoundError } from "@/module/issues/issues.errors.js";

test("GET /issues validates and forwards filters with pagination defaults", async () => {
  const { dependencies, request } = createTestApp();
  dependencies.services.issues.listIssues.mockResolvedValue({ data: [], meta: { total: 0 } });
  const response = await request
    .get("/issues?status=open&platform=argus&search=broken")
    .set("Authorization", "Bearer moderator-token");
  expect(response.status).toBe(200);
  expect(dependencies.services.issues.listIssues).toHaveBeenCalledWith({
    status: "open",
    platform: "argus",
    search: "broken",
    limit: 25,
    offset: 0,
  });
});

test("POST /issues stamps actor and defaults and audits successful creation", async () => {
  const { dependencies, request } = createTestApp();
  dependencies.services.issues.createIssue.mockResolvedValue({ id: ids.report });
  const response = await request
    .post("/issues")
    .set("Authorization", "ApiKey service-actor-token")
    .send({ platform: "argus", title: "Broken page" });
  expect(response.status).toBe(201);
  expect(response.body).toEqual({ data: { id: ids.report } });
  expect(dependencies.services.issues.createIssue).toHaveBeenCalledWith(
    {
      platform: "argus",
      title: "Broken page",
      description: "No description",
      status: "open",
      severity: null,
    },
    ids.apiKeyOwnerActor,
  );
  expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
    expect.objectContaining({ action: "issue.create", actorId: ids.apiKeyOwnerActor }),
  );
});

test("PATCH /issues/:id forwards nulls and authenticated actor, and audits", async () => {
  const { dependencies, request } = createTestApp();
  dependencies.services.issues.updateIssue.mockResolvedValue({ id: ids.report });
  const response = await request
    .patch(`/issues/${ids.report}`)
    .set("Authorization", "Bearer moderator-token")
    .send({ status: "closed", assignedToActorId: null });
  expect(response.status).toBe(200);
  expect(dependencies.services.issues.updateIssue).toHaveBeenCalledWith(
    ids.report,
    { status: "closed", assignedToActorId: null },
    ids.actor,
  );
  expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
    expect.objectContaining({ action: "issue.update" }),
  );
});

test("GET /issues/:id wraps response and returns typed not found errors", async () => {
  const { dependencies, request } = createTestApp();
  dependencies.services.issues.getIssueById
    .mockResolvedValueOnce({ id: ids.report })
    .mockRejectedValueOnce(new IssueNotFoundError(ids.report));
  expect(
    (await request.get(`/issues/${ids.report}`).set("Authorization", "Bearer moderator-token"))
      .body,
  ).toEqual({ data: { id: ids.report } });
  const response = await request
    .get(`/issues/${ids.report}`)
    .set("Authorization", "Bearer moderator-token");
  expect(response.status).toBe(404);
  expect(response.body).toMatchObject({ error: { code: "ISSUE_NOT_FOUND" } });
});

test.each([
  {},
  { title: " " },
  { closedByActorId: ids.actor },
  { createdByActorId: ids.actor },
  { status: "bogus" },
])("PATCH rejects invalid input %j before service", async (body) => {
  const { dependencies, request } = createTestApp();
  expect(
    (
      await request
        .patch(`/issues/${ids.report}`)
        .set("Authorization", "Bearer moderator-token")
        .send(body)
    ).status,
  ).toBe(400);
  expect(dependencies.services.issues.updateIssue).not.toHaveBeenCalled();
});

test("invalid IDs and queries fail validation", async () => {
  const { request } = createTestApp();
  expect(
    (await request.get("/issues/nope").set("Authorization", "Bearer moderator-token")).status,
  ).toBe(400);
  expect(
    (await request.get("/issues?limit=101").set("Authorization", "Bearer moderator-token")).status,
  ).toBe(400);
});

test("unauthenticated and insufficient-scope reads are rejected", async () => {
  const { dependencies, request } = createTestApp();
  expect((await request.get("/issues")).status).toBe(401);
  expect((await request.get("/issues").set("Authorization", "ApiKey read-only-token")).status).toBe(
    403,
  );
  expect(dependencies.services.issues.listIssues).not.toHaveBeenCalled();
});

test("writes require an actor and authorized role", async () => {
  const { dependencies, request } = createTestApp();
  const body = { platform: "argus", title: "Broken page" };
  const response = await request
    .post("/issues")
    .set("Authorization", "ApiKey server-token")
    .send(body);
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({ error: { code: "ACTOR_REQUIRED" } });
  expect(
    (await request.post("/issues").set("Authorization", "ApiKey read-only-token").send(body))
      .status,
  ).toBe(403);
  expect(dependencies.services.issues.createIssue).not.toHaveBeenCalled();
});
