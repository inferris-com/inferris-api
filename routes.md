# Route Planning Spec

This document defines the first-pass REST route layout for Argus API resources. Routes are organized around stable domain resources first, with action-style endpoints used only when the operation represents a workflow transition, side effect, or multi-table operation rather than a simple field update.

## Players

```http
POST   /players
GET    /players
GET    /players/:playerId
PATCH  /players/:playerId
DELETE /players/:playerId
```

`GET /players/:playerId` may compose the core player, profile, badges, ranks, flags, current nickname, current session, and other player-facing data as needed.

`PATCH /players/:playerId` is limited to core player fields. Profile data, badges, rank assignments, nickname state, and moderation state are handled through their own endpoints because they have separate validation, permissions, persistence, and audit behavior.

`DELETE /players/:playerId` runs the account deletion workflow rather than always hard-deleting the player record.

By default, the endpoint performs a soft deletion: it preserves the core `players` row for actor/audit continuity, clears player-facing identity data, and removes related player-owned records such as `player_profiles`, `player_badges`, and `player_ranks`.

The optional `?hard` query parameter can be used when a true hard delete is intended. When `hard=true`, the system hard-deletes the player and the underlying actor record. When omitted or set to `false`, the system performs the default soft-deletion workflow.

More work is underway to make it more anonymous to respect data regulations/laws.

## Player Profile

```http
GET    /players/:playerId/profile
PATCH  /players/:playerId/profile
```

The profile endpoint owns profile-specific fields such as bio, pronouns, featured badge, locale, and preferences.

## Player Badges

```http
GET    /players/:playerId/badges
POST   /players/:playerId/badges
DELETE /players/:playerId/badges/:badgeId
```

Badge assignment is a sub-resource of the player because the assignment exists through `player_badges` and may trigger additional logic.

`POST /players/:playerId/badges` grants a badge.

`DELETE /players/:playerId/badges/:badgeId` removes a badge assignment.

## Player Ranks

```http
GET    /players/:playerId/ranks
POST   /players/:playerId/ranks
DELETE /players/:playerId/ranks/:groupKey/:rankKey
```

Rank assignment is a sub-resource of the player because the assignment exists through `player_ranks` and carries additional logic to meet table expectations.

`POST /players/:playerId/ranks` assigns a rank.

`DELETE /players/:playerId/ranks/:groupKey/:rankKey` removes a rank assignment.

## Player Nicknames

```http
GET    /players/:playerId/nicknames
POST   /players/:playerId/nicknames
GET    /players/:playerId/nicknames/:nicknameId
PATCH  /players/:playerId/nicknames/:nicknameId
DELETE /players/:playerId/nicknames/:nicknameId
```

`POST /players/:playerId/nicknames` creates a nickname assignment.

`DELETE /players/:playerId/nicknames/:nicknameId` revokes the nickname assignment rather than hard-deleting it.

Expected deletion behavior:

```text
is_active = false
revoked_by_actor_id = current actor
revoked_at_ms = current time
```

The unique active nickname constraints enforce:

```text
one active nickname per player
one active holder per nickname
```

## Player Sessions

```http
GET    /players/:playerId/sessions
GET    /players/:playerId/sessions/current
GET    /servers/:serverId/sessions
GET    /servers/:serverId/players
GET    /sessions/current
GET    /sessions/:sessionEventId
POST   /servers/:serverId/sessions/connect
POST   /servers/:serverId/sessions/disconnect
```

`player_session_events` is the historical session event table.

`player_sessions_current` is the current online snapshot table.

Session state is maintained with a hybrid ingestion model:

```text
connect/disconnect lifecycle calls = immediate state and alerts
server heartbeat player lists = authoritative reconciliation and recovery
```

Consumer plugins should send lifecycle calls when they observe joins, leaves, or server transfers. These calls give accurate timestamps and allow immediate staff-facing watchlist alerts.

Server heartbeats should still include the current player list. The API treats the heartbeat list as the source of truth for that server and repairs any missed lifecycle events.

Lifecycle behavior:

```text
POST /servers/:serverId/sessions/connect
→ creates an open session event if needed
→ inserts or updates player_sessions_current
→ updates players.last_server_id and players.last_seen_at_ms
→ may emit watchlist activity alerts

POST /servers/:serverId/sessions/disconnect
→ closes the open session event
→ removes player_sessions_current
→ updates players.last_seen_at_ms
```

