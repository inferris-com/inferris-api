import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import { PlayerSessionNotFoundError } from "./player-session.errors.js";
import { toPlayerSessionResponse } from "./player-session.mapper.js";
import type { PlayerSessionPgRepository } from "./player-session.pg-repository.js";
import type { PlayerSessionResponse } from "./player-session.response-types.js";
import type { ListPlayerSessionsQuery } from "./player-session.schemas.js";

export class PlayerSessionService {
  constructor(private readonly repo: PlayerSessionPgRepository) {}

  async listSessions(
    query: ListPlayerSessionsQuery,
  ): Promise<PaginatedResult<PlayerSessionResponse>> {
    const result = await this.repo.listSessions(query);

    return {
      ...result,
      rows: result.rows.map((row) =>
        toPlayerSessionResponse(
          row.session,
          row.backendSessions ?? [],
          query.include === "backendSessions",
        ),
      ),
    };
  }

  async getSession(sessionId: string, includeBackendSessions = false): Promise<PlayerSessionResponse> {
    const session = await this.repo.findSessionById(sessionId, includeBackendSessions);

    if (!session) {
      throw new PlayerSessionNotFoundError(sessionId);
    }

    return toPlayerSessionResponse(
      session.session,
      session.backendSessions ?? [],
      includeBackendSessions,
    );
  }
}
