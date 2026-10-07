import type { RequestHandler } from "express";

import { authorize } from "@/module/auth/auth.middleware.js";
import type { AuthRepository } from "@/module/auth/auth.repository.js";

export function authorizeListIdentities(repository: AuthRepository): RequestHandler[] {
  // Expanding a moderation list must not bypass the separate resource read policies.
  const readActors = authorize(repository, { apiScopes: ["actors:read"], argusRole: "moderator" });
  const readPlayers = authorize(repository, {
    apiScopes: ["players:read"],
    argusRole: "moderator",
  });

  // Return each guard's promise to Express so asynchronous failures reach its error handler.
  return [readActors, readPlayers].map((guard) => (req, res, next) => {
    if (req.query.include === "identities") return guard(req, res, next);
    next();
  });
}
