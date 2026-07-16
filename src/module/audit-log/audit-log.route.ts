import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";
import { authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { AuditLogResponse } from "./audit-log.response-types.js";
import {
  auditLogParamsSchema,
  listAuditLogsQuerySchema,
  type AuditLogParams,
  type ListAuditLogsQuery,
} from "./audit-log.schemas.js";
import type { AuditLogService } from "./audit-log.service.js";

type AuditLogListSuccess = { data: AuditLogResponse[]; meta: PaginatedResponse };

export function createAuditLogRouter(
  service: AuditLogService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const readAuditLogs = authorize(authRepository, {
    apiScopes: ["audit:read"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listAuditLogs: RequestHandler = async (req, res) => {
    const result = await service.listAuditLogs(req.query as unknown as ListAuditLogsQuery);
    const body: AuditLogListSuccess = {
      data: result.rows,
      meta: { count: result.rows.length, total: result.total, limit: result.limit, offset: result.offset },
    };
    res.json(body);
  };

  const getAuditLog: RequestHandler<AuditLogParams> = async (req, res) => {
    const log = await service.getAuditLog(req.params.auditLogId);
    const body: ApiSuccess<AuditLogResponse> = { data: log };
    res.json(body);
  };

  router.get(
    "/",
    readAuditLogs,
    validateRequest({ query: listAuditLogsQuerySchema }) as unknown as RequestHandler,
    listAuditLogs,
  );
  router.get(
    "/:auditLogId",
    readAuditLogs,
    validateRequest({ params: auditLogParamsSchema }),
    getAuditLog,
  );

  return router;
}
