import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class PlayerUsernameConflictError extends ConflictError {
  constructor() {
    super({
      code: "PLAYER_USERNAME_CONFLICT",
      message: "That username is already associated with a different Minecraft identity.",
    });
  }
}

export class PlayerNotFoundError extends NotFoundError {
  readonly playerId: string;

  constructor(playerId: string) {
    super({
      code: "PLAYER_NOT_FOUND",
      message: "Player not found.",
    });

    this.playerId = playerId;
  }
}

export class GroupNotFoundError extends NotFoundError {
  readonly groupId: string;

  constructor(groupId: string) {
    super({
      code: "GROUP_NOT_FOUND",
      message: "Group not found.",
    });
    this.groupId = groupId;
  }
}

export class RankNotFoundError extends NotFoundError {
  readonly rankId: string;

  constructor(rankId: string) {
    super({
      code: "RANK_NOT_FOUND",
      message: "Rank not found.",
    });
    this.rankId = rankId;
  }
}

export class PlayerNicknameNotFoundError extends NotFoundError {
  readonly playerId: string;

  constructor(playerId: string) {
    super({
      code: "PLAYER_NICKNAME_NOT_FOUND",
      message: "Active player nickname not found.",
    });

    this.playerId = playerId;
  }
}

export class BadgeNotFoundError extends NotFoundError {
  readonly badgeId: number;

  constructor(badgeId: number) {
    super({
      code: "BADGE_NOT_FOUND",
      message: "Badge not found.",
    });

    this.badgeId = badgeId;
  }
}

export class PlayerAlreadyExistsError extends ConflictError {
  readonly playerId: string;

  constructor(playerId: string) {
    super({
      code: "PLAYER_ALREADY_EXISTS",
      message: "Player already exists.",
    });

    this.playerId = playerId;
  }
}

export class PlayerNicknameConflictError extends ConflictError {
  readonly nickname: string;

  constructor(nickname: string) {
    super({
      code: "PLAYER_NICKNAME_CONFLICT",
      message: "Player nickname is already active.",
    });

    this.nickname = nickname;
  }
}

export class GroupAlreadyExistsError extends ConflictError {
  readonly groupId: string;

  constructor(groupId: string) {
    super({
      code: "GROUP_ALREADY_EXISTS",
      message: "Group already exists.",
    });
    this.groupId = groupId;
  }
}

export class RankAlreadyExistsError extends ConflictError {
  readonly rankId: string;

  constructor(rankId: string) {
    super({
      code: "RANK_ALREADY_EXISTS",
      message: "Rank already exists.",
    });
    this.rankId = rankId;
  }
}
