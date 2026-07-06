# Authentication and Authorization

This document describes the API's current authentication and authorization model.
The implementation is centered in `src/module/auth`, with route-level policy wiring in each
module router.

## Summary

Authentication answers "who or what made this request?" and attaches an `AuthContext` to
`req.auth`.

Authorization answers "is this authenticated principal allowed to use this route?" Most
application routes use `authorize(...)` policies based on API key scopes, Argus account roles,
and privileged actor roles. Minecraft permission nodes are a separate rank-based system used
for Minecraft-facing permission checks and server access concepts.

All routes except `/health` and the unauthenticated auth token endpoints are mounted behind the
global authentication middleware in `src/app/app.routes.ts`.

## Authentication

The request authentication middleware is `authenticate(service)` in
`src/module/auth/auth.middleware.ts`. It accepts credentials in this order:

1. `Authorization: Bearer <jwt>` for Argus users.
2. `Authorization: MinecraftSession <token>` for online Minecraft player sessions.
3. `Authorization: ApiKey <keyId.secret>` for API keys.
4. `x-api-key: <keyId.secret>` for API keys.

If no credential is present, the request fails with `401 UNAUTHORIZED` and
`Missing authentication credentials`. If a credential is present but invalid, the request fails
with `401 UNAUTHORIZED` and `Invalid authentication credentials`.

### Argus User Tokens

Argus users authenticate with `POST /auth/login`, passing `usernameOrEmail` and `password`.
Passwords are verified with Argon2 hashes stored on `argus_users.password_hash`.

Successful login returns:

- A signed JWT access token.
- A refresh token.
- The current Argus user projection.

Access tokens are signed with `AUTH_JWT_SECRET`, use HS256, include `typ: "access"`, and expire
after `AUTH_ACCESS_TOKEN_TTL_SECONDS`. The access token subject is the Argus user id. The token
also carries the user's `actorId` and Argus role, but the server still looks up the active Argus
user on each authenticated request.

Refresh tokens are random opaque tokens. Only their SHA-256 hash is used as the Redis key:
`auth:refresh:<hash>`. `POST /auth/refresh` rotates refresh tokens by deleting the presented
refresh session before issuing a new token pair. `POST /auth/logout` deletes the presented
refresh token session.

`GET /auth/me` requires authentication and specifically requires an Argus user context. API keys
and Minecraft session credentials are not sufficient for this endpoint.

Relevant files:

- `src/module/auth/auth.route.ts`
- `src/module/auth/auth.service.ts`
- `src/module/auth/auth.crypto.ts`
- `src/module/auth/auth.repository.ts`

### API Keys

API keys are stored in the `api_keys` table. The token format is:

```text
<keyId>.<secret>
```

The public `keyId` can match either `api_keys.id` or `api_keys.key`. The secret is never stored
directly. The server hashes it with HMAC-SHA-256 using `AUTH_API_KEY_PEPPER` and compares it with
`api_keys.key_hash` using a timing-safe comparison.

Only active API keys can authenticate. The authenticated context includes:

- `principalType` from `api_keys.principal_type`
- `principalId` as the API key row id
- `platform` from `api_keys.platform`
- `credentialOwnerActorId` from `api_keys.owner_actor_id`
- `apiKey.scopes` from `api_keys.permissions`
- `apiKey.isSuperKey` from `api_keys.is_super_key`

For `service_actor_api_key` credentials, `actorId` is set to the owner actor id. Other API key
principal types authenticate as service credentials without a request actor. Middleware such as
`requireActor()` rejects those non-actor-bearing credentials when a mutation needs a concrete
actor.

API key permissions are route scopes. They are not Minecraft permission nodes.

In non-production environments only, `is_super_key` makes an API key pass every API scope check.
In production, super keys do not bypass scope checks.

### Minecraft Session Tokens

Minecraft session tokens are online-player credentials issued by server-plugin endpoints.
Trusted server API keys with the `minecraft:sessions:manage` scope call:

- `POST /servers/:serverId/player-sessions`
- `DELETE /servers/:serverId/player-sessions/:mojangId`
- `POST /servers/:serverId/heartbeat`

When a player session starts, `ServerService.startPlayerSession(...)` ensures the Minecraft
player identity exists, creates a `player_session_events` row, updates `player_sessions_current`
through database trigger behavior, and issues a random opaque token. The token hash is stored in
Redis under:

