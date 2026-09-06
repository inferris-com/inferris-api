import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "@/middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "@/shared/http/api-response.types.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerFlagBitmaskResponse,
  PlayerFlagDefinitionResponse,
  PlayerNicknameResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSearchResultResponse,
  PlayerSummaryResponse,
} from "@/module/player/player.response.types.js";
import type { PlayerService } from "@/module/player/player.service.js";
import {
  type CreatePlayerBody,
  type CreatePlayerBadgeAssignmentBody,
  type AssignPlayerNicknameBody,
  type DecodePlayerFlagsQuery,
  type EncodePlayerFlagsQuery,
  type ListPlayersQuery,
  type ListPlayerFlagDefinitionsQuery,
  type PlayerBadgeAssignmentParams,
  type PlayerIdParams,
  type PlayerMojangIdParams,
  type PlayerRankAssignmentParams,
  createPlayerBadgeAssignmentBodySchema,
  assignPlayerNicknameBodySchema,
  decodePlayerFlagsQuerySchema,
  encodePlayerFlagsQuerySchema,
  listPlayerFlagDefinitionsQuerySchema,
  replacePlayerRankAssignmentBodySchema,
  type ReplaceRankAssignmentBody,
  type SearchPlayersQuery,
  searchPlayersQuerySchema,
  type UpdatePlayerBody,
  updatePlayerProfileBodySchema,
  type UpdateProfileBody,
} from "@/module/player/player.schemas.js";
import {
  createPlayerBodySchema,
  deletePlayerQuerySchema,
  listPlayersQuerySchema,
  playerBadgeAssignmentParamsSchema,
  playerIdParamsSchema,
  playerMojangIdParamsSchema,
  playerRankAssignmentParamsSchema,
  updatePlayerBodySchema,
} from "@/module/player/player.schemas.js";
import {
  auditMutation,
  authorize,
  getRequestActorId,
  requireActor,
} from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";
import { ForbiddenError } from "@/error/app-error.js";

