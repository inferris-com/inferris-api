import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "@/openapi/openapi.helpers.js";
import {
  chatMessageListResponseSchema,
  chatMessageResponseSchema,
} from "@/module/chat-message/chat-message.response-types.js";
import {
  createChatMessageBatchBodySchema,
  createChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from "@/module/chat-message/chat-message.schemas.js";

export function registerChatMessageOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/chat-messages",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "List chat messages",
    description:
      "Use include=identities to receive the actor and active player identity needed to render each row, including the active nickname when present. This expansion also requires actors:read and players:read for API keys, or an Argus moderator role. Archived players fall back to the actor identity.",
    operationId: "listChatMessages",
    request: { query: listChatMessagesQuerySchema },
    responses: {
      "200": {
        description: "Successful list response",
        content: {
          "application/json": jsonBody(chatMessageListResponseSchema),
        },
      },
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/chat-messages",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "Create a chat message",
    operationId: "createChatMessage",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createChatMessageBodySchema) },
      },
    },
    responses: {
      "202": successResponse(chatMessageResponseSchema, "Chat message accepted"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/chat-messages/batch",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "Create chat messages in a batch",
    operationId: "createChatMessagesInBatch",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createChatMessageBatchBodySchema) },
      },
    },
    responses: {
      "202": listResponse(chatMessageResponseSchema, "Chat messages accepted"),
      ...standardErrorResponses,
    },
  });
}
