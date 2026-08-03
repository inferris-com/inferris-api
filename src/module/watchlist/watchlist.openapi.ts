import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { watchlistEntryResponseSchema } from "@/module/watchlist/watchlist.response-types.js";
import {
  addWatchlistBodySchema,
  clearWatchlistBodySchema,
  getActiveWatchlistQuerySchema,
  listWatchlistQuerySchema,
} from "@/module/watchlist/watchlist.schemas.js";

export function registerWatchlistOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/watchlist",
    tags: ["Watchlist"],
    security: userOrServiceSecurity,
    summary: "List watchlist entries",
    operationId: "listWatchlistEntries",
    request: { query: listWatchlistQuerySchema },
    responses: { "200": listResponse(watchlistEntryResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/watchlist/active",
    tags: ["Watchlist"],
    security: userOrServiceSecurity,
    summary: "Get an active watchlist entry",
    operationId: "getActiveWatchlistEntry",
    request: { query: getActiveWatchlistQuerySchema },
    responses: { "200": successResponse(watchlistEntryResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/watchlist",
    tags: ["Watchlist"],
    security: userOrServiceSecurity,
    summary: "Add a watchlist entry",
    operationId: "addWatchlistEntry",
    request: {
      body: { required: true, content: { "application/json": jsonBody(addWatchlistBodySchema) } },
    },
    responses: {
      "201": successResponse(watchlistEntryResponseSchema, "Watchlist entry added"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/watchlist/clear",
    tags: ["Watchlist"],
    security: userOrServiceSecurity,
    summary: "Clear a watchlist entry",
    operationId: "clearWatchlistEntry",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(clearWatchlistBodySchema) },
      },
    },
    responses: {
      "200": successResponse(watchlistEntryResponseSchema, "Watchlist entry cleared"),
      ...standardErrorResponses,
    },
  });
}
