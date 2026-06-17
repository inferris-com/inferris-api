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
  apiKeyOwnerActor: "00000000-0000-0000-0000-000000000005",
  actingActor: "00000000-0000-0000-0000-000000000006",
  unknownActor: "00000000-0000-0000-0000-000000000007",
  report: "00000000-0000-0000-0000-000000000008",
  modCase: "00000000-0000-0000-0000-000000000009",
  watchlist: "00000000-0000-0000-0000-00000000000a",
  chatMessage: "00000000-0000-0000-0000-00000000000b",
} as const;

export type TestDependencies = Omit<AppDependencies, "authRepository" | "services"> & {
  authRepository: {
    insertAuditLog: AsyncMock;
    actorExists: AsyncMock;
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
    chatMessage: {
      listMessages: AsyncMock;
      createMessage: AsyncMock;
      createBatch: AsyncMock;
    };
    modCase: {
      listModCases: AsyncMock;
      getModCase: AsyncMock;
      createModCase: AsyncMock;
      updateModCase: AsyncMock;
      listActors: AsyncMock;
      createActor: AsyncMock;
    };
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
    report: {
      listReports: AsyncMock;
      getReport: AsyncMock;
      createReport: AsyncMock;
      updateReport: AsyncMock;
      listComments: AsyncMock;
      createComment: AsyncMock;
    };
    server: {
      registerServer: AsyncMock;
      createServer: AsyncMock;
      createLockdown: AsyncMock;
      getServer: AsyncMock;
      getServerByName: AsyncMock;
      patchServer: AsyncMock;
      updateAccessPolicy: AsyncMock;
      patchLockdown: AsyncMock;
      getAccessPolicy: AsyncMock;
      getLockdownByServer: AsyncMock;
      getActiveGlobalLockdown: AsyncMock;
      deleteServer: AsyncMock;
      deletePolicy: AsyncMock;
      deleteLockdown: AsyncMock;
    };
    watchlist: {
      listEntries: AsyncMock;
      getActiveEntry: AsyncMock;
      addEntry: AsyncMock;
      clearEntry: AsyncMock;
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

const serverApiKeyAuth: AuthContext = {
  principalType: "server_api_key",
  principalId: "server-key-1",
  actorId: ids.apiKeyOwnerActor,
  platform: "minecraft",
  apiKey: {
    id: "server-key-1",
    scopes: ["*"],
    isSuperKey: false,
  },
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
      req.auth = structuredClone(adminAuth);
      next();
      return;
    }

    if (authorization === "Bearer moderator-token") {
      req.auth = structuredClone(moderatorAuth);
      next();
      return;
    }

    if (authorization === "Bearer unprivileged-token") {
      req.auth = structuredClone(unprivilegedModeratorAuth);
      next();
      return;
    }

    if (authorization === "ApiKey server-token") {
      req.auth = structuredClone(serverApiKeyAuth);
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
      actorExists: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation((actorId) => Promise.resolve(actorId !== ids.unknownActor)),
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
      chatMessage: {
        listMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createMessage: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createBatch: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      modCase: {
        listModCases: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listActors: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createActor: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
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
      report: {
        listReports: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listComments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createComment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      server: {
        registerServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getServerByName: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        patchServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateAccessPolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        patchLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getAccessPolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getLockdownByServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getActiveGlobalLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deletePolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      watchlist: {
        listEntries: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getActiveEntry: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        addEntry: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        clearEntry: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
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
