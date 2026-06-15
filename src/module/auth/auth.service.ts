import { config } from "../../config.js";
import { UnauthorizedError } from "../../error/app-error.js";
import type { RedisClient } from "../../redis/index.js";
import {
  compareHashes,
  createRefreshToken,
  hashApiKeySecret,
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
  createdAtMs: number;
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

    return {
      principalType: record.principalType,
      principalId: record.id,
      actorId: record.ownerActorId,
      platform: record.platform,
      apiKey: {
        id: record.id,
        scopes: record.scopes,
        isSuperKey: record.isSuperKey,
      },
    };
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
        },
        ...(privileged ? { privileged } : {}),
      };
    } catch {
      return null;
    }
  }

  async login(input: LoginBody): Promise<AuthTokenResponse> {
    const user = await this.repo.findArgusUserByUsernameOrEmail(input.usernameOrEmail);

    if (!user) {
      throw invalidCredentials();
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);

    if (!passwordValid) {
      throw invalidCredentials();
    }

    return this.issueTokenResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
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

    return this.issueTokenResponse(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.redis.del(refreshKey(hashRefreshToken(refreshToken)));
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

  private async issueTokenResponse(user: {
    id: string;
    username: string;
    role: "moderator" | "admin";
    actorId: string | null;
  }): Promise<AuthTokenResponse> {
    const accessToken = await signAccessToken({
      sub: user.id,
      actorId: user.actorId,
      role: user.role,
    });
    const refreshToken = createRefreshToken();

    const session: RefreshSession = {
      argusUserId: user.id,
      createdAtMs: Date.now(),
    };

    await this.redis.set(refreshKey(refreshToken.tokenHash), JSON.stringify(session), {
      EX: config.auth.refreshTokenTtlSeconds,
    });

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
    role: "moderator" | "admin";
    actorId: string | null;
  }): Promise<AuthUserResponse> {
    const privileged = await this.repo.findActivePrivilegedSubject(user.actorId);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      actorId: user.actorId,
      privilegedRole: privileged?.role ?? null,
    };
  }
}

function refreshKey(refreshTokenHash: string): string {
  return `auth:refresh:${refreshTokenHash}`;
}

function invalidCredentials(): UnauthorizedError {
  return new UnauthorizedError({
    code: "INVALID_CREDENTIALS",
    message: "Invalid credentials",
  });
}
