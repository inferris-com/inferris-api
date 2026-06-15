import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { UnauthorizedError } from "../../error/app-error.js";
import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { AuthTokenResponse, AuthUserResponse } from "./auth.response-types.js";
import {
  type LoginBody,
  loginBodySchema,
  type LogoutBody,
  logoutBodySchema,
  type RefreshBody,
  refreshBodySchema,
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(
  service: AuthService,
  authenticateRequest: RequestHandler,
): Router {
  const router = Router();

  const login: RequestHandler<ParamsDictionary, unknown, LoginBody> = async (req, res) => {
    const result = await service.login(req.body);
    const body: ApiSuccess<AuthTokenResponse> = { data: result };

    res.status(201).json(body);
  };

  const refresh: RequestHandler<ParamsDictionary, unknown, RefreshBody> = async (req, res) => {
    const result = await service.refresh(req.body.refreshToken);
    const body: ApiSuccess<AuthTokenResponse> = { data: result };

    res.json(body);
  };

  const logout: RequestHandler<ParamsDictionary, unknown, LogoutBody> = async (req, res) => {
    await service.logout(req.body.refreshToken);
    res.status(204).send();
  };

  const me: RequestHandler = async (req, res) => {
    if (!req.auth) {
      throw new UnauthorizedError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const user = await service.getCurrentUser(req.auth);
    const body: ApiSuccess<AuthUserResponse> = { data: user };

    res.json(body);
  };

  router.post("/login", validateRequest({ body: loginBodySchema }), login);
  router.post("/refresh", validateRequest({ body: refreshBodySchema }), refresh);
  router.post("/logout", validateRequest({ body: logoutBodySchema }), logout);
  router.get("/me", authenticateRequest, me);

  return router;
}
