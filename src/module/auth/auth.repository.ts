import { sql } from "kysely";

import type { DbExecutor } from "../../db/index.js";
import type { Json, Platform, PrincipalType } from "../../db/types.js";
import type { AccountRole, AccountSecurityLock, AccountState } from "../account/account.schemas.js";
import type { StaffPrivilegeRole } from "../staff-privilege/staff-privilege.schemas.js";
import type { ApiScope } from "./auth.types.js";

export type ApiKeyAuthRecord = {
  id: string;
  principalType: PrincipalType;
  platform: Platform;
  keyHash: string;
  ownerActorId: string;
  scopes: ApiScope[];
  isSuperKey: boolean;
};

export type ArgusAuthRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string | null;
  role: AccountRole;
  actorId: string | null;
  accountState: AccountState;
  accountSecurityLock: AccountSecurityLock | null;
};

export type PrivilegedRecord = {
  id: string;
  role: StaffPrivilegeRole;
};

export type CurrentNetworkSessionRecord = {
  playerId: string;
  proxyServerId: string;
  networkSessionId: string;
};

export type ServerInstanceAuthRecord = {
  id: string;
  serverId: string;
  serverType: string;
  state: string;
};

export type ArgusSessionRecord = {
  id: string;
  argusUserId: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type UpsertArgusSessionInput = {
  id: string;
  argusUserId: string;
  nowMs: number;
  expiresAtMs: number;
  ipAddress: string | null;
  userAgent: string | null;
};

export type RevokeArgusSessionInput = {
  argusUserId: string;
  sessionId: string;
  revokedByActorId?: string | null;
  revokedByArgusUserId?: string | null;
};

export type AuditInput = {
  actorId: string | null;
  subjectActorId?: string | null;
  principalType: PrincipalType | null;
  principalId: string | null;
  platform: Platform | null;
  source?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result: "allowed" | "denied" | "failed";
  reason?: string | null;
  metadata?: Json;
};

export class AuthRepository {
  constructor(private readonly db: DbExecutor) {}

  async findApiKeyByPublicId(keyId: string): Promise<ApiKeyAuthRecord | null> {
    const row = await this.db
      .selectFrom("api_keys")
      .select([
        "id",
        "key",
        "principal_type",
        "platform",
        "key_hash",
        "owner_actor_id",
        "permissions",
        "is_super_key",
      ])
      .where("is_active", "=", true)
      .where((eb) => eb.or([eb("id", "=", keyId), eb("key", "=", keyId)]))
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      principalType: row.principal_type,
      platform: row.platform,
      keyHash: row.key_hash,
      ownerActorId: row.owner_actor_id,
      scopes: parseApiScopes(row.permissions),
      isSuperKey: row.is_super_key,
    };
  }

  async findArgusUserByUsernameOrEmail(usernameOrEmail: string): Promise<ArgusAuthRecord | null> {
    const row = await this.db
      .selectFrom("argus_users")
      .select([
        "id",
        "username",
        "email",
        "password_hash",
        "role",
        "actor_id",
        "account_state",
        "account_security_lock",
      ])
      .where("account_state", "in", ["active", "suspended", "disabled", "verify_email"])

      .where((eb) =>
        eb.or([
          eb(sql`lower(username)`, "=", usernameOrEmail.toLowerCase()),
          eb(sql`lower(email)`, "=", usernameOrEmail.toLowerCase()),
        ]),
      )
      .executeTakeFirst();

    return row
      ? {
          id: row.id,
          username: row.username,
          email: row.email,
          passwordHash: row.password_hash,
          role: row.role,
          actorId: row.actor_id,
          accountState: row.account_state,
          accountSecurityLock: row.account_security_lock,
        }
      : null;
  }

  async findActiveArgusUserById(id: string): Promise<Omit<ArgusAuthRecord, "passwordHash"> | null> {
    const row = await this.db
      .selectFrom("argus_users")
      .select([
        "id",
        "username",
        "email",
        "role",
        "actor_id",
        "account_state",
        "account_security_lock",
      ])
      .where("id", "=", id)
      .where("account_state", "=", "active")
      .executeTakeFirst();

    return row
      ? {
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
          actorId: row.actor_id,
          accountState: row.account_state,
          accountSecurityLock: row.account_security_lock,
        }
      : null;
  }

  async findActivePrivilegedSubject(actorId: string | null): Promise<PrivilegedRecord | null> {
    if (!actorId) {
      return null;
    }

    const row = await this.db
      .selectFrom("privileged_subjects")
      .select(["id", "role"])
      .where("actor_id", "=", actorId)
      .where("status", "=", "active")
      .executeTakeFirst();

    return row ? { id: row.id, role: row.role } : null;
  }

  async actorExists(actorId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("id", "=", actorId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async actorHasMinecraftPermission(actorId: string, permissionKey: string): Promise<boolean> {
    const rules = await this.db
      .selectFrom("actors")
      .innerJoin("players", "players.actor_id", "actors.id")
      .innerJoin("player_ranks", "player_ranks.player_id", "players.id")
      .innerJoin("ranks", "ranks.key", "player_ranks.rank_key")
      .innerJoin("permission_policies", "permission_policies.rank_key", "ranks.key")
      .innerJoin("permission_nodes", "permission_nodes.id", "permission_policies.permission_id")
      .select(["permission_policies.effect", "permission_nodes.key"])
      .where("actors.id", "=", actorId)
      .where("permission_nodes.is_active", "=", true)
      .where("ranks.is_active", "=", true)
      .execute();

    // Keep only policy entries that apply to the requested permission key.
    const matchingEffects = rules
      .filter((rule) => permissionMatches(rule.key, permissionKey))
      .map((rule) => rule.effect);

    // Deny rules take precedence over allows.
    if (matchingEffects.includes("deny")) {
      return false;
    }

    return matchingEffects.includes("allow");
  }

  async findCurrentNetworkSession(playerId: string): Promise<CurrentNetworkSessionRecord | null> {
    const row = await this.db
      .selectFrom("network_sessions_current")
      .select(["player_id", "proxy_server_id", "network_session_id"])
      .where("player_id", "=", playerId)
      .executeTakeFirst();

    return row
      ? {
          playerId: row.player_id,
          proxyServerId: row.proxy_server_id,
          networkSessionId: row.network_session_id,
        }
      : null;
  }

  async findActiveServerInstanceByTokenHash(
    tokenHash: string,
  ): Promise<ServerInstanceAuthRecord | null> {
    const rows = await sql<{
      id: string;
      server_id: string;
      server_type: string;
      state: string;
    }>`
      SELECT
        si.id,
        si.server_id,
        s.type::text AS server_type,
        si.state::text AS state
      FROM server_instance_tokens sit
      INNER JOIN server_instances si ON si.id = sit.server_instance_id
      INNER JOIN servers s ON s.id = si.server_id
      WHERE sit.token_hash = ${tokenHash}
        AND sit.revoked_at_ms IS NULL
        AND si.state IN ('active', 'draining')
      LIMIT 1
    `.execute(this.db);

    const row = rows.rows[0];

    return row
      ? {
          id: row.id,
          serverId: row.server_id,
          serverType: row.server_type,
          state: row.state,
        }
      : null;
  }

  async upsertArgusSession(input: UpsertArgusSessionInput): Promise<void> {
    await this.db
      .insertInto("argus_sessions")
      .values({
        id: input.id,
        argus_user_id: input.argusUserId,
        created_at_ms: input.nowMs,
        last_seen_at_ms: input.nowMs,
        expires_at_ms: input.expiresAtMs,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          last_seen_at_ms: input.nowMs,
          expires_at_ms: input.expiresAtMs,
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
        }),
      )
      .execute();
  }

  async listArgusSessions(argusUserId: string): Promise<ArgusSessionRecord[]> {
    const rows = await this.db
      .selectFrom("argus_sessions")
      .select([
        "id",
        "argus_user_id",
        "created_at_ms",
        "last_seen_at_ms",
        "expires_at_ms",
        "revoked_at_ms",
        "ip_address",
        "user_agent",
      ])
      .where("argus_user_id", "=", argusUserId)
      .orderBy("last_seen_at_ms", "desc")
      .execute();

    return rows.map((row) => ({
      id: row.id,
      argusUserId: row.argus_user_id,
      createdAtMs: Number(row.created_at_ms),
      lastSeenAtMs: Number(row.last_seen_at_ms),
      expiresAtMs: Number(row.expires_at_ms),
      revokedAtMs: row.revoked_at_ms === null ? null : Number(row.revoked_at_ms),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    }));
  }

  async revokeArgusSession(input: RevokeArgusSessionInput): Promise<boolean> {
    const result = await this.db
      .updateTable("argus_sessions")
      .set({
        revoked_at_ms: sql`get_unix_ms()`,
        revoked_by_actor_id: input.revokedByActorId ?? null,
        revoked_by_argus_user_id: input.revokedByArgusUserId ?? null,
      })
      .where("id", "=", input.sessionId)
      .where("argus_user_id", "=", input.argusUserId)
      .where("revoked_at_ms", "is", null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async insertAuditLog(input: AuditInput): Promise<void> {
    await this.db
      .insertInto("audit_logs")
      .values({
        actor_id: input.actorId,
        subject_actor_id: input.subjectActorId ?? null,
        principal_type: input.principalType,
        principal_id: input.principalId,
        platform: input.platform,
        source: input.source ?? null,
        action: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        result: input.result,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
      })
      .execute();
  }
}

export function parseApiScopes(value: Json): ApiScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((scope) => {
    if (isApiScope(scope)) {
      return [scope];
    }

    return parseApiScopes(scope);
  });
}

function isApiScope(value: Json): value is ApiScope {
  return typeof value === "string";
}

function permissionMatches(policyKey: string, requestedKey: string): boolean {
  if (policyKey === requestedKey || policyKey === "*") {
    return true;
  }

  if (!policyKey.endsWith(".*")) {
    return false;
  }

  const prefix = policyKey.slice(0, -1);

  return requestedKey.startsWith(prefix);
}
