import { NotFoundError, ValidationError } from "../../error/app-error.js";

export class ModCaseNotFoundError extends NotFoundError {
  constructor(caseId: string) {
    super({
      code: "MOD_CASE_NOT_FOUND",
      message: "Mod case not found.",
      details: { caseId },
    });
  }
}

export class InvalidModCaseTransitionError extends ValidationError {
  constructor(message: string) {
    super({
      code: "INVALID_MOD_CASE_TRANSITION",
      message,
    });
  }
}
