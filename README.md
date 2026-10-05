# Inferris API

The **Inferris API** serves as the most important application of the Inferris project.

It is an Express RESTful API written in TypeScript (Node 24).

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
- `npm test` - run Jest unit and route integration tests. PostgreSQL tests require `TEST_DATABASE_URL` and use disposable schemas.

## Domain documentation

- [Actors and domain boundaries](docs/actors-and-domain-boundaries.md)
- [Authentication and authorization](docs/authentication-and-authorization.md)
