import { type RequestHandler, Router } from "express";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiSuccess } from "@/shared/http/api-response.types.js";
import { authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type {
  MetricsOverviewResponse,
  ServerMetricsResponse,
} from "@/module/metrics/metrics.response-types.js";
import {
  metricsQuerySchema,
  type MetricsQuery,
  serverMetricsParamsSchema,
  type ServerMetricsParams,
} from "@/module/metrics/metrics.schemas.js";
import type { MetricsService } from "@/module/metrics/metrics.service.js";

export function createMetricsRouter(
  service: MetricsService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const readMetrics = authorize(authRepository, {
    apiScopes: ["servers:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const getOverview: RequestHandler = async (req, res) => {
    const query = req.query as unknown as MetricsQuery;
    const overview = await service.getOverview(query.window);
    const body: ApiSuccess<MetricsOverviewResponse> = { data: overview };

    res.json(body);
  };

  const getServerMetrics: RequestHandler<ServerMetricsParams> = async (req, res) => {
    const query = req.query as unknown as MetricsQuery;
    const metrics = await service.getServerMetrics(req.params.serverId, query.window);
    const body: ApiSuccess<ServerMetricsResponse> = { data: metrics };

    res.json(body);
  };

  router.get(
    "/overview",
    readMetrics,
    validateRequest({ query: metricsQuerySchema }) as unknown as RequestHandler,
    getOverview,
  );
  router.get(
    "/servers/:serverId",
    readMetrics,
    validateRequest({ params: serverMetricsParamsSchema, query: metricsQuerySchema }),
    getServerMetrics,
  );

  return router;
}
