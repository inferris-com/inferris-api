import { ForbiddenError, NotFoundError, ValidationError } from "../../error/app-error.js";

export class ArgusDmConversationNotFoundError extends NotFoundError {
  constructor(conversationId: string) {
    super({
      code: "ARGUS_DM_CONVERSATION_NOT_FOUND",
      message: "Argus DM conversation not found.",
      details: { conversationId },
    });
  }
}

export class ArgusDmMessageNotFoundError extends NotFoundError {
  constructor(messageId: string) {
    super({
      code: "ARGUS_DM_MESSAGE_NOT_FOUND",
      message: "Argus DM message not found.",
      details: { messageId },
    });
  }
}

export class ArgusDmUserNotFoundError extends NotFoundError {
  constructor(argusUserId: string) {
    super({
      code: "ARGUS_DM_USER_NOT_FOUND",
      message: "Argus user not found.",
      details: { argusUserId },
    });
  }
}

export class ArgusDmForbiddenError extends ForbiddenError {
  constructor(message: string) {
    super({
      code: "ARGUS_DM_FORBIDDEN",
      message,
    });
  }
}

export class ArgusDmValidationError extends ValidationError {
  constructor(message: string) {
    super({
      code: "ARGUS_DM_VALIDATION_ERROR",
      message,
    });
  }
}
