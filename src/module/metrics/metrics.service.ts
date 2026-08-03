import { ServerNotFoundError } from "@/module/server/server.errors.js";
import type { MetricsPgRepository } from "@/module/metrics/metrics.pg-repository.js";
import type {
  MetricsOverviewResponse,
  ServerMetricsResponse,
} from "@/module/metrics/metrics.response-types.js";
import { type MetricsWindow, windowToMs } from "@/module/metrics/metrics.schemas.js";

export class MetricsService {
  constructor(private readonly repo: MetricsPgRepository) {}

  getOverview(window: MetricsWindow): Promise<MetricsOverviewResponse> {
    return this.repo.getOverview(window, windowToMs(window));
  }

  async getServerMetrics(serverId: string, window: MetricsWindow): Promise<ServerMetricsResponse> {
    const result = await this.repo.getServerMetrics(serverId, window, windowToMs(window));

    if (!result) {
      throw new ServerNotFoundError(serverId);
    }

    return result;
  }
}
