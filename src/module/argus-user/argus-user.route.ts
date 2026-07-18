import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { ArgusUserResponse } from "./argus-user.response-types.js";
import {
  argusUserParamsSchema,
  createArgusUserBodySchema,
  listArgusUsersQuerySchema,
  resolveArgusUsersQuerySchema,
  updateArgusUserBodySchema,
  type ArgusUserParams,
  type CreateArgusUserBody,
  type ListArgusUsersQuery,
  type ResolveArgusUsersQuery,
  type UpdateArgusUserBody,
} from "./argus-user.schemas.js";
import type { ArgusUserService } from "./argus-user.service.js";

type ArgusUserListSuccess = { data: ArgusUserResponse[]; meta: PaginatedResponse };

export function createArgusUserRouter(
  service: ArgusUserService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readArgusUsers = authorize(authRepository, {
    apiScopes: ["argus:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const manageArgusUsers = authorize(authRepository, {
    apiScopes: ["argus:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });
  const resolveArgusUsers = authorize(authRepository, {
    argusRole: "moderator",
  });

  const listUsers: RequestHandler = async (req, res) => {
    const result = await service.listUsers(req.query as unknown as ListArgusUsersQuery);
    const body: ArgusUserListSuccess = {
      data: result.rows,
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
    res.json(body);
  };
  const getUser: RequestHandler<ArgusUserParams> = async (req, res) => {
    const user = await service.getUser(req.params.userId);
    const body: ApiSuccess<ArgusUserResponse> = { data: user };
    res.json(body);
  };
  const resolveUsers: RequestHandler = async (req, res) => {
    const users = await service.resolveUsers(req.query as unknown as ResolveArgusUsersQuery);
    const body: ApiListSuccess<ArgusUserResponse> = {
      data: users,
      meta: { count: users.length },
    };
    res.json(body);
  };
  const createUser: RequestHandler<Record<string, never>, unknown, CreateArgusUserBody> = async (
    req,
    res,
  ) => {
    const user = await service.createUser(req.body);
    const body: ApiSuccess<ArgusUserResponse> = { data: user };
    res.status(201).json(body);
  };
  const updateUser: RequestHandler<ArgusUserParams, unknown, UpdateArgusUserBody> = async (
    req,
    res,
  ) => {
    const user = await service.updateUser(req.params.userId, req.body);
    const body: ApiSuccess<ArgusUserResponse> = { data: user };
    res.json(body);
  };
  const disableUser: RequestHandler<ArgusUserParams> = async (req, res) => {
    const user = await service.disableUser(req.params.userId);
    const body: ApiSuccess<ArgusUserResponse> = { data: user };
    res.json(body);
  };

  router.get(
    "/",
    readArgusUsers,
    validateRequest({ query: listArgusUsersQuerySchema }) as unknown as RequestHandler,
    listUsers,
  );
  router.get(
    "/resolve",
    resolveArgusUsers,
    validateRequest({ query: resolveArgusUsersQuerySchema }) as unknown as RequestHandler,
    resolveUsers,
  );
  router.get(
    "/:userId",
    readArgusUsers,
    validateRequest({ params: argusUserParamsSchema }),
    getUser,
  );
  router.post(
    "/",
    manageArgusUsers,
    auditMutation(authRepository, "argus-users.create"),
    validateRequest({ body: createArgusUserBodySchema }),
    createUser,
  );
  router.patch(
    "/:userId",
    manageArgusUsers,
    auditMutation(authRepository, "argus-users.update"),
    validateRequest({ params: argusUserParamsSchema, body: updateArgusUserBodySchema }),
    updateUser,
  );
  router.delete(
    "/:userId",
    manageArgusUsers,
    auditMutation(authRepository, "argus-users.disable"),
    validateRequest({ params: argusUserParamsSchema }),
    disableUser,
  );

  return router;
}
