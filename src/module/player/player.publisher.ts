import type { RedisClient } from "@/redis/index.js";
import type { PlayerRankAssignmentResponse } from "@/module/player/player.response.types.js";
import type { WatchlistEntryResponse } from "@/module/watchlist/watchlist.response-types.js";

export const playerEventChannel = "player.events";

export type PlayerEvent =
  | { event: "rank.assigned"; rank: PlayerRankAssignmentResponse }
  | { event: "badge.assigned"; badge: PlayerRankAssignmentResponse }
  | { event: "watchlist.created"; badge: WatchlistEntryResponse }
  | { event: "rank.revoked" }
  | { event: "badge.revoked" }
  | { event: "watchlist.removed" };

export class ReportPublisher {
  constructor(private readonly redis: RedisClient) {}

  async publish(event: PlayerEvent): Promise<void> {
    await this.redis.publish(playerEventChannel, JSON.stringify(event));
  }
}
