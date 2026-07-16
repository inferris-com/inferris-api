import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { GroupResponse } from "./group.response-types.js";
import {
  createGroupBodySchema,
  groupKeyParamsSchema,
  listGroupsQuerySchema,
  updateGroupBodySchema,
  type CreateGroupBody,
  type GroupKeyParams,
  type ListGroupsQuery,
  type UpdateGroupBody,
} from "./group.schemas.js";
import type { GroupService } from "./group.service.js";

export function createGroupRouter(service: GroupService, authRepository: AuthRepository): Router {
  const router = Router();
  const readGroups = authorize(authRepository, { apiScopes: ["players:read"], argusRole: "moderator" });
  const writeGroups = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listGroups: RequestHandler = async (req, res) => {
    const groups = await service.listGroups(req.query as unknown as ListGroupsQuery);
    const body: ApiListSuccess<GroupResponse> = { data: groups, meta: { count: groups.length } };
    res.json(body);
  };

  const getGroup: RequestHandler<GroupKeyParams> = async (req, res) => {
    const group = await service.getGroup(req.params.groupKey);
    const body: ApiSuccess<GroupResponse> = { data: group };
    res.json(body);
  };

  const createGroup: RequestHandler<Record<string, never>, unknown, CreateGroupBody> = async (
    req,
    res,
  ) => {
    const group = await service.createGroup(req.body);
    const body: ApiSuccess<GroupResponse> = { data: group };
    res.status(201).json(body);
  };

  const updateGroup: RequestHandler<GroupKeyParams, unknown, UpdateGroupBody> = async (req, res) => {
    const group = await service.updateGroup(req.params.groupKey, req.body);
    const body: ApiSuccess<GroupResponse> = { data: group };
    res.json(body);
  };

  const deleteGroup: RequestHandler<GroupKeyParams> = async (req, res) => {
    await service.deleteGroup(req.params.groupKey);
    res.status(204).send();
  };

  router.get(
    "/",
    readGroups,
    validateRequest({ query: listGroupsQuerySchema }) as unknown as RequestHandler,
    listGroups,
  );
  router.get(
    "/:groupKey",
    readGroups,
    validateRequest({ params: groupKeyParamsSchema }),
    getGroup,
  );
  router.post(
    "/",
    writeGroups,
    auditMutation(authRepository, "groups.create"),
    validateRequest({ body: createGroupBodySchema }),
    createGroup,
  );
  router.patch(
    "/:groupKey",
    writeGroups,
    auditMutation(authRepository, "groups.update"),
    validateRequest({ params: groupKeyParamsSchema, body: updateGroupBodySchema }),
    updateGroup,
  );
  router.delete(
    "/:groupKey",
    writeGroups,
    auditMutation(authRepository, "groups.delete"),
    validateRequest({ params: groupKeyParamsSchema }),
    deleteGroup,
  );

  return router;
}
