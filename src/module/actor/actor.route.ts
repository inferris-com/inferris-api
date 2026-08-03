import type { ActorService } from "@/module/actor/actor.service.js";
import { type RequestHandler, Router } from "express";
import {
  type ActorIdParams,
  actorIdParamsSchema,
  type ListActorsQuery,
  listActorsQuerySchema,
  type SearchActorsQuery,
  searchActorsQuerySchema,
  type UpdateActorBody,
  updateActorBodySchema,
} from "@/module/actor/actor.schemas.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import type { ActorResponse } from "@/module/actor/actor.response.types.js";
import { validateRequest } from "@/middleware/validation.js";
import { type PlayerIdParams, playerIdParamsSchema } from "@/module/player/player.schemas.js";
import { auditMutation, authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";

export function createActorRouter(service: ActorService, authRepository: AuthRepository): Router {
  const router = Router();

  const getActors: RequestHandler = async (req, res) => {
    const actors = await service.listActors(req.query as unknown as ListActorsQuery);
    const body: ApiListSuccess<ActorResponse> = {
      data: actors.data,
      meta: { count: actors.meta.count },
    };
    res.json(body);
  };

  const searchActors: RequestHandler = async (req, res) => {
    const actors = await service.searchActors(req.query as unknown as SearchActorsQuery);
    const body: ApiListSuccess<ActorResponse> = {
      data: actors,
      meta: { count: actors.length },
    };
    res.json(body);
  };

  const getActorById: RequestHandler<ActorIdParams> = async (req, res) => {
    const actor = await service.findActorById(req.params.actorId);
    const body: ApiSuccess<ActorResponse> = { data: actor };
    res.json(body);
  };

  const getActorByPlayerId: RequestHandler<PlayerIdParams> = async (req, res) => {
    const actor = await service.findActorByPlayerId(req.params.playerId);
    const body: ApiSuccess<ActorResponse> = { data: actor };
    res.json(body);
  };

  const patchActor: RequestHandler<ActorIdParams, unknown, UpdateActorBody> = async (req, res) => {
    const actor = await service.updateActorById(req.params.actorId, req.body);
    const body: ApiSuccess<ActorResponse> = { data: actor };
    res.json(body);
  };

  const readActors = authorize(authRepository, {
    apiScopes: ["actors:read"],
    argusRole: "moderator",
  });
  const writeActors = authorize(authRepository, {
    apiScopes: ["actors:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  router.get(
    "/by-player/:playerId",
    readActors,
    validateRequest({ params: playerIdParamsSchema }),
    getActorByPlayerId,
  );
  router.get(
    "/search",
    readActors,
    validateRequest({ query: searchActorsQuerySchema }) as unknown as RequestHandler,
    searchActors,
  );
  router.get(
    "/",
    readActors,
    validateRequest({ query: listActorsQuerySchema }) as unknown as RequestHandler,
    getActors,
  );
  router.get(
    "/:actorId",
    readActors,
    validateRequest({ params: actorIdParamsSchema }),
    getActorById,
  );
  router.patch(
    "/:actorId",
    writeActors,
    auditMutation(authRepository, "actors.update"),
    validateRequest({ params: actorIdParamsSchema, body: updateActorBodySchema }),
    patchActor,
  );

  return router;
}
