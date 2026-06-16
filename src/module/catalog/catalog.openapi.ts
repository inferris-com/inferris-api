import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { listResponse, standardErrorResponses, userOrServiceSecurity } from "../../openapi/openapi.helpers.js";
import { listBadgesQuerySchema, listGroupsQuerySchema, listRanksQuerySchema } from "./catalog.schemas.js";

export function registerCatalogOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/groups",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List groups",
    request: { query: listGroupsQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/ranks",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List ranks",
    request: { query: listRanksQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/badges",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List badges",
    request: { query: listBadgesQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });
}
