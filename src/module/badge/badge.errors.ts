import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class BadgeNotFoundError extends NotFoundError {
  constructor(badgeId: number) {
    super({
      code: "BADGE_NOT_FOUND",
      message: "Badge not found.",
      details: { badgeId },
    });
  }
}

export class BadgeAlreadyExistsError extends ConflictError {
  constructor(key: string) {
    super({
      code: "BADGE_ALREADY_EXISTS",
      message: "Badge already exists.",
      details: { key },
    });
  }
}
