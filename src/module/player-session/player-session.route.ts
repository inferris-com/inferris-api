import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";
import { authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { PlayerSessionResponse } from "./player-session.response-types.js";
import {
  listPlayerSessionsQuerySchema,
  type ListPlayerSessionsQuery,
  type PlayerSessionParams,
  playerSessionParamsSchema,
} from "./player-session.schemas.js";
import type { PlayerSessionService } from "./player-session.service.js";

type PlayerSessionListSuccess = {
  data: PlayerSessionResponse[];
  meta: PaginatedResponse;
};

export function createPlayerSessionRouter(
  service: PlayerSessionService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const readSessions = authorize(authRepository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });

  const listSessions: RequestHandler = async (req, res) => {
    const result = await service.listSessions(req.query as unknown as ListPlayerSessionsQuery);
    const body: PlayerSessionListSuccess = {
      data: result.rows,
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };

    res.json(body);
  };

  const listLiveSessions: RequestHandler = async (req, res) => {
    const query = req.query as unknown as Omit<ListPlayerSessionsQuery, "state">;
    const result = await service.listLiveSessions(query);
    const body: PlayerSessionListSuccess = {
      data: result.rows,
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };

    res.json(body);
  };

  const getSession: RequestHandler<PlayerSessionParams> = async (req, res) => {
    const session = await service.getSession(req.params.sessionId);
    const body: ApiSuccess<PlayerSessionResponse> = { data: session };

    res.json(body);
  };

  router.get(
    "/",
    readSessions,
    validateRequest({ query: listPlayerSessionsQuerySchema }) as unknown as RequestHandler,
    listSessions,
  );
  router.get(
    "/live",
    readSessions,
    validateRequest({
      query: listPlayerSessionsQuerySchema.omit({ state: true }),
    }) as unknown as RequestHandler,
    listLiveSessions,
  );
  router.get(
    "/:sessionId",
    readSessions,
    validateRequest({ params: playerSessionParamsSchema }),
    getSession,
  );

  return router;
}
