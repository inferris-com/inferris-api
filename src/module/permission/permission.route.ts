import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PermissionService } from "./permission.service.js";
import {
  type CreatePermissionNodeBody,
  createPermissionNodeBodySchema,
  type PermissionKeyParams,
  permissionKeyParamsSchema,
  type PermissionRuleKeyParams,
  permissionRuleParamsSchema,
  type ReplacePermissionRuleBody,
  replacePermissionRuleBodySchema,
} from "./permission.schemas.js";
import type {
  PermissionNodeResponse,
  PermissionRuleResponse,
} from "./permission.response-types.js";
import type { ParamsDictionary } from "express-serve-static-core";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";

export function createPermissionRouter(
  service: PermissionService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const getPermissionNodeByKey: RequestHandler<PermissionKeyParams> = async (req, res) => {
    const node = await service.findPermissionByKey(req.params.permissionKey);
    const body: ApiSuccess<PermissionNodeResponse> = { data: node };
    res.json(body);
  };

  const getPermissionRuleByMinRank: RequestHandler<PermissionRuleKeyParams> = async (req, res) => {
    const node = await service.findPermissionRuleByMinRank(req.params.permissionKey);
    const body: ApiSuccess<PermissionRuleResponse> = { data: node };
    res.json(body);
  };

  const createPermissionNode: RequestHandler<
    ParamsDictionary,
    unknown,
    CreatePermissionNodeBody
  > = async (req, res) => {
    const node = await service.createPermissionNode(req.body);
    const body: ApiSuccess<PermissionNodeResponse> = { data: node };
    res.status(201).json(body);
  };

  const replacePermissionRule: RequestHandler<
    PermissionRuleKeyParams,
    unknown,
    ReplacePermissionRuleBody
  > = async (req, res) => {
    const rule = await service.replacePermissionRule(
      req.params.permissionKey,
      req.params.minRankKey,
      req.body,
    );
    const body: ApiSuccess<PermissionRuleResponse> = { data: rule };
    res.status(201).json(body);
  };

  const readPermissions = authorize(authRepository, {
    apiScopes: ["permissions:read"],
    argusRole: "moderator",
  });
  const writePermissions = authorize(authRepository, {
    apiScopes: ["permissions:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  router.get(
    "/:permissionKey",
    readPermissions,
    validateRequest({ params: permissionKeyParamsSchema }),
    getPermissionNodeByKey,
  );
  router.get(
    "/:permissionKey/rules/:minRankKey",
    readPermissions,
    validateRequest({ params: permissionRuleParamsSchema }),
    getPermissionRuleByMinRank,
  );
  router.post(
    "/",
    writePermissions,
    auditMutation(authRepository, "permissions.create"),
    validateRequest({ body: createPermissionNodeBodySchema }),
    createPermissionNode,
  );
  router.put(
    "/:permissionKey/rules/:minRankKey",
    writePermissions,
    auditMutation(authRepository, "permissions.rules.replace"),
    validateRequest({ params: permissionRuleParamsSchema, body: replacePermissionRuleBodySchema }),
    replacePermissionRule,
  );

  return router;
}
