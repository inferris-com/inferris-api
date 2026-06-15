import { NotFoundError, ServiceUnavailableError, ValidationError } from "../../error/app-error.js";

export class ChatActorNotFoundError extends NotFoundError {
  constructor(id: string) {
    super({
      code: "CHAT_ACTOR_NOT_FOUND",
      message: `Chat actor '${id}' was not found.`,
    });
  }
}

export class ChatServerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super({
      code: "CHAT_SERVER_NOT_FOUND",
      message: `Chat origin server '${id}' was not found.`,
    });
  }
}

export class ChatChannelNotFoundError extends NotFoundError {
  constructor(key: string) {
    super({
      code: "CHAT_CHANNEL_NOT_FOUND",
      message: `Chat channel '${key}' was not found.`,
    });
  }
}

export class ChatRedisUnavailableError extends ServiceUnavailableError {
  constructor(cause?: unknown) {
    super({
      code: "CHAT_BUFFER_UNAVAILABLE",
      message: "Chat ingestion buffer is unavailable.",
      cause,
    });
  }
}

export class ChatBatchTooLargeError extends ValidationError {
  constructor(max: number) {
    super({
      code: "CHAT_BATCH_TOO_LARGE",
      message: `Chat message batch may contain at most ${max} messages.`,
    });
  }
}
