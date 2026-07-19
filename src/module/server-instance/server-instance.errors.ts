import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../error/app-error.js";

export class ServerInstanceNotFoundError extends NotFoundError {
  constructor(serverInstanceId: string) {
    super({
      code: "SERVER_INSTANCE_NOT_FOUND",
      message: `Server instance ${serverInstanceId} was not found.`,
    });
  }
}

export class ServerInstanceSequenceGapError extends ConflictError {
  constructor(expectedSequence: string) {
    super({
      code: "SERVER_EVENT_SEQUENCE_GAP",
      message: "Server event sequence has a gap.",
      details: { expectedSequence },
    });
  }
}

export class ServerInstanceEventConflictError extends ConflictError {
  constructor() {
    super({
      code: "SERVER_EVENT_CONFLICT",
      message: "Server event id or sequence was already used for different event content.",
    });
  }
}

export class ProxyInstanceRequiredError extends ForbiddenError {
  constructor() {
    super({
      code: "PROXY_INSTANCE_REQUIRED",
      message: "Canonical session events require an authenticated proxy instance.",
    });
  }
}

export class InvalidServerEventPayloadError extends ValidationError {
  constructor(message: string) {
    super({
      code: "INVALID_SERVER_EVENT_PAYLOAD",
      message,
    });
  }
}

export class ServerInstanceInactiveError extends ForbiddenError {
  constructor() {
    super({
      code: "SERVER_INSTANCE_INACTIVE",
      message: "Server instance token is no longer active.",
    });
  }
}

export class ServerInstanceRegistrationForbiddenError extends ForbiddenError {
  constructor() {
    super({
      code: "SERVER_INSTANCE_REGISTRATION_FORBIDDEN",
      message: "Registration credential is not bound to the requested server.",
    });
  }
}
