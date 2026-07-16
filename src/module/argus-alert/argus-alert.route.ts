import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { ArgusAlertResponse } from "./argus-alert.response-types.js";
import {
  argusAlertParamsSchema,
  createArgusAlertBodySchema,
  listArgusAlertsQuerySchema,
  updateArgusAlertBodySchema,
  type ArgusAlertParams,
  type CreateArgusAlertBody,
  type ListArgusAlertsQuery,
  type UpdateArgusAlertBody,
} from "./argus-alert.schemas.js";
import type { ArgusAlertService } from "./argus-alert.service.js";

type ArgusAlertListSuccess = { data: ArgusAlertResponse[]; meta: PaginatedResponse };

export function createArgusAlertRouter(
  service: ArgusAlertService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const readArgusAlerts = authorize(authRepository, {
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const manageArgusAlerts = authorize(authRepository, {
    apiScopes: ["argus:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listAlerts: RequestHandler = async (req, res) => {
    const result = await service.listAlerts(req.query as unknown as ListArgusAlertsQuery);
    const body: ArgusAlertListSuccess = {
      data: result.rows,
      meta: { count: result.rows.length, total: result.total, limit: result.limit, offset: result.offset },
    };
    res.json(body);
  };
  const getAlert: RequestHandler<ArgusAlertParams> = async (req, res) => {
    const alert = await service.getAlert(req.params.alertId);
    const body: ApiSuccess<ArgusAlertResponse> = { data: alert };
    res.json(body);
  };
  const createAlert: RequestHandler<Record<string, never>, unknown, CreateArgusAlertBody> = async (
    req,
    res,
  ) => {
    const alert = await service.createAlert(req.body);
    const body: ApiSuccess<ArgusAlertResponse> = { data: alert };
    res.status(201).json(body);
  };
  const updateAlert: RequestHandler<ArgusAlertParams, unknown, UpdateArgusAlertBody> = async (
    req,
    res,
  ) => {
    const alert = await service.updateAlert(req.params.alertId, req.body);
    const body: ApiSuccess<ArgusAlertResponse> = { data: alert };
    res.json(body);
  };
  const deactivateAlert: RequestHandler<ArgusAlertParams> = async (req, res) => {
    const alert = await service.deactivateAlert(req.params.alertId);
    const body: ApiSuccess<ArgusAlertResponse> = { data: alert };
    res.json(body);
  };

  router.get(
    "/",
    readArgusAlerts,
    validateRequest({ query: listArgusAlertsQuerySchema }) as unknown as RequestHandler,
    listAlerts,
  );
  router.get(
    "/:alertId",
    readArgusAlerts,
    validateRequest({ params: argusAlertParamsSchema }) as unknown as RequestHandler,
    getAlert as unknown as RequestHandler,
  );
  router.post(
    "/",
    manageArgusAlerts,
    auditMutation(authRepository, "argus-alerts.create"),
    validateRequest({ body: createArgusAlertBodySchema }),
    createAlert,
  );
  router.patch(
    "/:alertId",
    manageArgusAlerts,
    auditMutation(authRepository, "argus-alerts.update"),
    validateRequest({
      params: argusAlertParamsSchema,
      body: updateArgusAlertBodySchema,
    }) as unknown as RequestHandler,
    updateAlert as unknown as RequestHandler,
  );
  router.delete(
    "/:alertId",
    manageArgusAlerts,
    auditMutation(authRepository, "argus-alerts.deactivate"),
    validateRequest({ params: argusAlertParamsSchema }) as unknown as RequestHandler,
    deactivateAlert as unknown as RequestHandler,
  );

  return router;
}
