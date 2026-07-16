import { NotFoundError } from "../../error/app-error.js";

export class AuditLogNotFoundError extends NotFoundError {
  constructor(auditLogId: string) {
    super({
      code: "AUDIT_LOG_NOT_FOUND",
      message: "Audit log not found.",
      details: { auditLogId },
    });
  }
}
