import type { RedisClient } from "../../redis/index.js";
import type { PunishmentResponse } from "./punishment.response-types.js";

export const punishmentEventsChannel = "punishments.events";

export type PunishmentEvent =
  | {
      event: "punishment.created";
      punishment: PunishmentResponse;
    }
  | {
      event: "punishment.revoked";
      punishment: PunishmentResponse;
    };

export class PunishmentPublisher {
  constructor(private readonly redis: RedisClient) {}

  async publish(event: PunishmentEvent): Promise<void> {
    await this.redis.publish(punishmentEventsChannel, JSON.stringify(event));
  }
}
