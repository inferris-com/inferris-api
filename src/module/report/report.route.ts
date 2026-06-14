import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import { auditMutation, authorize } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { ReportCommentResponse, ReportResponse } from "./report.response-types.js";
import {
  type CreateReportBody,
  createReportBodySchema,
  type CreateReportCommentBody,
  createReportCommentBodySchema,
  type ListReportsQuery,
  listReportsQuerySchema,
  type ReportIdParams,
  reportIdParamsSchema,
  type UpdateReportBody,
  updateReportBodySchema,
} from "./report.schemas.js";
import type { ReportListResponse, ReportService } from "./report.service.js";

export function createReportRouter(service: ReportService, authRepository: AuthRepository): Router {
  const router = Router();

  const submitReports = authorize(authRepository, {
    apiScopes: ["moderation:write"],
  });
  const readReports = authorize(authRepository, {
    apiScopes: ["moderation:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const manageReports = authorize(authRepository, {
    apiScopes: ["moderation:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const listReports: RequestHandler = async (req, res) => {
    const result = await service.listReports(req.query as unknown as ListReportsQuery);
    res.json(result satisfies ReportListResponse);
  };

  const getReport: RequestHandler<ReportIdParams> = async (req, res) => {
    const report = await service.getReport(req.params.reportId);
    const body: ApiSuccess<ReportResponse> = { data: report };

    res.json(body);
  };

  const createReport: RequestHandler<ParamsDictionary, unknown, CreateReportBody> = async (
    req,
    res,
  ) => {
    const report = await service.createReport(req.body);
    const body: ApiSuccess<ReportResponse> = { data: report };

    res.status(201).json(body);
  };

  const updateReport: RequestHandler<ReportIdParams, unknown, UpdateReportBody> = async (
    req,
    res,
  ) => {
    const report = await service.updateReport(
      req.params.reportId,
      req.body,
      req.auth?.actorId ?? "",
    );
    const body: ApiSuccess<ReportResponse> = { data: report };

    res.json(body);
  };

  const listComments: RequestHandler<ReportIdParams> = async (req, res) => {
    const comments = await service.listComments(req.params.reportId);
    const body: ApiListSuccess<ReportCommentResponse> = {
      data: comments,
      meta: { count: comments.length },
    };

    res.json(body);
  };

  const createComment: RequestHandler<ReportIdParams, unknown, CreateReportCommentBody> = async (
    req,
    res,
  ) => {
    const comment = await service.createComment(
      req.params.reportId,
      req.body,
      req.auth?.actorId ?? "",
    );
    const body: ApiSuccess<ReportCommentResponse> = { data: comment };

    res.status(201).json(body);
  };

  router.post(
    "/",
    submitReports,
    auditMutation(authRepository, "reports.create"),
    validateRequest({ body: createReportBodySchema }),
    createReport,
  );
  router.get(
    "/",
    readReports,
    validateRequest({ query: listReportsQuerySchema }) as unknown as RequestHandler,
    listReports,
  );
  router.get(
    "/:reportId",
    readReports,
    validateRequest({ params: reportIdParamsSchema }),
    getReport,
  );
  router.patch(
    "/:reportId",
    manageReports,
    auditMutation(authRepository, "reports.update"),
    validateRequest({ params: reportIdParamsSchema, body: updateReportBodySchema }),
    updateReport,
  );
  router.get(
    "/:reportId/comments",
    readReports,
    validateRequest({ params: reportIdParamsSchema }),
    listComments,
  );
  router.post(
    "/:reportId/comments",
    manageReports,
    auditMutation(authRepository, "reports.comments.create"),
    validateRequest({ params: reportIdParamsSchema, body: createReportCommentBodySchema }),
    createComment,
  );

  return router;
}
