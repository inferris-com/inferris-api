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
  argusDmConversation: "00000000-0000-0000-0000-00000000000c",
  argusDmMessage: "00000000-0000-0000-0000-00000000000d",
} as const;

export type TestDependencies = Omit<AppDependencies, "authRepository" | "services"> & {
  authRepository: {
    insertAuditLog: AsyncMock;
    actorExists: AsyncMock;
    actorHasMinecraftPermission: AsyncMock;
  };
  services: {
    actor: {
      listActors: AsyncMock;
      searchActors: AsyncMock;
      findActorById: AsyncMock;
      findActorByPlayerId: AsyncMock;
      updateActorById: AsyncMock;
    };
    account: {
      getAccount: AsyncMock;
      changePassword: AsyncMock;
      changePasswordSecurityLock: AsyncMock;
      listSessions: AsyncMock;
      revokeSession: AsyncMock;
      listNotifications: AsyncMock;
      markNotificationRead: AsyncMock;
    };
    argusAlert: {
      listAlerts: AsyncMock;
      getAlert: AsyncMock;
      createAlert: AsyncMock;
      updateAlert: AsyncMock;
      deactivateAlert: AsyncMock;
    };
    argusDm: {
      listConversations: AsyncMock;
      getConversation: AsyncMock;
      createConversation: AsyncMock;
      updateConversation: AsyncMock;
      leaveConversation: AsyncMock;
      markConversationRead: AsyncMock;
      getUnreadCount: AsyncMock;
      listMessages: AsyncMock;
      createMessage: AsyncMock;
      updateMessage: AsyncMock;
      deleteMessage: AsyncMock;
    };
    argusUser: {
      listUsers: AsyncMock;
      getUser: AsyncMock;
      resolveUsers: AsyncMock;
      createUser: AsyncMock;
      updateUser: AsyncMock;
      disableUser: AsyncMock;
    };
    auth: {
      login: AsyncMock;
      refresh: AsyncMock;
      logout: AsyncMock;
      getCurrentUser: AsyncMock;
    };
    auditLog: {
      listAuditLogs: AsyncMock;
      getAuditLog: AsyncMock;
    };
    badge: {
      listBadges: AsyncMock;
      getBadge: AsyncMock;
      createBadge: AsyncMock;
      updateBadge: AsyncMock;
      deleteBadge: AsyncMock;
    };
    chatMessage: {
      listMessages: AsyncMock;
      createMessage: AsyncMock;
      createBatch: AsyncMock;
    };
    metrics: {
      getOverview: AsyncMock;
      getServerMetrics: AsyncMock;
    };
    modCase: {
      listModCases: AsyncMock;
      getModCase: AsyncMock;
      createModCase: AsyncMock;
      updateModCase: AsyncMock;
      listActors: AsyncMock;
      createActor: AsyncMock;
    };
    group: {
      listGroups: AsyncMock;
      getGroup: AsyncMock;
      createGroup: AsyncMock;
      updateGroup: AsyncMock;
      deleteGroup: AsyncMock;
    };
    permission: {
      findPermissionByKey: AsyncMock;
      findPermissionRuleByMinRank: AsyncMock;
      createPermissionNode: AsyncMock;
      replacePermissionRule: AsyncMock;
    };
    player: {
      listPlayers: AsyncMock;
      searchPlayers: AsyncMock;
      listFlagDefinitions: AsyncMock;
      encodeFlags: AsyncMock;
      decodeFlags: AsyncMock;
      getPlayer: AsyncMock;
      getPlayerByMojangId: AsyncMock;
      getProfile: AsyncMock;
      listBadgeAssignments: AsyncMock;
      listNicknames: AsyncMock;
      createPlayer: AsyncMock;
      updatePlayer: AsyncMock;
      updateProfile: AsyncMock;
      updateRankAssignment: AsyncMock;
      createBadgeAssignment: AsyncMock;
      assignNickname: AsyncMock;
      deletePlayer: AsyncMock;
      deleteRankAssignment: AsyncMock;
      deleteBadgeAssignment: AsyncMock;
      revokeActiveNickname: AsyncMock;
    };
    playerSession: {
      listSessions: AsyncMock;
      listLiveSessions: AsyncMock;
      getSession: AsyncMock;
    };
    punishment: {
      listPunishments: AsyncMock;
      getPunishment: AsyncMock;
      getPunishmentByCode: AsyncMock;
      createPunishment: AsyncMock;
      revokePunishment: AsyncMock;
    };
    rank: {
      listRanks: AsyncMock;
      getRank: AsyncMock;
      createRank: AsyncMock;
      updateRank: AsyncMock;
      deleteRank: AsyncMock;
    };
    report: {
      listReports: AsyncMock;
      getReport: AsyncMock;
      getReportByCode: AsyncMock;
      createReport: AsyncMock;
      updateReport: AsyncMock;
      listComments: AsyncMock;
      createComment: AsyncMock;
      updateComment: AsyncMock;
      deleteComment: AsyncMock;
    };
    server: {
      listServers: AsyncMock;
      registerServer: AsyncMock;
      expireInactiveServers: AsyncMock;
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
      startNetworkSession: AsyncMock;
      endNetworkSession: AsyncMock;
      startBackendSession: AsyncMock;
      endBackendSession: AsyncMock;
      startPlayerSession: AsyncMock;
      endPlayerSession: AsyncMock;
      heartbeat: AsyncMock;
      deleteServer: AsyncMock;
      deletePolicy: AsyncMock;
      deleteLockdown: AsyncMock;
    };
    serverInstance: {
      registerInstance: AsyncMock;
      getInstance: AsyncMock;
      heartbeat: AsyncMock;
      recordMetrics: AsyncMock;
      reconcilePresence: AsyncMock;
      processEvent: AsyncMock;
    };
    staffPrivilege: {
      listPrivileges: AsyncMock;
      listPrivilegesByActorId: AsyncMock;
      getPrivilege: AsyncMock;
      createPrivilege: AsyncMock;
      updatePrivilege: AsyncMock;
      revokePrivilege: AsyncMock;
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
  argus: { userId: "argus-admin", role: "admin", sessionId: ids.chatMessage },
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
  actorId: null,
  platform: "minecraft",
  apiKey: {
    id: "server-key-1",
    scopes: ["*"],
    isSuperKey: false,
  },
};

const serverInstanceAuth: AuthContext = {
  principalType: "server_instance",
  principalId: ids.chatMessage,
  actorId: null,
  platform: "minecraft",
  serverInstance: {
    id: ids.chatMessage,
    serverId: ids.server,
    serverType: "velocity",
    state: "active",
  },
};

const readOnlyApiKeyAuth: AuthContext = {
  principalType: "server_api_key",
  principalId: "read-only-key-1",
  actorId: null,
  platform: "minecraft",
  apiKey: {
    id: "read-only-key-1",
    scopes: ["players:read"],
    isSuperKey: false,
  },
};

const serviceActorApiKeyAuth: AuthContext = {
  principalType: "service_actor_api_key",
  principalId: "service-actor-key-1",
  actorId: ids.apiKeyOwnerActor,
  platform: "minecraft",
  credentialOwnerActorId: ids.apiKeyOwnerActor,
  apiKey: {
    id: "service-actor-key-1",
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

    if (authorization === "Bearer instance-token") {
      req.auth = structuredClone(serverInstanceAuth);
      next();
      return;
    }

    if (authorization === "ApiKey server-token") {
      req.auth = structuredClone(serverApiKeyAuth);
      next();
      return;
    }

    if (
      authorization === "MinecraftSession player-token" &&
      req.header("x-api-key") === "server-token"
    ) {
      req.auth = {
        ...structuredClone(serverApiKeyAuth),
        actorId: ids.actor,
        minecraftSession: {
          playerId: ids.player,
          mojangId: ids.player,
          proxyServerId: ids.server,
          networkSessionId: ids.chatMessage,
        },
      };
      next();
      return;
    }

    if (authorization === "ApiKey read-only-token") {
      req.auth = structuredClone(readOnlyApiKeyAuth);
      next();
      return;
    }

    if (authorization === "ApiKey service-actor-token") {
      req.auth = structuredClone(serviceActorApiKeyAuth);
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
      actor: {
        listActors: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        searchActors: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findActorById: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findActorByPlayerId: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateActorById: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      account: {
        getAccount: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        changePassword: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        changePasswordSecurityLock: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listSessions: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        revokeSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listNotifications: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        markNotificationRead: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      argusAlert: {
        listAlerts: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getAlert: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createAlert: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateAlert: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deactivateAlert: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      argusDm: {
        listConversations: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getConversation: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createConversation: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateConversation: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        leaveConversation: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        markConversationRead: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getUnreadCount: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createMessage: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateMessage: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteMessage: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      argusUser: {
        listUsers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        resolveUsers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        disableUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      auth: {
        login: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        refresh: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        logout: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getCurrentUser: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
          id: "argus-admin",
          username: "Admin",
          email: "admin@example.com",
          role: "admin",
          actorId: ids.actor,
          accountState: "active",
          accountSecurityLock: null,
          privilegedRole: "superadmin",
        }),
      },
      auditLog: {
        listAuditLogs: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getAuditLog: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      badge: {
        listBadges: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getBadge: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createBadge: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateBadge: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteBadge: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      chatMessage: {
        listMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createMessage: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createBatch: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      metrics: {
        getOverview: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getServerMetrics: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      modCase: {
        listModCases: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateModCase: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listActors: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createActor: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      group: {
        listGroups: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getGroup: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createGroup: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateGroup: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteGroup: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      permission: {
        findPermissionByKey: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findPermissionRuleByMinRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPermissionNode: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        replacePermissionRule: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      player: {
        listPlayers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        searchPlayers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listFlagDefinitions: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        encodeFlags: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        decodeFlags: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPlayerByMojangId: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getProfile: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listBadgeAssignments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listNicknames: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updatePlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateProfile: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateRankAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createBadgeAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        assignNickname: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deletePlayer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteRankAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteBadgeAssignment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        revokeActiveNickname: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      playerSession: {
        listSessions: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listLiveSessions: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      punishment: {
        listPunishments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPunishmentByCode: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        revokePunishment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      rank: {
        listRanks: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteRank: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      report: {
        listReports: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getReportByCode: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateReport: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listComments: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createComment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updateComment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteComment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      server: {
        listServers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        registerServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        expireInactiveServers: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
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
        startNetworkSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        endNetworkSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        startBackendSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        endBackendSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        startPlayerSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        endPlayerSession: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        heartbeat: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteServer: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deletePolicy: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        deleteLockdown: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      serverInstance: {
        registerInstance: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getInstance: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        heartbeat: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        recordMetrics: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        reconcilePresence: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        processEvent: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      staffPrivilege: {
        listPrivileges: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        listPrivilegesByActorId: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        getPrivilege: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        createPrivilege: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        updatePrivilege: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        revokePrivilege: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
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
