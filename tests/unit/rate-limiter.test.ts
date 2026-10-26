import { describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { RateLimitedError, UnauthorizedError } from "@/error/app-error.js";
import { createRateLimiter, resolveRateLimitSubject } from "@/middleware/rate-limiter.js";
import type { AuthContext } from "@/module/auth/auth.types.js";
import type { RedisClient } from "@/redis/index.js";

const auth = {
  principalType: "api_key",
  principalId: "credential-1",
  actorId: "player-1",
  platform: "minecraft",
  apiKey: { id: "credential-1", scopes: [], isSuperKey: false },
} as unknown as AuthContext;

describe("rate limiter", () => {
  test("distinguishes acting actor and credential principal", () => {
    const context = { kind: "authenticated" as const, auth, ip: "127.0.0.1" };
    expect(resolveRateLimitSubject(context, "principal")).toBe("principal:api_key:credential-1");
    expect(resolveRateLimitSubject(context, "actor")).toBe("actor:player-1");
    expect(resolveRateLimitSubject(context, "ip")).toBe("ip:127.0.0.1");
    expect(resolveRateLimitSubject({ kind: "anonymous", ip: "::1" }, "principal")).toBeNull();
  });

  test("allows up to the cap and returns 429 with Retry-After", async () => {
    let count = 0;
    const exec = jest.fn(() => Promise.resolve([++count, 1, 25_000]));
    const transaction = {
      incr: () => transaction,
      pExpire: () => transaction,
      pTTL: () => transaction,
      exec,
    };
    const rateLimit = createRateLimiter({
      // Redis transaction types include generic extensions irrelevant to this fake.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      multi: () => transaction as unknown as ReturnType<RedisClient["multi"]>,
    });
    const middleware = rateLimit({
      name: "example",
      subject: "principal",
      maxRequests: 2,
      windowMs: 30_000,
    });
    const req = { auth, ip: "127.0.0.1" } as Request;
    const headers = new Map<string, string>();
    const res = {
      setHeader: (key: string, value: string) => {
        headers.set(key, value);
      },
    } as Response;
    const run = async () => {
      let error: unknown;
      const next: NextFunction = (nextError?: unknown) => {
        error = nextError;
      };
      await middleware(req, res, next);
      return error;
    };
    expect(await run()).toBeUndefined();
    expect(await run()).toBeUndefined();
    expect(await run()).toBeInstanceOf(RateLimitedError);
    expect(headers.get("Retry-After")).toBe("25");
    expect(exec).toHaveBeenCalledTimes(3);
  });

  test("rejects a missing required actor instead of using a shared fallback", async () => {
    const middleware = createRateLimiter({ multi: jest.fn<RedisClient["multi"]>() })({
      name: "actor-actions",
      subject: "actor",
      maxRequests: 5,
      windowMs: 60_000,
    });
    const req = { auth: { ...auth, actorId: null }, ip: "127.0.0.1" } as Request;
    const res = {} as Response;
    let failure: unknown;
    await middleware(req, res, ((error?: unknown) => {
      failure = error;
    }) as NextFunction);
    expect(failure).toBeInstanceOf(UnauthorizedError);
  });
});
