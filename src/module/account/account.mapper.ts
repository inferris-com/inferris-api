import type {
  ActorType,
  ArgusAccountRole,
  ArgusAccountSecurityLock,
  ArgusAccountStatus,
  UserPrivilegeRole,
} from "../../db/types.js";
import type { PasswordSecurityCue } from "../password-security/password-security.schemas.js";
import { staffPrivilegeStatusSchema } from "../staff-privilege/staff-privilege.schemas.js";
import type { AccountResponse } from "./account.response-types.js";

export function toAccountResponse(
  row: {
    id: string;
    username: string;
    email: string;
    role: ArgusAccountRole;
    actor_id: string | null;
    account_state: ArgusAccountStatus;
    account_security_lock: ArgusAccountSecurityLock | null;
    created_at_ms: string;
    updated_at_ms: string | null;
    actor_name: string | null;
    actor_type: ActorType | null;
    privileged_id: string | null;
    privileged_role: UserPrivilegeRole | null;
    privileged_title: string | null;
    privileged_status: string | null;
  },
  passwordSecurity: PasswordSecurityCue | null,
): AccountResponse {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    actorId: row.actor_id,
    linkedActor: row.actor_id
      ? {
          id: row.actor_id,
          name: row.actor_name,
          type: row.actor_type ?? "unspecified",
        }
      : null,
    privileged: row.privileged_id
      ? {
          id: row.privileged_id,
          role: row.privileged_role ?? "none",
          title: row.privileged_title,
          status: staffPrivilegeStatusSchema.parse(row.privileged_status ?? "active"),
        }
      : null,
    accountState: row.account_state,
    accountSecurityLock: row.account_security_lock,
    passwordSecurity,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}
