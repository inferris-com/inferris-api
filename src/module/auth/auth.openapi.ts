import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userSecurity,
  jsonBody,
  standardErrorResponses,
  successResponse,
} from "@/openapi/openapi.helpers.js";
import {
  authTokenResponseSchema,
  authUserResponseSchema,
} from "@/module/auth/auth.response-types.js";
import {
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
} from "@/module/auth/auth.schemas.js";

export function registerAuthOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["Auth"],
    summary: "Get the current Argus user",
    operationId: "getCurrentArgusUser",
    security: userSecurity,
    responses: {
      "200": successResponse(authUserResponseSchema, "Current Argus user"),
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: ["Auth"],
    summary: "Log in",
    operationId: "logIn",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(loginBodySchema) },
      },
    },
    responses: {
      "201": successResponse(authTokenResponseSchema, "Token pair created"),
      "400": standardErrorResponses["400"],
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/refresh",
    tags: ["Auth"],
    summary: "Refresh an access token",
    operationId: "refreshAccessToken",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(refreshBodySchema) },
      },
    },
    responses: {
      "200": successResponse(authTokenResponseSchema, "Token pair refreshed"),
      "400": standardErrorResponses["400"],
      "401": standardErrorResponses["401"],
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["Auth"],
    summary: "Log out",
    operationId: "logOut",
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
