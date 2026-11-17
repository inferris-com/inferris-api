import { sql, type UpdateObject } from "kysely";
import type { DbExecutor } from "@/db/index.js";
import type { DB } from "@/db/types.js";
import {
  isTerminalIssueStatus,
  type CreateIssueBody,
  type UpdateIssueBody,
  type ListIssuesQuery,
} from "@/module/issues/issues.schemas.js";

export class IssuesPgRepository {
  constructor(private readonly db: DbExecutor) {}

  async createIssue(input: CreateIssueBody, actorId: string) {
    const closed = isTerminalIssueStatus(input.status);
    return this.db
      .insertInto("issues")
      .values({
        platform: input.platform,
        title: input.title,
        description: input.description ?? "No description",
        status: input.status,
        severity: input.severity,
        created_by_actor_id: actorId,
        closed_by_actor_id: closed ? actorId : null,
        closed_at_ms: closed ? sql<string>`get_unix_ms ()` : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findIssueById(id: string) {
    return this.db.selectFrom("issues").where("id", "=", id).selectAll().executeTakeFirst();
  }

  async listIssues(query: ListIssuesQuery) {
    let select = this.db.selectFrom("issues").selectAll();
    if (query.platform !== undefined) select = select.where("platform", "=", query.platform);
    if (query.status !== undefined) select = select.where("status", "=", query.status);
    if (query.severity !== undefined) select = select.where("severity", "=", query.severity);
    if (query.createdByActorId !== undefined)
      select = select.where("created_by_actor_id", "=", query.createdByActorId);
    if (query.assignedToActorId !== undefined)
      select = select.where("assigned_to_actor_id", "=", query.assignedToActorId);
    if (query.search !== undefined)
      select = select.where(sql<boolean>`
        to_tsvector(
          'english',
          coalesce(title, '') || ' ' || coalesce(description, '')
        ) @@ plainto_tsquery('english', ${query.search})
      `);
    const [rows, count] = await Promise.all([
      select
        .orderBy("created_at_ms", "desc")
        .orderBy("id", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      select
        .clearSelect()
        .select((eb) => eb.fn.countAll<string>().as("total"))
        .executeTakeFirstOrThrow(),
    ]);
    return { rows, total: Number(count.total), limit: query.limit, offset: query.offset };
  }

  async updateIssue(id: string, input: UpdateIssueBody, actorId: string) {
    const values: UpdateObject<DB, "issues"> = { updated_at_ms: sql<string>`get_unix_ms ()` };
    if (input.platform !== undefined) values.platform = input.platform;
    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description ?? "No description";
    if (input.severity !== undefined) values.severity = input.severity;
    if (input.assignedToActorId !== undefined)
      values.assigned_to_actor_id = input.assignedToActorId;
    if (input.status !== undefined) {
      values.status = input.status;
      if (isTerminalIssueStatus(input.status)) {
        // Preserve the first closure while moving between terminal states. This
        // single UPDATE also serializes correctly with concurrent reopen/close requests.
        values.closed_by_actor_id = sql<string>`
          coalesce(
            closed_by_actor_id,
            ${actorId}::uuid
          )
        `;
        values.closed_at_ms = sql<string>`coalesce(closed_at_ms, get_unix_ms ())`;
      } else {
        values.closed_by_actor_id = null;
        values.closed_at_ms = null;
      }
    }
    return this.db
      .updateTable("issues")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }
}
export default IssuesPgRepository;
