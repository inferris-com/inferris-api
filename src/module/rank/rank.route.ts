import { type RequestHandler, Router } from "express";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import { auditMutation, authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type { RankResponse } from "@/module/rank/rank.response-types.js";
import {
  createRankBodySchema,
  listRanksQuerySchema,
  rankKeyParamsSchema,
  updateRankBodySchema,
  type CreateRankBody,
  type ListRanksQuery,
  type RankKeyParams,
  type UpdateRankBody,
} from "@/module/rank/rank.schemas.js";
import type { RankService } from "@/module/rank/rank.service.js";

export function createRankRouter(service: RankService, authRepository: AuthRepository): Router {
  const router = Router();
  const readRanks = authorize(authRepository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });
  const writeRanks = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listRanks: RequestHandler = async (req, res) => {
    const ranks = await service.listRanks(req.query as unknown as ListRanksQuery);
    const body: ApiListSuccess<RankResponse> = { data: ranks, meta: { count: ranks.length } };
    res.json(body);
  };
  const getRank: RequestHandler<RankKeyParams> = async (req, res) => {
    const rank = await service.getRank(req.params.rankKey);
    const body: ApiSuccess<RankResponse> = { data: rank };
    res.json(body);
  };
  const createRank: RequestHandler<Record<string, never>, unknown, CreateRankBody> = async (
    req,
    res,
  ) => {
    const rank = await service.createRank(req.body);
    const body: ApiSuccess<RankResponse> = { data: rank };
    res.status(201).json(body);
  };
  const updateRank: RequestHandler<RankKeyParams, unknown, UpdateRankBody> = async (req, res) => {
    const rank = await service.updateRank(req.params.rankKey, req.body);
    const body: ApiSuccess<RankResponse> = { data: rank };
    res.json(body);
  };
  const deleteRank: RequestHandler<RankKeyParams> = async (req, res) => {
    await service.deleteRank(req.params.rankKey);
    res.status(204).send();
  };

  router.get(
    "/",
    readRanks,
    validateRequest({ query: listRanksQuerySchema }) as unknown as RequestHandler,
    listRanks,
  );
  router.get("/:rankKey", readRanks, validateRequest({ params: rankKeyParamsSchema }), getRank);
  router.post(
    "/",
    writeRanks,
    auditMutation(authRepository, "ranks.create"),
    validateRequest({ body: createRankBodySchema }),
    createRank,
  );
  router.patch(
    "/:rankKey",
    writeRanks,
    auditMutation(authRepository, "ranks.update"),
    validateRequest({ params: rankKeyParamsSchema, body: updateRankBodySchema }),
    updateRank,
  );
  router.delete(
    "/:rankKey",
    writeRanks,
    auditMutation(authRepository, "ranks.delete"),
    validateRequest({ params: rankKeyParamsSchema }),
    deleteRank,
  );

  return router;
}
