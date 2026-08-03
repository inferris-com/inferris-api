import { type RequestHandler, Router } from "express";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiListSuccess } from "@/shared/http/api-response.types.js";
import { authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type { CatalogService } from "@/module/catalog/catalog.service.js";
import type {
  BadgeResponse,
  GroupResponse,
  RankResponse,
} from "@/module/catalog/catalog.response-types.js";
import {
  listBadgesQuerySchema,
  listGroupsQuerySchema,
  type ListBadgesQuery,
  type ListGroupsQuery,
  type ListRanksQuery,
  listRanksQuerySchema,
} from "@/module/catalog/catalog.schemas.js";

export function createCatalogRouter(
  service: CatalogService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readCatalog = authorize(authRepository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });

  const listGroups: RequestHandler = async (req, res) => {
    const groups = await service.listGroups(req.query as unknown as ListGroupsQuery);
    const body: ApiListSuccess<GroupResponse> = { data: groups, meta: { count: groups.length } };
    res.json(body);
  };

  const listRanks: RequestHandler = async (req, res) => {
    const ranks = await service.listRanks(req.query as unknown as ListRanksQuery);
    const body: ApiListSuccess<RankResponse> = { data: ranks, meta: { count: ranks.length } };
    res.json(body);
  };

  const listBadges: RequestHandler = async (req, res) => {
    const badges = await service.listBadges(req.query as unknown as ListBadgesQuery);
    const body: ApiListSuccess<BadgeResponse> = { data: badges, meta: { count: badges.length } };
    res.json(body);
  };

  router.get(
    "/groups",
    readCatalog,
    validateRequest({ query: listGroupsQuerySchema }) as unknown as RequestHandler,
    listGroups,
  );
  router.get(
    "/ranks",
    readCatalog,
    validateRequest({ query: listRanksQuerySchema }) as unknown as RequestHandler,
    listRanks,
  );
  router.get(
    "/badges",
    readCatalog,
    validateRequest({ query: listBadgesQuerySchema }) as unknown as RequestHandler,
    listBadges,
  );

  return router;
}
