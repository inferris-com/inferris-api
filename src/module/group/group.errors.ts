import { ConflictError, NotFoundError } from "../../error/app-error.js";

export class GroupNotFoundError extends NotFoundError {
  constructor(groupKey: string) {
    super({
      code: "GROUP_NOT_FOUND",
      message: "Group not found.",
      details: { groupKey },
    });
  }
}

export class GroupAlreadyExistsError extends ConflictError {
  constructor(groupKey: string) {
    super({
      code: "GROUP_ALREADY_EXISTS",
      message: "Group already exists.",
      details: { groupKey },
    });
  }
}
