import { type RequestHandler, Router } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { validateRequest } from "../../middleware/validation.js";
import type { ApiListSuccess, ApiSuccess } from "../../shared/http/api-response.types.js";
import type { PlayerResponse, PlayerSummaryResponse } from "./player.response.types.js";
import type { PlayerService } from "./player.service.js";
import type {
  CreatePlayerBody,
  DeletePlayerQuery,
  ListPlayersQuery,
  PlayerIdParams,
  UpdatePlayerBody,
} from "./player.schemas.js";
import {
  createPlayerBodySchema,
  deletePlayerQuerySchema,
  listPlayersQuerySchema,
  playerIdParamsSchema,
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

  const createPlayer: RequestHandler<ParamsDictionary, unknown, CreatePlayerBody> = async (
    req,
    res,
  ) => {
    const player = await service.createPlayer(req.body);
    const body: ApiSuccess<PlayerResponse> = { data: player };

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

  const deletePlayer: RequestHandler<PlayerIdParams, unknown, unknown, DeletePlayerQuery> = async (
    req,
    res,
  ) => {
    await service.deletePlayer(req.params.playerId, { hard: req.query.hard });
    res.status(204).send();
  };

  router.get("/", validateRequest({ query: listPlayersQuerySchema }), listPlayers);
  router.get("/:playerId", validateRequest({ params: playerIdParamsSchema }), getPlayer);
  router.post("/", validateRequest({ body: createPlayerBodySchema }), createPlayer);
  router.patch(
    "/:playerId",
    validateRequest({
      params: playerIdParamsSchema,
      body: updatePlayerBodySchema,
    }),
    updatePlayer,
  );
  router.delete(
    "/:playerId",
    validateRequest({ params: playerIdParamsSchema, query: deletePlayerQuerySchema }),
    deletePlayer,
  );

  return router;
}
