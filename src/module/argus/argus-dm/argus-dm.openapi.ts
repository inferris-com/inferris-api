import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import {
  argusDmConversationResponseSchema,
  argusDmMessageResponseSchema,
  argusDmUnreadCountResponseSchema,
} from "@/module/argus/argus-dm/argus-dm.response-types.js";
import {
  argusDmConversationParamsSchema,
  argusDmMessageParamsSchema,
  createArgusDmConversationBodySchema,
  createArgusDmMessageBodySchema,
  listArgusDmConversationsQuerySchema,
  updateArgusDmConversationBodySchema,
  updateArgusDmMessageBodySchema,
} from "@/module/argus/argus-dm/argus-dm.schemas.js";

export function registerArgusDmOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/argus-dms",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "List Argus DM conversations",
    operationId: "listArgusDmConversations",
    request: { query: listArgusDmConversationsQuerySchema },
    responses: {
      "200": listResponse(argusDmConversationResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/argus-dms",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Create an Argus DM conversation",
    operationId: "createArgusDmConversation",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createArgusDmConversationBodySchema) },
      },
    },
    responses: {
      "201": successResponse(argusDmConversationResponseSchema, "Argus DM conversation created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/argus-dms/unread-count",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Get Argus DM unread conversation count",
    operationId: "getArgusDmUnreadCount",
    responses: {
      "200": successResponse(argusDmUnreadCountResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/argus-dms/{conversationId}",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Get an Argus DM conversation",
    operationId: "getArgusDmConversation",
    request: { params: argusDmConversationParamsSchema },
    responses: {
      "200": successResponse(argusDmConversationResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/argus-dms/{conversationId}",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Update an Argus DM conversation",
    operationId: "updateArgusDmConversation",
    request: {
      params: argusDmConversationParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateArgusDmConversationBodySchema) },
      },
    },
    responses: {
      "200": successResponse(argusDmConversationResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/argus-dms/{conversationId}/leave",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Leave an Argus DM conversation",
    operationId: "leaveArgusDmConversation",
    request: { params: argusDmConversationParamsSchema },
    responses: { "204": { description: "Argus DM conversation left" }, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/argus-dms/{conversationId}/read",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Mark an Argus DM conversation read",
    operationId: "markArgusDmConversationRead",
    request: { params: argusDmConversationParamsSchema },
    responses: {
      "204": { description: "Argus DM conversation marked read" },
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/argus-dms/{conversationId}/messages",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "List Argus DM messages",
    operationId: "listArgusDmMessages",
    request: { params: argusDmConversationParamsSchema },
    responses: { "200": listResponse(argusDmMessageResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/argus-dms/{conversationId}/messages",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Create an Argus DM message",
    operationId: "createArgusDmMessage",
    request: {
      params: argusDmConversationParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createArgusDmMessageBodySchema) },
      },
    },
    responses: {
      "201": successResponse(argusDmMessageResponseSchema, "Argus DM message created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/argus-dms/{conversationId}/messages/{messageId}",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Update an Argus DM message",
    operationId: "updateArgusDmMessage",
    request: {
      params: argusDmMessageParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateArgusDmMessageBodySchema) },
      },
    },
    responses: { "200": successResponse(argusDmMessageResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/argus-dms/{conversationId}/messages/{messageId}",
    tags: ["Argus DMs"],
    security: userOrServiceSecurity,
    summary: "Delete an Argus DM message",
    operationId: "deleteArgusDmMessage",
    request: { params: argusDmMessageParamsSchema },
    responses: { "204": { description: "Argus DM message deleted" }, ...standardErrorResponses },
  });
}
