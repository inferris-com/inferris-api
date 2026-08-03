import type { Kysely, Selectable } from "kysely";
import type { DB, PermissionNodes, PermissionPolicies } from "@/db/types.js";
import type { DbExecutor } from "@/db/index.js";
import type {
  CreatePermissionNodeBody,
  ListPermissionsQuery,
  ReplacePermissionRuleBody,
} from "@/module/permission/permission.schemas.js";
import type { CreateResult } from "@/shared/results.types.js";
import {
  toPermissionNodeCreate,
  toPermissionRuleUpdate,
} from "@/module/permission/permission.mapper.js";

type CreatePermissionNodeResult = CreateResult<Selectable<PermissionNodes>>;
type ReplacePermissionRuleResult =
  | { status: "replaced"; rule: Selectable<PermissionPolicies> }
  | { status: "permission_key_not_found" }
  | { status: "min_rank_key_not_found" };

export class PermissionPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async createPermissionNode(input: CreatePermissionNodeBody): Promise<CreatePermissionNodeResult> {
    return await this.db.transaction().execute(async (trx) => {
      const permissionNode = await trx
        .insertInto("permission_nodes")
        .values(toPermissionNodeCreate(input))
        .returningAll()
        .onConflict((oc) => {
          return oc.doNothing();
        })
        .executeTakeFirst();

      if (!permissionNode) {
        return { status: "conflict" };
      }

      return { status: "created", data: permissionNode };
    });
  }

  // PUT /permissions/:permissionKey/rules/:minRankKey
  async replacePermissionRule(
    permissionKey: string,
    minRankKey: string,
    input: ReplacePermissionRuleBody,
  ): Promise<ReplacePermissionRuleResult> {
    return await this.db.transaction().execute(async (trx) => {
      const permissionRow = await trx
        .selectFrom("permission_nodes")
        .where("key", "=", permissionKey)
        .select("id")
        .executeTakeFirst();
      const minRankRow = await trx
        .selectFrom("ranks")
        .where("key", "=", minRankKey)
        .executeTakeFirst();

      if (!permissionRow) {
        return { status: "permission_key_not_found" };
      }

      if (!minRankRow) {
        return { status: "min_rank_key_not_found" };
      }

      // Map ReplacePermissionRuleBody to insertable/updatable row
      const mappedPermissionRule = toPermissionRuleUpdate(permissionRow.id, minRankKey, input);

      const ruleToUpsert = await trx
        .insertInto("permission_policies")
        .values({
          rank_key: minRankKey,
          permission_id: permissionRow.id,
          effect: input.effect,
        })
        .onConflict((oc) =>
          oc.columns(["permission_id", "rank_key"]).doUpdateSet(mappedPermissionRule),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      return { status: "replaced", rule: ruleToUpsert };
    });
  }

  async findPermissionNodeByKey(key: string) {
    return await this.db.transaction().execute(async (trx) => {
      const existsByKey = await this.permissionNodeExistsByKey(key, trx);

      if (!existsByKey) {
        return null;
      }

      return await trx
        .selectFrom("permission_nodes")
        .selectAll()
        .where("key", "=", key)
        .executeTakeFirst();
    });
  }

  async listPermissionNodes(query: ListPermissionsQuery) {
    return this.db
      .selectFrom("permission_nodes")
      .selectAll()
      .$if(query.includeInactive !== true, (qb) => qb.where("is_active", "=", true))
      .$if(query.category !== undefined, (qb) =>
        qb.where("category", "=", query.category ?? "general"),
      )
      .orderBy("category", "asc")
      .orderBy("key", "asc")
      .execute();
  }

  async findPermissionRuleByMinRank(permissionKey: string, minRankKey: string) {
    return await this.db.transaction().execute(async (trx) => {
      const permissionRow = await trx
        .selectFrom("permission_nodes")
        .select(["id", "key"])
        .where("key", "=", permissionKey)
        .executeTakeFirst();

      if (!permissionRow) {
        return null;
      }

      return await trx
        .selectFrom("permission_policies")
        .select([
          "permission_policies.permission_id",
          "permission_policies.rank_key",
          "permission_policies.effect",
          "permission_policies.created_at_ms",
          "permission_policies.updated_at_ms",
        ])
        .select((eb) => eb.val(permissionRow.key).as("permission_key"))
        .where("permission_id", "=", permissionRow.id)
        .where("rank_key", "=", minRankKey)
        .executeTakeFirst();
    });
  }

  async listPermissionRulesByPermissionKey(permissionKey: string) {
    return await this.db.transaction().execute(async (trx) => {
      const permissionRow = await trx
        .selectFrom("permission_nodes")
        .select(["id", "key"])
        .where("key", "=", permissionKey)
        .executeTakeFirst();

      if (!permissionRow) {
        return null;
      }

      return await trx
        .selectFrom("permission_policies")
        .select([
          "permission_policies.permission_id",
          "permission_policies.rank_key",
          "permission_policies.effect",
          "permission_policies.created_at_ms",
          "permission_policies.updated_at_ms",
        ])
        .select((eb) => eb.val(permissionRow.key).as("permission_key"))
        .where("permission_id", "=", permissionRow.id)
        .orderBy("rank_key", "asc")
        .execute();
    });
  }

  async permissionNodeExistsByKey(key: string, db: DbExecutor = this.db): Promise<boolean> {
    const row = await db
      .selectFrom("permission_nodes")
      .select("key")
      .where("key", "=", key)
      .executeTakeFirst();

    return row !== undefined;
  }

  async permissionRuleExistsByMinRankKey(key: string, db: DbExecutor = this.db): Promise<boolean> {
    const row = await db
      .selectFrom("permission_policies")
      .select("rank_key")
      .where("rank_key", "=", key)
      .executeTakeFirst();

    return row !== undefined;
  }

  async permissionNodeExistsById(id: string, db: DbExecutor = this.db): Promise<boolean> {
    const row = await db
      .selectFrom("permission_nodes")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();

    return row !== undefined;
  }
}
