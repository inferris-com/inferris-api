import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import {
  auditMutation,
  authorize,
  getActingActorId,
  requireActingActor,
} from "../auth/auth.middleware.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { ModCaseActorResponse, ModCaseResponse } from "./mod-case.response-types.js";
import {
  type CreateModCaseActorBody,
  createModCaseActorBodySchema,
  type CreateModCaseBody,
  createModCaseBodySchema,
  type ListModCasesQuery,
  listModCasesQuerySchema,
  type ModCaseIdParams,
  modCaseIdParamsSchema,
  type UpdateModCaseBody,
  updateModCaseBodySchema,
} from "./mod-case.schemas.js";
import type { ModCaseListResponse, ModCaseService } from "./mod-case.service.js";

export function createModCaseRouter(
  service: ModCaseService,
  authRepository: AuthRepository,
): Router {
  const router = Router();

  const readModCases = authorize(authRepository, {
    apiScopes: ["moderation:read"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });
  const manageModCases = authorize(authRepository, {
    apiScopes: ["moderation:write"],
    argusRole: "moderator",
    privilegedRole: "moderator",
  });

  const listModCases: RequestHandler = async (req, res) => {
    const result = await service.listModCases(req.query as unknown as ListModCasesQuery);
    res.json(result satisfies ModCaseListResponse);
  };

  const getModCase: RequestHandler<ModCaseIdParams> = async (req, res) => {
    const modCase = await service.getModCase(req.params.caseId);
    const body: ApiSuccess<ModCaseResponse> = { data: modCase };

    res.json(body);
  };

  const createModCase: RequestHandler<ParamsDictionary, unknown, CreateModCaseBody> = async (
    req,
    res,
  ) => {
    const modCase = await service.createModCase(req.body, getActingActorId(req) ?? "");
    const body: ApiSuccess<ModCaseResponse> = { data: modCase };

    res.status(201).json(body);
  };

  const updateModCase: RequestHandler<ModCaseIdParams, unknown, UpdateModCaseBody> = async (
    req,
    res,
  ) => {
    const modCase = await service.updateModCase(
      req.params.caseId,
      req.body,
      getActingActorId(req) ?? "",
    );
    const body: ApiSuccess<ModCaseResponse> = { data: modCase };

    res.json(body);
  };

  const listActors: RequestHandler<ModCaseIdParams> = async (req, res) => {
    const actors = await service.listActors(req.params.caseId);
    const body: ApiListSuccess<ModCaseActorResponse> = {
      data: actors,
      meta: { count: actors.length },
    };

    res.json(body);
  };

  const createActor: RequestHandler<ModCaseIdParams, unknown, CreateModCaseActorBody> = async (
    req,
    res,
  ) => {
    const actor = await service.createActor(
      req.params.caseId,
      req.body,
      getActingActorId(req) ?? "",
    );
    const body: ApiSuccess<ModCaseActorResponse> = { data: actor };

    res.status(201).json(body);
  };

  router.get(
    "/",
    readModCases,
    validateRequest({ query: listModCasesQuerySchema }) as unknown as RequestHandler,
    listModCases,
  );
  router.post(
    "/",
    manageModCases,
    requireActingActor(authRepository),
    auditMutation(authRepository, "mod_cases.create"),
    validateRequest({ body: createModCaseBodySchema }),
    createModCase,
  );
  router.get(
    "/:caseId",
    readModCases,
    validateRequest({ params: modCaseIdParamsSchema }),
    getModCase,
  );
  router.patch(
    "/:caseId",
    manageModCases,
    requireActingActor(authRepository),
    auditMutation(authRepository, "mod_cases.update"),
    validateRequest({ params: modCaseIdParamsSchema, body: updateModCaseBodySchema }),
    updateModCase,
  );
  router.get(
    "/:caseId/actors",
    readModCases,
    validateRequest({ params: modCaseIdParamsSchema }),
    listActors,
  );
  router.post(
    "/:caseId/actors",
    manageModCases,
    requireActingActor(authRepository),
    auditMutation(authRepository, "mod_cases.actors.create"),
    validateRequest({ params: modCaseIdParamsSchema, body: createModCaseActorBodySchema }),
    createActor,
  );

  return router;
}
