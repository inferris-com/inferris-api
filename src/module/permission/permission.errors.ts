import { ConflictError, NotFoundError } from "../../error/app-error.js";

export class PermissionKeyNotFoundError extends NotFoundError {
  readonly permissionKey: string;

  constructor(permissionKey: string) {
    super({
      code: "PERMISSION_KEY_NOT_FOUND",
      message: "Permission key not found.",
    });

    this.permissionKey = permissionKey;
  }
}

export class PermissionRuleNotFoundError extends NotFoundError {
  readonly permissionRule: string;

  constructor(permissionRule: string) {
    super({
      code: "PERMISSION_RULE_NOT_FOUND",
      message: "Permission rule not found.",
    });

    this.permissionRule = permissionRule;
  }
}

export class PermissionKeyAlreadyExistsError extends ConflictError {
  readonly permissionKey: string;

  constructor(permissionKey: string) {
    super({
      code: "PERMISSION_KEY_ALREADY_EXISTS",
      message: "Permission key already exists.",
    });

    this.permissionKey = permissionKey;
  }
}
export class PermissionRuleAlreadyExistsError extends ConflictError {
  readonly permissionRule: string;

  constructor(permissionRule: string) {
    super({
      code: "PERMISSION_RULE_ALREADY_EXISTS",
      message: "Permission rule already exists.",
    });

    this.permissionRule = permissionRule;
  }
}
