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

export function createServerRouter(service: ServerService): Router {
  const router = Router();

  const createServer: RequestHandler = async (req, res) => {
    const server = await service.createServer(req.body as CreateServerBody);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const createAccessPolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.createAccessPolicy(req.params.serverId, req.body as ReplaceServerAccessBody);
    const body: ApiSuccess<AccessResponse> = { data: server };

    res.json(body);
  };

  const createLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.createLockdown(req.params.serverId, req.body as CreateLockdownBody);
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  const getServer: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getServer(req.params.serverId);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const patchServer: RequestHandler<ServerIdParamsSchema, unknown, UpdateServerBody> = async (req, res) => {
    const server = await service.patchServer(req.params.serverId, req.body);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const updateAccessPolicy: RequestHandler<ServerIdParamsSchema, unknown, ReplaceServerAccessBody> = async (req, res) => {
    const policy = await service.updateAccessPolicy(req.params.serverId, req.body);
    const body: ApiSuccess<AccessResponse> = {data: policy};

    res.json(body);
  }

  const patchLockdown: RequestHandler<ServerIdParamsSchema, unknown, UpdateLockdownBody> = async (req, res) => {
    const server = await service.patchLockdown(req.params.serverId, req.body);
    const body: ApiSuccess<LockdownResponse> = {data: server};

    res.json(body);
  }

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
  }

  const deletePolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    await service.deletePolicy(req.params.serverId);

    res.status(204).send();
  }

  const deleteLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    await service.deleteLockdown(req.params.serverId);

    res.status(204).send();
  }

  router.post("/", validateRequest({ body: createServerBodySchema }), createServer);
  router.post("/:serverId/lockdown", validateRequest({ body: createLockdownBodySchema }), createLockdown);
  router.put("/:serverId/access", validateRequest({ body: replaceServerAccessBodySchema }), updateAccessPolicy);
  router.patch("/:serverId", validateRequest({ body: updateServerBodySchema }), patchServer);
  router.patch("/:serverId/lockdown", validateRequest({ body: updateLockdownBodySchema }), patchLockdown);
  router.get("/:serverId", validateRequest({ params: serverIdParamsSchema }), getServer);
  router.get("/:serverId/access", validateRequest({ params: serverIdParamsSchema }), getAccessPolicy);
  router.get("/:serverId/lockdown", validateRequest({ params: serverIdParamsSchema }), getLockdown);
  router.delete("/:serverId", validateRequest({ params: serverIdParamsSchema }), deleteServer);
  router.delete("/:serverId/lockdown", validateRequest({ params: serverIdParamsSchema }), deleteLockdown);
  router.delete("/:serverId/access", validateRequest({ params: serverIdParamsSchema }), deletePolicy);
  return router;
}