Heartbeat reconciliation behavior is documented under Servers.

## Servers

```http
POST   /servers
GET    /servers
GET    /servers/:serverId
PATCH  /servers/:serverId
DELETE /servers/:serverId
POST   /servers/:serverId/heartbeat
```

`PATCH /servers/:serverId` is limited to core server fields such as name, type, environment, status, version, port, and base access mode.

`POST /servers/:serverId/heartbeat` is the primary server/plugin ingestion endpoint. It marks the server alive, records reported player count and operational metadata, and reconciles session state from the current player list.

Recommended heartbeat body:

```json
{
  "status": "online",
  "playerCount": 42,
  "players": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "username": "Refrizor"
    }
  ],
  "meta": {
    "tps": 19.98,
    "mspt": 12.4,
    "maxPlayers": 100
  }
}
```

Heartbeat reconciliation behavior:

```text
players present in heartbeat but missing from current sessions
→ create recovered open sessions

players currently on this server but absent from heartbeat
→ close sessions as missing_from_heartbeat

players still present
→ refresh player_sessions_current.updated_at_ms
→ update players.last_seen_at_ms

watchlisted players present in the heartbeat
→ may emit staff-facing activity alerts
```

If `playerCount` and `players.length` differ, store the reported count for telemetry but use the supplied player list for reconciliation. If the player list is omitted, the heartbeat should update only server liveness and metrics, not session membership.

## Server Access Policies

```http
GET    /servers/:serverId/access
PUT    /servers/:serverId/access
PATCH  /servers/:serverId/access
DELETE /servers/:serverId/access
```

Server access policy data lives in `server_access_policies`, so it is modeled as a sub-resource of a server.

This keeps `PATCH /servers/:serverId` focused on the server row itself while access policy logic can validate mode, required rank, required permission, and related constraints separately.

## Lockdowns

```http
POST   /lockdowns
GET    /lockdowns
GET    /lockdowns/:lockdownId
PATCH  /lockdowns/:lockdownId
DELETE /lockdowns/:lockdownId
```

Convenience action routes:

```http
POST   /servers/lockdown
DELETE /servers/lockdown

POST   /servers/:serverId/lockdown
DELETE /servers/:serverId/lockdown
```

`POST /servers/lockdown` creates a global lockdown.

`POST /servers/:serverId/lockdown` creates a local lockdown for one server.

`DELETE` deactivates the active lockdown rather than hard-deleting the historical row.

Expected behavior:

```text
is_active = false
updated_at_ms = current time
```

Lockdowns are modeled as their own workflow because they affect live server behavior, may publish Redis events, and are backed by the `lockdowns` table.

## Groups

```http
POST   /groups
GET    /groups
GET    /groups/:groupKey
PATCH  /groups/:groupKey
DELETE /groups/:groupKey
```

Groups use their stable key as the route identifier.

Example:

```http
GET /groups/staff
PATCH /groups/supporters
```

## Ranks

```http
POST   /ranks
GET    /ranks
GET    /ranks/:rankKey
PATCH  /ranks/:rankKey
DELETE /ranks/:rankKey
```

Ranks use their stable key as the route identifier.

Filtering examples:

```http
GET /ranks?groupKey=staff
GET /ranks?isStaff=true
GET /ranks?isActive=true
```

## Permission Nodes

```http
POST   /permissions
GET    /permissions
GET    /permissions/:permissionId
PATCH  /permissions/:permissionId
DELETE /permissions/:permissionId
```

Optional key-based lookup:

```http
GET /permissions/by-key/:permissionKey
```

Permission nodes represent atomic abilities.

Example:

```text
moderation.reports.read
moderation.reports.close
players.profile.update
servers.lockdown.manage
```

## Permission Rules

```http
POST   /permission-rules
GET    /permission-rules
GET    /permission-rules/:ruleId
PATCH  /permission-rules/:ruleId
DELETE /permission-rules/:ruleId
```

Permission rules bind permission nodes to groups, ranks, minimum rank tiers, effects, and priorities.

Filtering examples:

