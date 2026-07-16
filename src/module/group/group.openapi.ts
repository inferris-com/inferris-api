import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { groupResponseSchema } from "./group.response-types.js";
import {
  createGroupBodySchema,
  groupKeyParamsSchema,
  listGroupsQuerySchema,
  updateGroupBodySchema,
} from "./group.schemas.js";

export function registerGroupOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/groups",
    tags: ["Groups"],
    security: userOrServiceSecurity,
    summary: "List groups",
    operationId: "listGroups",
    request: { query: listGroupsQuerySchema },
    responses: { "200": listResponse(groupResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/groups/{groupKey}",
    tags: ["Groups"],
    security: userOrServiceSecurity,
    summary: "Get a group",
    operationId: "getGroup",
    request: { params: groupKeyParamsSchema },
    responses: { "200": successResponse(groupResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/groups",
    tags: ["Groups"],
    security: userOrServiceSecurity,
    summary: "Create a group",
    operationId: "createGroup",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createGroupBodySchema) } },
    },
    responses: { "201": successResponse(groupResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/groups/{groupKey}",
    tags: ["Groups"],
    security: userOrServiceSecurity,
    summary: "Update a group",
    operationId: "updateGroup",
    request: {
      params: groupKeyParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateGroupBodySchema) } },
    },
    responses: { "200": successResponse(groupResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/groups/{groupKey}",
    tags: ["Groups"],
    security: userOrServiceSecurity,
    summary: "Delete a group",
    operationId: "deleteGroup",
    request: { params: groupKeyParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });
}
