import { config } from "../../config.js";
import { UnauthorizedError } from "../../error/app-error.js";
import { randomUUID } from "node:crypto";
import type { RedisClient } from "../../redis/index.js";
import {
  compareHashes,
  createRefreshToken,
  hashApiKeySecret,
  hashMinecraftSessionToken,
  hashRefreshToken,
  parseApiKeyToken,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "./auth.crypto.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthTokenResponse, AuthUserResponse } from "./auth.response-types.js";
import type { LoginBody } from "./auth.schemas.js";
import type { AuthContext } from "./auth.types.js";

type RefreshSession = {
  argusUserId: string;
  sessionId: string;
  createdAtMs: number;
};

type ArgusSessionState = RefreshSession & {
  refreshTokenHash: string;
  lastSeenAtMs: number;
  expiresAtMs: number;
  userAgent: string | null;
  ipAddress: string | null;
};

export type ArgusSessionResponse = {
  id: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  isCurrent: boolean;
  userAgent: string | null;
  ipAddress: string | null;
};

export type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type MinecraftSessionState = {
  actorId: string;
  playerId: string;
  mojangId: string;
  serverId: string;
  sessionEventId: string;
  issuedAtMs: number;
};

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly redis: RedisClient,
  ) {}

  async authenticateApiKey(token: string): Promise<AuthContext | null> {
    const parsed = parseApiKeyToken(token);

    // Middleware rejects if null
    if (!parsed) {
      return null;
    }

    const record = await this.repo.findApiKeyByPublicId(parsed.keyId);

    if (!record) {
      return null;
    }

    const actualHash = hashApiKeySecret(parsed.secret);

    if (!compareHashes(actualHash, record.keyHash)) {
      return null;
    }

    const actorId = record.principalType === "service_actor_api_key" ? record.ownerActorId : null;
    const privileged = await this.repo.findActivePrivilegedSubject(actorId);

    return {
      principalType: record.principalType,
      principalId: record.id,
      actorId,
      credentialOwnerActorId: record.ownerActorId,
      platform: record.platform,
      apiKey: {
        id: record.id,
        scopes: record.scopes,
        isSuperKey: record.isSuperKey,
      },
      ...(privileged ? { privileged } : {}),
    };
  }

  async authenticateMinecraftSession(token: string): Promise<AuthContext | null> {
    const state = await this.readMinecraftSession(token);

    if (!state) {
      return null;
    }

    const current = await this.repo.findCurrentPlayerSession(state.playerId);

    if (
      !current ||
      current.serverId !== state.serverId ||
      current.sessionEventId !== state.sessionEventId
    ) {
      return null;
    }

    const privileged = await this.repo.findActivePrivilegedSubject(state.actorId);

    return {
      principalType: "minecraft_session",
      principalId: state.sessionEventId,
      actorId: state.actorId,
      platform: "minecraft",
      minecraftSession: {
        playerId: state.playerId,
        mojangId: state.mojangId,
        serverId: state.serverId,
        sessionEventId: state.sessionEventId,
      },
      ...(privileged ? { privileged } : {}),
    };
  }

  async readMinecraftSession(token: string): Promise<MinecraftSessionState | null> {
    const raw = await this.redis.get(minecraftSessionTokenKey(hashMinecraftSessionToken(token)));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as MinecraftSessionState;
  }

  async authenticateAccessToken(token: string): Promise<AuthContext | null> {
    try {
      const payload = await verifyAccessToken(token);
      const user = await this.repo.findActiveArgusUserById(payload.sub);

      if (!user) {
        return null;
      }

      const privileged = await this.repo.findActivePrivilegedSubject(user.actorId);

      return {
        principalType: "argus_user",
        principalId: user.id,
        actorId: user.actorId,
        platform: "argus",
        argus: {
          userId: user.id,
          role: user.role,
          ...(payload.sessionId !== undefined ? { sessionId: payload.sessionId } : {}),
        },
        ...(privileged ? { privileged } : {}),
      };
    } catch {
      return null;
    }
  }

  async login(input: LoginBody, sessionMeta: SessionMeta = {}): Promise<AuthTokenResponse> {
    const user = await this.repo.findArgusUserByUsernameOrEmail(input.usernameOrEmail);

    if (!user) {
      throw invalidCredentials();
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);

    if (!passwordValid) {
      throw invalidCredentials();
    }

    return this.issueTokenResponse(user, sessionMeta);
  }

  async refresh(refreshToken: string, sessionMeta: SessionMeta = {}): Promise<AuthTokenResponse> {
    const sessionKey = refreshKey(hashRefreshToken(refreshToken));
    const rawSession = await this.redis.get(sessionKey);

    if (!rawSession) {
      throw invalidCredentials();
    }

    await this.redis.del(sessionKey);

    const session = JSON.parse(rawSession) as RefreshSession;
    const user = await this.repo.findActiveArgusUserById(session.argusUserId);

    if (!user) {
      throw invalidCredentials();
    }

    return this.issueTokenResponse(user, sessionMeta, session.sessionId);
  }

  async logout(refreshToken: string): Promise<void> {
    const sessionKey = refreshKey(hashRefreshToken(refreshToken));
    const rawSession = await this.redis.get(sessionKey);

    await this.redis.del(sessionKey);

    if (!rawSession) {
      return;
    }

    const session = JSON.parse(rawSession) as Partial<RefreshSession>;

    if (session.argusUserId && session.sessionId) {
      await this.redis.del(argusSessionKey(session.sessionId));
      await this.redis.sRem(argusUserSessionsKey(session.argusUserId), session.sessionId);
      await this.repo.revokeArgusSession({
        argusUserId: session.argusUserId,
        sessionId: session.sessionId,
        revokedByArgusUserId: session.argusUserId,
      });
    }
  }

  async getCurrentUser(auth: AuthContext): Promise<AuthUserResponse> {
    if (!auth.argus) {
      throw new UnauthorizedError({
        code: "ARGUS_AUTH_REQUIRED",
        message: "Argus user authentication required",
      });
    }

    const user = await this.repo.findActiveArgusUserById(auth.argus.userId);

    if (!user) {
      throw invalidCredentials();
    }

    return this.toAuthUserResponse(user);
  }

  async listArgusSessions(
    argusUserId: string,
    currentSessionId?: string | null,
  ): Promise<ArgusSessionResponse[]> {
    const sessions = await this.repo.listArgusSessions(argusUserId);

    return sessions.map((session) => ({
      id: session.id,
      createdAtMs: session.createdAtMs,
      lastSeenAtMs: session.lastSeenAtMs,
      expiresAtMs: session.expiresAtMs,
      revokedAtMs: session.revokedAtMs,
      isCurrent: currentSessionId === session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
    }));
  }

  async revokeArgusSession(
    argusUserId: string,
    sessionId: string,
    revokedByActorId?: string | null,
  ): Promise<boolean> {
    const raw = await this.redis.get(argusSessionKey(sessionId));
    let redisSession: ArgusSessionState | null = null;

    if (raw) {
      redisSession = JSON.parse(raw) as ArgusSessionState;
    }

    if (redisSession && redisSession.argusUserId !== argusUserId) {
      return false;
    }

    const revoked = await this.repo.revokeArgusSession({
      argusUserId,
      sessionId,
      revokedByArgusUserId: argusUserId,
      ...(revokedByActorId !== undefined ? { revokedByActorId } : {}),
    });

    if (!revoked) {
      if (!raw) {
        await this.redis.sRem(argusUserSessionsKey(argusUserId), sessionId);
      }

      return false;
    }

    await Promise.all([
      this.redis.del(argusSessionKey(sessionId)),
      ...(redisSession ? [this.redis.del(refreshKey(redisSession.refreshTokenHash))] : []),
      this.redis.sRem(argusUserSessionsKey(argusUserId), sessionId),
    ]);

    return true;
  }

  private async issueTokenResponse(user: {
    id: string;
    username: string;
    email: string;
    role: "moderator" | "admin";
    actorId: string | null;
  }, sessionMeta: SessionMeta, existingSessionId?: string): Promise<AuthTokenResponse> {
    const refreshToken = createRefreshToken();
    const now = Date.now();
    const sessionId = existingSessionId ?? randomUUID();
    const expiresAtMs = now + config.auth.refreshTokenTtlSeconds * 1000;
    const accessToken = await signAccessToken({
      sub: user.id,
      actorId: user.actorId,
      role: user.role,
      sessionId,
    });

    const session: RefreshSession = {
      argusUserId: user.id,
      sessionId,
      createdAtMs: now,
    };

    const existingSessionRaw = existingSessionId
      ? await this.redis.get(argusSessionKey(existingSessionId))
      : null;
    const existingSession = existingSessionRaw
      ? (JSON.parse(existingSessionRaw) as ArgusSessionState)
      : null;
    const sessionState: ArgusSessionState = {
      ...session,
      createdAtMs: existingSession?.createdAtMs ?? now,
      refreshTokenHash: refreshToken.tokenHash,
      lastSeenAtMs: now,
      expiresAtMs,
      userAgent: sessionMeta.userAgent ?? existingSession?.userAgent ?? null,
      ipAddress: sessionMeta.ipAddress ?? existingSession?.ipAddress ?? null,
    };

    await this.repo.upsertArgusSession({
      id: sessionId,
      argusUserId: user.id,
      nowMs: now,
      expiresAtMs,
      ipAddress: sessionState.ipAddress,
      userAgent: sessionState.userAgent,
    });
    await this.redis.set(refreshKey(refreshToken.tokenHash), JSON.stringify(session), {
      EX: config.auth.refreshTokenTtlSeconds,
    });
    await this.redis.set(argusSessionKey(sessionId), JSON.stringify(sessionState), {
      EX: config.auth.refreshTokenTtlSeconds,
    });
    await this.redis.sAdd(argusUserSessionsKey(user.id), sessionId);
    await this.redis.expire(argusUserSessionsKey(user.id), config.auth.refreshTokenTtlSeconds);

    const authUser = await this.toAuthUserResponse(user);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      tokenType: "Bearer",
      expiresInSeconds: config.auth.accessTokenTtlSeconds,
      user: authUser,
    };
  }

  private async toAuthUserResponse(user: {
    id: string;
    username: string;
    email: string;
    role: "moderator" | "admin";
    actorId: string | null;
  }): Promise<AuthUserResponse> {
    const privileged = await this.repo.findActivePrivilegedSubject(user.actorId);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      actorId: user.actorId,
      privilegedRole: privileged?.role ?? null,
    };
  }
}

function refreshKey(refreshTokenHash: string): string {
  return `auth:refresh:${refreshTokenHash}`;
}

export function argusSessionKey(sessionId: string): string {
  return `auth:argus-session:${sessionId}`;
}

export function argusUserSessionsKey(argusUserId: string): string {
  return `auth:argus-user-sessions:${argusUserId}`;
}

export function minecraftSessionTokenKey(tokenHash: string): string {
  return `auth:minecraft-session:token:${tokenHash}`;
}

export function minecraftSessionPlayerKey(playerId: string): string {
  return `auth:minecraft-session:player:${playerId}`;
}

function invalidCredentials(): UnauthorizedError {
  return new UnauthorizedError({
    code: "INVALID_CREDENTIALS",
    message: "Invalid credentials",
  });
}
