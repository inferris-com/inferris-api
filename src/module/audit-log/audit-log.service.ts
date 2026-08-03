import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import { AuditLogNotFoundError } from "@/module/audit-log/audit-log.errors.js";
import { toAuditLogResponse } from "@/module/audit-log/audit-log.mapper.js";
import type { AuditLogPgRepository } from "@/module/audit-log/audit-log.pg-repository.js";
import type { AuditLogResponse } from "@/module/audit-log/audit-log.response-types.js";
import type { ListAuditLogsQuery } from "@/module/audit-log/audit-log.schemas.js";

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
