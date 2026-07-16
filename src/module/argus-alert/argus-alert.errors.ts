import { ConflictError, NotFoundError } from "../../error/app-error.js";

export class ArgusAlertNotFoundError extends NotFoundError {
  constructor(alertId: number) {
    super({
      code: "ARGUS_ALERT_NOT_FOUND",
      message: `Argus alert ${alertId} not found`,
    });
  }
}

export class ArgusAlertAlreadyExistsError extends ConflictError {
  constructor() {
    super({
      code: "ARGUS_ALERT_ALREADY_EXISTS",
      message: "An Argus alert with that title already exists",
    });
  }
}
