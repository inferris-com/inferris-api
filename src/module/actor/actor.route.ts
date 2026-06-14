import type { ActorService } from "./actor.service.js";
import { type RequestHandler, Router } from "express";
import {
  type ActorIdParams,
  actorIdParamsSchema,
  type UpdateActorBody,
  updateActorBodySchema,
} from "./actor.schemas.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { ActorResponse } from "./actor.response.types.js";
import { validateRequest } from "../../middleware/validation.js";
import { type PlayerIdParams, playerIdParamsSchema } from "../player/player.schemas.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";

export function createActorRouter(service: ActorService, authRepository: AuthRepository): Router {
  const router = Router();

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
