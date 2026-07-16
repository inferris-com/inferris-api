import { type Kysely, sql, type Selectable } from "kysely";

import type { DB, ModCaseActors, ModCases } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type {
  CreateModCaseActorBody,
  CreateModCaseBody,
  ListModCasesQuery,
  UpdateModCaseBody,
} from "./mod-case.schemas.js";

export type CreateModCaseInput = CreateModCaseBody & {
  openedByActorId: string;
  openedByArgusUserId?: string | null;
};

export type UpdateModCaseInput = UpdateModCaseBody & {
  closedByActorId?: string | null;
  closedByArgusUserId?: string | null;
};

export type CreateModCaseActorInput = CreateModCaseActorBody & {
  caseId: string;
  addedByActorId: string;
};

export class ModCasePgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listModCases(query: ListModCasesQuery): Promise<PaginatedResult<Selectable<ModCases>>> {
    const rowsQuery = this.db
      .selectFrom("mod_cases")
      .$if(query.openedByActorId !== undefined, (qb) =>
        qb.where("opened_by_actor_id", "=", query.openedByActorId ?? ""),
      )
      .$if(query.assignedToActorId !== undefined, (qb) =>
        qb.where("assigned_to_actor_id", "=", query.assignedToActorId ?? ""),
      )
      .$if(query.originServerId !== undefined, (qb) =>
        qb.where("origin_server_id", "=", query.originServerId ?? ""),
      )
      .$if(query.status !== undefined, (qb) => qb.where("status", "=", query.status ?? "open"))
      .$if(query.severity !== undefined, (qb) =>
        qb.where("severity", "=", query.severity ?? "low"),
      );

    const [rows, countRow] = await Promise.all([
      rowsQuery
        .selectAll("mod_cases")
        .orderBy("is_sticky", "desc")
        .orderBy("opened_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      rowsQuery
        .clearSelect()
        .select((eb) => eb.fn.countAll<string>().as("total"))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      rows,
      total: Number(countRow.total),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findModCaseById(id: string): Promise<Selectable<ModCases> | null> {
    return (
      (await this.db.selectFrom("mod_cases").selectAll().where("id", "=", id).executeTakeFirst()) ??
      null
    );
  }

  async createModCase(input: CreateModCaseInput): Promise<Selectable<ModCases>> {
    const assignedToArgusUserId = await this.findArgusUserIdByActorId(input.assignedToActorId);

    return this.db.transaction().execute(async (trx) => {
      const modCase = await trx
        .insertInto("mod_cases")
        .values({
          title: input.title,
          description: input.description ?? null,
          opened_by_actor_id: input.openedByActorId,
          opened_by_argus_user_id: input.openedByArgusUserId ?? null,
          assigned_to_actor_id: input.assignedToActorId ?? null,
          assigned_to_argus_user_id: assignedToArgusUserId,
          origin_server_id: input.originServerId ?? null,
          severity: input.severity ?? null,
          is_sticky: input.isSticky,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (input.actors.length > 0) {
        await trx
          .insertInto("mod_case_actors")
          .values(
            input.actors.map((actor) => ({
              case_id: modCase.id,
              actor_id: actor.actorId,
              role: actor.role,
              added_by_actor_id: input.openedByActorId,
              note: actor.note ?? null,
            })),
          )
          .onConflict((oc) => oc.columns(["case_id", "actor_id", "role"]).doNothing())
          .execute();
      }

      if (input.relatedReportId) {
        await trx
          .insertInto("moderation_resource_links")
          .values({
            source_type: "report",
            source_id: input.relatedReportId,
            target_type: "mod_case",
            target_id: modCase.id,
            link_type: "created_from",
            created_by_actor_id: input.openedByActorId,
          })
          .execute();
      }

      return modCase;
    });
  }

  async updateModCase(id: string, input: UpdateModCaseInput): Promise<Selectable<ModCases> | null> {
    const assignedToArgusUserId =
      input.assignedToActorId === undefined
        ? undefined
        : await this.findArgusUserIdByActorId(input.assignedToActorId);

    return (
      (await this.db
        .updateTable("mod_cases")
        .set({
          title: input.title,
          description: input.description,
          assigned_to_actor_id: input.assignedToActorId,
          assigned_to_argus_user_id: assignedToArgusUserId,
          status: input.status,
          severity: input.severity,
          resolution: input.resolution,
          is_sticky: input.isSticky,
          closed_by_actor_id: input.closedByActorId,
          closed_by_argus_user_id: input.closedByArgusUserId,
          closed_at_ms: input.closedByActorId === undefined ? undefined : sql`get_unix_ms()`,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async listActors(caseId: string): Promise<Selectable<ModCaseActors>[]> {
    return this.db
      .selectFrom("mod_case_actors")
      .selectAll()
      .where("case_id", "=", caseId)
      .orderBy("added_at_ms", "asc")
      .execute();
  }

  async createActor(input: CreateModCaseActorInput): Promise<Selectable<ModCaseActors>> {
    return this.db
      .insertInto("mod_case_actors")
      .values({
        case_id: input.caseId,
        actor_id: input.actorId,
        role: input.role,
        added_by_actor_id: input.addedByActorId,
        note: input.note ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private async findArgusUserIdByActorId(
    actorId: string | null | undefined,
  ): Promise<string | null> {
    if (!actorId) {
      return null;
    }

    const row = await this.db
      .selectFrom("argus_users")
      .select("id")
      .where("actor_id", "=", actorId)
      .orderBy("created_at_ms", "desc")
      .executeTakeFirst();

    return row?.id ?? null;
  }
}
