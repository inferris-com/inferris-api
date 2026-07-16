import { type RequestHandler, Router } from "express";

import { UnauthorizedError } from "../../error/app-error.js";
import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import {
  accountNotificationParamsSchema,
  accountSessionParamsSchema,
  changePasswordBodySchema,
  type AccountNotificationParams,
  type AccountSessionParams,
  type ChangePasswordBody,
} from "./account.schemas.js";
import type { AccountService } from "./account.service.js";
import type {
  AccountNotificationResponse,
  AccountResponse,
  ArgusSessionResponse,
  PasswordChangeResponse,
} from "./account.response-types.js";

export function createAccountRouter(service: AccountService): Router {
  const router = Router();

  const getAccount: RequestHandler = async (req, res) => {
    const auth = requireAuth(req);
    const account = await service.getAccount(auth);
    const body: ApiSuccess<AccountResponse> = { data: account };
    res.json(body);
  };

  const changePassword: RequestHandler<Record<string, never>, unknown, ChangePasswordBody> = async (
    req,
    res,
  ) => {
    const auth = requireAuth(req);
    const result = await service.changePassword(auth, req.body);
    const body: ApiSuccess<PasswordChangeResponse> = { data: result };
    res.json(body);
  };

  const listSessions: RequestHandler = async (req, res) => {
    const auth = requireAuth(req);
    const sessions = await service.listSessions(auth);
    const body: ApiListSuccess<ArgusSessionResponse> = {
      data: sessions,
      meta: { count: sessions.length },
    };
    res.json(body);
  };

  const revokeSession: RequestHandler<AccountSessionParams> = async (req, res) => {
    const auth = requireAuth(req);
    await service.revokeSession(auth, req.params.sessionId);
    res.status(204).send();
  };

  const listNotifications: RequestHandler = async (req, res) => {
    const auth = requireAuth(req);
    const notifications = await service.listNotifications(auth);
    const body: ApiListSuccess<AccountNotificationResponse> = {
      data: notifications,
      meta: { count: notifications.length },
    };
    res.json(body);
  };

  const markNotificationRead: RequestHandler<AccountNotificationParams> = async (req, res) => {
    const auth = requireAuth(req);
    await service.markNotificationRead(auth, req.params.notificationId);
    res.status(204).send();
  };

  router.get("/", getAccount);
  router.patch(
    "/password",
    validateRequest({ body: changePasswordBodySchema }),
    changePassword,
  );
  router.get("/sessions", listSessions);
  router.delete(
    "/sessions/:sessionId",
    validateRequest({ params: accountSessionParamsSchema }),
    revokeSession,
  );
  router.get("/notifications", listNotifications);
  router.patch(
    "/notifications/:notificationId/read",
    validateRequest({ params: accountNotificationParamsSchema }),
    markNotificationRead,
  );

  return router;
}

function requireAuth(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) {
    throw new UnauthorizedError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return req.auth;
}
