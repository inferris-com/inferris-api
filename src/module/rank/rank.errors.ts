import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class RankNotFoundError extends NotFoundError {
  constructor(rankKey: string) {
    super({
      code: "RANK_NOT_FOUND",
      message: "Rank not found.",
      details: { rankKey },
    });
  }
}

export class RankAlreadyExistsError extends ConflictError {
  constructor(rankKey: string) {
    super({
      code: "RANK_ALREADY_EXISTS",
      message: "Rank already exists.",
      details: { rankKey },
    });
  }
}
