import type { Kysely, Selectable } from "kysely";
import type { DB, PermissionNodes } from "../../db/types.js";
import type { DbExecutor } from "../../db/index.js";
import type { CreatePermissionNodeBody, CreatePermissionRuleBody } from "./permission.schemas.js";
import type { CreateResult } from "../../shared/results.types.js";
import {toPermissionRuleUpdate} from "./permission.mapper.js";

type CreatePermissionNodeResult = CreateResult<Selectable<PermissionNodes>>;

export class PermissionPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async createPermissionNode(input: CreatePermissionNodeBody): Promise<CreatePermissionNodeResult> {
    return await this.db.transaction().execute(async (trx) => {
      const permissionNode = await trx
        .insertInto("permission_nodes")
        .values(input)
        .returningAll()
        .executeTakeFirst();

      if (!permissionNode) {
        return { status: "conflict" };
      }

      return { status: "created", data: permissionNode };
    });
  }

  // PUT
  async createPermissionRule(input: CreatePermissionRuleBody) {
    return await this.db.transaction().execute(async (trx) => {
      const mappedPermissionNode = toPermissionRuleUpdate(input);

      await trx.
    })
  }

  async findPermissionNodeByKey(key: string) {
    await this.db.transaction().execute(async (trx) => {
      const existsByKey = await this.permissionNodeExistsByKey(key, trx);

      if (!existsByKey) {
        return null;
      }

      return await trx.selectFrom("permission_nodes").where("key", "=", key).executeTakeFirst();
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

  async permissionNodeExistsById(id: string, db: DbExecutor = this.db): Promise<boolean> {
    const row = await db
      .selectFrom("permission_nodes")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();

    return row !== undefined;
  }
}
