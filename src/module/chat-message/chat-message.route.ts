import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "@/middleware/validation.js";
import { authorizeListIdentities } from "@/module/actor/actor-summary.middleware.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import { auditMutation, authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type { ChatMessageResponse } from "@/module/chat-message/chat-message.response-types.js";
import {
  type CreateChatMessageBatchBody,
  createChatMessageBatchBodySchema,
  type CreateChatMessageBody,
  createChatMessageBodySchema,
  type ListChatMessagesQuery,
  listChatMessagesQuerySchema,
} from "@/module/chat-message/chat-message.schemas.js";
import type { ChatMessageService } from "@/module/chat-message/chat-message.service.js";

export function createChatMessageRouter(
  service: ChatMessageService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readChat = authorize(authRepository, {
    apiScopes: ["chat:read"],
    privilegedRole: "moderator",
    argusRole: "moderator",
  });
  const writeChat = authorize(authRepository, {
    apiScopes: ["chat:write"],
  });

  const listMessages: RequestHandler = async (req, res) => {
    const result = await service.listMessages(req.query as unknown as ListChatMessagesQuery);
    res.json(result);
  };

  const createMessage: RequestHandler<ParamsDictionary, unknown, CreateChatMessageBody> = async (
    req,
    res,
  ) => {
    const message = await service.createMessage(req.body);
    const body: ApiSuccess<ChatMessageResponse> = { data: message };

    res.status(202).json(body);
  };

  const createBatch: RequestHandler<ParamsDictionary, unknown, CreateChatMessageBatchBody> = async (
    req,
    res,
  ) => {
    const messages = await service.createBatch(req.body);
    const body: ApiListSuccess<ChatMessageResponse> = {
      data: messages,
      meta: { count: messages.length },
    };

    res.status(202).json(body);
  };

  router.get(
    "/",
    readChat,
    validateRequest({ query: listChatMessagesQuerySchema }) as unknown as RequestHandler,
    authorizeListIdentities(authRepository),
    listMessages,
  );
  router.post(
    "/",
    writeChat,
    auditMutation(authRepository, "chat-messages.create"),
    validateRequest({ body: createChatMessageBodySchema }),
    createMessage,
  );
  router.post(
    "/batch",
    writeChat,
    auditMutation(authRepository, "chat-messages.batch.create"),
    validateRequest({ body: createChatMessageBatchBodySchema }),
    createBatch,
  );

  return router;
}
