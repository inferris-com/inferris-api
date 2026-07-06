import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import {
  auditMutation,
  authorize,
  getRequestActorId,
  requireActor,
} from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PunishmentResponse } from "./punishment.response-types.js";
import {
  type CreatePunishmentBody,
  createPunishmentBodySchema,
  type ListPunishmentsQuery,
  listPunishmentsQuerySchema,
  type PunishmentIdParams,
  punishmentIdParamsSchema,
  type RevokePunishmentBody,
  revokePunishmentBodySchema,
} from "./punishment.schemas.js";
import type { PunishmentListResponse, PunishmentService } from "./punishment.service.js";

export function createPunishmentRouter(
  service: PunishmentService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readPunishments = authorize(authRepository, {
    apiScopes: ["moderation:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const writePunishments = authorize(authRepository, {
    apiScopes: ["moderation:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const listPunishments: RequestHandler = async (req, res) => {
    const result = await service.listPunishments(req.query as unknown as ListPunishmentsQuery);
    res.json(result satisfies PunishmentListResponse);
  };

  const getPunishment: RequestHandler<PunishmentIdParams> = async (req, res) => {
    const punishment = await service.getPunishment(req.params.punishmentId);
    const body: ApiSuccess<PunishmentResponse> = { data: punishment };

    res.json(body);
  };

  const createPunishment: RequestHandler<ParamsDictionary, unknown, CreatePunishmentBody> = async (
    req,
    res,
  ) => {
    const punishment = await service.createPunishment(req.body, getRequestActorId(req) ?? "");
    const body: ApiSuccess<PunishmentResponse> = { data: punishment };

    res.status(201).json(body);
  };

  const revokePunishment: RequestHandler<
    PunishmentIdParams,
    unknown,
    RevokePunishmentBody
  > = async (req, res) => {
    const punishment = await service.revokePunishment(
      req.params.punishmentId,
      req.body,
      getRequestActorId(req) ?? "",
    );
    const body: ApiSuccess<PunishmentResponse> = { data: punishment };

    res.json(body);
  };

  router.get(
    "/",
    readPunishments,
    validateRequest({ query: listPunishmentsQuerySchema }) as unknown as RequestHandler,
    listPunishments,
  );
  router.get(
    "/:punishmentId",
    readPunishments,
    validateRequest({ params: punishmentIdParamsSchema }),
    getPunishment,
  );
  router.post(
    "/",
    writePunishments,
    requireActor(),
    auditMutation(authRepository, "punishments.create"),
    validateRequest({ body: createPunishmentBodySchema }),
    createPunishment,
  );
  router.post(
    "/:punishmentId/revoke",
    writePunishments,
    requireActor(),
    auditMutation(authRepository, "punishments.revoke"),
    validateRequest({ params: punishmentIdParamsSchema, body: revokePunishmentBodySchema }),
    revokePunishment,
  );

  return router;
}
