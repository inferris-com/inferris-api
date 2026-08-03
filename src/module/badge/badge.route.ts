import { type RequestHandler, Router } from "express";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import { auditMutation, authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type { BadgeResponse } from "@/module/badge/badge.response-types.js";
import {
  badgeParamsSchema,
  createBadgeBodySchema,
  listBadgesQuerySchema,
  updateBadgeBodySchema,
  type BadgeParams,
  type CreateBadgeBody,
  type ListBadgesQuery,
  type UpdateBadgeBody,
} from "@/module/badge/badge.schemas.js";
import type { BadgeService } from "@/module/badge/badge.service.js";

export function createBadgeRouter(service: BadgeService, authRepository: AuthRepository): Router {
  const router = Router();
  const readBadges = authorize(authRepository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });
  const writeBadges = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listBadges: RequestHandler = async (req, res) => {
    const badges = await service.listBadges(req.query as unknown as ListBadgesQuery);
    const body: ApiListSuccess<BadgeResponse> = { data: badges, meta: { count: badges.length } };
    res.json(body);
  };
  const getBadge: RequestHandler = async (req, res) => {
    const { badgeId } = req.params as unknown as BadgeParams;
    const badge = await service.getBadge(badgeId);
    const body: ApiSuccess<BadgeResponse> = { data: badge };
    res.json(body);
  };
  const createBadge: RequestHandler<Record<string, never>, unknown, CreateBadgeBody> = async (
    req,
    res,
  ) => {
    const badge = await service.createBadge(req.body);
    const body: ApiSuccess<BadgeResponse> = { data: badge };
    res.status(201).json(body);
  };
  const updateBadge: RequestHandler = async (req, res) => {
    const { badgeId } = req.params as unknown as BadgeParams;
    const badge = await service.updateBadge(badgeId, req.body as UpdateBadgeBody);
    const body: ApiSuccess<BadgeResponse> = { data: badge };
    res.json(body);
  };
  const deleteBadge: RequestHandler = async (req, res) => {
    const { badgeId } = req.params as unknown as BadgeParams;
    await service.deleteBadge(badgeId);
    res.status(204).send();
  };

  router.get(
    "/",
    readBadges,
    validateRequest({ query: listBadgesQuerySchema }) as unknown as RequestHandler,
    listBadges,
  );
  router.get(
    "/:badgeId",
    readBadges,
    validateRequest({ params: badgeParamsSchema }) as unknown as RequestHandler,
    getBadge,
  );
  router.post(
    "/",
    writeBadges,
    auditMutation(authRepository, "badges.create"),
    validateRequest({ body: createBadgeBodySchema }),
    createBadge,
  );
  router.patch(
    "/:badgeId",
    writeBadges,
    auditMutation(authRepository, "badges.update"),
    validateRequest({
      params: badgeParamsSchema,
      body: updateBadgeBodySchema,
    }) as unknown as RequestHandler,
    updateBadge,
  );
  router.delete(
    "/:badgeId",
    writeBadges,
    auditMutation(authRepository, "badges.delete"),
    validateRequest({ params: badgeParamsSchema }) as unknown as RequestHandler,
    deleteBadge,
  );

  return router;
}
