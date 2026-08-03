import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class ArgusUserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super({
      code: "ARGUS_USER_NOT_FOUND",
      message: "Argus user not found.",
      details: { userId },
    });
  }
}

export class ArgusUserAlreadyExistsError extends ConflictError {
  constructor() {
    super({
      code: "ARGUS_USER_ALREADY_EXISTS",
      message: "Argus username or email already exists.",
    });
  }
}
