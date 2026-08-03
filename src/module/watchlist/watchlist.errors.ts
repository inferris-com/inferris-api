import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class WatchlistActorNotFoundError extends NotFoundError {
  constructor(id: string) {
    super({
      code: "WATCHLIST_ACTOR_NOT_FOUND",
      message: `Watchlist actor '${id}' was not found.`,
      details: { id },
    });
  }
}

export class WatchlistEntryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super({
      code: "WATCHLIST_ENTRY_NOT_FOUND",
      message: `No active watchlist entry was found for '${id}'.`,
      details: { id },
    });
  }
}

export class WatchlistExpirationConflictError extends ConflictError {
  constructor() {
    super({
      code: "WATCHLIST_EXPIRATION_CONFLICT",
      message: "Watchlist expiration must be in the future.",
    });
  }
}
