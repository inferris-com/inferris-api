import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import { AuditLogNotFoundError } from "./audit-log.errors.js";
import { toAuditLogResponse } from "./audit-log.mapper.js";
import type { AuditLogPgRepository } from "./audit-log.pg-repository.js";
import type { AuditLogResponse } from "./audit-log.response-types.js";
import type { ListAuditLogsQuery } from "./audit-log.schemas.js";

export class AuditLogService {
  constructor(private readonly repo: AuditLogPgRepository) {}

  async listAuditLogs(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLogResponse>> {
    const result = await this.repo.listAuditLogs(query);
    return { ...result, rows: result.rows.map(toAuditLogResponse) };
  }

  async getAuditLog(auditLogId: string): Promise<AuditLogResponse> {
    const log = await this.repo.findAuditLogById(auditLogId);
    if (!log) throw new AuditLogNotFoundError(auditLogId);
    return toAuditLogResponse(log);
  }
}