```http
GET /permission-rules?permissionId=:permissionId
GET /permission-rules?groupKey=:groupKey
GET /permission-rules?rankKey=:rankKey
```

## Badges

```http
POST   /badges
GET    /badges
GET    /badges/:badgeId
PATCH  /badges/:badgeId
DELETE /badges/:badgeId
```

Optional key-based lookup:

```http
GET /badges/by-key/:badgeKey
```

`DELETE /badges/:badgeId` should usually deactivate the badge rather than hard-delete it if historical player badge assignments need to remain meaningful.

Expected behavior:

```text
is_active = false
```

## Chat Channels

```http
POST   /chat-channels
GET    /chat-channels
GET    /chat-channels/:channelKey
PATCH  /chat-channels/:channelKey
DELETE /chat-channels/:channelKey
```

Chat channels use `key` as their primary identifier.

Example:

```http
GET /chat-channels/global
GET /chat-channels/staff
GET /chat-channels/testing
```

`DELETE /chat-channels/:channelKey` should deactivate the channel rather than hard-delete it if chat messages reference the channel.

Expected behavior:

```text
is_active = false
```

## Chat Messages

```http
GET    /chat-messages
GET    /chat-messages/:messageId
PATCH  /chat-messages/:messageId
DELETE /chat-messages/:messageId
```

Channel-scoped message routes:

```http
GET    /chat-channels/:channelKey/messages
POST   /chat-channels/:channelKey/messages
```

The nested channel route is the preferred creation route because messages are usually created within a channel.

Filtering examples:

```http
GET /chat-messages?channelKey=global
GET /chat-messages?actorId=:actorId
GET /chat-messages?originServerId=:serverId
```

`DELETE /chat-messages/:messageId` should be chosen carefully. If messages are moderation/audit-relevant, deletion should either soft-delete, redact, or require elevated permission.

## Punishments

```http
POST   /punishments
GET    /punishments
GET    /punishments/:punishmentId
PATCH  /punishments/:punishmentId
DELETE /punishments/:punishmentId
```

Punishments contain historical and active punishments across all punishment types.

Filtering examples:

```http
GET /punishments?subjectActorId=:actorId
GET /punishments?issuerActorId=:actorId
GET /punishments?type=ban
GET /punishments?active=true
GET /punishments?serverOriginId=:serverId
```

A central punishment resource is sufficient for the first version.

Optional future type-specific creation routes:

```http
POST /punishments/ban
POST /punishments/mute
POST /punishments/warn
POST /punishments/kick
```

These should only be added if each punishment type develops meaningfully different validation, permissions, side effects, or event-publishing logic.

`DELETE /punishments/:punishmentId` should usually revoke, void, or mark inactive rather than hard-delete, depending on the final punishment lifecycle design.

## Punishment Appeals

```http
POST   /punishment-appeals
GET    /punishment-appeals
GET    /punishment-appeals/:appealId
PATCH  /punishment-appeals/:appealId
DELETE /punishment-appeals/:appealId
```

Filtering examples:

```http
GET /punishment-appeals?appellantActorId=:actorId
GET /punishment-appeals?status=open
GET /punishment-appeals?infractionRefId=:punishmentId
GET /punishment-appeals?infractionCategory=ban
```

Decision routes:

```http
POST /punishment-appeals/:appealId/accept
POST /punishment-appeals/:appealId/reject
POST /punishment-appeals/:appealId/withdraw
```

Decision routes are modeled as actions because they represent lifecycle transitions and may update multiple fields.

Expected behavior:

```text
accept:
  status = accepted
  closed_by_actor_id = current actor
  closed_at_ms = current time
  optional punishment modification/revocation side effect

reject:
  status = rejected
  closed_by_actor_id = current actor
  closed_at_ms = current time

withdraw:
  status = withdrawn
  closed_at_ms = current time
```

## Reports

```http
POST   /reports
GET    /reports
GET    /reports/:reportId
PATCH  /reports/:reportId
DELETE /reports/:reportId
```

Filtering examples:

```http
GET /reports?status=open
GET /reports?priority=high
GET /reports?reporterActorId=:actorId
GET /reports?subjectActorId=:actorId
GET /reports?originServerId=:serverId
```

Report lifecycle routes:

