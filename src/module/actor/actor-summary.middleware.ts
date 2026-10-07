import type { RequestHandler } from "express";

import { authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";

export function authorizeListIdentities(repository: AuthRepository): RequestHandler {
  // Expanding a moderation list must not bypass the separate resource read policies.
  const readActors = authorize(repository, { apiScopes: ["actors:read"], argusRole: "moderator" });
  const readPlayers = authorize(repository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });

  return (req, res, next) => {
    if (req.query.include !== "identities") {
      next();
      return;
    }
    void readActors(req, res, (error?: unknown) => {
      if (error) next(error);
      else void readPlayers(req, res, next);
    });
  };
}
