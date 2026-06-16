import { sql } from "kysely";

import type { DbExecutor } from "../../db/index.js";
import type {
  ArgusAccountRole,
  Json,
  Platform,
  PrincipalType,
  UserPrivilegeRole,
} from "../../db/types.js";
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
  role: ArgusAccountRole;
  actorId: string | null;
};

export type PrivilegedRecord = {
  id: string;
  role: UserPrivilegeRole;
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
      scopes: parseScopes(row.permissions),
      isSuperKey: row.is_super_key,
    };
  }

  async findArgusUserByUsernameOrEmail(usernameOrEmail: string): Promise<ArgusAuthRecord | null> {
    const row = await this.db
      .selectFrom("argus_users")
      .select(["id", "username", "email", "password_hash", "role", "actor_id"])
      .where("account_state", "=", "active")
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
        }
      : null;
  }

  async findActiveArgusUserById(id: string): Promise<Omit<ArgusAuthRecord, "passwordHash"> | null> {
    const row = await this.db
      .selectFrom("argus_users")
      .select(["id", "username", "email", "role", "actor_id"])
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
      .innerJoin("player_ranks", "player_ranks.player_id", "actors.player_id")
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

function parseScopes(value: Json): ApiScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((scope): scope is ApiScope => typeof scope === "string");
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
