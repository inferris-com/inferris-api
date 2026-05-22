import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import {
  type CreateServerBody,
  createServerBodySchema,
  type ServerIdParamsSchema,
  serverIdParamsSchema,
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

  const getAccessPolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getAccessPolicy(req.params.serverId);
    const body: ApiSuccess<AccessResponse> = { data: server };

    res.json(body);
  };

  const getLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getLockdown(req.params.serverId);
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  router.post("/", validateRequest({ body: createServerBodySchema }), createServer);
  router.patch("/:serverId", validateRequest({ body: updateServerBodySchema }), patchServer);
  router.get("/:serverId", validateRequest({ params: serverIdParamsSchema }), getServer);
  router.get("/:serverId/access", validateRequest({ params: serverIdParamsSchema }), getAccessPolicy);
  router.get("/:serverId/lockdown", validateRequest({ params: serverIdParamsSchema }), getLockdown);
  return router;
}
