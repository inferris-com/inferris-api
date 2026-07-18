/**
 * @deprecated Password security is owned by the password-security module.
 * Import from ../password-security/password-security.service.js instead.
 */
export { PasswordSecurityService } from "../password-security/password-security.service.js";

/** @deprecated Use PasswordSecurityService methods instead of accessing Redis keys directly. */
export const passwordSecurityKey = (accountId: string): string =>
  `account:password-security:${accountId}`;

/** @deprecated Account notifications own this identifier. */
export const passwordSecurityNotificationId = "password-security:breached";
