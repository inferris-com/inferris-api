import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
  userSecurity,
} from "../../openapi/openapi.helpers.js";
import {
  accountNotificationResponseSchema,
  accountResponseSchema,
  passwordChangeResponseSchema,
} from "./account.response-types.js";
import { argusSessionResponseSchema } from "../auth/auth.response-types.js";
import {
  accountNotificationParamsSchema,
  accountSessionParamsSchema,
  changePasswordBodySchema,
} from "./account.schemas.js";

export function registerAccountOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/account",
    tags: ["Account"],
    security: userSecurity,
    summary: "Get the current Argus account",
    operationId: "getAccount",
    responses: { "200": successResponse(accountResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/account/password",
    tags: ["Account"],
    security: userSecurity,
    summary: "Change the current Argus account password",
    operationId: "changeAccountPassword",
    request: {
      body: { required: true, content: { "application/json": jsonBody(changePasswordBodySchema) } },
    },
    responses: { "200": successResponse(passwordChangeResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/account/security-lock/change-password",
    tags: ["Account"],
    security: userSecurity,
    summary:
      "Change the current Argus account password and clear an active change-password security lock",
    operationId: "changeAccountPasswordSecurityLock",
    request: {
      body: { required: true, content: { "application/json": jsonBody(changePasswordBodySchema) } },
    },
    responses: { "200": successResponse(passwordChangeResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/account/sessions",
    tags: ["Account"],
    security: userSecurity,
    summary: "List current Argus account sessions",
    operationId: "listAccountSessions",
    responses: { "200": listResponse(argusSessionResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/account/sessions/{sessionId}",
    tags: ["Account"],
    security: userSecurity,
    summary: "Revoke an Argus account session",
    operationId: "revokeAccountSession",
    request: { params: accountSessionParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/account/notifications",
    tags: ["Account"],
    security: userSecurity,
    summary: "List current Argus account notifications",
    operationId: "listAccountNotifications",
    responses: {
      "200": listResponse(accountNotificationResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/account/notifications/{notificationId}/read",
    tags: ["Account"],
    security: userSecurity,
    summary: "Mark a current Argus account notification as read",
    operationId: "markAccountNotificationRead",
    request: { params: accountNotificationParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });
}
