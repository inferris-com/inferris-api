import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import { reportCommentResponseSchema, reportResponseSchema } from "./report.response-types.js";
import {
  createReportBodySchema,
  createReportCommentBodySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  updateReportBodySchema,
} from "./report.schemas.js";

const reportEnvelopeSchema = successEnvelopeSchema("ReportEnvelope", reportResponseSchema);
const reportListEnvelopeSchema = listEnvelopeSchema("ReportListEnvelope", reportResponseSchema);
const reportCommentEnvelopeSchema = successEnvelopeSchema(
  "ReportCommentEnvelope",
  reportCommentResponseSchema,
);
const reportCommentListEnvelopeSchema = listEnvelopeSchema(
  "ReportCommentListEnvelope",
  reportCommentResponseSchema,
);

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
      "201": successResponse(reportEnvelopeSchema, "Report created"),
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
    responses: { "200": listResponse(reportListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Get a report",
    operationId: "getReport",
    request: { params: reportIdParamsSchema },
    responses: { "200": successResponse(reportEnvelopeSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(reportEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}/comments",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "List report comments",
    operationId: "listReportComments",
    request: { params: reportIdParamsSchema },
    responses: { "200": listResponse(reportCommentListEnvelopeSchema), ...standardErrorResponses },
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
      "201": successResponse(reportCommentEnvelopeSchema, "Report comment created"),
      ...standardErrorResponses,
    },
  });
}
