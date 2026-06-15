# Inferris API

TypeScript template for Node.js 24 using native ES modules, strict TypeScript, ESLint, and Prettier.

## Scripts

- `npm run dev` - run `src/index.ts` in watch mode.
- `npm run build` - compile TypeScript into `dist`.
- `npm run check` - type-check without emitting files.
- `npm run db:migrate` - run all pending Kysely migrations with `kysely-ctl`.
- `npm run db:migrate:up` - run one pending Kysely migration.
- `npm run db:migrate:down` - roll back one Kysely migration.
- `npm run db:seed` - run all seed files from `src/db/seeds` with `kysely-ctl`.
- `npm run db:codegen` - regenerate Kysely database types from Postgres.
- `npm run lint` - lint the project.
- `npm run format` - format files with Prettier.
- `npm test` - run Node's built-in test runner.

## Local Development

Copy `.env.example` if needed, then start the API, Postgres, Redis, and Adminer:

```sh
docker compose up --build
```

Defaults:

- API: `http://localhost:3000`
- Postgres: `localhost:5432`, database `devdb`, user `dev`, password `dev`
- Redis: `localhost:6379`
- Adminer: `http://localhost:8080`, server `postgres`

Run migrations and seed data from the host once Postgres is healthy:

```sh
npm run db:migrate
npm run db:seed
npm run db:codegen
```

Migrations and seeds are configured in `kysely.config.ts`. Add seed files under `src/db/seeds` with a default `Seed` export from `kysely-ctl`. Keep them idempotent so they can be safely re-run during development.

## Request Validation

Use `validateRequest` with Zod schemas to validate request inputs before a handler runs. Validated values are written back to `req`, so defaults and coercions are available in the route handler.

```ts
import { Router } from "express";
import z from "zod";

import { type ValidatedRequest, validateRequest } from "./middleware/validation.js";

const router = Router();

const createServerSchemas = {
  body: z.object({
    name: z.string().max(100).nonempty(),
    type: z.enum(["paper", "velocity", "other"]),
  }),
  query: z.object({
    dryRun: z.coerce.boolean().default(false),
  }),
};

router.post(
  "/servers",
  validateRequest(createServerSchemas),
  (req: ValidatedRequest<typeof createServerSchemas>, res) => {
    res.status(201).json({
      name: req.body.name,
      dryRun: req.query.dryRun,
    });
  },
);
```

Supported inputs are `body`, `params`, `query`, and `headers`. Validation failures return a `400` response with code `VALIDATION_ERROR`.

## Error Handling

Throw concrete `AppError` subclasses when a failure is expected and safe to return to clients. Prefer domain/application-specific errors from services, such as `PlayerNotFoundError`, so routes/controllers stay focused on HTTP input and response formatting.

```ts
import { ConflictError } from "./error/app-error.js";
import { PlayerNotFoundError } from "./module/player/player.errors.js";

throw new PlayerNotFoundError(playerId);

throw new ConflictError({
  code: "PLAYER_USERNAME_TAKEN",
  message: "Username is already taken",
});
```

The global error handler maps categories to HTTP status codes:

```txt
validation -> 400
unauthorized -> 401
forbidden -> 403
not_found -> 404
conflict -> 409
rate_limited -> 429
internal -> 500
```

Unexpected errors are returned as `500 INTERNAL_SERVER_ERROR`.
