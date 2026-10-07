import { randomInt } from "node:crypto";

import { PgErrorCode, isPgErrorCode } from "@/shared/db/pg-error.utils.js";
import {
  ReportActorNotFoundError,
  ReportCommentForbiddenError,
  ReportCommentNotFoundError,
  ReportNotFoundError,
} from "@/module/report/report.errors.js";
import { toReportCommentResponse, toReportResponse } from "@/module/report/report.mapper.js";
import type { ReportPgRepository } from "@/module/report/report.pg-repository.js";
import type { ReportPublisher } from "@/module/report/report.publisher.js";
import type {
  ReportCommentResponse,
  ReportResponse,
  ReportListItemResponse,
} from "@/module/report/report.response-types.js";
import type {
  CreateReportBody,
  CreateReportCommentBody,
  ListReportsQuery,
  UpdateReportCommentBody,
  UpdateReportBody,
} from "@/module/report/report.schemas.js";

export type ReportListResponse = {
  data: ReportListItemResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

const terminalReportStatuses = new Set(["actioned", "dismissed", "duplicate"]);
const reportCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const reportCodeLength = 10;
const maxReportCodeCreateAttempts = 5;

export class ReportService {
  constructor(
    private readonly repo: ReportPgRepository,
    private readonly publisher: ReportPublisher,
  ) {}

  async listReports(query: ListReportsQuery): Promise<ReportListResponse> {
    const result = await this.repo.listReports(query);

    return {
      data: result.rows.map((row) => ({
        ...toReportResponse(row),
        ...(query.include === "identities"
          ? { reporterActor: row.reporterActor ?? null, subjectActor: row.subjectActor ?? null }
          : {}),
      })),
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async getReport(id: string): Promise<ReportResponse> {
    const report = await this.repo.findReportById(id);

    if (!report) {
      throw new ReportNotFoundError(id);
    }

    return toReportResponse(report);
  }

  async getReportByCode(code: string): Promise<ReportResponse> {
    const report = await this.repo.findReportByCode(code);

    if (!report) {
      throw new ReportNotFoundError(code);
    }

    return toReportResponse(report);
  }

  async createReport(input: CreateReportBody): Promise<ReportResponse> {
    const [reporterActorId, subjectActorId] = await Promise.all([
      this.resolveActorId(input.reporterActorId, input.reporterPlayerId),
      this.resolveActorId(input.subjectActorId, input.subjectPlayerId),
    ]);

    const report = await this.createReportWithUniqueCode(input, reporterActorId, subjectActorId);
    const response = toReportResponse(report);

    await this.publisher.publish({
      event: "report.created",
      report: response,
    });

    return response;
  }

  private async createReportWithUniqueCode(
    input: CreateReportBody,
    reporterActorId: string,
    subjectActorId: string,
  ) {
    for (let attempt = 1; attempt <= maxReportCodeCreateAttempts; attempt += 1) {
      try {
        return await this.repo.createReport({
          ...input,
          code: generateReportCode(),
          reporterActorId,
          subjectActorId,
        });
      } catch (err) {
        if (
          isPgErrorCode(err, PgErrorCode.UniqueViolation) &&
          err.constraint === "uq_reports_code" &&
          attempt < maxReportCodeCreateAttempts
        ) {
          continue;
        }

        throw err;
      }
    }

    throw new Error("Failed to generate a unique report code.");
  }

  async updateReport(
    id: string,
    input: UpdateReportBody,
    actorId: string,
  ): Promise<ReportResponse> {
    const updateInput = {
      ...input,
    };

    if (input.status === "under_review") {
      Object.assign(updateInput, { triagedByActorId: actorId });
    }

    if (input.status && terminalReportStatuses.has(input.status)) {
      Object.assign(updateInput, { closedByActorId: actorId });
    }

    const report = await this.repo.updateReport(id, updateInput);

    if (!report) {
      throw new ReportNotFoundError(id);
    }

    return toReportResponse(report);
  }

  async listComments(reportId: string): Promise<ReportCommentResponse[]> {
    if (!(await this.repo.findReportById(reportId))) {
      throw new ReportNotFoundError(reportId);
    }

    return (await this.repo.listComments(reportId)).map(toReportCommentResponse);
  }

  async createComment(
    reportId: string,
    input: CreateReportCommentBody,
    authorActorId: string,
    authorArgusUserId?: string | null,
  ): Promise<ReportCommentResponse> {
    if (!(await this.repo.findReportById(reportId))) {
      throw new ReportNotFoundError(reportId);
    }

    return toReportCommentResponse(
      await this.repo.createComment({
        ...input,
        reportId,
        authorActorId,
        ...(authorArgusUserId === undefined ? {} : { authorArgusUserId }),
      }),
    );
  }

  async updateComment(
    reportId: string,
    commentId: string,
    input: UpdateReportCommentBody,
    actorId: string,
    canManageOtherComments: boolean,
  ): Promise<ReportCommentResponse> {
    const comment = await this.requireManageableComment(
      reportId,
      commentId,
      actorId,
      canManageOtherComments,
    );

    const updatedComment = await this.repo.updateComment({
      reportId,
      commentId: comment.id,
      commentText: input.commentText,
      ...(input.isSticky === undefined ? {} : { isSticky: input.isSticky }),
    });

    if (!updatedComment) {
      throw new ReportCommentNotFoundError(commentId);
    }

    return toReportCommentResponse(updatedComment);
  }

  async deleteComment(
    reportId: string,
    commentId: string,
    actorId: string,
    argusUserId: string | null | undefined,
    canManageOtherComments: boolean,
  ): Promise<void> {
    await this.requireManageableComment(reportId, commentId, actorId, canManageOtherComments);
    const result = await this.repo.deleteComment(reportId, commentId, actorId, argusUserId);

    if (!result) {
      throw new ReportCommentNotFoundError(commentId);
    }
  }

  private async requireManageableComment(
    reportId: string,
    commentId: string,
    actorId: string,
    canManageOtherComments: boolean,
  ) {
    const comment = await this.repo.findCommentById(reportId, commentId);

    if (!comment || comment.deleted_at_ms !== null) {
      throw new ReportCommentNotFoundError(commentId);
    }

    if (!canManageOtherComments && comment.author_actor_id !== actorId) {
      throw new ReportCommentForbiddenError(commentId);
    }

    return comment;
  }

  private async resolveActorId(actorId: string | undefined, playerId: string | undefined) {
    if (actorId) {
      return actorId;
    }

    if (!playerId) {
      throw new ReportActorNotFoundError("unknown");
    }

    const resolvedActorId = await this.repo.findActorIdByPlayerId(playerId);

    if (!resolvedActorId) {
      throw new ReportActorNotFoundError(playerId);
    }

    return resolvedActorId;
  }
}

function generateReportCode(): string {
  let code = "";

  for (let index = 0; index < reportCodeLength; index += 1) {
    code += reportCodeAlphabet.charAt(randomInt(reportCodeAlphabet.length));
  }

  return code;
}