- `auth:minecraft-session:token:<tokenHash>` -> serialized session state
- `auth:minecraft-session:player:<playerId>` -> current token hash for that player

The TTL is `MINECRAFT_SESSION_TTL_SECONDS`. Heartbeats extend the Redis TTL for currently online
players. Ending a session removes the current player's session token keys.

Authenticating a Minecraft session token requires both:

- A valid Redis session state for the token hash.
- A matching current database session in `player_sessions_current` with the same player, server,
  and session event.

This prevents an old token from remaining valid after the player disconnects or a replacement
session is created.

### Combined Minecraft Session and API Key Authentication

When the main credential is `Authorization: MinecraftSession <token>`, the middleware may also
accept `x-api-key`.

If `x-api-key` is present, both credentials must authenticate. The resulting context uses the API
key as the principal authority while borrowing the resolved `actorId`, privileged role, and
Minecraft session details from the Minecraft session. This supports trusted server-plugin
workflows that need both service authority and the currently resolved player actor.

## Auth Context

Authenticated requests receive `req.auth`, shaped by `AuthContext` in
`src/module/auth/auth.types.ts`.

Important fields:

- `principalType`: how the request authenticated, such as `argus_user`, `minecraft_session`,
  `server_api_key`, or `service_actor_api_key`.
- `principalId`: the id of the authenticating principal.
- `actorId`: the actor represented by the request, when the credential resolves to one.
- `credentialOwnerActorId`: the actor that owns an API key, when different from the request actor.
- `platform`: operational platform for the credential.
- `apiKey`: API key id, scopes, and super-key flag.
- `argus`: Argus user id and Argus account role.
- `minecraftSession`: player, Mojang id, server, and session event ids.
- `privileged`: active privileged subject id and role for the resolved actor.

`actorId` can be `null`. Use `requireActor()` when an endpoint must write actor-attributed
domain data.

## Authorization

Route authorization uses `authorize(authRepository, policy)`.

A route policy can include:

- `apiScopes`: one or more API key scopes.
- `argusRole`: minimum Argus account role.
- `privilegedRole`: minimum active privileged actor role.

These are alternate authorities when present together. A request passes if any applicable
authority satisfies the policy:

- API key scope passes when the authenticated API key contains the required scope or `*`.
- Argus role passes when `req.auth.argus.role` meets or exceeds the required Argus role.
- Privileged role passes when `req.auth.privileged.role` meets or exceeds the required privileged
  role.

If a policy only specifies `privilegedRole`, the request must have a sufficient privileged role.
If a policy contains neither API scopes nor Argus role nor privileged role, it allows any
authenticated request, though current route code generally uses explicit policies.

### Role Rankings

Argus account roles:

| Role | Rank |
| --- | ---: |
| `moderator` | 1 |
| `admin` | 2 |

Privileged actor roles:

| Role | Rank |
| --- | ---: |
| `none` | 0 |
| `collaborator` | 1 |
| `moderator` | 2 |
| `administrator` | 3 |
| `superadmin` | 4 |

Argus roles and privileged roles are intentionally separate:

- Argus roles belong to Argus account access.
- Privileged roles belong to actors and can authorize non-Argus credentials, such as Minecraft
  session credentials for privileged staff actors.

## Minecraft Permission Nodes

Minecraft permission nodes are stored separately from API key scopes:

- `permission_nodes` defines permission keys such as `server.lockdown.bypass`.
- `permission_policies` binds permission nodes to rank keys with `allow` or `deny`.

`AuthRepository.actorHasMinecraftPermission(actorId, permissionKey)` resolves permissions through:

1. `actors`
2. `players`
3. `player_ranks`
4. `ranks`
5. `permission_policies`
6. `permission_nodes`

Only active ranks and active permission nodes participate. Permission matching supports:

- Exact keys, such as `server.lockdown.bypass`.
- The global wildcard `*`.
- Prefix wildcards ending in `.*`, such as `server.*`.

If any matching policy is `deny`, access is denied even if another matching policy is `allow`.
Otherwise, at least one matching `allow` is required.

The `requireMinecraftPermission(repo, permissionKey)` middleware is stricter than a normal route
policy. It requires:

- An authenticated API key with `minecraft:permission-check`.
- A resolved request actor.
- That actor to have the requested Minecraft permission node.

