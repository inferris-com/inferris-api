import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userSecurity,
  jsonBody,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { loginBodySchema, logoutBodySchema, refreshBodySchema } from "./auth.schemas.js";

export function registerAuthOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["Auth"],
    summary: "Get the current Argus user",
    security: userSecurity,
    responses: {
      "200": successResponse("Current Argus user"),
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: ["Auth"],
    summary: "Log in",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(loginBodySchema) },
      },
    },
    responses: {
      "201": successResponse("Token pair created"),
      "400": standardErrorResponses["400"],
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/refresh",
    tags: ["Auth"],
    summary: "Refresh an access token",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(refreshBodySchema) },
      },
    },
    responses: {
      "200": successResponse("Token pair refreshed"),
      "400": standardErrorResponses["400"],
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["Auth"],
    summary: "Log out",
    security: userSecurity,
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(logoutBodySchema) },
      },
    },
    responses: {
      "204": { description: "Logged out" },
      "400": standardErrorResponses["400"],
    },
  });
}