```http
POST /reports/:reportId/close
POST /reports/:reportId/reopen
POST /reports/:reportId/action
POST /reports/:reportId/dismiss
POST /reports/:reportId/mark-duplicate
```

These action routes are optional but clean.

They are useful because report status changes often set more than just `status`.

Expected behavior:

```text
action:
  status = actioned
  closed_by_actor_id = current actor
  closed_at_ms = current time

dismiss:
  status = dismissed
  closed_by_actor_id = current actor
  closed_at_ms = current time

mark-duplicate:
  status = duplicate
  closed_by_actor_id = current actor
  closed_at_ms = current time

reopen:
  status = open
  closed_by_actor_id = null
  closed_at_ms = null
```

## Report Comments

```http
POST   /reports/:reportId/comments
GET    /reports/:reportId/comments
GET    /reports/:reportId/comments/:commentId
PATCH  /reports/:reportId/comments/:commentId
DELETE /reports/:reportId/comments/:commentId
```

Top-level comments and replies use the same creation route.

Top-level comment body:

```json
{
  "commentText": "Reviewed the report."
}
```

Reply body:

```json
{
  "parentCommentId": "comment-uuid",
  "commentText": "I checked the logs too."
}
```

Optional future reply route:

```http
POST /reports/:reportId/comments/:commentId/replies
```

The generic creation route is enough for the first version because replies are represented by `parent_comment_id`.

Sticky behavior can be handled through the comment patch route:

```http
PATCH /reports/:reportId/comments/:commentId
```

Example body:

```json
{
  "isSticky": true
}
```

## Moderation Cases

```http
POST   /mod-cases
GET    /mod-cases
GET    /mod-cases/:caseId
PATCH  /mod-cases/:caseId
DELETE /mod-cases/:caseId
```

Filtering examples:

```http
GET /mod-cases?status=open
GET /mod-cases?priority=high
GET /mod-cases?openedByActorId=:actorId
GET /mod-cases?isSticky=true
```

Lifecycle routes:

```http
POST /mod-cases/:caseId/investigate
POST /mod-cases/:caseId/pending-action
POST /mod-cases/:caseId/resolve
POST /mod-cases/:caseId/dismiss
POST /mod-cases/:caseId/close
POST /mod-cases/:caseId/reopen
```

Expected behavior:

```text
investigate:
  status = investigating

pending-action:
  status = pending_action

resolve:
  status = resolved
  closed_by_actor_id = current actor
  closed_at_ms = current time

dismiss:
  status = dismissed
  closed_by_actor_id = current actor
  closed_at_ms = current time

close:
  status = closed
  closed_by_actor_id = current actor
  closed_at_ms = current time

reopen:
  status = open
  closed_by_actor_id = null
  closed_at_ms = null
```

`PATCH /mod-cases/:caseId` remains useful for ordinary editable fields:

```text
title
description
priority
is_sticky
```

Lifecycle routes are better for state transitions because they can enforce transition rules, audit actor identity, update closure fields, and publish events consistently.

## Watchlist

```http
GET    /watchlist
GET    /watchlist/:entryId
POST   /players/:playerId/watchlist
GET    /players/:playerId/watchlist
DELETE /players/:playerId/watchlist/active
```

The watchlist is backed by `player_watchlist_entries`. It lets modmins track concerning players, keep history, filter the active watchlist, and trigger staff-facing activity alerts when a watched player joins, leaves, or otherwise becomes relevant.

Filtering examples:

```http
GET /watchlist?subjectActorId=:actorId
GET /watchlist?addedByActorId=:actorId
GET /watchlist?active=true
```

`POST /players/:playerId/watchlist` adds a player to the staff watchlist.

`DELETE /players/:playerId/watchlist/active` clears the active watchlist entry rather than hard-deleting it.

Adding a player to the watchlist should also set the derived `WATCHLISTED` bit in `players.flags`. Clearing the active watchlist entry should clear that bit when no active entry remains. The bitmask itself is not managed through standalone public flag endpoints.

Expected behavior:

```text
cleared_by_actor_id = current actor
cleared_at_ms = current time
```

The canonical player-scoped write route is under `/players/:playerId/watchlist` because consumers usually operate from a player context. The broad `/watchlist` collection is for staff filtering, review queues, and history.

