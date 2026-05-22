import { ConflictError, NotFoundError } from "../../error/app-error.js";

export class PlayerNotFoundError extends NotFoundError {
  readonly playerId: string;

  constructor(playerId: string) {
    super({
      code: "PLAYER_NOT_FOUND",
      message: "Player not found.",
    });

    this.playerId = playerId;
  }
}

export class PlayerAlreadyExistsError extends ConflictError {
  readonly playerId: string;

  constructor(playerId: string) {
    super({
      code: "PLAYER_ALREADY_EXISTS",
      message: "Player already exists.",
    });

    this.playerId = playerId;
  }
}

export class BadgeNotFoundError extends NotFoundError {
  readonly badgeId: number;

  constructor(badgeId: number) {
    super({
      code: "BADGE_NOT_FOUND",
      message: "Badge not found.",
    });

    this.badgeId = badgeId;
  }
}
