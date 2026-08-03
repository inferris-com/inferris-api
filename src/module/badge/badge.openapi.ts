import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { badgeResponseSchema } from "@/module/badge/badge.response-types.js";
import {
  badgeParamsSchema,
  createBadgeBodySchema,
  listBadgesQuerySchema,
  updateBadgeBodySchema,
} from "@/module/badge/badge.schemas.js";

export function registerBadgeOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/badges",
    tags: ["Badges"],
    security: userOrServiceSecurity,
    summary: "List badges",
    operationId: "listBadges",
    request: { query: listBadgesQuerySchema },
    responses: { "200": listResponse(badgeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/badges/{badgeId}",
    tags: ["Badges"],
    security: userOrServiceSecurity,
    summary: "Get a badge",
    operationId: "getBadge",
    request: { params: badgeParamsSchema },
    responses: { "200": successResponse(badgeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/badges",
    tags: ["Badges"],
    security: userOrServiceSecurity,
    summary: "Create a badge",
    operationId: "createBadge",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createBadgeBodySchema) } },
    },
    responses: { "201": successResponse(badgeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/badges/{badgeId}",
    tags: ["Badges"],
    security: userOrServiceSecurity,
    summary: "Update a badge",
    operationId: "updateBadge",
    request: {
      params: badgeParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateBadgeBodySchema) } },
    },
    responses: { "200": successResponse(badgeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/badges/{badgeId}",
    tags: ["Badges"],
    security: userOrServiceSecurity,
    summary: "Delete a badge",
    operationId: "deleteBadge",
    request: { params: badgeParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });
}
