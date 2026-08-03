import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  listResponse,
  standardErrorResponses,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import {
  badgeResponseSchema,
  groupResponseSchema,
  rankResponseSchema,
} from "@/module/catalog/catalog.response-types.js";
import {
  listBadgesQuerySchema,
  listGroupsQuerySchema,
  listRanksQuerySchema,
} from "@/module/catalog/catalog.schemas.js";

export function registerCatalogOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/groups",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List groups",
    operationId: "listGroups",
    request: { query: listGroupsQuerySchema },
    responses: { "200": listResponse(groupResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/ranks",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List ranks",
    operationId: "listRanks",
    request: { query: listRanksQuerySchema },
    responses: { "200": listResponse(rankResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/badges",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List badges",
    operationId: "listBadges",
    request: { query: listBadgesQuerySchema },
    responses: { "200": listResponse(badgeResponseSchema), ...standardErrorResponses },
  });
}
