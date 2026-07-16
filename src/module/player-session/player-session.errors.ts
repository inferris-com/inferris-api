import { NotFoundError } from "../../error/app-error.js";

export class PlayerSessionNotFoundError extends NotFoundError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super({
      code: "PLAYER_SESSION_NOT_FOUND",
      message: "Player session not found.",
    });

    this.sessionId = sessionId;
  }
}
