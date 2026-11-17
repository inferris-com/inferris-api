import { NotFoundError, ValidationError } from "@/error/app-error.js";
export class IssueNotFoundError extends NotFoundError {
  constructor(id: string) {
    super({ code: "ISSUE_NOT_FOUND", message: `Issue '${id}' was not found.`, details: { id } });
  }
}
export class IssueActorNotFoundError extends ValidationError {
  constructor() {
    super({ code: "ISSUE_ACTOR_NOT_FOUND", message: "A referenced issue actor does not exist." });
  }
}
