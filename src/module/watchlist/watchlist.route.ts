import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import {
  auditMutation,
  authorize,
  getActingActorId,
  requireActingActor,
} from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { WatchlistEntryResponse } from "./watchlist.response-types.js";
import {
  type AddWatchlistBody,
  addWatchlistBodySchema,
  type ClearWatchlistBody,
  clearWatchlistBodySchema,
  type GetActiveWatchlistQuery,
  getActiveWatchlistQuerySchema,
  type ListWatchlistQuery,
  listWatchlistQuerySchema,
} from "./watchlist.schemas.js";
import type { WatchlistListResponse, WatchlistService } from "./watchlist.service.js";

export function createWatchlistRouter(
  service: WatchlistService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readWatchlist = authorize(authRepository, {
    apiScopes: ["moderation:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const writeWatchlist = authorize(authRepository, {
    apiScopes: ["moderation:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const listEntries: RequestHandler = async (req, res) => {
    const result = await service.listEntries(req.query as unknown as ListWatchlistQuery);
    res.json(result satisfies WatchlistListResponse);
  };

  const getActiveEntry: RequestHandler = async (req, res) => {
    const entry = await service.getActiveEntry(req.query as unknown as GetActiveWatchlistQuery);
    const body: ApiSuccess<WatchlistEntryResponse> = { data: entry };
    res.json(body);
  };

  const addEntry: RequestHandler<ParamsDictionary, unknown, AddWatchlistBody> = async (
    req,
    res,
  ) => {
    const entry = await service.addEntry(req.body, getActingActorId(req) ?? "");
    const body: ApiSuccess<WatchlistEntryResponse> = { data: entry };
    res.status(201).json(body);
  };

  const clearEntry: RequestHandler<ParamsDictionary, unknown, ClearWatchlistBody> = async (
    req,
    res,
  ) => {
    const entry = await service.clearEntry(req.body, getActingActorId(req) ?? "");
    const body: ApiSuccess<WatchlistEntryResponse> = { data: entry };
    res.json(body);
  };

  router.get(
    "/",
    readWatchlist,
    validateRequest({ query: listWatchlistQuerySchema }) as unknown as RequestHandler,
    listEntries,
  );
  router.get(
    "/active",
    readWatchlist,
    validateRequest({ query: getActiveWatchlistQuerySchema }) as unknown as RequestHandler,
    getActiveEntry,
  );
  router.post(
    "/",
    writeWatchlist,
    requireActingActor(authRepository),
    auditMutation(authRepository, "watchlist.add"),
    validateRequest({ body: addWatchlistBodySchema }),
    addEntry,
  );
  router.post(
    "/clear",
    writeWatchlist,
    requireActingActor(authRepository),
    auditMutation(authRepository, "watchlist.clear"),
    validateRequest({ body: clearWatchlistBodySchema }),
    clearEntry,
  );

  return router;
}
