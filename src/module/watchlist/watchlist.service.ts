import {
  WatchlistActorNotFoundError,
  WatchlistEntryNotFoundError,
  WatchlistExpirationConflictError,
} from "./watchlist.errors.js";
import { toWatchlistEntryResponse } from "./watchlist.mapper.js";
import type { WatchlistPgRepository } from "./watchlist.pg-repository.js";
import type { WatchlistEntryResponse } from "./watchlist.response-types.js";
import type {
  AddWatchlistBody,
  ClearWatchlistBody,
  GetActiveWatchlistQuery,
  ListWatchlistQuery,
} from "./watchlist.schemas.js";

export type WatchlistListResponse = {
  data: WatchlistEntryResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

export class WatchlistService {
  constructor(private readonly repo: WatchlistPgRepository) {}

  async listEntries(query: ListWatchlistQuery): Promise<WatchlistListResponse> {
    const result = await this.repo.listEntries(query);

    return {
      data: result.rows.map(toWatchlistEntryResponse),
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async getActiveEntry(query: GetActiveWatchlistQuery): Promise<WatchlistEntryResponse> {
    const entry = await this.repo.findActiveEntry(query);

    if (!entry) {
      throw new WatchlistEntryNotFoundError(query.subjectActorId ?? query.subjectPlayerId ?? "unknown");
    }

    return toWatchlistEntryResponse(entry);
  }

  async addEntry(input: AddWatchlistBody, addedByActorId: string): Promise<WatchlistEntryResponse> {
    if (input.expiresAtMs != null && BigInt(input.expiresAtMs) <= BigInt(Date.now())) {
      throw new WatchlistExpirationConflictError();
    }

    const subjectActorId = await this.resolveSubjectActorId(input.subjectActorId, input.subjectPlayerId);
    const entry = await this.repo.addEntry({
      ...input,
      subjectActorId,
      addedByActorId,
    });

    return toWatchlistEntryResponse(entry);
  }

  async clearEntry(
    input: ClearWatchlistBody,
    clearedByActorId: string,
  ): Promise<WatchlistEntryResponse> {
    const subjectActorId = await this.resolveSubjectActorId(input.subjectActorId, input.subjectPlayerId);
    const entry = await this.repo.clearEntry({
      ...input,
      subjectActorId,
      clearedByActorId,
    });

    if (!entry) {
      throw new WatchlistEntryNotFoundError(subjectActorId);
    }

    return toWatchlistEntryResponse(entry);
  }

  private async resolveSubjectActorId(
    subjectActorId: string | undefined,
    subjectPlayerId: string | undefined,
  ): Promise<string> {
    if (subjectActorId) {
      if (!(await this.repo.actorExists(subjectActorId))) {
        throw new WatchlistActorNotFoundError(subjectActorId);
      }

      return subjectActorId;
    }

    const actorId = await this.repo.findActorIdByPlayerId(subjectPlayerId);

    if (!actorId) {
      throw new WatchlistActorNotFoundError(subjectPlayerId ?? "unknown");
    }

    return actorId;
  }
}
