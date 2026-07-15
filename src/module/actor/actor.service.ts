import type { ActorPgRepository } from "./actor.pg-repository.js";
import { ActorNotFoundError, ActorsNotFoundError } from "./actor.errors.js";
import type { ActorResponse } from "./actor.response.types.js";
import { toActorResponse } from "./actor.mapper.js";
import type { ListActorsQuery, UpdateActorBody } from "./actor.schemas.js";

export type ActorListResponse = {
  data: ActorResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

export class ActorService {
  constructor(private readonly repo: ActorPgRepository) {}

  async listActors(query: ListActorsQuery): Promise<ActorListResponse> {
    const actors = await this.repo.listActors(query);

    if (!actors) {
      throw new ActorsNotFoundError();
    }

    return {
      data: actors.rows.map(toActorResponse),
      meta: {
        count: actors.rows.length,
        total: actors.total,
        limit: actors.limit,
        offset: actors.offset,
      },
    };
  }

  async findActorById(id: string): Promise<ActorResponse> {
    const actor = await this.repo.findActorById(id);

    if (!actor) {
      throw new ActorNotFoundError(id);
    }

    return toActorResponse(actor);
  }

  async findActorByPlayerId(id: string): Promise<ActorResponse> {
    const actor = await this.repo.findActorByPlayerId(id);

    if (!actor) {
      throw new ActorNotFoundError(id);
    }
    return toActorResponse(actor);
  }

  async updateActorById(id: string, updateActorBody: UpdateActorBody): Promise<ActorResponse> {
    const actor = await this.repo.updateActorById(id, updateActorBody);

    if (!actor) {
      throw new ActorNotFoundError(id);
    }
    return toActorResponse(actor);
  }
}
