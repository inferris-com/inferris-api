import { type Kysely, sql, type Selectable } from "kysely";

import type { DB, ReportComments, Reports } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type {
  CreateReportBody,
  CreateReportCommentBody,
  ListReportsQuery,
  UpdateReportBody,
} from "./report.schemas.js";

export type CreateReportInput = CreateReportBody & {
  reporterActorId: string;
  subjectActorId: string;
};

export type UpdateReportInput = UpdateReportBody & {
  triagedByActorId?: string | null;
  closedByActorId?: string | null;
};

export type CreateReportCommentInput = CreateReportCommentBody & {
  reportId: string;
  authorActorId: string;
};

export class ReportPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listReports(query: ListReportsQuery): Promise<PaginatedResult<Selectable<Reports>>> {
    const rowsQuery = this.db
      .selectFrom("reports")
      .$if(query.reporterActorId !== undefined, (qb) =>
        qb.where("reporter_actor_id", "=", query.reporterActorId ?? ""),
      )
      .$if(query.subjectActorId !== undefined, (qb) =>
        qb.where("subject_actor_id", "=", query.subjectActorId ?? ""),
      )
      .$if(query.assignedToActorId !== undefined, (qb) =>
        qb.where("assigned_to_actor_id", "=", query.assignedToActorId ?? ""),
      )
      .$if(query.originServerId !== undefined, (qb) =>
        qb.where("origin_server_id", "=", query.originServerId ?? ""),
      )
      .$if(query.status !== undefined, (qb) => qb.where("status", "=", query.status ?? "open"))
      .$if(query.severity !== undefined, (qb) => qb.where("severity", "=", query.severity ?? "low"))
      .$if(query.selectedReason !== undefined, (qb) =>
        qb.where("selected_reason", "=", query.selectedReason ?? ""),
      );

    const [rows, countRow] = await Promise.all([
      rowsQuery
        .selectAll("reports")
        .orderBy("created_at_ms", "desc")
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

  async findReportById(id: string): Promise<Selectable<Reports> | null> {
    return (
      (await this.db.selectFrom("reports").selectAll().where("id", "=", id).executeTakeFirst()) ??
      null
    );
  }

  async findActorIdByPlayerId(playerId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("player_id", "=", playerId)
      .executeTakeFirst();

    return row?.id ?? null;
  }

  async createReport(input: CreateReportInput): Promise<Selectable<Reports>> {
    return this.db
      .insertInto("reports")
      .values({
        reporter_actor_id: input.reporterActorId,
        subject_actor_id: input.subjectActorId,
        selected_reason: input.selectedReason,
        reason_description: input.reasonDescription ?? null,
        origin_server_id: input.originServerId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateReport(id: string, input: UpdateReportInput): Promise<Selectable<Reports> | null> {
    return (
      (await this.db
        .updateTable("reports")
        .set({
          status: input.status,
          severity: input.severity,
          assigned_to_actor_id: input.assignedToActorId,
          resolution: input.resolution,
          resolution_note: input.resolutionNote,
          triaged_by_actor_id: input.triagedByActorId,
          triaged_at_ms: input.triagedByActorId === undefined ? undefined : sql`get_unix_ms()`,
          closed_by_actor_id: input.closedByActorId,
          closed_at_ms: input.closedByActorId === undefined ? undefined : sql`get_unix_ms()`,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async listComments(reportId: string): Promise<Selectable<ReportComments>[]> {
    return this.db
      .selectFrom("report_comments")
      .selectAll()
      .where("report_id", "=", reportId)
      .orderBy("is_sticky", "desc")
      .orderBy("created_at_ms", "asc")
      .execute();
  }

  async createComment(input: CreateReportCommentInput): Promise<Selectable<ReportComments>> {
    return this.db
      .insertInto("report_comments")
      .values({
        report_id: input.reportId,
        author_actor_id: input.authorActorId,
        parent_comment_id: input.parentCommentId ?? null,
        comment_text: input.commentText,
        is_sticky: input.isSticky,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
