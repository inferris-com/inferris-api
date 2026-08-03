import { NotFoundError } from "@/error/app-error.js";

export class StaffPrivilegeNotFoundError extends NotFoundError {
  constructor(privilegeId: string) {
    super({
      code: "STAFF_PRIVILEGE_NOT_FOUND",
      message: "Staff privilege not found.",
      details: { privilegeId },
    });
  }
}
