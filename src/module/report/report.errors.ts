import { NotFoundError, ValidationError } from "../../error/app-error.js";

export class ReportNotFoundError extends NotFoundError {
  constructor(reportId: string) {
    super({
      code: "REPORT_NOT_FOUND",
      message: "Report not found.",
      details: { reportId },
    });
  }
}

export class ReportActorNotFoundError extends NotFoundError {
  constructor(actorIdOrPlayerId: string) {
    super({
      code: "REPORT_ACTOR_NOT_FOUND",
      message: "Report actor not found.",
      details: { actorIdOrPlayerId },
    });
  }
}

export class InvalidReportTransitionError extends ValidationError {
  constructor(message: string) {
    super({
      code: "INVALID_REPORT_TRANSITION",
      message,
    });
  }
}
