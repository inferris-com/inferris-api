import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { argusUserResponseSchema } from "./argus-user.response-types.js";
import {
  argusUserParamsSchema,
  createArgusUserBodySchema,
  listArgusUsersQuerySchema,
  resolveArgusUsersQuerySchema,
  updateArgusUserBodySchema,
} from "./argus-user.schemas.js";

export function registerArgusUserOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/argus-users",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "List Argus users",
    operationId: "listArgusUsers",
    request: { query: listArgusUsersQuerySchema },
    responses: { "200": listResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/argus-users/{userId}",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "Get an Argus user",
    operationId: "getArgusUser",
    request: { params: argusUserParamsSchema },
    responses: { "200": successResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/argus-users/resolve",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "Resolve Argus users",
    operationId: "resolveArgusUsers",
    request: { query: resolveArgusUsersQuerySchema },
    responses: { "200": listResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/argus-users",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "Create an Argus user",
    operationId: "createArgusUser",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createArgusUserBodySchema) },
      },
    },
    responses: { "201": successResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/argus-users/{userId}",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "Update an Argus user",
    operationId: "updateArgusUser",
    request: {
      params: argusUserParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateArgusUserBodySchema) },
      },
    },
    responses: { "200": successResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/argus-users/{userId}",
    tags: ["Argus Users"],
    security: userOrServiceSecurity,
    summary: "Disable an Argus user",
    operationId: "disableArgusUser",
    request: { params: argusUserParamsSchema },
    responses: { "200": successResponse(argusUserResponseSchema), ...standardErrorResponses },
  });
}
