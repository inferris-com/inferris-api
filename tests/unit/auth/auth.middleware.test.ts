import { describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import {
  authorize,
  requireActingActor,
  requireMinecraftPermission,
} from "../../../src/module/auth/auth.middleware.js";
import type { AuthRepository } from "../../../src/module/auth/auth.repository.js";

describe("auth middleware", () => {
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
        principalType: "minecraft_actor",
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

  test("requireActingActor uses the API key owner actor when no acting actor header is supplied", async () => {
    const actorExists = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const repo = { actorExists } as unknown as AuthRepository;
    const req = {
      auth: {
        principalType: "argus_api_key",
        principalId: "argus-key-1",
        actorId: "00000000-0000-0000-0000-000000000005",
        platform: "argus",
        apiKey: {
          id: "argus-key-1",
          scopes: ["moderation:write"],
          isSuperKey: false,
        },
      },
      header: jest.fn<(...args: unknown[]) => unknown>().mockReturnValue(undefined),
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await requireActingActor(repo)(req, {} as Response, next);

    expect(req.auth?.actingActorId).toBe("00000000-0000-0000-0000-000000000005");
    expect(actorExists).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test("requireActingActor still requires an acting actor header for actorless API keys", async () => {
    const repo = {} as AuthRepository;
    const req = {
      auth: {
        principalType: "server_api_key",
        principalId: "server-key-1",
        actorId: null,
        platform: "minecraft",
        apiKey: {
          id: "server-key-1",
          scopes: ["moderation:write"],
          isSuperKey: false,
        },
      },
      header: jest.fn<(...args: unknown[]) => unknown>().mockReturnValue(undefined),
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await requireActingActor(repo)(req, {} as Response, next);

    expect(req.auth?.actingActorId).toBeUndefined();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ACTING_ACTOR_REQUIRED",
        message: "X-Inferris-Actor-Id is required for API key requests without an owner actor",
      }),
    );
  });

  test("requireMinecraftPermission evaluates the acting actor", async () => {
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
        actorId: "00000000-0000-0000-0000-000000000005",
        actingActorId: "00000000-0000-0000-0000-000000000006",
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
