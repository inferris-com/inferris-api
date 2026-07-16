import { type RequestHandler, Router } from "express";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";
import { auditMutation, authorize, getRequestActorId } from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { StaffPrivilegeResponse } from "./staff-privilege.response-types.js";
import {
  createStaffPrivilegeBodySchema,
  listStaffPrivilegesQuerySchema,
  staffPrivilegeActorParamsSchema,
  staffPrivilegeParamsSchema,
  updateStaffPrivilegeBodySchema,
  type CreateStaffPrivilegeBody,
  type ListStaffPrivilegesQuery,
  type StaffPrivilegeActorParams,
  type StaffPrivilegeParams,
  type UpdateStaffPrivilegeBody,
} from "./staff-privilege.schemas.js";
import type { StaffPrivilegeService } from "./staff-privilege.service.js";

type StaffPrivilegeListSuccess = { data: StaffPrivilegeResponse[]; meta: PaginatedResponse };

export function createStaffPrivilegeRouter(
  service: StaffPrivilegeService,
  authRepository: AuthRepository,
): Router {
  const router = Router();
  const managePrivileges = authorize(authRepository, {
    apiScopes: ["staff:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });

  const listPrivileges: RequestHandler = async (req, res) => {
    const result = await service.listPrivileges(req.query as unknown as ListStaffPrivilegesQuery);
    const body: StaffPrivilegeListSuccess = {
      data: result.rows,
      meta: { count: result.rows.length, total: result.total, limit: result.limit, offset: result.offset },
    };
    res.json(body);
  };
  const getPrivilege: RequestHandler<StaffPrivilegeParams> = async (req, res) => {
    const privilege = await service.getPrivilege(req.params.privilegeId);
    const body: ApiSuccess<StaffPrivilegeResponse> = { data: privilege };
    res.json(body);
  };
  const listPrivilegesByActor: RequestHandler<StaffPrivilegeActorParams> = async (req, res) => {
    const privileges = await service.listPrivilegesByActorId(req.params.actorId);
    res.json({ data: privileges, meta: { count: privileges.length } });
  };
  const createPrivilege: RequestHandler<Record<string, never>, unknown, CreateStaffPrivilegeBody> =
    async (req, res) => {
      const privilege = await service.createPrivilege(req.body, getRequestActorId(req));
      const body: ApiSuccess<StaffPrivilegeResponse> = { data: privilege };
      res.status(201).json(body);
    };
  const updatePrivilege: RequestHandler<
    StaffPrivilegeParams,
    unknown,
    UpdateStaffPrivilegeBody
  > = async (req, res) => {
    const privilege = await service.updatePrivilege(req.params.privilegeId, req.body);
    const body: ApiSuccess<StaffPrivilegeResponse> = { data: privilege };
    res.json(body);
  };
  const revokePrivilege: RequestHandler<StaffPrivilegeParams> = async (req, res) => {
    const privilege = await service.revokePrivilege(req.params.privilegeId, getRequestActorId(req));
    const body: ApiSuccess<StaffPrivilegeResponse> = { data: privilege };
    res.json(body);
  };

  router.get(
    "/",
    managePrivileges,
    validateRequest({ query: listStaffPrivilegesQuerySchema }) as unknown as RequestHandler,
    listPrivileges,
  );
  router.get(
    "/actors/:actorId",
    managePrivileges,
    validateRequest({ params: staffPrivilegeActorParamsSchema }),
    listPrivilegesByActor,
  );
  router.get(
    "/:privilegeId",
    managePrivileges,
    validateRequest({ params: staffPrivilegeParamsSchema }),
    getPrivilege,
  );
  router.post(
    "/",
    managePrivileges,
    auditMutation(authRepository, "staff-privileges.create"),
    validateRequest({ body: createStaffPrivilegeBodySchema }),
    createPrivilege,
  );
  router.patch(
    "/:privilegeId",
    managePrivileges,
    auditMutation(authRepository, "staff-privileges.update"),
    validateRequest({ params: staffPrivilegeParamsSchema, body: updateStaffPrivilegeBodySchema }),
    updatePrivilege,
  );
  router.delete(
    "/:privilegeId",
    managePrivileges,
    auditMutation(authRepository, "staff-privileges.revoke"),
    validateRequest({ params: staffPrivilegeParamsSchema }),
    revokePrivilege,
  );

  return router;
}
