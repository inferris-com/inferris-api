import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { ValidationError } from "@/error/app-error.js";
import { validateRequest } from "@/middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import { auditMutation, authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import type {
  ArgusDmConversationResponse,
  ArgusDmMessageResponse,
  ArgusDmUnreadCountResponse,
} from "@/module/argus/direct-messages/argus-dm.response-types.js";
import {
  argusDmConversationParamsSchema,
  type ArgusDmConversationParams,
  argusDmMessageParamsSchema,
  type ArgusDmMessageParams,
  createArgusDmConversationBodySchema,
  type CreateArgusDmConversationBody,
  createArgusDmMessageBodySchema,
  type CreateArgusDmMessageBody,
  listArgusDmConversationsQuerySchema,
  type ListArgusDmConversationsQuery,
  updateArgusDmConversationBodySchema,
  type UpdateArgusDmConversationBody,
  updateArgusDmMessageBodySchema,
  type UpdateArgusDmMessageBody,
} from "@/module/argus/direct-messages/argus-dm.schemas.js";
import type {
  ArgusDmConversationListResponse,
  ArgusDmService,
} from "@/module/argus/direct-messages/argus-dm.service.js";

export function createArgusDmRouter(
  service: ArgusDmService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const useArgusDms = authorize(authRepository, { argusRole: "moderator" });

  const listConversations: RequestHandler = async (req, res) => {
    const result = await service.listConversations(
      requireArgusUserId(req),
      req.query as unknown as ListArgusDmConversationsQuery,
    );

    res.json(result satisfies ArgusDmConversationListResponse);
  };

  const createConversation: RequestHandler<
    ParamsDictionary,
    unknown,
    CreateArgusDmConversationBody
  > = async (req, res) => {
    const conversation = await service.createConversation(req.body, requireArgusUserId(req));
    const body: ApiSuccess<ArgusDmConversationResponse> = { data: conversation };

    res.status(201).json(body);
  };

  const getUnreadCount: RequestHandler = async (req, res) => {
    const unreadCount = await service.getUnreadCount(requireArgusUserId(req));
    const body: ApiSuccess<ArgusDmUnreadCountResponse> = { data: unreadCount };

    res.json(body);
  };

  const getConversation: RequestHandler<ArgusDmConversationParams> = async (req, res) => {
    const conversation = await service.getConversation(
      req.params.conversationId,
      requireArgusUserId(req),
    );
    const body: ApiSuccess<ArgusDmConversationResponse> = { data: conversation };

    res.json(body);
  };

  const updateConversation: RequestHandler<
    ArgusDmConversationParams,
    unknown,
    UpdateArgusDmConversationBody
  > = async (req, res) => {
    const conversation = await service.updateConversation(
      req.params.conversationId,
      req.body,
      requireArgusUserId(req),
      requireArgusRole(req),
    );
    const body: ApiSuccess<ArgusDmConversationResponse> = { data: conversation };

    res.json(body);
  };

  const leaveConversation: RequestHandler<ArgusDmConversationParams> = async (req, res) => {
    await service.leaveConversation(req.params.conversationId, requireArgusUserId(req));

    res.status(204).send();
  };

  const markConversationRead: RequestHandler<ArgusDmConversationParams> = async (req, res) => {
    await service.markConversationRead(req.params.conversationId, requireArgusUserId(req));

    res.status(204).send();
  };

  const listMessages: RequestHandler<ArgusDmConversationParams> = async (req, res) => {
    const messages = await service.listMessages(req.params.conversationId, requireArgusUserId(req));
    const body: ApiListSuccess<ArgusDmMessageResponse> = {
      data: messages,
      meta: { count: messages.length },
    };

    res.json(body);
  };

  const createMessage: RequestHandler<
    ArgusDmConversationParams,
    unknown,
    CreateArgusDmMessageBody
  > = async (req, res) => {
    const message = await service.createMessage(
      req.params.conversationId,
      req.body,
      requireArgusUserId(req),
    );
    const body: ApiSuccess<ArgusDmMessageResponse> = { data: message };

    res.status(201).json(body);
  };

  const updateMessage: RequestHandler<
    ArgusDmMessageParams,
    unknown,
    UpdateArgusDmMessageBody
  > = async (req, res) => {
    const message = await service.updateMessage(
      req.params.conversationId,
      req.params.messageId,
      req.body,
      requireArgusUserId(req),
    );
    const body: ApiSuccess<ArgusDmMessageResponse> = { data: message };

    res.json(body);
  };

  const deleteMessage: RequestHandler<ArgusDmMessageParams> = async (req, res) => {
    await service.deleteMessage(
      req.params.conversationId,
      req.params.messageId,
      requireArgusUserId(req),
      requireArgusRole(req),
    );

    res.status(204).send();
  };

  router.get(
    "/",
    useArgusDms,
    validateRequest({ query: listArgusDmConversationsQuerySchema }) as unknown as RequestHandler,
    listConversations,
  );
  router.post(
    "/",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.conversations.create"),
    validateRequest({ body: createArgusDmConversationBodySchema }),
    createConversation,
  );
  router.get("/unread-count", useArgusDms, getUnreadCount);
  router.get(
    "/:conversationId",
    useArgusDms,
    validateRequest({ params: argusDmConversationParamsSchema }),
    getConversation,
  );
  router.patch(
    "/:conversationId",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.conversations.update"),
    validateRequest({
      params: argusDmConversationParamsSchema,
      body: updateArgusDmConversationBodySchema,
    }),
    updateConversation,
  );
  router.post(
    "/:conversationId/leave",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.conversations.leave"),
    validateRequest({ params: argusDmConversationParamsSchema }),
    leaveConversation,
  );
  router.post(
    "/:conversationId/read",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.conversations.read"),
    validateRequest({ params: argusDmConversationParamsSchema }),
    markConversationRead,
  );
  router.get(
    "/:conversationId/messages",
    useArgusDms,
    validateRequest({ params: argusDmConversationParamsSchema }),
    listMessages,
  );
  router.post(
    "/:conversationId/messages",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.messages.create"),
    validateRequest({
      params: argusDmConversationParamsSchema,
      body: createArgusDmMessageBodySchema,
    }),
    createMessage,
  );
  router.patch(
    "/:conversationId/messages/:messageId",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.messages.update"),
    validateRequest({ params: argusDmMessageParamsSchema, body: updateArgusDmMessageBodySchema }),
    updateMessage,
  );
  router.delete(
    "/:conversationId/messages/:messageId",
    useArgusDms,
    auditMutation(authRepository, "argus-dms.messages.delete"),
    validateRequest({ params: argusDmMessageParamsSchema }),
    deleteMessage,
  );

  return router;
}

function requireArgusUserId(req: Parameters<RequestHandler>[0]): string {
  const argusUserId = req.auth?.argus?.userId;

  if (!argusUserId) {
    throw new ValidationError({
      code: "ARGUS_USER_REQUIRED",
      message: "This endpoint requires an Argus user credential.",
    });
  }

  return argusUserId;
}

function requireArgusRole(req: Parameters<RequestHandler>[0]) {
  const role = req.auth?.argus?.role;

  if (!role) {
    throw new ValidationError({
      code: "ARGUS_USER_REQUIRED",
      message: "This endpoint requires an Argus user credential.",
    });
  }

  return role;
}
