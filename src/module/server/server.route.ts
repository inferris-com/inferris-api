import { type RequestHandler, Router } from "express";
import type {ServerRepository} from "./server.repository.js";
import {serverIdParamsSchema, type ServerIdParamsSchema} from "./server.schemas.js";
import type {ApiSuccess} from "../../shared/http/api-response.types.js";
import type {ServerResponse} from "./server.response.types.js";
import {validateRequest} from "../../middleware/validation.js";
import { ServerNotFoundError } from "./server.errors.js";

type ServerReader = Pick<ServerRepository, "findServerById">;

// change dep to a service later
export function createServerRouter(repo: ServerReader): Router {
  const router = Router();

  const getServer: RequestHandler<ServerIdParamsSchema> = async (req, res) => {
    const server = await repo.findServerById(req.params.id);

    if (!server) {
      throw new ServerNotFoundError(req.params.id);
    }

    const body: ApiSuccess<ServerResponse> = {data: server};

    res.json(body);
  };

  router.get("/:id", validateRequest({ params: serverIdParamsSchema }), getServer);
  return router;
}
