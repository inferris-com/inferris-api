import { type RequestHandler, Router } from "express";

import { ForbiddenError } from "@/error/app-error.js";
import { validateRequest } from "@/middleware/validation.js";
import type { ApiSuccess } from "@/shared/http/api-response.types.js";
import { authorize, requireServerInstance } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type {
  RegisterServerInstanceResponse,
  ServerInstanceEventResponse,
  ServerInstanceHeartbeatResponse,
  ServerInstanceMetricsResponse,
  ServerInstancePresenceResponse,
  ServerInstanceResponse,
} from "@/module/server-instance/server-instance.response-types.js";
import {
  type RegisterServerInstanceBody,
  registerServerInstanceBodySchema,
  type ServerInstanceEventBody,
  serverInstanceEventBodySchema,
  type ServerInstanceHeartbeatBody,
  serverInstanceHeartbeatBodySchema,
  type ServerInstanceIdParams,
  serverInstanceIdParamsSchema,
  type ServerInstanceMetricsBody,
  serverInstanceMetricsBodySchema,
  type ServerInstancePresenceBody,
  serverInstancePresenceBodySchema,
} from "@/module/server-instance/server-instance.schemas.js";
import type {
  AuthenticatedServerInstance,
  ServerInstanceService,
} from "@/module/server-instance/server-instance.service.js";

export function createServerInstanceRouter(
  service: ServerInstanceService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const registerInstances = authorize(authRepository, {
    apiScopes: ["minecraft:sessions:manage", "servers:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });
  const readServers = authorize(authRepository, {
    apiScopes: ["servers:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const registerInstance: RequestHandler<unknown, unknown, RegisterServerInstanceBody> = async (
    req,
    res,
  ) => {
    const instance = await service.registerInstance(req.body, req.auth);
    const body: ApiSuccess<RegisterServerInstanceResponse> = { data: instance };

    res.status(201).json(body);
  };

  const getInstance: RequestHandler<ServerInstanceIdParams> = async (req, res) => {
    const instance = await service.getInstance(req.params.serverInstanceId);
    const body: ApiSuccess<ServerInstanceResponse> = { data: instance };

    res.json(body);
  };

  const heartbeat: RequestHandler<
    ServerInstanceIdParams,
    unknown,
    ServerInstanceHeartbeatBody
  > = async (req, res) => {
    const auth = requireMatchingInstance(req.params.serverInstanceId, req.auth?.serverInstance);
    const result = await service.heartbeat(auth, req.body);
    const body: ApiSuccess<ServerInstanceHeartbeatResponse> = { data: result };

    res.json(body);
  };

  const metrics: RequestHandler<
    ServerInstanceIdParams,
    unknown,
    ServerInstanceMetricsBody
  > = async (req, res) => {
    const auth = requireMatchingInstance(req.params.serverInstanceId, req.auth?.serverInstance);
    const result = await service.recordMetrics(auth, req.body);
    const body: ApiSuccess<ServerInstanceMetricsResponse> = { data: result };

    res.status(201).json(body);
  };

  const presence: RequestHandler<
    ServerInstanceIdParams,
    unknown,
    ServerInstancePresenceBody
  > = async (req, res) => {
    const auth = requireMatchingInstance(req.params.serverInstanceId, req.auth?.serverInstance);
    const result = await service.reconcilePresence(auth, req.body);
    const body: ApiSuccess<ServerInstancePresenceResponse> = { data: result };

    res.json(body);
  };

  const event: RequestHandler<ServerInstanceIdParams, unknown, ServerInstanceEventBody> = async (
    req,
    res,
  ) => {
    const auth = requireMatchingInstance(req.params.serverInstanceId, req.auth?.serverInstance);
    const result = await service.processEvent(auth, req.body);
    const body: ApiSuccess<ServerInstanceEventResponse> = { data: result };

    res.status(result.idempotent ? 200 : 201).json(body);
  };

  router.post(
    "/register",
    registerInstances,
    validateRequest({ body: registerServerInstanceBodySchema }),
    registerInstance,
  );
  router.get(
    "/:serverInstanceId",
    readServers,
    validateRequest({ params: serverInstanceIdParamsSchema }),
    getInstance,
  );
  router.put(
    "/:serverInstanceId/heartbeat",
    requireServerInstance(),
    validateRequest({
      params: serverInstanceIdParamsSchema,
      body: serverInstanceHeartbeatBodySchema,
    }),
    heartbeat,
  );
  router.post(
    "/:serverInstanceId/metrics",
    requireServerInstance(),
    validateRequest({
      params: serverInstanceIdParamsSchema,
      body: serverInstanceMetricsBodySchema,
    }),
    metrics,
  );
  router.put(
    "/:serverInstanceId/presence",
    requireServerInstance(),
    validateRequest({
      params: serverInstanceIdParamsSchema,
      body: serverInstancePresenceBodySchema,
    }),
    presence,
  );
  router.post(
    "/:serverInstanceId/events",
    requireServerInstance(),
    validateRequest({ params: serverInstanceIdParamsSchema, body: serverInstanceEventBodySchema }),
    event,
  );

  return router;
}

function requireMatchingInstance(
  serverInstanceId: string,
  auth: AuthenticatedServerInstance | undefined,
): AuthenticatedServerInstance {
  if (auth?.id === serverInstanceId) {
    return auth;
  }

  throw new ForbiddenError({
    code: "SERVER_INSTANCE_TOKEN_MISMATCH",
    message: "Server instance token cannot report for a different instance.",
  });
}
