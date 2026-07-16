import type { PasswordSecurityCue } from "./account.response-types.js";

export function toAccountResponse(
  row: {
    id: string;
    username: string;
    email: string;
    role: "moderator" | "admin";
    actor_id: string | null;
    account_state: "active" | "suspended" | "disabled" | "verify_email" | "reset_password";
    created_at_ms: string;
    updated_at_ms: string | null;
    actor_name: string | null;
    actor_type: string | null;
    privileged_id: string | null;
    privileged_role: "none" | "collaborator" | "moderator" | "administrator" | "superadmin" | null;
    privileged_title: string | null;
    privileged_status: string | null;
  },
  passwordSecurity: PasswordSecurityCue | null,
) {
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
          status: row.privileged_status ?? "active",
        }
      : null,
    accountState: row.account_state,
    passwordSecurity,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}
