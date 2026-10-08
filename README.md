# Inferris API

The **Inferris API** is the backend for the [Inferris](https://github.com/inferris-com) social and gaming ecosystem. It connects the Minecraft network, the Argus staff panel, and shared platform services through a single REST API. Its identity model is also designed to accommodate other integrations, including Discord, while treating each domain user as a pointer to one principal.

Built with **TypeScript**, **Node.js 24+**, **Express 5**, **PostgreSQL**, **Kysely**, **Redis**, and **Zod**. The API exposes an OpenAPI 3.1 specification and interactive Swagger UI.

## Capabilities

### Platform and identity

- **Actors:** stable identities for attributing actions to people, services, and automated systems. Actors can be linked to Minecraft players or Argus users without being interchangeable with those accounts.
- **Authentication and authorization:** scoped API keys, Argus bearer tokens, Minecraft player sessions, actor-level staff privileges, and Minecraft rank-based permissions.
- **Audit logs:** records of authorization decisions and selected mutations, with the acting principal and actor context.

### Minecraft network

- **Players:** Mojang identity, profile data, player state and bitmask flags, archival/restoration, rank assignments, and community badge assignments.
- **Ranks, badges, and permissions:** configurable ranks, rank-groups, badges, permission nodes, and allow/deny permission policies evaluated against ranks.
- **Servers:** server configuration, access rules, local and global lockdowns, server instances, and player connection/session tracking.
- **Operations and telemetry:** server heartbeats, observations, metrics, and network-session history.

### Moderation

- **Punishments:** issue and manage kicks, warnings, mutes, and bans, including expirations and automated lifting actions.
- **Reports and cases:** player reports, discussion threads, moderation cases, participants, and evidence.
- **Chat messages:** authenticated ingestion and querying, with Redis-backed buffering and a background flush worker.
- **Watchlist:** staff-managed monitoring records for subjects of interest.

### Argus staff panel

- **Accounts:** Argus user management, authentication, account states, security locks, password-change and reset flows.
- **Security:** Argon2 password hashing, refresh-token sessions, and breached-password checks.
- **Collaboration:** multi-recipient direct messages and alerts.
- **Administration:** staff-facing access to supported platform, player, moderation, and server resources.

For individual endpoints, request bodies, and access requirements, consult the [interactive API documentation](#api-reference) rather than relying on this overview as an endpoint catalogue.

## Identity and access model

Inferris separates **identity**, **authentication**, and **authorization**:

| Concept                  | Responsibility                                                                                                                                              |
| ------------------------ |-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**                | Principal. Stable identity used for attribution. May represent a person or a system; its kind and display name do not grant access.                         |
| **Player**               | Minecraft-specific identity and gameplay state, keyed by Mojang ID and linked to an actor. Archiving a player preserves history and the actor relationship. |
| **Argus user**           | Staff-panel login and account lifecycle. An actor link is optional, and the Argus user ID remains separate.                                                 |
| **API key**              | Service credential with route scopes (for example, `players:read` or `moderation:write`). Some keys are associated with an actor.                           |
| **Staff privilege**      | Role assigned to an actor (from `none` through `superadmin`), independent of Minecraft rank.                                                                |
| **Minecraft permission** | Rank-based allow/deny policy for permission nodes, separate from API key scopes and Argus roles.[^1]                                                        |

The API accepts these credential forms:

| Credential               | Header                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Argus access token       | `Authorization: Bearer <token>`                                       |
| Minecraft player session | `Authorization: MinecraftSession <token>`                             |
| API key                  | `Authorization: ApiKey <keyId.secret>` or `X-Api-Key: <keyId.secret>` |

Route policies can authorize by **API scope**, **Argus account role**, or **actor staff privilege**. Some operations additionally require a resolved actor for attribution, or enforce Minecraft permissions for trusted player-session workflows. A valid identity alone is not permission to access a resource.

API-key superkeys bypass scope checks **only outside production**. Argus uses signed JWT access tokens and opaque, rotating refresh tokens. Minecraft sessions are verified against both Redis-held token state and the current database session.

See [Actors and domain boundaries](docs/actors-and-domain-boundaries.md) and [Authentication and authorization](docs/authentication-and-authorization.md) for the detailed model and route policies.

## Getting started

### Requirements

- **Node.js 24 or newer** and npm.
- **Docker with Docker Compose** for the recommended local development environment, or separately running **PostgreSQL** and **Redis**.
- **Python 3.10+** only for optional Python-based development scripts.

PostgreSQL stores application data; Redis supports authentication sessions, pub/sub, and chat buffering. **Both services are currently required when the server starts**. Docker Compose provides them alongside the API and Adminer.

### Docker Compose (recommended)

From the `inferris-api/` directory:

```sh
# Create your local configuration; on PowerShell use:
# Copy-Item .env.example .env
cp .env.example .env

# Start the API, PostgreSQL, Redis, and Adminer
docker compose up --build -d

# Apply database migrations
docker compose exec -T app npm run db:migrate

# Optional: populate local development seed data
docker compose exec -T app npm run db:seed
```

The `app` service runs `npm run dev` with the repository mounted, so TypeScript changes reload automatically.

| Local URL                                                                | Purpose                                  |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| [http://localhost:3000/docs](http://localhost:3000/docs)                 | Swagger UI                               |
| [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json) | OpenAPI JSON                             |
| [http://localhost:3000/health](http://localhost:3000/health)             | Basic HTTP health response               |
| [http://localhost:3000/readyz](http://localhost:3000/readyz)             | Readiness check for PostgreSQL and Redis |
| [http://localhost:8080](http://localhost:8080)                           | Adminer database interface               |

These are defaults. Host-facing ports are configurable through `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, and `ADMINER_PORT` in `.env`.

To follow application logs, use `docker compose logs -f app`. To stop the development stack without removing persisted volumes, use `docker compose down`.

### Run the API directly

If PostgreSQL and Redis are already available on the host:

```sh
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

Use `Copy-Item .env.example .env` instead of `cp` if preferred on PowerShell. Check `DATABASE_URL` and `REDIS_URL` in `.env`; the example values target services on `localhost`. The Node process reads this configuration through `src/config.ts`.

For a compiled run, use `npm run build` followed by `npm start`.

## API reference

The running service hosts Swagger UI at **`/docs`** and the OpenAPI document at **`/openapi.json`**. Generated specifications are also committed as [`openapi.json`](openapi.json) and [`openapi.yaml`](openapi.yaml).

### Example requests

The liveness and readiness routes do not require credentials:

```sh
curl http://localhost:3000/health
curl http://localhost:3000/readyz
```

Application resources typically require a credential with an applicable role or scope:

```sh
# Replace the placeholder with an API key authorized for player reads
curl -H "X-Api-Key: <keyId.secret>" http://localhost:3000/players

# Argus login returns access and refresh tokens in the data envelope
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'
```

Most successful resource responses are wrapped in `{"data": ...}`; lists may include `meta`. Errors use `{"error":{"code":"...","message":"..."}}`, with optional details. Use the OpenAPI schemas for the exact contract of each route.

A separate Python endpoint-testing client is available in `scripts/api.py` (see `scripts/api.README.md`). It can be run with `npm run api --` or directly with Python when its optional dependencies are installed.

## Configuration

Copy [`.env.example`](.env.example) to `.env` and adjust it for your environment. Common application variables include:

| Variable                                                                | Purpose                                    |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `NODE_ENV`, `HOST`, `PORT`                                              | Runtime environment and HTTP listener.     |
| `DATABASE_URL`, `DB_POOL_SIZE`                                          | PostgreSQL connection and pool size.       |
| `REDIS_URL`, `REDIS_CONNECT_TIMEOUT_MS`, `REDIS_RECONNECT_MAX_DELAY_MS` | Redis connection and retry behavior.       |
| `AUTH_JWT_SECRET`, `AUTH_API_KEY_PEPPER`                                | Token signing and API-key hashing secrets. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS`, `AUTH_REFRESH_TOKEN_TTL_SECONDS`       | Argus token lifetimes.                     |
| `MINECRAFT_SESSION_TTL_SECONDS`, `MINECRAFT_HEARTBEAT_STALE_SECONDS`    | Minecraft session and heartbeat settings.  |
| `CHAT_FLUSH_BATCH_SIZE`, `CHAT_FLUSH_INTERVAL_MS`                       | Chat ingestion worker tuning.              |

Additional options and their defaults are defined in [`src/config.ts`](src/config.ts). **Replace development credentials before deploying**; production validates a minimum length of 32 characters for both `AUTH_JWT_SECRET` and `AUTH_API_KEY_PEPPER`. Never commit your local `.env` or real tokens.

## Development workflow

| Command                    | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Start the TypeScript server in watch mode.          |
| `npm run check`            | Type-check without generating output.               |
| `npm run lint`             | Run ESLint.                                         |
| `npm run format:check`     | Check formatting with Prettier.                     |
| `npm run format`           | Format files with Prettier (writes changes).        |
| `npm test`                 | Run Jest tests.                                     |
| `npm run build`            | Compile into `dist/`.                               |
| `npm start`                | Run the compiled server.                            |
| `npm run generate:openapi` | Regenerate `openapi.json` and `openapi.yaml`.       |
| `npm run db:migrate`       | Apply pending Kysely migrations.                    |
| `npm run db:migrate:list`  | Inspect migration status.                           |
| `npm run db:seed`          | Run development seed scripts.                       |
| `npm run db:codegen`       | Generate TypeScript database types from PostgreSQL. |
| `npm run test:api-client`  | Test the optional Python HTTP client.               |

When changing endpoints or schemas, update their OpenAPI registrations and run `npm run generate:openapi`. CI checks that the committed specifications match the generator.

Database-backed tests need an explicit `TEST_DATABASE_URL`; they run against **disposable schemas** in the supplied PostgreSQL database. Tests that require it are skipped without that variable. For example, with the development stack running:

```sh
docker compose exec -T app sh -c 'TEST_DATABASE_URL="$DATABASE_URL" npm test -- --runInBand --coverage=false tests/database'
```

Edit migrations in `src/db/migrations/` and regenerate `src/db/types.ts` with `npm run db:codegen`; **do not edit generated database types manually**. Destructive migration resets and reseeding should be confined to disposable development data.

## Repository layout

```text
src/
  app/         Application composition, dependencies, and route mounting
  module/      Domain modules (routes, schemas, services, repositories)
  db/          Database setup, migrations, generated types, and seeds
  middleware/  Request validation and shared middleware
  openapi/     OpenAPI registration and response schemas
  redis/       Redis client lifecycle
  cron/        Scheduled maintenance jobs
  shared/      Shared HTTP and database utilities
tests/         Unit, integration, and database regression tests
scripts/       OpenAPI generation, test clients, and development utilities
docs/          Domain and architecture documentation
```

The server also runs background work for expiring punishments, marking inactive servers, and flushing buffered chat messages.

## Further reading

- [Actors and domain boundaries](docs/actors-and-domain-boundaries.md) — identity links, player archival, and moderation attribution.
- [Authentication and authorization](docs/authentication-and-authorization.md) — credential resolution, route policies, roles, scopes, and Minecraft permission evaluation.
- [Stress-seeding utilities](scripts/stress_seed/README.md) — optional local workload and dataset generation.

Inferris API is an internal platform application. Its routes, authorization rules, and data contracts should be treated as implementation-owned and verified against the current OpenAPI specification.

[^1]: Permission nodes may checked server-side via `requireMinecraftPermission`, but are intended to be paired with a staff privilege requirement *if* it is a protected resource. Thus, this requirement can actually detect drift between what a player can execute and what they cannot actually access.
