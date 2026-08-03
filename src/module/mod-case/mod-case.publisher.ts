import type { RedisClient } from "@/redis/index.js";
import type { ModCaseResponse } from "@/module/mod-case/mod-case.response-types.js";

export const modCaseEventsChannel = "mod_cases.events";

export type ModCaseEvent = {
  event: "mod_case.created";
  modCase: ModCaseResponse;
};

export class ModCasePublisher {
  constructor(private readonly redis: RedisClient) {}

  async publish(event: ModCaseEvent): Promise<void> {
    await this.redis.publish(modCaseEventsChannel, JSON.stringify(event));
  }
}
