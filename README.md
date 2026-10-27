# Inferris API

> [!NOTE]
> The API is under active development and is subject to quickly change. This project does not include the specific Argus and Plugin projects.

[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/) [![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/) [![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](openapi.json)

**Inferris API** is the backend for the [Inferris](https://github.com/inferris-com) network and Argus staff panel. It provides shared identity, moderation, server management, and administrative services through a REST API.

Built with **Node.js 24+, TypeScript, Express 5, Kysely, Zod** and uses both **PostgreSQL** and **Redis**.

## Features

- **Identity & access**: cross-platform actors, Minecraft players, Argus accounts, scoped API keys, staff privileges, and audit logs.
- **Minecraft network**: profiles, ranks, permissions, badges, server instances, sessions, and telemetry.
- **Moderation**: punishments, reports, cases, evidence, chat ingestion, and watchlists.
- **Argus**: staff accounts, authentication, security controls, direct messages, and alerts.
- **Infrastructure**: PostgreSQL persistence, Redis-backed services, background workers, and OpenAPI 3.1 contracts.

Actors are stable cross-platform identities; Minecraft players and Argus users remain distinct accounts. Authentication credentials and authorization policies are separate from those identities.

## Quick start

Requires Docker Compose.

```sh
cp .env.example .env
docker compose up --build -d
docker compose exec -T app npm run db:migrate
```

Local endpoints:

| Service      | URL                                                               |
| ------------ | ----------------------------------------------------------------- |
| Swagger UI   | [localhost:3000/docs](http://localhost:3000/docs)                 |
| OpenAPI JSON | [localhost:3000/openapi.json](http://localhost:3000/openapi.json) |
| Health check | [localhost:3000/health](http://localhost:3000/health)             |
| Readiness    | [localhost:3000/readyz](http://localhost:3000/readyz)             |
| Adminer      | [localhost:8080](http://localhost:8080)                           |

The API can also run directly with Node.js 24+, PostgreSQL, and Redis. Connection settings are defined in [`.env.example`](.env.example).

## API

Route definitions, request schemas, and response contracts are documented in:

- [Swagger UI](http://localhost:3000/docs) (running locally)
- [OpenAPI JSON](openapi.json)
- [OpenAPI YAML](openapi.yaml)

Supported credentials include Argus bearer tokens, Minecraft session tokens, API keys, and server-instance tokens. Access is enforced through route scopes, roles, privileges, and resource-specific policies; see [Authentication and authorization](docs/authentication-and-authorization.md).

## Development

| Command                    | Purpose                          |
| -------------------------- | -------------------------------- |
| `npm run dev`              | Start the development server     |
| `npm run check`            | Type-check source and tests      |
| `npm test`                 | Run Jest tests                   |
| `npm run lint`             | Run ESLint                       |
| `npm run build`            | Compile to `dist/`               |
| `npm run generate:openapi` | Regenerate API specifications    |
| `npm run db:migrate`       | Apply database migrations        |
| `npm run db:codegen`       | Regenerate Kysely database types |

Database integration tests require `TEST_DATABASE_URL` and run in disposable schemas. Tests requiring it are skipped when unset. Do not edit the generated `src/db/types.ts` manually.

## Argus, plugins, and other projects

This repository does not include the Argus or Plugin projects themselves. Future versions might remove Argus from this API contract and favor a monorepo containing both Argus frontend and backend.

It is currently unclear whether Argus and the Minecraft server instance plugins will be open-sourced. Future information will explicitly provide an update on just this. The most likely outcome is building a developer-first ecosystem originating from Inferris code so that developers have a fuller, more unified experience while allowing Inferris to stand on its own.

## Repository structure

```text
src/
  app/         Application composition and routing
  module/      Domain modules
  db/          Database, migrations, and types
  redis/       Redis client and lifecycle
  middleware/  Shared HTTP middleware
  openapi/     API schema registration
  shared/      Shared utilities
tests/         Unit, integration, and database tests
docs/          Architecture documentation
scripts/       Development tooling
```

## Architecture docs

- [Actors and domain boundaries](docs/actors-and-domain-boundaries.md)
- [Authentication and authorization](docs/authentication-and-authorization.md)
- [Stress-seeding utilities](scripts/stress_seed/README.md)

**Status:** Active development. Refer to the generated OpenAPI specifications for current route contracts.
