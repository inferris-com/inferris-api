import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class ActorNotFoundError extends NotFoundError {
  readonly actorId: string;

  constructor(actorId: string) {
    super({
      code: "ACTOR_NOT_FOUND",
      message: "Actor not found.",
    });

    this.actorId = actorId;
  }
}

export class ActorsNotFoundError extends NotFoundError {
  constructor() {
    super({
      code: "ACTORS_NOT_FOUND",
      message: "Actors not found.",
    });
  }
}

export class ActorAlreadyExistsError extends ConflictError {
  readonly actorId: string;

  constructor(actorId: string) {
    super({
      code: "ACTOR_ALREADY_EXISTS",
      message: "Actor already exists.",
    });

    this.actorId = actorId;
  }
}
