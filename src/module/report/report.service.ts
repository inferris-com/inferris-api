import { ReportActorNotFoundError, ReportNotFoundError } from "./report.errors.js";
import { toReportCommentResponse, toReportResponse } from "./report.mapper.js";
import type { ReportPgRepository } from "./report.pg-repository.js";
import type { ReportPublisher } from "./report.publisher.js";
import type { ReportCommentResponse, ReportResponse } from "./report.response-types.js";
import type {
  CreateReportBody,
  CreateReportCommentBody,
  ListReportsQuery,
  UpdateReportBody,
} from "./report.schemas.js";

export type ReportListResponse = {
  data: ReportResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

const terminalReportStatuses = new Set(["actioned", "dismissed", "duplicate"]);

export class ReportService {
  constructor(
    private readonly repo: ReportPgRepository,
    private readonly publisher: ReportPublisher,
  ) {}

  async listReports(query: ListReportsQuery): Promise<ReportListResponse> {
    const result = await this.repo.listReports(query);

    return {
      data: result.rows.map(toReportResponse),
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

  async createReport(input: CreateReportBody): Promise<ReportResponse> {
    const [reporterActorId, subjectActorId] = await Promise.all([
      this.resolveActorId(input.reporterActorId, input.reporterPlayerId),
      this.resolveActorId(input.subjectActorId, input.subjectPlayerId),
    ]);

    const report = await this.repo.createReport({
      ...input,
      reporterActorId,
      subjectActorId,
    });
    const response = toReportResponse(report);

    await this.publisher.publish({
      event: "report.created",
      report: response,
    });

    return response;
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
  ): Promise<ReportCommentResponse> {
    if (!(await this.repo.findReportById(reportId))) {
      throw new ReportNotFoundError(reportId);
    }

    return toReportCommentResponse(
      await this.repo.createComment({
        ...input,
        reportId,
        authorActorId,
      }),
    );
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