export function createPlayerRouter(service: PlayerService, authRepository: AuthRepository): Router {
  const router = Router();

  const readPlayers = authorize(authRepository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });
  const writePlayers = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
  });
  const managePlayerStaffState = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });
  const administerPlayers = authorize(authRepository, {
    apiScopes: ["players:write"],
    argusRole: "admin",
    privilegedRole: "administrator",
  });
  const listPlayers: RequestHandler = async (req, res) => {
    const players = await service.listPlayers(req.query as unknown as ListPlayersQuery);
    const body: ApiListSuccess<PlayerSummaryResponse> = {
      data: players,
      meta: { count: players.length },
    };

    res.json(body);
  };

  const searchPlayers: RequestHandler = async (req, res) => {
    const players = await service.searchPlayers(req.query as unknown as SearchPlayersQuery);
    const body: ApiListSuccess<PlayerSearchResultResponse> = {
      data: players,
      meta: { count: players.length },
    };

    res.json(body);
  };

  const requireSensitivePlayerSearchAccess: RequestHandler = (req, _res, next) => {
    const query = req.query as unknown as SearchPlayersQuery;

    if (!query.sensitive) {
      next();
      return;
    }

    const apiKey = req.auth?.apiKey;
    const privilegedRole = req.auth?.privileged?.role;
    const hasAccess =
      req.auth?.argus?.role === "admin" ||
      privilegedRole === "administrator" ||
      privilegedRole === "superadmin" ||
      apiKey?.isSuperKey === true ||
      apiKey?.scopes.includes("*") === true ||
      apiKey?.scopes.includes("players:bypass-sensitive-fields") === true;

    if (!hasAccess) {
      next(
        new ForbiddenError({
          code: "FORBIDDEN",
          message: "Sensitive player search requires elevated read access.",
        }),
      );
      return;
    }

    next();
  };

  const listFlagDefinitions: RequestHandler = async (req, res) => {
    const flags = await service.listFlagDefinitions(
      req.query as unknown as ListPlayerFlagDefinitionsQuery,
    );
    const body: ApiListSuccess<PlayerFlagDefinitionResponse> = {
      data: flags,
      meta: { count: flags.length },
    };

    res.json(body);
  };

  const encodeFlags: RequestHandler = async (req, res) => {
    const result = await service.encodeFlags(req.query as unknown as EncodePlayerFlagsQuery);
    const body: ApiSuccess<PlayerFlagBitmaskResponse> = { data: result };

    res.json(body);
  };

  const decodeFlags: RequestHandler = async (req, res) => {
    const result = await service.decodeFlags(req.query as unknown as DecodePlayerFlagsQuery);
    const body: ApiSuccess<PlayerFlagBitmaskResponse> = { data: result };

    res.json(body);
  };

  const getPlayer: RequestHandler<PlayerIdParams> = async (req, res) => {
    const player = await service.getPlayer(req.params.playerId);
    const body: ApiSuccess<PlayerResponse> = { data: player };
    res.json(body);
  };

  const getPlayerByMojangId: RequestHandler<PlayerMojangIdParams> = async (req, res) => {
    const player = await service.getPlayerByMojangId(req.params.mojangId);
    const body: ApiSuccess<PlayerResponse> = { data: player };
    res.json(body);
  };

  const getProfile: RequestHandler<PlayerIdParams> = async (req, res) => {
    const player = await service.getProfile(req.params.playerId);
    const body: ApiSuccess<PlayerProfileResponse> = { data: player };
    res.json(body);
  };

  const listBadgeAssignments: RequestHandler<PlayerIdParams> = async (req, res) => {
    const badges = await service.listBadgeAssignments(req.params.playerId);
    const body: ApiListSuccess<PlayerBadgeAssignmentResponse> = {
      data: badges,
      meta: { count: badges.length },
    };

    res.json(body);
  };

  const listNicknames: RequestHandler<PlayerIdParams> = async (req, res) => {
    const nicknames = await service.listNicknames(req.params.playerId);
    const body: ApiListSuccess<PlayerNicknameResponse> = {
      data: nicknames,
      meta: { count: nicknames.length },
    };

    res.json(body);
  };

  const createPlayer: RequestHandler<ParamsDictionary, unknown, CreatePlayerBody> = async (
    req,
    res,
  ) => {
    const player = await service.createPlayer(req.body);
    const body: ApiSuccess<PlayerResponse> = { data: player };

    res.status(201).json(body);
  };

  const createBadgeAssignment: RequestHandler<
    PlayerIdParams,
    unknown,
    CreatePlayerBadgeAssignmentBody
  > = async (req, res) => {
    const badge = await service.createBadgeAssignment(req.params.playerId, req.body);
    const body: ApiSuccess<PlayerBadgeAssignmentResponse> = { data: badge };

    res.status(201).json(body);
  };

  const assignNickname: RequestHandler<PlayerIdParams, unknown, AssignPlayerNicknameBody> = async (
    req,
    res,
  ) => {
    const nickname = await service.assignNickname(req.params.playerId, req.body);
    const body: ApiSuccess<PlayerNicknameResponse> = { data: nickname };

    res.status(201).json(body);
  };

  const updatePlayer: RequestHandler<PlayerIdParams, unknown, UpdatePlayerBody> = async (
    req,
    res,
  ) => {
    const player = await service.updatePlayer(req.params.playerId, req.body);
    const body: ApiSuccess<PlayerResponse> = { data: player };
    res.json(body);
  };

  const updateRankAssignment: RequestHandler<
    PlayerRankAssignmentParams,
    unknown,
    ReplaceRankAssignmentBody
  > = async (req, res) => {
    const assignment = await service.updateRankAssignment(
      req.params.playerId,
      req.params.groupKey,
      req.params.rankKey,
      {
        ...req.body,
        assignedByActorId: getRequestActorId(req),
      },
    );
    const body: ApiSuccess<PlayerRankAssignmentResponse> = { data: assignment };
    res.json(body);
  };

  const updateProfile: RequestHandler<PlayerIdParams, unknown, UpdateProfileBody> = async (
    req,
    res,
  ) => {
    const player = await service.updateProfile(req.params.playerId, req.body);
    const body: ApiSuccess<PlayerProfileResponse> = { data: player };
    res.json(body);
  };

  const deletePlayer: RequestHandler<PlayerIdParams> = async (req, res) => {
    await service.deletePlayer(req.params.playerId);
    res.status(204).send();
  };

  const deleteRankAssignment: RequestHandler<PlayerRankAssignmentParams> = async (req, res) => {
    await service.deleteRankAssignment(
      req.params.playerId,
      req.params.groupKey,
      req.params.rankKey,
    );

    res.status(204).send();
  };

  const deleteBadgeAssignment: RequestHandler = async (req, res) => {
    const params = req.params as unknown as PlayerBadgeAssignmentParams;

    await service.deleteBadgeAssignment(params.playerId, params.badgeId);

    res.status(204).send();
  };

  const revokeActiveNickname: RequestHandler<PlayerIdParams> = async (req, res) => {
    const nickname = await service.revokeActiveNickname(
      req.params.playerId,
      getRequestActorId(req) ?? "",
    );
    const body: ApiSuccess<PlayerNicknameResponse> = { data: nickname };

    res.json(body);
  };

  router.get(
    "/",
    readPlayers,
    validateRequest({ query: listPlayersQuerySchema }) as unknown as RequestHandler,
    listPlayers,
  );
  router.get(
    "/search",
    readPlayers,
    validateRequest({ query: searchPlayersQuerySchema }) as unknown as RequestHandler,
    requireSensitivePlayerSearchAccess,
    searchPlayers,
  );
  router.get(
    "/flags",
    readPlayers,
    validateRequest({ query: listPlayerFlagDefinitionsQuerySchema }) as unknown as RequestHandler,
    listFlagDefinitions,
  );
  router.get(
    "/flags/encode",
    readPlayers,
    validateRequest({ query: encodePlayerFlagsQuerySchema }) as unknown as RequestHandler,
    encodeFlags,
  );
  router.get(
    "/flags/decode",
    readPlayers,
    validateRequest({ query: decodePlayerFlagsQuerySchema }) as unknown as RequestHandler,
    decodeFlags,
  );
  router.get(
    "/by-mojang/:mojangId",
    readPlayers,
    validateRequest({ params: playerMojangIdParamsSchema }),
    getPlayerByMojangId,
  );
  router.get(
    "/:playerId",
    readPlayers,
    validateRequest({ params: playerIdParamsSchema }),
    getPlayer,
  );
  router.get(
    "/:playerId/profile",
    readPlayers,
    validateRequest({ params: playerIdParamsSchema }),
    getProfile,
  );
  router.get(
    "/:playerId/badges",
    readPlayers,
    validateRequest({ params: playerIdParamsSchema }),
    listBadgeAssignments,
  );
  router.get(
    "/:playerId/nicknames",
    readPlayers,
    validateRequest({ params: playerIdParamsSchema }),
    listNicknames,
  );
  router.post(
    "/",
    writePlayers,
    auditMutation(authRepository, "players.create"),
    validateRequest({ body: createPlayerBodySchema }),
    createPlayer,
  );
  router.post(
    "/:playerId/badges",
    managePlayerStaffState,
    auditMutation(authRepository, "players.badges.create"),
    validateRequest({
      params: playerIdParamsSchema,
      body: createPlayerBadgeAssignmentBodySchema,
    }),
    createBadgeAssignment,
  );
  router.post(
    "/:playerId/nicknames",
    managePlayerStaffState,
    requireActor(),
    auditMutation(authRepository, "players.nicknames.create"),
    validateRequest({
      params: playerIdParamsSchema,
      body: assignPlayerNicknameBodySchema,
    }),
    assignNickname,
  );
  router.put(
    "/:playerId/ranks/:groupKey/:rankKey",
    managePlayerStaffState,
    requireActor(),
    auditMutation(authRepository, "players.ranks.replace"),
    validateRequest({
      params: playerRankAssignmentParamsSchema,
      body: replacePlayerRankAssignmentBodySchema,
    }),
    updateRankAssignment,
  );
  router.patch(
    "/:playerId",
    writePlayers,
    auditMutation(authRepository, "players.update"),
    validateRequest({
      params: playerIdParamsSchema,
      body: updatePlayerBodySchema,
    }),
    updatePlayer,
  );
  router.patch(
    "/:playerId/profile",
    writePlayers,
    auditMutation(authRepository, "players.profile.update"),
    validateRequest({
      params: playerIdParamsSchema,
      body: updatePlayerProfileBodySchema,
    }),
    updateProfile,
  );
  router.delete(
    "/:playerId",
    administerPlayers,
    auditMutation(authRepository, "players.delete"),
    validateRequest({
      params: playerIdParamsSchema,
      query: deletePlayerQuerySchema,
    }) as unknown as RequestHandler,
    deletePlayer,
  );
  router.delete(
    "/:playerId/ranks/:groupKey/:rankKey",
    managePlayerStaffState,
    auditMutation(authRepository, "players.ranks.delete"),
    validateRequest({ params: playerRankAssignmentParamsSchema }),
    deleteRankAssignment,
  );
  router.delete(
    "/:playerId/badges/:badgeId",
    managePlayerStaffState,
    auditMutation(authRepository, "players.badges.delete"),
    validateRequest({ params: playerBadgeAssignmentParamsSchema }) as unknown as RequestHandler,
    deleteBadgeAssignment,
  );
  router.delete(
    "/:playerId/nicknames/active",
    managePlayerStaffState,
    requireActor(),
    auditMutation(authRepository, "players.nicknames.revoke"),
    validateRequest({ params: playerIdParamsSchema }),
    revokeActiveNickname,
  );

  return router;
}
