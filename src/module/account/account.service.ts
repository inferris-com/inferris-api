import { NotFoundError, UnauthorizedError } from "../../error/app-error.js";
import { hashPassword, verifyPassword } from "../auth/auth.crypto.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { PasswordSecurityService } from "../password-security/password-security.service.js";
import { toAccountResponse } from "./account.mapper.js";
import type { AccountPgRepository } from "./account.pg-repository.js";
import type {
  AccountNotificationResponse,
  AccountResponse,
  PasswordChangeResponse,
} from "./account.response-types.js";
import type { ChangePasswordBody } from "./account.schemas.js";
import { config } from "../../config.js";

const passwordSecurityNotificationId = "password-security:breached";

export class AccountService {
  constructor(
    private readonly repo: AccountPgRepository,
    private readonly authService: AuthService,
    private readonly passwordSecurityService: PasswordSecurityService,
  ) {}

  async getAccount(auth: AuthContext): Promise<AccountResponse> {
    const argusUserId = requireArgusUserId(auth);
    const account = await this.repo.findAccountById(argusUserId);
    // Grab cue from Redis if notify data breach is enabled in config
    const securityClue = config.argus.notifyDataBreach
      ? await this.passwordSecurityService.getPasswordSecurityCue(argusUserId)
      : null;

    if (!account) {
      throw new NotFoundError({
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found",
      });
    }

    return toAccountResponse(account, securityClue);
  }

  async changePassword(
    auth: AuthContext,
    input: ChangePasswordBody,
  ): Promise<PasswordChangeResponse> {
    const argusUserId = requireArgusUserId(auth);
    const current = await this.repo.findPasswordAuthById(argusUserId);

    if (!current || !(await verifyPassword(current.password_hash, input.currentPassword))) {
      throw new UnauthorizedError({
        code: "INVALID_CURRENT_PASSWORD",
        message: "Current password is invalid",
      });
    }

    // HIBP API breach check & update Redis
    const passwordSecurity = await this.passwordSecurityService.refreshPasswordSecurityCue(
      argusUserId,
      input.newPassword,
    );

    await this.repo.updatePassword(argusUserId, await hashPassword(input.newPassword));

    return { passwordSecurity };
  }

  async changePasswordSecurityLock(
    auth: AuthContext,
    input: ChangePasswordBody,
  ): Promise<PasswordChangeResponse> {
    const argusUserId = requireArgusUserId(auth);
    const current = await this.repo.findPasswordAuthById(argusUserId);

    if (!current || !(await verifyPassword(current.password_hash, input.currentPassword))) {
      throw new UnauthorizedError({
        code: "INVALID_CURRENT_PASSWORD",
        message: "Current password is invalid",
      });
    }

    const passwordSecurity = await this.passwordSecurityService.refreshPasswordSecurityCue(
      argusUserId,
      input.newPassword,
    );

    const passwordChanged = await this.repo.clearChangePasswordSecurityLock(
      argusUserId,
      await hashPassword(input.newPassword),
    );

    if (!passwordChanged) {
      throw new NotFoundError({
        code: "SECURITY_LOCK_NOT_FOUND",
        message: "No change-password security lock is active for this account.",
      });
    }

    return { passwordSecurity };
  }

  async listSessions(auth: AuthContext) {
    return this.authService.listArgusSessions(requireArgusUserId(auth), auth.argus?.sessionId);
  }

  async revokeSession(auth: AuthContext, sessionId: string): Promise<void> {
    const revoked = await this.authService.revokeArgusSession(
      requireArgusUserId(auth),
      sessionId,
      auth.actorId,
    );

    if (!revoked) {
      throw new NotFoundError({
        code: "ARGUS_SESSION_NOT_FOUND",
        message: "Argus session not found",
      });
    }
  }

  async listNotifications(auth: AuthContext): Promise<AccountNotificationResponse[]> {
    const argusUserId = requireArgusUserId(auth);
    const [accountNotifications, passwordSecurity] = await Promise.all([
      this.repo.listUnreadNotifications(argusUserId),
      config.argus.notifyDataBreach
        ? this.passwordSecurityService.getPasswordSecurityCue(argusUserId)
        : Promise.resolve(null),
    ]);

    const notifications: AccountNotificationResponse[] = accountNotifications.map(
      (notification) => ({
        id: notification.id,
        type: "notification" as const,
        title: notification.title,
        description: notification.description,
        priority: notification.priority,
      }),
    );

    if (passwordSecurity?.breached) {
      notifications.unshift({
        id: passwordSecurityNotificationId,
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

  async markNotificationRead(auth: AuthContext, notificationId: string): Promise<void> {
    const argusUserId = requireArgusUserId(auth);

    if (notificationId === passwordSecurityNotificationId) {
      // Remove cue from Redis
      await this.passwordSecurityService.clearPasswordSecurityCue(argusUserId);
      return;
    }

    const updated = await this.repo.markNotificationRead(argusUserId, notificationId);

    if (!updated) {
      throw new NotFoundError({
        code: "ACCOUNT_NOTIFICATION_NOT_FOUND",
        message: "Account notification not found",
      });
    }
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
