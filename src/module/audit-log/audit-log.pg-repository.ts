import type { Kysely, Selectable } from "kysely";

import type { AuditLogs, DB } from "@/db/types.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import type { ListAuditLogsQuery } from "@/module/audit-log/audit-log.schemas.js";

export class AuditLogPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listAuditLogs(query: ListAuditLogsQuery): Promise<PaginatedResult<Selectable<AuditLogs>>> {
    const baseQuery = this.db
      .selectFrom("audit_logs")
      .$if(query.actorId !== undefined, (qb) => qb.where("actor_id", "=", query.actorId ?? ""))
      .$if(query.subjectActorId !== undefined, (qb) =>
        qb.where("subject_actor_id", "=", query.subjectActorId ?? ""),
      )
      .$if(query.principalType !== undefined, (qb) =>
        qb.where("principal_type", "=", query.principalType ?? "unknown"),
      )
      .$if(query.platform !== undefined, (qb) =>
        qb.where("platform", "=", query.platform ?? "other"),
      )
      .$if(query.action !== undefined, (qb) => qb.where("action", "ilike", `%${query.action}%`))
      .$if(query.targetType !== undefined, (qb) =>
        qb.where("target_type", "=", query.targetType ?? ""),
      )
      .$if(query.result !== undefined, (qb) => qb.where("result", "=", query.result ?? "allowed"));

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .selectAll()
        .orderBy("created_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: Number(totalRow.total), limit: query.limit, offset: query.offset };
  }

  async findAuditLogById(auditLogId: string) {
    return this.db
      .selectFrom("audit_logs")
      .selectAll()
      .where("id", "=", auditLogId)
      .executeTakeFirst();
  }
}
