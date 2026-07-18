/**
 * @deprecated Account schemas are owned by the account module.
 * Import from ../account/account.schemas.js instead.
 */
export {
  accountIdentityResponseSchema as argusAccountIdentityResponseSchema,
  accountRoleSchema as argusAccountRoleSchema,
  accountSecurityLockSchema as argusAccountSecurityLockSchema,
  accountStateSchema as argusAccountStateSchema,
} from "../account/account.schemas.js";

/**
 * @deprecated Password-security schemas are owned by the password-security module.
 * Import from ../password-security/password-security.schemas.js instead.
 */
export { passwordSecurityCueSchema } from "../password-security/password-security.schemas.js";
export type { PasswordSecurityCue } from "../password-security/password-security.schemas.js";
