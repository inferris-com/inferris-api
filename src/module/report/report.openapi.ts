import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { reportCommentResponseSchema, reportResponseSchema } from "./report.response-types.js";
import {
  createReportBodySchema,
  createReportCommentBodySchema,
  listReportsQuerySchema,
  reportCodeParamsSchema,
  reportCommentIdParamsSchema,
  reportIdParamsSchema,
  updateReportCommentBodySchema,
  updateReportBodySchema,
} from "./report.schemas.js";

export function registerReportOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/reports",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Create a report",
    operationId: "createReport",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createReportBodySchema) } },
    },
    responses: {
      "201": successResponse(reportResponseSchema, "Report created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/reports",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "List reports",
    operationId: "listReports",
    request: { query: listReportsQuerySchema },
    responses: { "200": listResponse(reportResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/code/{code}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Get a report by code",
    operationId: "getReportByCode",
    request: { params: reportCodeParamsSchema },
    responses: { "200": successResponse(reportResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Get a report",
    operationId: "getReport",
    request: { params: reportIdParamsSchema },
    responses: { "200": successResponse(reportResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/reports/{reportId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Update a report",
    operationId: "updateReport",
    request: {
      params: reportIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateReportBodySchema) } },
    },
    responses: { "200": successResponse(reportResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}/comments",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "List report comments",
    operationId: "listReportComments",
    request: { params: reportIdParamsSchema },
    responses: { "200": listResponse(reportCommentResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/reports/{reportId}/comments",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Create a report comment",
    operationId: "createReportComment",
    request: {
      params: reportIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createReportCommentBodySchema) },
      },
    },
    responses: {
      "201": successResponse(reportCommentResponseSchema, "Report comment created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/reports/{reportId}/comments/{commentId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Update a report comment",
    operationId: "updateReportComment",
    request: {
      params: reportCommentIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateReportCommentBodySchema) },
      },
    },
    responses: { "200": successResponse(reportCommentResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/reports/{reportId}/comments/{commentId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Delete a report comment",
    operationId: "deleteReportComment",
    request: { params: reportCommentIdParamsSchema },
    responses: { "204": { description: "Report comment deleted" }, ...standardErrorResponses },
  });
}
