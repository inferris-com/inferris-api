import { type RequestHandler, Router } from "express";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiSuccess } from "@/shared/http/api-response.types.js";
import type { PaginatedResponse } from "@/shared/pagination.schemas.js";
import { authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type { PlayerSessionResponse } from "@/module/player-session/player-session.response-types.js";
import {
  getPlayerSessionQuerySchema,
  listPlayerSessionsQuerySchema,
  type ListPlayerSessionsQuery,
  type NetworkSessionParams,
  networkSessionParamsSchema,
} from "@/module/player-session/player-session.schemas.js";
import type { PlayerSessionService } from "@/module/player-session/player-session.service.js";

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

  const getSession: RequestHandler<NetworkSessionParams> = async (req, res) => {
    const session = await service.getSession(
      req.params.networkSessionId,
      req.query.include === "backendSessions",
    );
    const body: ApiSuccess<PlayerSessionResponse> = { data: session };

    res.json(body);
  };

  router.get(
    "/",
    readSessions,
    validateRequest({ query: listPlayerSessionsQuerySchema }) as unknown as RequestHandler,
    listSessions,
  );
  router.get("/live", readSessions, (_req, res) => {
    res.status(404).send();
  });
  router.get(
    "/:networkSessionId",
    readSessions,
    validateRequest({ params: networkSessionParamsSchema, query: getPlayerSessionQuerySchema }),
    getSession,
  );

  return router;
}
