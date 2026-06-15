import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { playerIdParamsSchema } from "../player/player.schemas.js";
import { actorIdParamsSchema, updateActorBodySchema } from "./actor.schemas.js";

export function registerActorOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/actors/by-player/{playerId}",
    tags: ["Actors"],
    security: userOrServiceSecurity,
    summary: "Get an actor by player ID",
    request: { params: playerIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/actors/{actorId}",
    tags: ["Actors"],
    security: userOrServiceSecurity,
    summary: "Get an actor",
    request: { params: actorIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/actors/{actorId}",
    tags: ["Actors"],
    security: userOrServiceSecurity,
    summary: "Update an actor",
    request: {
      params: actorIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateActorBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });
}
