import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import { chatMessageResponseSchema } from "./chat-message.response-types.js";
import {
  createChatMessageBatchBodySchema,
  createChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from "./chat-message.schemas.js";

const chatMessageEnvelopeSchema = successEnvelopeSchema(
  "ChatMessageEnvelope",
  chatMessageResponseSchema,
);
const chatMessageListEnvelopeSchema = listEnvelopeSchema(
  "ChatMessageListEnvelope",
  chatMessageResponseSchema,
);

export function registerChatMessageOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/chat-messages",
    tags: ["Chat Messages"],
    security: userOrServiceSecurity,
    summary: "List chat messages",
    operationId: "listChatMessages",
    request: { query: listChatMessagesQuerySchema },
    responses: { "200": listResponse(chatMessageListEnvelopeSchema), ...standardErrorResponses },
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
      "202": successResponse(chatMessageEnvelopeSchema, "Chat message accepted"),
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
      "202": listResponse(chatMessageListEnvelopeSchema, "Chat messages accepted"),
      ...standardErrorResponses,
    },
  });
}
