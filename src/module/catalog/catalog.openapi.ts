import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  listResponse,
  standardErrorResponses,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import {
  badgeResponseSchema,
  groupResponseSchema,
  rankResponseSchema,
} from "./catalog.response-types.js";
import {
  listBadgesQuerySchema,
  listGroupsQuerySchema,
  listRanksQuerySchema,
} from "./catalog.schemas.js";

const groupListEnvelopeSchema = listEnvelopeSchema("GroupListEnvelope", groupResponseSchema);
const rankListEnvelopeSchema = listEnvelopeSchema("RankListEnvelope", rankResponseSchema);
const badgeListEnvelopeSchema = listEnvelopeSchema("BadgeListEnvelope", badgeResponseSchema);

export function registerCatalogOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/groups",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List groups",
    operationId: "listGroups",
    request: { query: listGroupsQuerySchema },
    responses: { "200": listResponse(groupListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/ranks",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List ranks",
    operationId: "listRanks",
    request: { query: listRanksQuerySchema },
    responses: { "200": listResponse(rankListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/badges",
    tags: ["Catalog"],
    security: userOrServiceSecurity,
    summary: "List badges",
    operationId: "listBadges",
    request: { query: listBadgesQuerySchema },
    responses: { "200": listResponse(badgeListEnvelopeSchema), ...standardErrorResponses },
  });
}
