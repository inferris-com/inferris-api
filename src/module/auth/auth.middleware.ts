import type { Request, RequestHandler } from "express";

import { config } from "../../config.js";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../error/app-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthService } from "./auth.service.js";
import { argusRoleRank, privilegedRoleRank, type ApiScope } from "./auth.types.js";
import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";

type RoutePolicy = {
  apiScopes?: ApiScope[];
  privilegedRole?: UserPrivilegeRole;
  argusRole?: ArgusAccountRole;
};

const actingActorHeader = "x-inferris-actor-id";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const credential = getCredential(req);

    if (!credential) {
      next(unauthorized("Missing authentication credentials"));
      return;
    }

    const auth =
      credential.kind === "api_key"
        ? await service.authenticateApiKey(credential.token)
        : await service.authenticateAccessToken(credential.token);

    if (!auth) {
      next(unauthorized("Invalid authentication credentials"));
      return;
    }

    req.auth = auth;
    next();
  };
}

export function requireActingActor(repo: AuthRepository): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    const headerValue = req.header(actingActorHeader);

    if (!req.auth.apiKey) {
      if (headerValue !== undefined) {
        next(
          new ValidationError({
            code: "ACTING_ACTOR_HEADER_NOT_ALLOWED",
            message: "X-Inferris-Actor-Id is only accepted for API key requests",
          }),
        );
        return;
      }

      if (req.auth.actorId) {
        req.auth.actingActorId = req.auth.actorId;
      }

      next();
      return;
    }

    if (!headerValue) {
      next(
        new ValidationError({
          code: "ACTING_ACTOR_REQUIRED",
          message: "X-Inferris-Actor-Id is required for API key requests to this endpoint",
        }),
      );
      return;
    }

    if (!uuidPattern.test(headerValue)) {
      next(
        new ValidationError({
          code: "INVALID_ACTING_ACTOR",
          message: "X-Inferris-Actor-Id must be a valid actor UUID",
        }),
      );
      return;
    }

    if (!(await repo.actorExists(headerValue))) {
      next(
        new NotFoundError({
          code: "ACTING_ACTOR_NOT_FOUND",
          message: "Acting actor was not found",
        }),
      );
      return;
    }

    req.auth.actingActorId = headerValue;
    next();
  };
}

export function authorize(repo: AuthRepository, policy: RoutePolicy): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!isPolicyAllowed(req, policy)) {
      await auditDenied(repo, req, policy);
      next(
        new ForbiddenError({
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        }),
      );
      return;
    }

    next();
  };
}

export function auditMutation(repo: AuthRepository, action: string): RequestHandler {
  return (req, res, next) => {
    res.once("finish", () => {
      if (!req.auth || res.statusCode >= 400) {
        return;
      }

      const metadata = {
        method: req.method,
        path: req.originalUrl,
        ...(req.auth.apiKey ? { credentialOwnerActorId: req.auth.actorId } : {}),
      };

      void repo.insertAuditLog({
        actorId: getActingActorId(req),
        ...(req.auth.apiKey ? { subjectActorId: req.auth.actorId } : {}),
        principalType: req.auth.principalType,
        principalId: req.auth.principalId,
        platform: req.auth.platform,
        action,
        result: "allowed",
        metadata,
      });
    });

    next();
  };
}

export function requireMinecraftPermission(
  repo: AuthRepository,
  permissionKey: string,
): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    // Only trusted server-plugin API keys may perform permission checks.
    if (!hasApiScope(req, "minecraft:permission-check")) {
      await auditDenied(repo, req, { apiScopes: ["minecraft:permission-check"] });
      next(
        new ForbiddenError({
          code: "FORBIDDEN",
          message: "Minecraft permission checks require a trusted server-plugin API key",
        }),
      );
      return;
    }

    const actingActorId = getActingActorId(req);

    // Require both an acting actor and the requested Minecraft permission.
    if (!actingActorId || !(await repo.actorHasMinecraftPermission(actingActorId, permissionKey))) {
      await auditDenied(repo, req, { apiScopes: ["minecraft:permission-check"] });
      next(
        new ForbiddenError({
          code: "FORBIDDEN",
          message: "Minecraft permission denied",
        }),
      );
      return;
    }

    next();
  };
}

export function getActingActorId(req: Request): string | null {
  return req.auth?.actingActorId ?? req.auth?.actorId ?? null;
}

function isPolicyAllowed(req: Request, policy: RoutePolicy): boolean {
  const hasApiPolicy = policy.apiScopes && policy.apiScopes.length > 0;
  const hasArgusPolicy = Boolean(policy.argusRole);

  if (!hasApiPolicy && !hasArgusPolicy) {
    return isPrivilegedAllowed(req, policy);
  }

  if (hasApiPolicy && policy.apiScopes?.some((scope) => hasApiScope(req, scope))) {
    // API key scopes are credential authority. They do not borrow or require staff privilege.
    return true;
  }

  if (policy.argusRole && req.auth?.argus) {
    return (
      argusRoleRank[req.auth.argus.role] >= argusRoleRank[policy.argusRole] &&
      isPrivilegedAllowed(req, policy)
    );
  }

  return false;
}

function isPrivilegedAllowed(req: Request, policy: RoutePolicy): boolean {
  if (!policy.privilegedRole) {
    return true;
  }

  const actualRole = req.auth?.privileged?.role;

  return Boolean(
    actualRole && privilegedRoleRank[actualRole] >= privilegedRoleRank[policy.privilegedRole],
  );
}

function hasApiScope(req: Request, scope: ApiScope): boolean {
  const apiKey = req.auth?.apiKey;

  if (!apiKey) {
    return false;
  }

  if (apiKey.isSuperKey && !config.isProduction) {
    return true;
  }

  return apiKey.scopes.includes("*") || apiKey.scopes.includes(scope);
}

async function auditDenied(repo: AuthRepository, req: Request, policy: RoutePolicy): Promise<void> {
  if (!req.auth) {
    return;
  }

  await repo.insertAuditLog({
    actorId: getActingActorId(req),
    ...(req.auth.apiKey ? { subjectActorId: req.auth.actorId } : {}),
    principalType: req.auth.principalType,
    principalId: req.auth.principalId,
    platform: req.auth.platform,
    action: `${req.method} ${req.originalUrl}`,
    result: "denied",
    reason: "Insufficient permissions",
    metadata: {
      path: req.originalUrl,
      policy,
      ...(req.auth.apiKey ? { credentialOwnerActorId: req.auth.actorId } : {}),
    },
  });
}

function getCredential(req: Request): { kind: "bearer" | "api_key"; token: string } | null {
  const authorization = req.header("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return { kind: "bearer", token: authorization.slice("Bearer ".length).trim() };
  }

  if (authorization?.startsWith("ApiKey ")) {
    return { kind: "api_key", token: authorization.slice("ApiKey ".length).trim() };
  }

  const apiKey = req.header("x-api-key");

  return apiKey ? { kind: "api_key", token: apiKey } : null;
}

function unauthorized(message: string): UnauthorizedError {
  return new UnauthorizedError({
    code: "UNAUTHORIZED",
    message,
  });
}
