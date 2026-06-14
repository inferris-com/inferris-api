import type { Request, RequestHandler } from "express";

import { config } from "../../config.js";
import { ForbiddenError, UnauthorizedError } from "../../error/app-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthService } from "./auth.service.js";
import { argusRoleRank, privilegedRoleRank, type ApiScope } from "./auth.types.js";
import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";

type RoutePolicy = {
  apiScopes?: ApiScope[];
  argusRole?: ArgusAccountRole;
  privilegedRole?: UserPrivilegeRole;
};

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

      void repo.insertAuditLog({
        actorId: req.auth.actorId,
        principalType: req.auth.principalType,
        principalId: req.auth.principalId,
        platform: req.auth.platform,
        action,
        result: "allowed",
        metadata: {
          method: req.method,
          path: req.originalUrl,
        },
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

    if (
      !req.auth.actorId ||
      !(await repo.actorHasMinecraftPermission(req.auth.actorId, permissionKey))
    ) {
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
    actorId: req.auth.actorId,
    principalType: req.auth.principalType,
    principalId: req.auth.principalId,
    platform: req.auth.platform,
    action: `${req.method} ${req.originalUrl}`,
    result: "denied",
    reason: "Insufficient permissions",
    metadata: {
      path: req.originalUrl,
      policy,
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