This middleware is for trusted Minecraft permission-check flows, not general Argus or API route
authorization.

## Auditing

Authorization denials are written to `audit_logs` by `auditDenied(...)`.

Successful mutations can opt into audit logging with `auditMutation(repo, action)`. The audit
entry is written after the response finishes and only when the response status is below 400.

Audit records include the request actor, API key owner actor when available, principal type,
principal id, platform, action, result, and metadata such as method and path.

For API-key-backed actor delegation, `actor_id` represents the request actor when one exists, and
`subject_actor_id` can record the API key owner actor.

## Route Policy Matrix

The following matrix summarizes the policy declarations currently used by routers.

| Area | Policy | API scopes | Argus role | Privileged role |
| --- | --- | --- | --- | --- |
| Actors | Read actors | `actors:read` | `moderator` | none |
| Actors | Write actors | `actors:write` | `admin` | `administrator` |
| Catalog | Read player catalog | `players:read` | `moderator` | none |
| Catalog | Read server catalog | `servers:read` | `moderator` | `moderator` |
| Chat messages | Read chat | `chat:read` | `moderator` | `moderator` |
| Chat messages | Write chat | `chat:write` | none | none |
| Mod cases | Read mod cases | `moderation:read` | `moderator` | `moderator` |
| Mod cases | Manage mod cases | `moderation:write` | `moderator` | `moderator` |
| Permissions | Read permissions | `permissions:read` | `moderator` | none |
| Permissions | Write permissions | `permissions:write` | `admin` | `administrator` |
| Players | Read players | `players:read` | `moderator` | none |
| Players | Write players | `players:write` | `moderator` | none |
| Players | Manage player staff state | `players:write` | `moderator` | `moderator` |
| Players | Administer players | `players:write` | `admin` | `administrator` |
| Punishments | Read punishments | `moderation:read` | `moderator` | `moderator` |
| Punishments | Write punishments | `moderation:write` | `moderator` | `moderator` |
| Reports | Submit reports | `moderation:write` | none | none |
| Reports | Read reports | `moderation:read` | `moderator` | `moderator` |
| Reports | Manage reports | `moderation:write` | `moderator` | `moderator` |
| Servers | Read servers | `servers:read` | `moderator` | `moderator` |
| Servers | Write servers | `servers:write` | `admin` | `administrator` |
| Servers | Manage lockdowns | `servers:write` | `moderator` | `moderator` |
| Servers | Manage Minecraft sessions | `minecraft:sessions:manage` | none | none |
| Watchlist | Read watchlist | `moderation:read` | `moderator` | `moderator` |
| Watchlist | Write watchlist | `moderation:write` | `moderator` | `moderator` |

Some individual mutation routes also call `requireActor()` after `authorize(...)` so the service
can record a concrete actor id in domain data. This is separate from permission to call the route.
Core tables:

- `argus_users`: Argus identities, password hashes, account state, Argus role, and optional actor
  link.
- `api_keys`: API key hashes, principal type, platform, API scopes, owner actor, active state, and
  super-key flag.
- `privileged_subjects`: actor-level staff privilege records and role.
- `permission_nodes`: Minecraft permission keys.
- `permission_policies`: rank bindings for Minecraft permission nodes.
- `player_session_events`: historical Minecraft player sessions.
- `player_sessions_current`: current online Minecraft sessions.
- `audit_logs`: allow, deny, and failure audit records.

Redis keys:

- `auth:refresh:<refreshTokenHash>` stores Argus refresh sessions.
- `auth:minecraft-session:token:<sessionTokenHash>` stores Minecraft session state.
- `auth:minecraft-session:player:<playerId>` maps an online player to their current session token
  hash.

## Adding Protected Endpoints

1. Mount it behind `authenticateRequest`, unless it is intentionally public.
2. Add an `authorize(...)` policy with the least authority that fits the endpoint.
3. Use API scopes for service/API-key automation.
4. Use Argus roles for staff-panel account access.
5. Use privileged roles when the actor's staff status matters independently of Argus login.
6. Use `requireActor()` when the service needs a concrete actor id.
7. Use `auditMutation(...)` for meaningful state-changing operations.
8. Update the endpoint's OpenAPI registration and run `npm run generate:openapi`.
9. If changing database-backed auth structures, edit migrations/seeds and regenerate Kysely types
   through the project database sync flow rather than editing `src/db/types.ts` directly.
