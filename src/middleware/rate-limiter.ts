import type { RequestHandler } from "express";

import { RateLimitedError, UnauthorizedError } from "@/error/app-error.js";
import type { AuthContext } from "@/module/auth/auth.types.js";
import type { RedisClient } from "@/redis/index.js";

/**
 * The credential principal identifies the caller; actor quotas can additionally
 * unify human-initiated actions across Argus and Minecraft.
 */
export type RateLimitContext =
  | { kind: "authenticated"; auth: AuthContext; ip: string }
  | { kind: "anonymous"; ip: string };

export type RateLimitSubject = "principal" | "actor" | "serverInstance" | "ip";

export type RateLimitPolicy = {
  /** Namespace shared by every route that should consume this quota. */
  name: string;
  subject: RateLimitSubject;
  maxRequests: number;
  windowMs: number;
};

type RateLimitStore = Pick<RedisClient, "multi">;

// MULTI/EXEC is atomic; PEXPIRE NX only starts a TTL for a new counter.
// Redis 7+ is required (the development stack uses Redis 8).

export function resolveRateLimitSubject(
  context: RateLimitContext,
  subject: RateLimitSubject,
): string | null {
  if (subject === "ip") {
    return `ip:${context.ip}`;
  }

  if (context.kind === "anonymous") {
    return null;
  }

  if (subject === "actor") {
    return context.auth.actorId ? `actor:${context.auth.actorId}` : null;
  }

  if (subject === "serverInstance") {
    return context.auth.serverInstance ? `instance:${context.auth.serverInstance.id}` : null;
  }

  // Limit a combined Minecraft-session/API-key request by the credential
  // principal rather than treating its acting player as the key's owner.
  return `principal:${context.auth.principalType}:${context.auth.principalId}`;
}

export function createRateLimiter(redis: RateLimitStore) {
  return (policy: RateLimitPolicy): RequestHandler => {
    if (
      !policy.name ||
      !Number.isSafeInteger(policy.maxRequests) ||
      policy.maxRequests < 1 ||
      !Number.isSafeInteger(policy.windowMs) ||
      policy.windowMs < 1
    ) {
      throw new Error("Invalid rate limit policy");
    }

    return async (req, res, next) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      const context: RateLimitContext = req.auth
        ? { kind: "authenticated", auth: req.auth, ip }
        : { kind: "anonymous", ip };

      const subject = resolveRateLimitSubject(context, policy.subject);
      if (!subject) {
        next(
          new UnauthorizedError({
            code: "RATE_LIMIT_IDENTITY_REQUIRED",
            message: "This endpoint requires an authenticated rate-limit subject.",
          }),
        );
        return;
      }

      try {
        const key = `rate-limit:v1:${policy.name}:${subject}`;
        const [rawCount, , rawTtl] = await redis
          .multi()
          .incr(key)
          .pExpire(key, policy.windowMs, "NX")
          .pTTL(key)
          .exec();
        const count = Number(rawCount);
        const ttl = Number(rawTtl);
        if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl < 0) {
          next(new Error("Invalid rate limiter Redis result"));
          return;
        }

        const remaining = Math.max(0, policy.maxRequests - count);
        res.setHeader("RateLimit-Limit", String(policy.maxRequests));
        res.setHeader("RateLimit-Remaining", String(remaining));

        if (count > policy.maxRequests) {
          const retryAfter = Math.max(1, Math.ceil(ttl / 1000));
          res.setHeader("Retry-After", String(retryAfter));
          next(
            new RateLimitedError({
              code: "RATE_LIMITED",
              message: "Too many requests. Please try again later.",
            }),
          );
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
