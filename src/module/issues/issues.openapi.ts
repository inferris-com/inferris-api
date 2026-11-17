import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  jsonBody,
  listResponse,
  successResponse,
  standardErrorResponses,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { issueResponseSchema } from "@/module/issues/issues.response-types.js";
import {
  createIssueSchema,
  updateIssueSchema,
  issueParamsSchema,
  listIssuesQuerySchema,
} from "@/module/issues/issues.schemas.js";
export function registerIssuesOpenApi(registry: OpenAPIRegistry) {
  const common = { tags: ["Issues"], security: userOrServiceSecurity };
  registry.registerPath({
    ...common,
    method: "get",
    path: "/issues",
    operationId: "listIssues",
    summary: "List issues",
    request: { query: listIssuesQuerySchema },
    responses: { "200": listResponse(issueResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    ...common,
    method: "get",
    path: "/issues/{id}",
    operationId: "getIssue",
    summary: "Get an issue",
    request: { params: issueParamsSchema },
    responses: { "200": successResponse(issueResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    ...common,
    method: "post",
    path: "/issues",
    operationId: "createIssue",
    summary: "Create an issue",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createIssueSchema) } },
    },
    responses: { "201": successResponse(issueResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    ...common,
    method: "patch",
    path: "/issues/{id}",
    operationId: "updateIssue",
    summary: "Update an issue",
    description:
      "Resolved, duplicate, invalid and closed issues receive the acting actor and closure time automatically. Reopening clears closure details. Omitted fields are preserved; null clears assignment/severity and resets description to No description.",
    request: {
      params: issueParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateIssueSchema) } },
    },
    responses: { "200": successResponse(issueResponseSchema), ...standardErrorResponses },
  });
}
