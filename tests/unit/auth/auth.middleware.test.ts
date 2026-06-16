import { describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { requireMinecraftPermission } from "../../../src/module/auth/auth.middleware.js";
import type { AuthRepository } from "../../../src/module/auth/auth.repository.js";

describe("auth middleware", () => {
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
