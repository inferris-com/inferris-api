import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import { type ServerIdParamsSchema, serverIdParamsSchema } from "./server.schemas.js";
import type { ServerService } from "./server.service.js";

export function createServerRouter(service: ServerService): Router {
  const router = Router();

  const getServer: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getServer(req.params.id);
    const body: ApiSuccess<ServerResponse> = { data: server };

    res.json(body);
  };

  const getAccessPolicy: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getAccessPolicy(req.params.id);
    const body: ApiSuccess<AccessResponse> = { data: server };

    res.json(body);
  };

  const getLockdown: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await service.getLockdown(req.params.id);
    const body: ApiSuccess<LockdownResponse> = { data: server };

    res.json(body);
  };

  router.get("/:id", validateRequest({ params: serverIdParamsSchema }), getServer);
  router.get("/:id/access", validateRequest({ params: serverIdParamsSchema }), getAccessPolicy);
  router.get("/:id/lockdown", validateRequest({ params: serverIdParamsSchema }), getLockdown);
  return router;
}
