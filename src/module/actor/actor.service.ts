import type { ActorPgRepository } from "./actor.pg-repository.js";
import { ActorNotFoundError } from "./actor.errors.js";
import type { ActorResponse } from "./actor.response.types.js";
import { toActorResponse } from "./actor.mapper.js";
import type { UpdateActorBody } from "./actor.schemas.js";

export class ActorService {
  constructor(private readonly repo: ActorPgRepository) {}

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
