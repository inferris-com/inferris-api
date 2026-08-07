from __future__ import annotations

from dataclasses import dataclass


GENERATION_NAMES = (
    "actors",
    "players",
    "servers",
    "chat",
    "punishments",
    "reports",
    "sessions",
    "argus-users",
)

DEFAULT_GENERATIONS = (
    "actors",
    "players",
    "chat",
    "punishments",
    "reports",
    "sessions",
)

PRESETS: dict[str, dict[str, int]] = {
    "tiny": {
        "players": 25,
        "chat_messages": 200,
        "punishments": 20,
        "reports": 25,
        "sessions": 50,
        "servers": 0,
    },
    "default": {
        "players": 250,
        "chat_messages": 2_000,
        "punishments": 175,
        "reports": 200,
        "sessions": 500,
        "servers": 0,
    },
    "large": {
        "players": 2_000,
        "chat_messages": 25_000,
        "punishments": 1_500,
        "reports": 2_000,
        "sessions": 5_000,
        "servers": 8,
    },
}


@dataclass(frozen=True)
class Counts:
    players: int
    chat_messages: int
    punishments: int
    reports: int
    sessions: int
    servers: int


@dataclass(frozen=True)
class Probabilities:
    staff: float
    admin_given_staff: float
    supporter: float
    deleted: float
    watchlisted: float
    muted: float
    banned: float
    quarantined: float
    disabled: float
    tester: float
    cool: float
    nicked_staff: float
    vanished_staff: float
    random_badge: float
    staff_active_channel: float
    open_session: float
    report_closed: float
    punishment_active: float


DEFAULT_PROBABILITIES = Probabilities(
    staff=0.015,
    admin_given_staff=0.22,
    supporter=0.09,
    deleted=0.015,
    watchlisted=0.035,
    muted=0.02,
    banned=0.008,
    quarantined=0.012,
    disabled=0.008,
    tester=0.025,
    cool=0.035,
    nicked_staff=0.08,
    vanished_staff=0.18,
    random_badge=0.13,
    staff_active_channel=0.18,
    open_session=0.08,
    report_closed=0.38,
    punishment_active=0.16,
)


STAFF_ROLE_MAP = {
    "moderator": {
        "rank_key": "moderator",
        "privileged_role": "moderator",
        "argus_role": "moderator",
        "title": "Moderator",
    },
    "admin": {
        "rank_key": "admin",
        "privileged_role": "administrator",
        "argus_role": "admin",
        "title": "Admin",
    },
}
