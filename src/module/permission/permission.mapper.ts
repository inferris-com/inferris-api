import type { PermissionNodes, PermissionPolicies } from "../../db/types.js";
import type {
  PermissionNodeResponse,
  PermissionRuleResponse,
} from "./permission.response-types.js";
import type {CreatePermissionNodeBody, ReplacePermissionRuleBody} from "./permission.schemas.js";
import type {Insertable, Selectable, Updateable} from "kysely";

export function toPermissionNodeResponse(row: Selectable<PermissionNodes>): PermissionNodeResponse {
  return {
    id: row.id,
    key: row.key,
    category: row.category,
    description: row.description,
    isActive: row.is_active,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  }
}
export function toPermissionRuleResponse(row: Selectable<PermissionPolicies>): PermissionRuleResponse {
  return {
    permissionId: row.permission_id,
    rankKey: row.rank_key,
    effect: row.effect,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  }
}

// Database rows
export function toPermissionRuleUpdate(permissionId: string, minRankKey: string, input: ReplacePermissionRuleBody): Updateable<PermissionPolicies> | Insertable<PermissionPolicies> {
  return {
    permission_id: permissionId,
    effect: input.effect,
  }
}

export function toPermissionNodeCreate(input: CreatePermissionNodeBody): Insertable<PermissionNodes> {
  return {
    key: input.key,
    category: input.category,
    description: input.description,
    is_active: input.isActive
  }
}
