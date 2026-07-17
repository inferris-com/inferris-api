import type { Request, RequestHandler } from "express";

import { config } from "../../config.js";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../../error/app-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthService } from "./auth.service.js";
import { argusRoleRank, privilegedRoleRank, type ApiScope } from "./auth.types.js";
import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";

type RoutePolicy = {
  apiScopes?: ApiScope[];
  privilegedRole?: UserPrivilegeRole;
  argusRole?: ArgusAccountRole;
};

type Credential = {
  kind: "bearer" | "api_key" | "minecraft_session";
  token: string;
};

export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const credential = getCredential(req);

    if (!credential) {
      next(unauthorized("Missing authentication credentials"));
      return;
    }

    const auth = await authenticateCredential(service, credential, req);

    if (!auth) {
      next(unauthorized("Invalid authentication credentials"));
      return;
    }

    req.auth = auth;
    next();
  };
}

export function requireActor(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!req.auth.actorId) {
      next(
        new ValidationError({
          code: "ACTOR_REQUIRED",
          message: "This endpoint requires an actor-bearing credential.",
        }),
      );
      return;
    }

    next();
  };
}

export function requireMinecraftSession(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!req.auth.minecraftSession) {
      next(
        new ValidationError({
          code: "MINECRAFT_SESSION_REQUIRED",
          message: "This endpoint requires a Minecraft session credential.",
        }),
      );
      return;
    }

    next();
  };
}

export function requireServerInstance(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!req.auth.serverInstance) {
      next(
        new ForbiddenError({
          code: "SERVER_INSTANCE_REQUIRED",
          message: "This endpoint requires a server instance bearer token.",
        }),
      );
      return;
    }

    next();
  };
}

export function requireProxyServerInstance(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!req.auth.serverInstance) {
      next(
        new ForbiddenError({
          code: "SERVER_INSTANCE_REQUIRED",
          message: "This endpoint requires a server instance bearer token.",
        }),
      );
      return;
    }

    if (req.auth.serverInstance.serverType !== "velocity") {
      next(
        new ForbiddenError({
          code: "PROXY_INSTANCE_REQUIRED",
          message: "Canonical session events require an authenticated proxy instance.",
        }),
      );
      return;
    }

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
        ...(req.auth.credentialOwnerActorId
          ? { credentialOwnerActorId: req.auth.credentialOwnerActorId }
          : {}),
      };

      void repo.insertAuditLog({
        actorId: getRequestActorId(req),
        ...(req.auth.credentialOwnerActorId
          ? { subjectActorId: req.auth.credentialOwnerActorId }
          : {}),
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

    const actorId = getRequestActorId(req);

    if (!actorId || !(await repo.actorHasMinecraftPermission(actorId, permissionKey))) {
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

export function getRequestActorId(req: Request): string | null {
  return req.auth?.actorId ?? null;
}

export function protectFields(fields: string[]): RequestHandler {
  return (req, res, next) => {
    const auth = req.auth;

    const hasAccess =
      (auth?.privileged?.role !== undefined && auth.privileged.role !== "none") ||
      auth?.apiKey?.scopes?.includes("players:bypass-sensitive-fields") === true ||
      auth?.apiKey?.isSuperKey === true;

    if (hasAccess) {
      next();
      return;
    }

    const protectedFields = new Set(fields);

    const sanitize = (value: unknown): void => {
      if (value === null || typeof value !== "object") {
        return;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          sanitize(item);
        }

        return;
      }

      const object = value as Record<string, unknown>;

      for (const [key, child] of Object.entries(object)) {
        if (protectedFields.has(key)) {
          object[key] = null;
          continue;
        }

        sanitize(child);
      }
    };

    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      sanitize(body);
      return originalJson(body);
    }) as typeof res.json;

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
    return true;
  }

  if (policy.argusRole && req.auth?.argus) {
    return argusRoleRank[req.auth.argus.role] >= argusRoleRank[policy.argusRole];
  }

  if (policy.privilegedRole) {
    return isPrivilegedAllowed(req, policy);
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
    actorId: getRequestActorId(req),
    ...(req.auth.credentialOwnerActorId ? { subjectActorId: req.auth.credentialOwnerActorId } : {}),
    principalType: req.auth.principalType,
    principalId: req.auth.principalId,
    platform: req.auth.platform,
    action: `${req.method} ${req.originalUrl}`,
    result: "denied",
    reason: "Insufficient permissions",
    metadata: {
      path: req.originalUrl,
      policy,
      ...(req.auth.credentialOwnerActorId
        ? { credentialOwnerActorId: req.auth.credentialOwnerActorId }
        : {}),
    },
  });
}

async function authenticateCredential(service: AuthService, credential: Credential, req: Request) {
  if (credential.kind === "bearer") {
    return service.authenticateAccessToken(credential.token);
  }

  if (credential.kind === "api_key") {
    return service.authenticateApiKey(credential.token);
  }

  const sessionAuth = await service.authenticateMinecraftSession(credential.token);

  if (!sessionAuth) {
    return null;
  }

  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return sessionAuth;
  }

  const apiKeyAuth = await service.authenticateApiKey(apiKey);

  if (!apiKeyAuth) {
    return null;
  }

  return {
    ...apiKeyAuth,
    actorId: sessionAuth.actorId,
    ...(sessionAuth.privileged ? { privileged: sessionAuth.privileged } : {}),
    ...(sessionAuth.minecraftSession ? { minecraftSession: sessionAuth.minecraftSession } : {}),
  };
}

function getCredential(req: Request): Credential | null {
  const authorization = req.header("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return { kind: "bearer", token: authorization.slice("Bearer ".length).trim() };
  }

  if (authorization?.startsWith("MinecraftSession ")) {
    return {
      kind: "minecraft_session",
      token: authorization.slice("MinecraftSession ".length).trim(),
    };
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
