import { ForbiddenError, NotFoundError, ValidationError } from "../../error/app-error.js";

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

export class ReportCommentNotFoundError extends NotFoundError {
  constructor(commentId: string) {
    super({
      code: "REPORT_COMMENT_NOT_FOUND",
      message: "Report comment not found.",
      details: { commentId },
    });
  }
}

export class ReportCommentForbiddenError extends ForbiddenError {
  constructor(commentId: string) {
    super({
      code: "REPORT_COMMENT_FORBIDDEN",
      message: "You can only manage your own report comments.",
      details: { commentId },
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
