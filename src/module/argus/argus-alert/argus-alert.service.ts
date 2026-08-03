import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import {
  ArgusAlertAlreadyExistsError,
  ArgusAlertNotFoundError,
} from "@/module/argus/argus-alert/argus-alert.errors.js";
import { toArgusAlertResponse } from "@/module/argus/argus-alert/argus-alert.mapper.js";
import type { ArgusAlertPgRepository } from "@/module/argus/argus-alert/argus-alert.pg-repository.js";
import type { ArgusAlertResponse } from "@/module/argus/argus-alert/argus-alert.response-types.js";
import type {
  CreateArgusAlertBody,
  ListArgusAlertsQuery,
  UpdateArgusAlertBody,
} from "@/module/argus/argus-alert/argus-alert.schemas.js";

export class ArgusAlertService {
  constructor(private readonly repo: ArgusAlertPgRepository) {}

  async listAlerts(query: ListArgusAlertsQuery): Promise<PaginatedResult<ArgusAlertResponse>> {
    const result = await this.repo.listAlerts(query);
    return { ...result, rows: result.rows.map(toArgusAlertResponse) };
  }

  async getAlert(alertId: number): Promise<ArgusAlertResponse> {
    const alert = await this.repo.findAlertById(alertId);
    if (!alert) throw new ArgusAlertNotFoundError(alertId);
    return toArgusAlertResponse(alert);
  }

  async createAlert(input: CreateArgusAlertBody): Promise<ArgusAlertResponse> {
    const alert = await this.repo.createAlert(input);
    if (!alert) throw new ArgusAlertAlreadyExistsError();
    return toArgusAlertResponse(alert);
  }

  async updateAlert(alertId: number, input: UpdateArgusAlertBody): Promise<ArgusAlertResponse> {
    const alert = await this.repo.updateAlert(alertId, input);
    if (!alert) throw new ArgusAlertNotFoundError(alertId);
    return toArgusAlertResponse(alert);
  }

  async deactivateAlert(alertId: number): Promise<ArgusAlertResponse> {
    const alert = await this.repo.deactivateAlert(alertId);
    if (!alert) throw new ArgusAlertNotFoundError(alertId);
    return toArgusAlertResponse(alert);
  }
}
