import { type Kysely, sql, type Selectable } from "kysely";

import type { DB, ReportComments, Reports } from "@/db/types.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import type {
  CreateReportBody,
  CreateReportCommentBody,
  ListReportsQuery,
  UpdateReportBody,
} from "@/module/report/report.schemas.js";

export type CreateReportInput = CreateReportBody & {
  code: string;
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
  authorArgusUserId?: string | null;
};

export type UpdateReportCommentInput = {
  reportId: string;
  commentId: string;
  commentText: string;
  isSticky?: boolean;
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

  async findReportByCode(code: string): Promise<Selectable<Reports> | null> {
    return (
      (await this.db
        .selectFrom("reports")
        .selectAll()
        .where("code", "=", code)
        .executeTakeFirst()) ?? null
    );
  }

  async findActorIdByPlayerId(playerId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom("players")
      .select("actor_id")
      .where("id", "=", playerId)
      .executeTakeFirst();

    return row?.actor_id ?? null;
  }

  async createReport(input: CreateReportInput): Promise<Selectable<Reports>> {
    return this.db
      .insertInto("reports")
      .values({
        code: input.code,
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

  async findCommentById(
    reportId: string,
    commentId: string,
  ): Promise<Selectable<ReportComments> | null> {
    return (
      (await this.db
        .selectFrom("report_comments")
        .selectAll()
        .where("report_id", "=", reportId)
        .where("id", "=", commentId)
        .executeTakeFirst()) ?? null
    );
  }

  async createComment(input: CreateReportCommentInput): Promise<Selectable<ReportComments>> {
    return this.db
      .insertInto("report_comments")
      .values({
        report_id: input.reportId,
        author_actor_id: input.authorActorId,
        author_argus_user_id: input.authorArgusUserId ?? null,
        parent_comment_id: input.parentCommentId ?? null,
        comment_text: input.commentText,
        is_sticky: input.isSticky,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateComment(input: UpdateReportCommentInput): Promise<Selectable<ReportComments> | null> {
    return (
      (await this.db
        .updateTable("report_comments")
        .set({
          comment_text: input.commentText,
          is_sticky: input.isSticky,
          edited_at_ms: sql`get_unix_ms()`,
        })
        .where("report_id", "=", input.reportId)
        .where("id", "=", input.commentId)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async deleteComment(
    reportId: string,
    commentId: string,
    deletedByActorId: string,
    deletedByArgusUserId?: string | null,
  ): Promise<"deleted" | "tombstoned" | null> {
    if (await this.commentHasReplies(reportId, commentId)) {
      const tombstone = await this.db
        .updateTable("report_comments")
        .set({
          comment_text: "[deleted]",
          is_sticky: false,
          edited_at_ms: null,
          deleted_at_ms: sql`get_unix_ms()`,
          deleted_by_actor_id: deletedByActorId,
          deleted_by_argus_user_id: deletedByArgusUserId ?? null,
        })
        .where("report_id", "=", reportId)
        .where("id", "=", commentId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      return tombstone.numUpdatedRows > 0n ? "tombstoned" : null;
    }

    const result = await this.db
      .deleteFrom("report_comments")
      .where("report_id", "=", reportId)
      .where("id", "=", commentId)
      .where("deleted_at_ms", "is", null)
      .executeTakeFirst();

    return result.numDeletedRows > 0n ? "deleted" : null;
  }

  private async commentHasReplies(reportId: string, commentId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("report_comments")
      .select("id")
      .where("report_id", "=", reportId)
      .where("parent_comment_id", "=", commentId)
      .executeTakeFirst();

    return Boolean(row);
  }
}
