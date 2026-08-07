from __future__ import annotations

from dataclasses import dataclass

import psycopg


@dataclass(frozen=True)
class FlagDefinition:
    key: str
    bit_position: int


@dataclass(frozen=True)
class Rank:
    key: str
    group_key: str | None
    is_staff: bool


@dataclass(frozen=True)
class Badge:
    id: int
    key: str


@dataclass(frozen=True)
class Server:
    id: str
    name: str
    type: str


@dataclass(frozen=True)
class Channel:
    key: str
    is_staff: bool


@dataclass(frozen=True)
class Actor:
    id: str
    name: str | None


@dataclass(frozen=True)
class Catalog:
    flags: dict[str, FlagDefinition]
    ranks: dict[str, Rank]
    badges: dict[str, Badge]
    servers: list[Server]
    channels: list[Channel]
    player_ids: list[str]
    player_ids_without_open_session: list[str]
    staff_actors: list[Actor]
    regular_actors: list[Actor]
    seed_actor_id: str

    def encode_flags(self, keys: list[str]) -> int:
        value = 0
        for key in keys:
            flag = self.flags.get(key)
            if flag is not None:
                value |= 1 << flag.bit_position
        return value

    def badge_id(self, key: str) -> int | None:
        badge = self.badges.get(key)
        return badge.id if badge else None


def _fetch_all(conn: psycopg.Connection, query: str, params: tuple = ()) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(query, params)
        return list(cur.fetchall())


def load_catalog(conn: psycopg.Connection) -> Catalog:
    flags = {
        row[0]: FlagDefinition(key=row[0], bit_position=row[1])
        for row in _fetch_all(
            conn,
            """
            SELECT flag_key, bit_position
            FROM player_flag_definitions
            WHERE is_active = TRUE
            ORDER BY bit_position
            """,
        )
    }
    ranks = {
        row[0]: Rank(key=row[0], group_key=row[1], is_staff=row[2])
        for row in _fetch_all(
            conn,
            """
            SELECT key, group_key, is_staff
            FROM ranks
            WHERE is_active = TRUE
            """,
        )
    }
    badges = {
        row[1]: Badge(id=row[0], key=row[1])
        for row in _fetch_all(
            conn,
            """
            SELECT id, key
            FROM badges
            WHERE is_active = TRUE
            """,
        )
    }
    servers = [
        Server(id=row[0], name=row[1], type=row[2])
        for row in _fetch_all(
            conn,
            """
            SELECT id::text, name, type
            FROM servers
            ORDER BY created_at_ms
            """,
        )
    ]
    channels = [
        Channel(key=row[0], is_staff=row[1])
        for row in _fetch_all(
            conn,
            """
            SELECT key, is_staff
            FROM chat_channels
            WHERE is_active = TRUE
            ORDER BY is_staff, key
            """,
        )
    ]
    player_ids = [
        row[0]
        for row in _fetch_all(
            conn,
            """
            SELECT id::text
            FROM players
            WHERE deleted_at_ms IS NULL
            """,
        )
    ]
    player_ids_without_open_session = [
        row[0]
        for row in _fetch_all(
            conn,
            """
            SELECT players.id::text
            FROM players
            LEFT JOIN network_sessions_current
              ON network_sessions_current.player_id = players.id
            WHERE players.deleted_at_ms IS NULL
              AND network_sessions_current.player_id IS NULL
            """,
        )
    ]
    staff_actors = [
        Actor(id=row[0], name=row[1])
        for row in _fetch_all(
            conn,
            """
            SELECT DISTINCT actors.id::text, actors.name
            FROM actors
            JOIN privileged_subjects ON privileged_subjects.actor_id = actors.id
            WHERE actors.type = 'user'
              AND privileged_subjects.status = 'active'
              AND privileged_subjects.role IN ('moderator', 'administrator', 'superadmin')
            """,
        )
    ]
    regular_actors = [
        Actor(id=row[0], name=row[1])
        for row in _fetch_all(
            conn,
            """
            SELECT actors.id::text, actors.name
            FROM actors
            LEFT JOIN privileged_subjects ON privileged_subjects.actor_id = actors.id
              AND privileged_subjects.status = 'active'
            WHERE actors.type = 'user'
              AND privileged_subjects.id IS NULL
            """,
        )
    ]
    seed_actor_id = _fetch_all(
        conn,
        """
        SELECT id::text
        FROM actors
        WHERE name = 'Seed Script' AND type = 'application'
        LIMIT 1
        """,
    )
    if not seed_actor_id:
        raise RuntimeError("Seed Script actor is missing. Run the Kysely dev seed first.")
    if not flags:
        raise RuntimeError("Player flag definitions are missing. Run the Kysely dev seed first.")
    if not servers:
        raise RuntimeError("At least one server is required before stress seeding.")
    if not channels:
        raise RuntimeError("At least one active chat channel is required before stress seeding.")

    return Catalog(
        flags=flags,
        ranks=ranks,
        badges=badges,
        servers=servers,
        channels=channels,
        player_ids=player_ids,
        player_ids_without_open_session=player_ids_without_open_session,
        staff_actors=staff_actors,
        regular_actors=regular_actors,
        seed_actor_id=seed_actor_id[0][0],
    )