## Argus Users

```http
POST   /argus-users
GET    /argus-users
GET    /argus-users/:userId
PATCH  /argus-users/:userId
DELETE /argus-users/:userId
```

Filtering examples:

```http
GET /argus-users?role=admin
GET /argus-users?accountState=suspended
GET /argus-users?minecraftId=:playerId
```

Account lifecycle routes:

```http
POST /argus-users/:userId/suspend
POST /argus-users/:userId/disable
POST /argus-users/:userId/enable
POST /argus-users/:userId/request-password-reset
POST /argus-users/:userId/request-email-verification
```

These routes represent account-state workflows rather than ordinary user field updates.

## Argus Email Verifications

```http
POST   /argus-email-verifications
GET    /argus-email-verifications/:verificationId
POST   /argus-email-verifications/:verificationId/verify
DELETE /argus-email-verifications/:verificationId
```

Email verification is a workflow resource. Most consumers should not need a broad list endpoint unless this is for internal administration.

## Argus Alerts

```http
POST   /argus-alerts
GET    /argus-alerts
GET    /argus-alerts/:alertId
PATCH  /argus-alerts/:alertId
DELETE /argus-alerts/:alertId
```

Filtering examples:

```http
GET /argus-alerts?active=true
```

`DELETE /argus-alerts/:alertId` should usually deactivate the alert.

Expected behavior:

```text
is_active = false
```

## API Keys

```http
POST   /api-keys
GET    /api-keys
GET    /api-keys/:apiKeyId
PATCH  /api-keys/:apiKeyId
DELETE /api-keys/:apiKeyId
```

Filtering examples:

```http
GET /api-keys?ownerActorId=:actorId
GET /api-keys?isActive=true
GET /api-keys?isSuperKey=true
```

Recommended action routes:

```http
POST /api-keys/:apiKeyId/revoke
POST /api-keys/:apiKeyId/rotate
```

`DELETE /api-keys/:apiKeyId` should usually revoke the key rather than hard-delete it.

Expected behavior:

```text
is_active = false
updated_at_ms = current time
```

## Actors

```http
GET /actors
GET /actors/:actorId
```

Actors are primarily audit identities. They should usually not be freely created, patched, or deleted through ordinary public routes.

Creation happens through domain workflows:

```text
player creation
system/application setup
service registration
```

Optional administrative route:

```http
PATCH /actors/:actorId
```

This should be limited to carefully controlled fields, such as display name corrections or service actor metadata.

## Delete Semantics

Some routes expose `DELETE`, but many of these should not physically delete rows.

Recommended semantics:

```text
DELETE /players/:playerId
→ soft-delete/anonymize player and preserve audit continuity

DELETE /players/:playerId/nicknames/:nicknameId
→ revoke nickname

DELETE /players/:playerId/watchlist/active
→ clear active watchlist entry

DELETE /chat-channels/:channelKey
→ deactivate channel

DELETE /badges/:badgeId
→ deactivate badge

DELETE /api-keys/:apiKeyId
→ revoke key

DELETE /lockdowns/:lockdownId
→ deactivate lockdown

DELETE /punishments/:punishmentId
→ revoke/void punishment, depending on final lifecycle design
```

Hard deletes should be reserved for data that is not audit-relevant or for development/admin-only maintenance operations.

## Endpoint Design Rules

Core resource routes use standard CRUD:

```http
POST   /resource
GET    /resource
GET    /resource/:id
PATCH  /resource/:id
DELETE /resource/:id
```

Nested routes are used when the child resource is naturally scoped by the parent:

```http
/players/:playerId/profile
/players/:playerId/badges
/players/:playerId/ranks
/reports/:reportId/comments
/chat-channels/:channelKey/messages
/servers/:serverId/access
```

Action routes are used when the operation is a named workflow transition:

```http
/mod-cases/:caseId/resolve
/reports/:reportId/dismiss
/punishment-appeals/:appealId/accept
/api-keys/:apiKeyId/revoke
/servers/:serverId/lockdown
```

A `PATCH` route is best for ordinary field updates. A named action route is better when the operation needs transition validation, actor attribution, timestamp updates, side effects, Redis publishing, audit records, or multiple table updates.
