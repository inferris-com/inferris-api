import { createHash } from "node:crypto";

import { NotFoundError, UnauthorizedError } from "../../error/app-error.js";
import type { RedisClient } from "../../redis/index.js";
import { hashPassword, verifyPassword } from "../auth/auth.crypto.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import { toAccountResponse } from "./account.mapper.js";
import type { AccountPgRepository } from "./account.pg-repository.js";
import type {
  AccountNotificationResponse,
  AccountResponse,
  PasswordChangeResponse,
  PasswordSecurityCue,
} from "./account.response-types.js";
import type { ChangePasswordBody } from "./account.schemas.js";

const passwordSecurityTtlSeconds = 60 * 60 * 24 * 30;

export class AccountService {
  constructor(
    private readonly repo: AccountPgRepository,
    private readonly authService: AuthService,
    private readonly redis: RedisClient,
  ) {}

  async getAccount(auth: AuthContext): Promise<AccountResponse> {
    const argusUserId = requireArgusUserId(auth);
    const account = await this.repo.findAccountById(argusUserId);

    if (!account) {
      throw new NotFoundError({
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found",
      });
    }

    return toAccountResponse(account, await this.getPasswordSecurityCue(argusUserId));
  }

  async changePassword(auth: AuthContext, input: ChangePasswordBody): Promise<PasswordChangeResponse> {
    const argusUserId = requireArgusUserId(auth);
    const current = await this.repo.findPasswordAuthById(argusUserId);

    if (!current || !(await verifyPassword(current.password_hash, input.currentPassword))) {
      throw new UnauthorizedError({
        code: "INVALID_CURRENT_PASSWORD",
        message: "Current password is invalid",
      });
    }

    const passwordSecurity = await this.checkPasswordSecurity(input.newPassword);

    await this.repo.updatePassword(argusUserId, await hashPassword(input.newPassword));

    if (passwordSecurity) {
      await this.setPasswordSecurityCue(argusUserId, passwordSecurity);
    } else {
      await this.redis.del(passwordSecurityKey(argusUserId));
    }

    return { passwordSecurity };
  }

  async listSessions(auth: AuthContext) {
    return this.authService.listArgusSessions(requireArgusUserId(auth));
  }

  async revokeSession(auth: AuthContext, sessionId: string): Promise<void> {
    const revoked = await this.authService.revokeArgusSession(requireArgusUserId(auth), sessionId);

    if (!revoked) {
      throw new NotFoundError({
        code: "ARGUS_SESSION_NOT_FOUND",
        message: "Argus session not found",
      });
    }
  }

  async listNotifications(auth: AuthContext): Promise<AccountNotificationResponse[]> {
    const argusUserId = requireArgusUserId(auth);
    const [alerts, passwordSecurity] = await Promise.all([
      this.repo.listActiveAlerts(),
      this.getPasswordSecurityCue(argusUserId),
    ]);

    const notifications: AccountNotificationResponse[] = alerts.map((alert) => ({
      id: `alert:${alert.id}`,
      type: "alert" as const,
      title: alert.title,
      description: alert.description,
      priority: alert.priority,
    }));

    if (passwordSecurity?.breached) {
      notifications.unshift({
        id: "password-security:breached",
        type: "password_security",
        title: "Password found in public breaches",
        description:
          passwordSecurity.breachCount === null
            ? "Change your Argus password to a unique password."
            : `Change your Argus password. This password appears ${passwordSecurity.breachCount} times in known breach data.`,
        priority: 1000,
      });
    }

    return notifications;
  }

  private async checkPasswordSecurity(password: string): Promise<PasswordSecurityCue | null> {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          "User-Agent": "inferris-api",
          "Add-Padding": "true",
        },
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const match = text
        .split("\n")
        .map((line) => line.trim().split(":"))
        .find(([candidate]) => candidate === suffix);

      if (!match) {
        return null;
      }

      return {
        breached: true,
        breachCount: Number.parseInt(match[1] ?? "0", 10),
        checkedAtMs: Date.now(),
      };
    } catch {
      return null;
    }
  }

  private async getPasswordSecurityCue(argusUserId: string): Promise<PasswordSecurityCue | null> {
    const raw = await this.redis.get(passwordSecurityKey(argusUserId));

    return raw ? (JSON.parse(raw) as PasswordSecurityCue) : null;
  }

  private async setPasswordSecurityCue(
    argusUserId: string,
    cue: PasswordSecurityCue,
  ): Promise<void> {
    await this.redis.set(passwordSecurityKey(argusUserId), JSON.stringify(cue), {
      EX: passwordSecurityTtlSeconds,
    });
  }
}

function requireArgusUserId(auth: AuthContext): string {
  if (!auth.argus) {
    throw new UnauthorizedError({
      code: "ARGUS_AUTH_REQUIRED",
      message: "Argus user authentication required",
    });
  }

  return auth.argus.userId;
}

function passwordSecurityKey(argusUserId: string): string {
  return `account:password-security:${argusUserId}`;
}
