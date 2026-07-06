import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createReportBodySchema,
  createReportCommentBodySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  updateReportBodySchema,
} from "./report.schemas.js";

export function registerReportOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/reports",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Create a report",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createReportBodySchema) } },
    },
    responses: { "201": successResponse("Report created"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "List reports",
    request: { query: listReportsQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Get a report",
    request: { params: reportIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/reports/{reportId}",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Update a report",
    request: {
      params: reportIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateReportBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/reports/{reportId}/comments",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "List report comments",
    request: { params: reportIdParamsSchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/reports/{reportId}/comments",
    tags: ["Reports"],
    security: userOrServiceSecurity,
    summary: "Create a report comment",
    request: {
      params: reportIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createReportCommentBodySchema) },
      },
    },
    responses: { "201": successResponse("Report comment created"), ...standardErrorResponses },
  });
}
