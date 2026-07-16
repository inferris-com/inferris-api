import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { staffPrivilegeResponseSchema } from "./staff-privilege.response-types.js";
import {
  createStaffPrivilegeBodySchema,
  listStaffPrivilegesQuerySchema,
  staffPrivilegeActorParamsSchema,
  staffPrivilegeParamsSchema,
  updateStaffPrivilegeBodySchema,
} from "./staff-privilege.schemas.js";

export function registerStaffPrivilegeOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/staff-privileges",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "List staff privileges",
    operationId: "listStaffPrivileges",
    request: { query: listStaffPrivilegesQuerySchema },
    responses: { "200": listResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/staff-privileges/actors/{actorId}",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "List staff privileges for an actor",
    operationId: "listStaffPrivilegesByActor",
    request: { params: staffPrivilegeActorParamsSchema },
    responses: { "200": listResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/staff-privileges/{privilegeId}",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "Get a staff privilege",
    operationId: "getStaffPrivilege",
    request: { params: staffPrivilegeParamsSchema },
    responses: { "200": successResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/staff-privileges",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "Create a staff privilege",
    operationId: "createStaffPrivilege",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createStaffPrivilegeBodySchema) },
      },
    },
    responses: { "201": successResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/staff-privileges/{privilegeId}",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "Update a staff privilege",
    operationId: "updateStaffPrivilege",
    request: {
      params: staffPrivilegeParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateStaffPrivilegeBodySchema) },
      },
    },
    responses: { "200": successResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/staff-privileges/{privilegeId}",
    tags: ["Staff Privileges"],
    security: userOrServiceSecurity,
    summary: "Revoke a staff privilege",
    operationId: "revokeStaffPrivilege",
    request: { params: staffPrivilegeParamsSchema },
    responses: { "200": successResponse(staffPrivilegeResponseSchema), ...standardErrorResponses },
  });
}
