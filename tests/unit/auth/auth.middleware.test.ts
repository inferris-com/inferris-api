import { describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import {
  authorize,
  requireActor,
  requireMinecraftPermission,
} from "../../../src/module/auth/auth.middleware.js";
import {
  parseApiScopes,
  type AuthRepository,
} from "../../../src/module/auth/auth.repository.js";

describe("auth middleware", () => {
  test("parseApiScopes accepts legacy nested scope arrays", () => {
    expect(parseApiScopes([["players:read"], "servers:read"])).toEqual([
      "players:read",
      "servers:read",
    ]);
  });

  test("authorize treats Argus role and privileged role policies as alternate authorities", async () => {
    const insertAuditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const repo = { insertAuditLog } as unknown as AuthRepository;
    const req = {
      auth: {
        principalType: "argus_user",
        principalId: "argus-user-1",
        actorId: "00000000-0000-0000-0000-000000000005",
        platform: "argus",
        argus: {
          userId: "argus-user-1",
          role: "moderator",
        },
      },
    } as Request;
    const next = jest.fn() as NextFunction;

    await authorize(repo, {
      apiScopes: ["moderation:write"],
      argusRole: "moderator",
      privilegedRole: "moderator",
    })(req, {} as Response, next);

    expect(insertAuditLog).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test("authorize still allows privileged actors without Argus auth", async () => {
    const insertAuditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const repo = { insertAuditLog } as unknown as AuthRepository;
    const req = {
      auth: {
        principalType: "minecraft_session",
        principalId: "minecraft-actor-1",
        actorId: "00000000-0000-0000-0000-000000000005",
        platform: "minecraft",
        privileged: {
          id: "privileged-subject-1",
          role: "moderator",
        },
      },
    } as unknown;
    const next = jest.fn() as NextFunction;

    await authorize(repo, {
      apiScopes: ["moderation:write"],
      argusRole: "moderator",
      privilegedRole: "moderator",
    })(req as Request, {} as Response, next);

    expect(insertAuditLog).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test("requireActor rejects service credentials without a resolved actor", () => {
    const req = {
      auth: {
        principalType: "server_api_key",
        principalId: "server-key-1",
        actorId: null,
        credentialOwnerActorId: "00000000-0000-0000-0000-000000000005",
        platform: "minecraft",
        apiKey: {
          id: "server-key-1",
          scopes: ["moderation:write"],
          isSuperKey: false,
        },
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    requireActor()(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ACTOR_REQUIRED",
        message: "This endpoint requires an actor-bearing credential.",
      }),
    );
  });

  test("requireActor accepts actor-bearing credentials", () => {
    const req = {
      auth: {
        principalType: "service_actor_api_key",
        principalId: "service-key-1",
        actorId: "00000000-0000-0000-0000-000000000006",
        platform: "minecraft",
        apiKey: {
          id: "service-key-1",
          scopes: ["moderation:write"],
          isSuperKey: false,
        },
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    requireActor()(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  test("requireMinecraftPermission evaluates the resolved actor", async () => {
    const actorHasMinecraftPermission = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(true);
    const insertAuditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const repo = {
      actorHasMinecraftPermission,
      insertAuditLog,
    } as unknown as AuthRepository;
    const req = {
      auth: {
        principalType: "server_api_key",
        principalId: "server-key-1",
        actorId: "00000000-0000-0000-0000-000000000006",
        credentialOwnerActorId: "00000000-0000-0000-0000-000000000005",
        platform: "minecraft",
        apiKey: {
          id: "server-key-1",
          scopes: ["minecraft:permission-check"],
          isSuperKey: false,
        },
      },
    } as Request;
    const next = jest.fn() as NextFunction;

    await requireMinecraftPermission(repo, "server.lockdown.bypass")(req, {} as Response, next);

    expect(actorHasMinecraftPermission).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000006",
      "server.lockdown.bypass",
    );
    expect(next).toHaveBeenCalledWith();
  });
});
