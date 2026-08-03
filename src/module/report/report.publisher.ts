import type { RedisClient } from "@/redis/index.js";
import type { ReportResponse } from "@/module/report/report.response-types.js";

export const reportEventsChannel = "reports.events";

export type ReportEvent = {
  event: "report.created";
  report: ReportResponse;
};

export class ReportPublisher {
  constructor(private readonly redis: RedisClient) {}

  async publish(event: ReportEvent): Promise<void> {
    await this.redis.publish(reportEventsChannel, JSON.stringify(event));
  }
}
