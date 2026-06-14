import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import {
  type CreateLockdownBody,
  createLockdownBodySchema,
  type CreateServerBody,
  createServerBodySchema,
  type ReplaceServerAccessBody,
  replaceServerAccessBodySchema,
  type ServerIdParamsSchema,
  serverIdParamsSchema,
  type UpdateLockdownBody,
  updateLockdownBodySchema,
  type UpdateServerBody,
  updateServerBodySchema,
} from "./server.schemas.js";
import type { ServerService } from "./server.service.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";

export function createServerRouter(service: ServerService, authRepository: AuthRepository): Router {
  const router = Router();

  const createServer: RequestHandler = async (req, res) => {
    const server = await service.createServer(req.body as CreateServerBody);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const createLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.createLockdown(req.params.serverId, {
      ...(req.body as CreateLockdownBody),
      issuedByActorId: req.auth?.actorId ?? "",
    });
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  const getServer: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getServer(req.params.serverId);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const patchServer: RequestHandler<ServerIdParamsSchema, unknown, UpdateServerBody> = async (
    req,
    res,
  ) => {
    const server = await service.patchServer(req.params.serverId, req.body);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const updateAccessPolicy: RequestHandler<
    ServerIdParamsSchema,
    unknown,
    ReplaceServerAccessBody
  > = async (req, res) => {
    const policy = await service.updateAccessPolicy(req.params.serverId, req.body);
    const body: ApiSuccess<AccessResponse> = { data: policy };

    res.json(body);
  };

  const patchLockdown: RequestHandler<ServerIdParamsSchema, unknown, UpdateLockdownBody> = async (
    req,
    res,
  ) => {
    const server = await service.patchLockdown(req.params.serverId, req.body);
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  const getAccessPolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getAccessPolicy(req.params.serverId);
    const body: ApiSuccess<AccessResponse> = { data: server };

    res.json(body);
  };

  const getLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getLockdownByServer(req.params.serverId);
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  const deleteServer: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    await service.deleteServer(req.params.serverId);

    res.status(204).send();
  };

  const deletePolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    await service.deletePolicy(req.params.serverId);

    res.status(204).send();
  };

  const deleteLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    await service.deleteLockdown(req.params.serverId);

    res.status(204).send();
  };

  const readServers = authorize(authRepository, {
    apiScopes: ["servers:read"],
    privilegedRole: "moderator",
    argusRole: "moderator",
  });
  const writeServers = authorize(authRepository, {
    apiScopes: ["servers:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });
  const manageLockdowns = authorize(authRepository, {
    apiScopes: ["servers:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  router.post(
    "/",
    writeServers,
    auditMutation(authRepository, "servers.create"),
    validateRequest({ body: createServerBodySchema }),
    createServer,
  );
  router.post(
    "/:serverId/lockdown",
    manageLockdowns,
    auditMutation(authRepository, "servers.lockdowns.create"),
    validateRequest({ params: serverIdParamsSchema, body: createLockdownBodySchema }),
    createLockdown,
  );
  router.put(
    "/:serverId/access",
    writeServers,
    auditMutation(authRepository, "servers.access.replace"),
    validateRequest({ params: serverIdParamsSchema, body: replaceServerAccessBodySchema }),
    updateAccessPolicy,
  );
  router.patch(
    "/:serverId",
    writeServers,
    auditMutation(authRepository, "servers.update"),
    validateRequest({ params: serverIdParamsSchema, body: updateServerBodySchema }),
    patchServer,
  );
  router.patch(
    "/:serverId/lockdown",
    manageLockdowns,
    auditMutation(authRepository, "servers.lockdowns.update"),
    validateRequest({ params: serverIdParamsSchema, body: updateLockdownBodySchema }),
    patchLockdown,
  );
  router.get(
    "/:serverId",
    readServers,
    validateRequest({ params: serverIdParamsSchema }),
    getServer,
  );
  router.get(
    "/:serverId/access",
    readServers,
    validateRequest({ params: serverIdParamsSchema }),
    getAccessPolicy,
  );
  router.get(
    "/:serverId/lockdown",
    readServers,
    validateRequest({ params: serverIdParamsSchema }),
    getLockdown,
  );
  router.delete(
    "/:serverId",
    writeServers,
    auditMutation(authRepository, "servers.delete"),
    validateRequest({ params: serverIdParamsSchema }),
    deleteServer,
  );
  router.delete(
    "/:serverId/lockdown",
    manageLockdowns,
    auditMutation(authRepository, "servers.lockdowns.delete"),
    validateRequest({ params: serverIdParamsSchema }),
    deleteLockdown,
  );
  router.delete(
    "/:serverId/access",
    writeServers,
    auditMutation(authRepository, "servers.access.delete"),
    validateRequest({ params: serverIdParamsSchema }),
    deletePolicy,
  );
  return router;
}
