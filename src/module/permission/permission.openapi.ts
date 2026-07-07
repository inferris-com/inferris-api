import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import {
  permissionNodeResponseSchema,
  permissionRuleResponseSchema,
} from "./permission.response-types.js";
import {
  createPermissionNodeBodySchema,
  listPermissionsQuerySchema,
  permissionKeyParamsSchema,
  permissionRuleParamsSchema,
  replacePermissionRuleBodySchema,
} from "./permission.schemas.js";

const permissionNodeEnvelopeSchema = successEnvelopeSchema(
  "PermissionNodeEnvelope",
  permissionNodeResponseSchema,
);
const permissionNodeListEnvelopeSchema = listEnvelopeSchema(
  "PermissionNodeListEnvelope",
  permissionNodeResponseSchema,
);
const permissionRuleEnvelopeSchema = successEnvelopeSchema(
  "PermissionRuleEnvelope",
  permissionRuleResponseSchema,
);
const permissionRuleListEnvelopeSchema = listEnvelopeSchema(
  "PermissionRuleListEnvelope",
  permissionRuleResponseSchema,
);

export function registerPermissionOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/permissions",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "List permission nodes",
    operationId: "listPermissionNodes",
    request: { query: listPermissionsQuerySchema },
    responses: { "200": listResponse(permissionNodeListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/permissions/{permissionKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Get a permission node",
    operationId: "getPermissionNode",
    request: { params: permissionKeyParamsSchema },
    responses: { "200": successResponse(permissionNodeEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/permissions/{permissionKey}/rules",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "List permission rules",
    operationId: "listPermissionRules",
    request: { params: permissionKeyParamsSchema },
    responses: { "200": listResponse(permissionRuleListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/permissions/{permissionKey}/rules/{minRankKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Get a permission rule",
    operationId: "getPermissionRule",
    request: { params: permissionRuleParamsSchema },
    responses: { "200": successResponse(permissionRuleEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/permissions",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Create a permission node",
    operationId: "createPermissionNode",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createPermissionNodeBodySchema) },
      },
    },
    responses: {
      "201": successResponse(permissionNodeEnvelopeSchema, "Permission node created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/permissions/{permissionKey}/rules/{minRankKey}",
    tags: ["Permissions"],
    security: userOrServiceSecurity,
    summary: "Replace a permission rule",
    operationId: "replacePermissionRule",
    request: {
      params: permissionRuleParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replacePermissionRuleBodySchema) },
      },
    },
    responses: {
      "201": successResponse(permissionRuleEnvelopeSchema, "Permission rule replaced"),
      ...standardErrorResponses,
    },
  });
}
