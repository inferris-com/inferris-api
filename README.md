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
