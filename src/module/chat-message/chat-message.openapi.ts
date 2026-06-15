import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createChatMessageBatchBodySchema,
  createChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from "./chat-message.schemas.js";

export function registerChatMessageOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/chat-messages",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "List chat messages",
    request: { query: listChatMessagesQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/chat-messages",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "Create a chat message",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createChatMessageBodySchema) },
      },
    },
    responses: { "202": successResponse("Chat message accepted"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/chat-messages/batch",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "Create chat messages in a batch",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createChatMessageBatchBodySchema) },
      },
    },
    responses: { "202": listResponse("Chat messages accepted"), ...standardErrorResponses },
  });
}
