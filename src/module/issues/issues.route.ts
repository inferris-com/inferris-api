import { Router, type RequestHandler } from "express";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import {
  authorize,
  requireActor,
  getRequestActorId,
  auditMutation,
} from "@/module/auth/auth.middleware.js";
import { validateRequest } from "@/middleware/validation.js";
import type { IssueService } from "@/module/issues/issues.service.js";
import {
  createIssueSchema,
  updateIssueSchema,
  issueParamsSchema,
  listIssuesQuerySchema,
  type ListIssuesQuery,
} from "@/module/issues/issues.schemas.js";

export function createIssuesRouter(service: IssueService, authRepository: AuthRepository): Router {
  const router = Router();
  const read = authorize(authRepository, {
    apiScopes: ["moderation:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const write = authorize(authRepository, {
    apiScopes: ["moderation:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  router.get(
    "/",
    read,
    validateRequest({ query: listIssuesQuerySchema }) as unknown as RequestHandler,
    async (req, res) => {
      res.json(await service.listIssues(req.query as unknown as ListIssuesQuery));
    },
  );
  router.get("/:id", read, validateRequest({ params: issueParamsSchema }), async (req, res) => {
    res.json({ data: await service.getIssueById(req.params.id) });
  });
  router.post(
    "/",
    write,
    requireActor(),
    auditMutation(authRepository, "issue.create"),
    validateRequest({ body: createIssueSchema }),
    async (req, res) => {
      res
        .status(201)
        .json({ data: await service.createIssue(req.body, getRequestActorId(req) ?? "") });
    },
  );
  router.patch(
    "/:id",
    write,
    requireActor(),
    auditMutation(authRepository, "issue.update"),
    validateRequest({ params: issueParamsSchema, body: updateIssueSchema }),
    async (req, res) => {
      res.json({
        data: await service.updateIssue(req.params.id, req.body, getRequestActorId(req) ?? ""),
      });
    },
  );
  return router;
}
