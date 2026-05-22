import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSummaryResponse,
} from "./player.response.types.js";
import type { PlayerService } from "./player.service.js";
import {
  type CreatePlayerBody,
  type CreatePlayerBadgeAssignmentBody,
  type DeletePlayerQuery,
  type ListPlayersQuery,
  type PlayerBadgeAssignmentParams,
  type PlayerIdParams,
  type PlayerRankAssignmentParams,
  createPlayerBadgeAssignmentBodySchema,
  replacePlayerRankAssignmentBodySchema,
  type ReplaceRankAssignmentBody,
  type UpdatePlayerBody,
  updatePlayerProfileBodySchema,
  type UpdateProfileBody,
} from "./player.schemas.js";
import {
  createPlayerBodySchema,
  deletePlayerQuerySchema,
  listPlayersQuerySchema,
  playerBadgeAssignmentParamsSchema,
  playerIdParamsSchema,
  playerRankAssignmentParamsSchema,
  updatePlayerBodySchema,
} from "./player.schemas.js";

export function createPlayerRouter(service: PlayerService): Router {
  const router = Router();

  const listPlayers: RequestHandler<ParamsDictionary, unknown, unknown, ListPlayersQuery> = async (
    req,
    res,
  ) => {
    const players = await service.listPlayers(req.query);
    const body: ApiListSuccess<PlayerSummaryResponse> = {
      data: players,
      meta: { count: players.length },
    };

    res.json(body);
  };

  const getPlayer: RequestHandler<PlayerIdParams> = async (req, res) => {
    const player = await service.getPlayer(req.params.playerId);
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
      req.body,
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

  const deletePlayer: RequestHandler<PlayerIdParams, unknown, unknown, DeletePlayerQuery> = async (
    req,
    res,
  ) => {
    await service.deletePlayer(req.params.playerId, { hard: req.query.hard });
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

  const deleteBadgeAssignment: RequestHandler<PlayerBadgeAssignmentParams> = async (req, res) => {
    await service.deleteBadgeAssignment(req.params.playerId, req.params.badgeId);

    res.status(204).send();
  };

  router.get("/", validateRequest({ query: listPlayersQuerySchema }), listPlayers);
  router.get("/:playerId", validateRequest({ params: playerIdParamsSchema }), getPlayer);
  router.get("/:playerId/profile", validateRequest({ params: playerIdParamsSchema }), getProfile);
  router.get(
    "/:playerId/badges",
    validateRequest({ params: playerIdParamsSchema }),
    listBadgeAssignments,
  );
  router.post("/", validateRequest({ body: createPlayerBodySchema }), createPlayer);
  router.post(
    "/:playerId/badges",
    validateRequest({
      params: playerIdParamsSchema,
      body: createPlayerBadgeAssignmentBodySchema,
    }),
    createBadgeAssignment,
  );
  router.put(
    "/:playerId/ranks/:groupKey/:rankKey",
    validateRequest({
      params: playerRankAssignmentParamsSchema,
      body: replacePlayerRankAssignmentBodySchema,
    }),
    updateRankAssignment,
  );
  router.patch(
    "/:playerId",
    validateRequest({
      params: playerIdParamsSchema,
      body: updatePlayerBodySchema,
    }),
    updatePlayer,
  );
  router.patch(
    "/:playerId/profile",
    validateRequest({
      params: playerIdParamsSchema,
      body: updatePlayerProfileBodySchema,
    }),
    updateProfile,
  );
  router.delete(
    "/:playerId",
    validateRequest({ params: playerIdParamsSchema, query: deletePlayerQuerySchema }),
    deletePlayer,
  );
  router.delete(
    "/:playerId/ranks/:groupKey/:rankKey",
    validateRequest({ params: playerRankAssignmentParamsSchema }),
    deleteRankAssignment,
  );
  router.delete(
    "/:playerId/badges/:badgeId",
    validateRequest({ params: playerBadgeAssignmentParamsSchema }),
    deleteBadgeAssignment,
  );

  return router;
}
