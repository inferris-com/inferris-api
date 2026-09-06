# Actors and domain boundaries

An actor is a stable identity used to attribute actions to a human or an automated entity.
It exists so that a moderator, a staff member without a Minecraft player, and an automated
system can all issue actions without inventing fake players. Preserving moderation history
when a player is deleted is handled by archiving the player and retaining its references.

## Responsibilities

| Concept        | Owns                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| Actor          | Attribution identity, actor kind, and an optional display label                |
| Player         | Mojang identity, Minecraft username, gameplay state, and archival lifecycle    |
| Argus account  | Staff-panel login and account lifecycle                                        |
| Authentication | Credential verification and resolution of the request principal and actor      |
| Authorization  | API scopes, Argus access, staff privileges, and Minecraft permission decisions |
| Moderation     | Eligible subjects, action scope, attribution, and moderation history           |

An actor ID does not grant permission, prove ownership of an account, or make every domain
resource belong to that actor. Actor kind describes the entity; it is not an authorization role.
An actor may be referenced by explicitly linked accounts, but it is not automatically a verified
network-wide person. Future Discord identities must be linked explicitly, never by matching names.

## Identity and labels

- A Minecraft identity is resolved by `players.mojang_id`. Player ID, Mojang ID, and actor ID
  remain attached through username changes and archival/restoration.
- A new Minecraft identity receives a new user actor. Matching an existing actor's name does
  not reuse it, even when that actor has no player.
- `actors.name` is a nullable, non-unique display label, initialized from the player's username
  when provisioning a player. It can subsequently differ from the Minecraft username.
- Player renames update the Minecraft username. Actor label edits update only the label;
  they never rename or relink the player. Clients displaying Minecraft usernames should use
  player data rather than infer usernames from actor labels.
- `PATCH /actors/:actorId` accepts only `name` (a nonblank label or `null`). Kind, IDs, identity
  links, and creation/update timestamps are not client-editable fields. The server records the
  label's update time. There is no public actor deletion or identity-relinking endpoint.
- Actor lookup, search, list, and patch responses expose the linked player ID, including for
  archived players, so attribution can still be navigated.

Minecraft usernames remain unique in the current schema. If a new Mojang identity presents a
username still stored against another player, the operation returns `409 PLAYER_USERNAME_CONFLICT`
and leaves the original identity intact. Once the old player's username is updated, the name can
be reused by a distinct player. This deliberately requires reconciliation rather than guessing
identity from a potentially stale name.

## Player archival and restoration

`DELETE /players/:playerId` archives the player by setting its deletion timestamp and reason.
It preserves the actor link, profile, ranks, badges, balances, other gameplay state, and moderation
history. Ordinary player lookup/listing excludes archives; privileged sensitive search and actor
lookup can still locate them.

The old `?hard=false` option remains accepted. `?hard=true` is rejected. The player repository
has no hard-delete operation.

A subsequent trusted Minecraft connection, or `POST /players` with the same Mojang ID, restores
the same player and actor and updates the Minecraft username. Explicit creation of an existing
active player still returns a conflict. On restoration, supplied creation IDs and gameplay defaults
are ignored: use the normal update endpoints for intentional state changes. A missing profile
from an older archive is recreated, but previously deleted ranks, badges, or profile contents
cannot be recovered by restoration.

Archival is a visibility/lifecycle operation. It does not revoke credentials, remove staff
privileges, terminate sessions, or prevent rejoining. Use moderation for Minecraft restrictions
and the relevant account/credential lifecycle for disabling access.

## Attribution and moderation subjects

The acting identity and the affected resource answer different questions:

- `issuerActorId`, `liftedByActorId`, and similar attribution fields identify who acted. A system
  actor is valid here.
- A Minecraft punishment targets a player. Its subject must resolve to an existing player linked
  to a user actor, including an archived player. An application, system, or unlinked staff actor
  is not a Minecraft punishment target.
- The existing punishment API accepts either `subjectPlayerId` or `subjectActorId` and still
  stores/emits `subjectActorId`. Both inputs now validate the player relationship. This preserves
  existing storage, history, and event contracts while enforcing the domain boundary. New clients
  should prefer `subjectPlayerId` for Minecraft actions.

Reports, watchlists, and case participants currently retain their actor-based subjects. Those
relationships do not establish that all actor kinds are valid for every future moderation action,
or that Minecraft and Discord sanctions have the same scope. Define eligible subjects and scope
inside the relevant moderation operation when extending these features.

The existing entitlement, purchase, and virtual-transaction schema also retains actor references.
That is legacy storage, not a mandate for new gameplay features. New relationships should reference
the actual owner: use a player for Minecraft-owned state and an actor for attribution. A shared
account ownership model requires an explicit product decision before migrating those tables.

## Middleware and application boundaries

`AuthService` resolves the authenticated principal and request actor. The shared auth middleware
provides `requireActor()` and `getRequestActorId()`. Player routes consume these helpers when
recording who changed a rank or revoked a nickname; they do not implement a second actor resolver.
The player router's sensitive-search access check remains local because it gates player-specific
query behavior.

Resolving a submitted moderation subject is separate from resolving the request actor. Subject
lookup must not change `req.auth` or assign the subject as the issuer. Domain services validate
subject eligibility; HTTP middleware verifies authentication and route access. Small lookup joins
in repositories do not need a generic middleware or a new identity framework.

See [Authentication and Authorization](authentication-and-authorization.md) for credential details.

## Migration and regression checks

Apply pending migrations with `npm run db:migrate`. Migration
`20260906000000_actor_display_labels` removes only the unique actor-name constraint; it does not
rewrite identities or historical records. Rollback restores uniqueness and fails if duplicate
labels exist, allowing an operator to resolve the conflict without silently renaming records.

The database regression suite creates and drops a disposable schema in an explicitly supplied
PostgreSQL database. It tests actual migrations and repositories without reading existing users
or credentials. With the development containers running:

```sh
docker compose exec -T app sh -c 'TEST_DATABASE_URL="$DATABASE_URL" npm test -- --runInBand --coverage=false tests/database'
```

Ordinary `npm test` skips database tests unless `TEST_DATABASE_URL` is supplied.
