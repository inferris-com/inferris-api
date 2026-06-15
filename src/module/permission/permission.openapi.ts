import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createPermissionNodeBodySchema,
  permissionKeyParamsSchema,
  permissionRuleParamsSchema,
  replacePermissionRuleBodySchema,
} from "./permission.schemas.js";

export function registerPermissionOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/permissions/{permissionKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Get a permission node",
    request: { params: permissionKeyParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/permissions/{permissionKey}/rules/{minRankKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Get a permission rule",
    request: { params: permissionRuleParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/permissions",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Create a permission node",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createPermissionNodeBodySchema) },
      },
    },
    responses: { "201": successResponse("Permission node created"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/permissions/{permissionKey}/rules/{minRankKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Replace a permission rule",
    request: {
      params: permissionRuleParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replacePermissionRuleBodySchema) },
      },
    },
    responses: { "201": successResponse("Permission rule replaced"), ...standardErrorResponses },
  });
}
