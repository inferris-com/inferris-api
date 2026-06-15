import { jest } from "@jest/globals";
import type { RequestHandler } from "express";
import request from "supertest";

import type { AppDependencies } from "../../src/app/app.dependencies.js";
import { createApp } from "../../src/server.js";
import type { AuthContext } from "../../src/module/auth/auth.types.js";

type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

export const ids = {
  actor: "00000000-0000-0000-0000-000000000001",
  player: "00000000-0000-0000-0000-000000000002",
  server: "00000000-0000-0000-0000-000000000003",
  punishment: "00000000-0000-0000-0000-000000000004",
} as const;

export type TestDependencies = Omit<AppDependencies, "authRepository" | "services"> & {
  authRepository: {
    insertAuditLog: AsyncMock;
    actorHasMinecraftPermission: AsyncMock;
  };
  services: {
    actor: Record<string, never>;
    auth: {
      login: AsyncMock;
      refresh: AsyncMock;
      logout: AsyncMock;
      getCurrentUser: AsyncMock;
    };
    chatMessage: Record<string, never>;
    modCase: Record<string, never>;
    permission: {
      findPermissionByKey: AsyncMock;
      findPermissionRuleByMinRank: AsyncMock;
      createPermissionNode: AsyncMock;
      replacePermissionRule: AsyncMock;
    };
    player: {
      listPlayers: AsyncMock;
      listFlagDefinitions: AsyncMock;
      encodeFlags: AsyncMock;
      decodeFlags: AsyncMock;
      getPlayer: AsyncMock;
      getProfile: AsyncMock;
      listBadgeAssignments: AsyncMock;
      createPlayer: AsyncMock;
      updatePlayer: AsyncMock;
      updateProfile: AsyncMock;
      updateRankAssignment: AsyncMock;
      createBadgeAssignment: AsyncMock;
      deletePlayer: AsyncMock;
      deleteRankAssignment: AsyncMock;
      deleteBadgeAssignment: AsyncMock;
    };
    punishment: {
      listPunishments: AsyncMock;
      getPunishment: AsyncMock;
      createPunishment: AsyncMock;
      revokePunishment: AsyncMock;
    };
    report: Record<string, never>;
    server: {
      createServer: AsyncMock;
      createLockdown: AsyncMock;
      getServer: AsyncMock;
      patchServer: AsyncMock;
      updateAccessPolicy: AsyncMock;
      patchLockdown: AsyncMock;
      getAccessPolicy: AsyncMock;
      getLockdownByServer: AsyncMock;
      deleteServer: AsyncMock;
      deletePolicy: AsyncMock;
      deleteLockdown: AsyncMock;
    };
  };
};

const adminAuth: AuthContext = {
  principalType: "argus_user",
  principalId: "argus-admin",
  actorId: ids.actor,
  platform: "argus",
  argus: { userId: "argus-admin", role: "admin" },
  privileged: { id: "privileged-admin", role: "superadmin" },
};

const moderatorAuth: AuthContext = {
  principalType: "argus_user",
  principalId: "argus-moderator",
  actorId: ids.actor,
  platform: "argus",
  argus: { userId: "argus-moderator", role: "moderator" },
  privileged: { id: "privileged-moderator", role: "moderator" },
};

const unprivilegedModeratorAuth: AuthContext = {
  principalType: "argus_user",
  principalId: "argus-unprivileged",
  actorId: ids.actor,
  platform: "argus",
  argus: { userId: "argus-unprivileged", role: "moderator" },
};

function testAuthenticate(): RequestHandler {
  return (req, res, next) => {
    const authorization = req.header("authorization");

    if (!authorization) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing authentication credentials",
        },
      });
      return;
    }

    if (authorization === "Bearer admin-token") {
      req.auth = adminAuth;
      next();
      return;
    }

    if (authorization === "Bearer moderator-token") {
      req.auth = moderatorAuth;
      next();
      return;
    }

    if (authorization === "Bearer unprivileged-token") {
      req.auth = unprivilegedModeratorAuth;
      next();
      return;
    }

    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authentication credentials",
      },
    });
  };
}

export function createTestDependencies(): TestDependencies {
  const dependencies = {
    authRepository: {
      insertAuditLog: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
      actorHasMinecraftPermission: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(true),
    },
    authenticateRequest: testAuthenticate(),
    services: {
      actor: {},
      auth: {
        login: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        refresh: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        logout: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getCurrentUser: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
          id: "argus-admin",
          username: "Admin",
          role: "admin",
          actorId: ids.actor,
          privilegedRole: "superadmin",
        }),
      },
      chatMessage: {},
      modCase: {},
      permission: {
        findPermissionByKey: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findPermissionRuleByMinRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPermissionNode: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        replacePermissionRule: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      player: {
        listPlayers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listFlagDefinitions: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        encodeFlags: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        decodeFlags: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getProfile: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listBadgeAssignments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updatePlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateProfile: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateRankAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createBadgeAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deletePlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteRankAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteBadgeAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      punishment: {
        listPunishments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        revokePunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      report: {},
      server: {
        createServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        patchServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateAccessPolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        patchLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getAccessPolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getLockdownByServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deletePolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
    },
    workers: {
      chatMessageFlush: {
        start: jest.fn(),
        stop: jest.fn(),
      },
    },
  };

  return dependencies as unknown as TestDependencies;
}

export function createTestApp(dependencies = createTestDependencies()) {
  return {
    dependencies,
    request: request(createApp(dependencies as unknown as AppDependencies)),
  };
}
