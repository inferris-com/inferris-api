import type { Kysely, Selectable } from "kysely";

import type { ArgusAlerts, DB } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import { toArgusAlertInsert, toArgusAlertUpdate } from "./argus-alert.mapper.js";
import type {
  CreateArgusAlertBody,
  ListArgusAlertsQuery,
  UpdateArgusAlertBody,
} from "./argus-alert.schemas.js";

export class ArgusAlertPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listAlerts(query: ListArgusAlertsQuery): Promise<PaginatedResult<Selectable<ArgusAlerts>>> {
    const baseQuery = this.db
      .selectFrom("argus_alerts")
      .$if(query.isActive !== undefined, (qb) =>
        qb.where("is_active", "=", query.isActive ?? true),
      );

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .selectAll()
        .orderBy("priority", "desc")
        .orderBy("created_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: Number(totalRow.total), limit: query.limit, offset: query.offset };
  }

  async findAlertById(alertId: number) {
    return this.db
      .selectFrom("argus_alerts")
      .selectAll()
      .where("id", "=", alertId)
      .executeTakeFirst();
  }

  async createAlert(input: CreateArgusAlertBody) {
    return this.db
      .insertInto("argus_alerts")
      .values(toArgusAlertInsert(input))
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async updateAlert(alertId: number, input: UpdateArgusAlertBody) {
    return this.db
      .updateTable("argus_alerts")
      .set(toArgusAlertUpdate(input))
      .where("id", "=", alertId)
      .returningAll()
      .executeTakeFirst();
  }

  async deactivateAlert(alertId: number) {
    return this.db
      .updateTable("argus_alerts")
      .set({ is_active: false })
      .where("id", "=", alertId)
      .returningAll()
      .executeTakeFirst();
  }
}
