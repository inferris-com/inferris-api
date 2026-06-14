import { ConflictError, NotFoundError, ValidationError } from "../../error/app-error.js";

export class PunishmentNotFoundError extends NotFoundError {
  constructor(punishmentId: string) {
    super({
      code: "PUNISHMENT_NOT_FOUND",
      message: "Punishment not found.",
      details: { punishmentId },
    });
  }
}

export class PunishmentAlreadyRevokedError extends ConflictError {
  constructor(punishmentId: string) {
    super({
      code: "PUNISHMENT_ALREADY_REVOKED",
      message: "Punishment is already revoked.",
      details: { punishmentId },
    });
  }
}

export class InvalidPunishmentDurationError extends ValidationError {
  constructor(message: string) {
    super({
      code: "INVALID_PUNISHMENT_DURATION",
      message,
    });
  }
}

export class ActivePunishmentConflictError extends ConflictError {
  constructor(type: "ban" | "mute", subjectActorId: string) {
    super({
      code: "ACTIVE_PUNISHMENT_CONFLICT",
      message: `Actor already has an active ${type}.`,
      details: { type, subjectActorId },
    });
  }
}
