from __future__ import annotations

import random
import string
import uuid
from dataclasses import dataclass, field
from typing import Any

from faker import Faker

from .catalog import Catalog, Server
from .config import Counts, Probabilities, STAFF_ROLE_MAP


DEV_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$cIiPtXejD1STgPzcTRZSSA"
    "$alT/uE2pvOJ+ct42nlVEjoIc2E4EJ99pIzENZpfW3VQ"
)

REPORT_REASONS = [
    "Chat harassment",
    "Spam or flooding",
    "Suspicious combat behavior",
    "Inappropriate skin or username",
    "Griefing claim",
    "Bypassing moderation",
    "Scam attempt",
]

PUNISHMENT_REASONS = [
    "Spam",
    "Harassment",
    "Advertising",
    "Combat advantage",
    "Griefing",
    "Staff disrespect",
    "Unsafe link",
]


@dataclass
class Batch:
    actors: list[dict[str, Any]] = field(default_factory=list)
    players: list[dict[str, Any]] = field(default_factory=list)
    profiles: list[dict[str, Any]] = field(default_factory=list)
    ranks: list[dict[str, Any]] = field(default_factory=list)
    badges: list[dict[str, Any]] = field(default_factory=list)
    nicknames: list[dict[str, Any]] = field(default_factory=list)
    privileged_subjects: list[dict[str, Any]] = field(default_factory=list)
    argus_users: list[dict[str, Any]] = field(default_factory=list)
    watchlist_entries: list[dict[str, Any]] = field(default_factory=list)
    servers: list[dict[str, Any]] = field(default_factory=list)
    server_instances: list[dict[str, Any]] = field(default_factory=list)
    chat_messages: list[dict[str, Any]] = field(default_factory=list)
    punishments: list[dict[str, Any]] = field(default_factory=list)
    reports: list[dict[str, Any]] = field(default_factory=list)
    report_comments: list[dict[str, Any]] = field(default_factory=list)
    network_sessions: list[dict[str, Any]] = field(default_factory=list)
    network_sessions_current: list[dict[str, Any]] = field(default_factory=list)
    backend_sessions: list[dict[str, Any]] = field(default_factory=list)
    backend_sessions_current: list[dict[str, Any]] = field(default_factory=list)
    generated_actor_ids: list[str] = field(default_factory=list)
    generated_regular_actor_ids: list[str] = field(default_factory=list)
    generated_staff_actor_ids: list[str] = field(default_factory=list)
    generated_player_ids: list[str] = field(default_factory=list)


class StressGenerator:
    def __init__(
        self,
        catalog: Catalog,
        counts: Counts,
        probabilities: Probabilities,
        *,
        include_staff: bool,
        seed: int | None,
    ) -> None:
        self.catalog = catalog
        self.counts = counts
        self.probabilities = probabilities
        self.include_staff = include_staff
        self.random = random.Random(seed)
        self.fake = Faker()
        if seed is not None:
            Faker.seed(seed)
        self.run_tag = self._short_id(8)
        self._used_usernames: set[str] = set()
        self._used_codes: set[str] = set()

    def generate(self, generations: set[str]) -> Batch:
        batch = Batch()

        if "servers" in generations and self.counts.servers > 0:
            self._servers(batch)

        if "actors" in generations or "players" in generations:
            self._players(batch)

        actor_pool = self._actor_pool(batch)
        staff_pool = self._staff_pool(batch)
        server_pool = self._server_pool(batch)

        if "sessions" in generations:
            self._sessions(batch, server_pool)
        if "chat" in generations:
            self._chat(batch, actor_pool, staff_pool, server_pool)
        if "punishments" in generations:
            self._punishments(batch, actor_pool, staff_pool, server_pool)
        if "reports" in generations:
            self._reports(batch, actor_pool, staff_pool, server_pool)
        if "argus-users" in generations and self.include_staff:
            self._backfill_argus_users(batch)

        return batch

    def _players(self, batch: Batch) -> None:
        for index in range(self.counts.players):
            actor_id = str(uuid.uuid4())
            player_id = str(uuid.uuid4())
            username = self._username()
            created_at_ms = self._past_ms(days=900)
            is_staff = self.include_staff and self.random.random() < self.probabilities.staff
            staff_kind = "admin" if (
                is_staff and self.random.random() < self.probabilities.admin_given_staff
            ) else "moderator"
            is_supporter = (not is_staff) and self.random.random() < self.probabilities.supporter
            is_deleted = self.random.random() < self.probabilities.deleted

            flags = self._player_flags(is_staff=is_staff, is_deleted=is_deleted)
            active_channel = (
                "staff"
                if is_staff
                and self._has_channel("staff")
                and self.random.random() < self.probabilities.staff_active_channel
                else "global"
            )
            server = self.random.choice(self.catalog.servers)

            batch.actors.append(
                {
                    "id": actor_id,
                    "name": f"Load {username}",
                    "type": "user",
                    "created_at_ms": created_at_ms,
                    "last_updated_at_ms": None,
                }
            )
            batch.players.append(
                {
                    "id": player_id,
                    "mojang_id": str(uuid.uuid4()),
                    "actor_id": actor_id,
                    "username": username,
                    "flags": flags,
                    "orbs": self.random.randint(0, 200_000),
                    "active_channel_key": active_channel,
                    "created_at_ms": created_at_ms,
                    "last_seen_at_ms": None if is_deleted else self._recent_ms(days=90),
                    "last_server_id": server.id,
                    "deleted_at_ms": self._recent_ms(days=120) if is_deleted else None,
                    "deleted_reason": self.random.choice(
                        ["self request", "underage account", "staff cleanup"]
                    )
                    if is_deleted
                    else None,
                }
            )
            batch.profiles.append(
                {
                    "player_id": player_id,
                    "bio": self.fake.sentence(nb_words=10) if self.random.random() < 0.35 else None,
                    "pronouns": self.random.choice(["he/him", "she/her", "they/them", None, None]),
                    "featured_badge_id": None,
                    "locale": self.random.choice(["en_US", "en_GB", "es_ES", "fr_FR", "de_DE"]),
                    "preferences": {},
                }
            )
            batch.generated_actor_ids.append(actor_id)
            batch.generated_player_ids.append(player_id)

            if is_staff:
                batch.generated_staff_actor_ids.append(actor_id)
                self._staff_records(batch, actor_id, player_id, username, staff_kind)
            else:
                batch.generated_regular_actor_ids.append(actor_id)
                if is_supporter:
                    self._supporter_records(batch, player_id)
                self._random_badges(batch, player_id)

            if "WATCHLISTED" in self._decode_flag_keys(flags):
                batch.watchlist_entries.append(
                    {
                        "subject_actor_id": actor_id,
                        "added_by_actor_id": self._staff_issuer(),
                        "reason": self.fake.sentence(nb_words=8),
                        "severity": self._severity(),
                        "alert_on_join": True,
                        "alert_on_chat": self.random.random() < 0.3,
                        "alert_note": self.fake.sentence(nb_words=6),
                        "expires_at_ms": None,
                    }
                )

            if index % 100 == 0:
                self._used_usernames.add(username.lower())

    def _staff_records(
        self,
        batch: Batch,
        actor_id: str,
        player_id: str,
        username: str,
        staff_kind: str,
    ) -> None:
        mapping = STAFF_ROLE_MAP[staff_kind]
        rank_key = mapping["rank_key"]
        rank = self.catalog.ranks.get(rank_key)
        if rank and rank.group_key:
            batch.ranks.append(
                {
                    "player_id": player_id,
                    "group_key": rank.group_key,
                    "rank_key": rank.key,
                    "assigned_by_actor_id": self.catalog.seed_actor_id,
                    "source": "stress_seed",
                }
            )
        batch.privileged_subjects.append(
            {
                "actor_id": actor_id,
                "status": "active",
                "role": mapping["privileged_role"],
                "title": mapping["title"],
                "enrolled_by_actor_id": self.catalog.seed_actor_id,
            }
        )
        batch.argus_users.append(
            {
                "id": str(uuid.uuid4()),
                "username": username,
                "email": f"{username.lower()}+{self.run_tag}@stress.inferris.test",
                "password_hash": DEV_PASSWORD_HASH,
                "role": mapping["argus_role"],
                "actor_id": actor_id,
                "account_state": "active",
            }
        )
        if staff_kind == "admin":
            dev_badge = self.catalog.badge_id("developer")
            if dev_badge:
                batch.badges.append(
                    {
                        "player_id": player_id,
                        "badge_id": dev_badge,
                        "source": "stress_seed:staff_admin",
                    }
                )
        if self.random.random() < self.probabilities.nicked_staff:
            batch.nicknames.append(
                {
                    "player_id": player_id,
                    "nickname": self._username(max_len=17),
                    "cover_rank_key": "moderator",
                    "meta": {"source": "stress_seed"},
                    "is_active": True,
                }
            )

    def _supporter_records(self, batch: Batch, player_id: str) -> None:
        supporter_rank = self.catalog.ranks.get("supporter_i")
        if supporter_rank and supporter_rank.group_key:
            batch.ranks.append(
                {
                    "player_id": player_id,
                    "group_key": supporter_rank.group_key,
                    "rank_key": supporter_rank.key,
                    "assigned_by_actor_id": self.catalog.seed_actor_id,
                    "source": "stress_seed:supporter",
                }
            )
        supporter_badge = self.catalog.badge_id("supporter")
        if supporter_badge:
            batch.badges.append(
                {
                    "player_id": player_id,
                    "badge_id": supporter_badge,
                    "source": "stress_seed:supporter",
                }
            )

    def _random_badges(self, batch: Batch, player_id: str) -> None:
        excluded = {"developer", "supporter", "ghost_user", "inactive_badge"}
        available = [badge for key, badge in self.catalog.badges.items() if key not in excluded]
        self.random.shuffle(available)
        for badge in available[: self.random.randint(0, 3)]:
            if self.random.random() < self.probabilities.random_badge:
                batch.badges.append(
                    {"player_id": player_id, "badge_id": badge.id, "source": "stress_seed:random"}
                )

    def _player_flags(self, *, is_staff: bool, is_deleted: bool) -> int:
        keys: list[str] = []
        if is_staff:
            keys.append("STAFF")
            keys.append("ARGUS_ACCESS")
            if self.random.random() < self.probabilities.vanished_staff:
                keys.append("VANISHED")
            if self.random.random() < self.probabilities.nicked_staff:
                keys.append("NICKED")
        if is_deleted:
            keys.append("DELETED")
            if self.random.random() < 0.45:
                keys.append("SELF_DELETED")
            elif self.random.random() < 0.2:
                keys.append("UNDERAGE_DELETED")
        elif not is_staff:
            for key, probability in (
                ("WATCHLISTED", self.probabilities.watchlisted),
                ("MUTED", self.probabilities.muted),
                ("BANNED", self.probabilities.banned),
                ("QUARANTINED", self.probabilities.quarantined),
                ("DISABLED", self.probabilities.disabled),
                ("TESTER", self.probabilities.tester),
                ("COOL", self.probabilities.cool),
            ):
                if self.random.random() < probability:
                    keys.append(key)
        return self.catalog.encode_flags(keys)

    def _servers(self, batch: Batch) -> None:
        for index in range(self.counts.servers):
            server_id = str(uuid.uuid4())
            server_type = self.random.choice(["paper", "paper", "paper", "velocity", "vanilla"])
            batch.servers.append(
                {
                    "id": server_id,
                    "name": f"stress-{self.run_tag}-{index + 1}",
                    "type": server_type,
                    "environment": self.random.choice(["development", "alpha", "beta"]),
                    "port": self.random.randint(20_000, 40_000),
                }
            )
            batch.server_instances.append(
                {
                    "id": str(uuid.uuid4()),
                    "server_id": server_id,
                    "boot_id": f"stress-{self.run_tag}-{self._short_id(10)}",
                    "state": "active",
                    "runtime_port": self.random.randint(20_000, 40_000),
                    "version": f"stress-{self.run_tag}",
                    "started_at_ms": self._recent_ms(days=7),
                    "last_heartbeat_at_ms": self._recent_ms(days=1),
                    "heartbeat_interval_ms": 10_000,
                    "last_presence_sequence": None,
                    "is_synthetic_backfill": True,
                }
            )

    def _sessions(self, batch: Batch, servers: list[Server]) -> None:
        eligible_players = self.catalog.player_ids_without_open_session + batch.generated_player_ids
        if not eligible_players:
            return
        proxy_servers = [server for server in servers if server.type == "velocity"] or servers
        backend_servers = [server for server in servers if server.type != "velocity"] or servers
        open_players: set[str] = set()

        for _ in range(self.counts.sessions):
            player_id = self.random.choice(eligible_players)
            if player_id in open_players:
                continue
            session_id = str(uuid.uuid4())
            backend_session_id = str(uuid.uuid4())
            connected_at = self._past_ms(days=120)
            open_session = self.random.random() < self.probabilities.open_session
            disconnected_at = None if open_session else connected_at + self.random.randint(60_000, 14_400_000)
            proxy = self.random.choice(proxy_servers)
            backend = self.random.choice(backend_servers)
            batch.network_sessions.append(
                {
                    "id": session_id,
                    "player_id": player_id,
                    "proxy_server_id": proxy.id,
                    "proxy_server_instance_id": None,
                    "connected_at_ms": connected_at,
                    "disconnected_at_ms": disconnected_at,
                    "disconnect_reason": None if open_session else self.random.choice(
                        ["quit", "timeout", "server switch", "restart"]
                    ),
                    "meta": {"source": "stress_seed"},
                }
            )
            joined_at = connected_at + self.random.randint(1_000, 60_000)
            left_at = None if open_session else min(disconnected_at, joined_at + self.random.randint(30_000, 7_200_000))
            batch.backend_sessions.append(
                {
                    "id": backend_session_id,
                    "network_session_id": session_id,
                    "player_id": player_id,
                    "backend_server_id": backend.id,
                    "backend_server_instance_id": None,
                    "joined_at_ms": joined_at,
                    "left_at_ms": left_at,
                    "leave_reason": None if open_session else self.random.choice(["quit", "switch", "restart"]),
                    "meta": {"source": "stress_seed"},
                }
            )
            if open_session:
                open_players.add(player_id)
                batch.network_sessions_current.append(
                    {
                        "player_id": player_id,
                        "proxy_server_id": proxy.id,
                        "network_session_id": session_id,
                        "connected_at_ms": connected_at,
                    }
                )
                batch.backend_sessions_current.append(
                    {
                        "network_session_id": session_id,
                        "player_id": player_id,
                        "backend_server_id": backend.id,
                        "backend_session_id": backend_session_id,
                        "joined_at_ms": joined_at,
                    }
                )

    def _chat(
        self,
        batch: Batch,
        actors: list[str],
        staff: list[str],
        servers: list[Server],
    ) -> None:
        if not actors:
            return
        public_channels = [channel.key for channel in self.catalog.channels if not channel.is_staff]
        staff_channels = [channel.key for channel in self.catalog.channels if channel.is_staff]
        for index in range(self.counts.chat_messages):
            use_staff_channel = bool(staff and staff_channels and self.random.random() < 0.08)
            actor_id = self.random.choice(staff if use_staff_channel else actors)
            server = self.random.choice(servers)
            verdict = self.random.choices(["allow", "warn", "deny"], weights=[93, 5, 2], k=1)[0]
            batch.chat_messages.append(
                {
                    "id": str(uuid.uuid4()),
                    "actor_id": actor_id,
                    "producer_message_id": f"stress:{self.run_tag}:{index}",
                    "ingest_stream_id": f"stress:{self.run_tag}",
                    "message": self._chat_message(),
                    "channel_key": self.random.choice(staff_channels if use_staff_channel else public_channels),
                    "origin_server_id": server.id,
                    "verdict": verdict,
                    "moderation_reason": "synthetic classifier sample" if verdict != "allow" else None,
                    "moderation_metadata": {"source": "stress_seed", "score": round(self.random.random(), 3)},
                    "is_flagged": verdict != "allow",
                    "created_at_ms": self._past_ms(days=60),
                }
            )

    def _punishments(
        self,
        batch: Batch,
        actors: list[str],
        staff: list[str],
        servers: list[Server],
    ) -> None:
        if not actors:
            return
        issuers = staff or [self.catalog.seed_actor_id]
        active_pairs: set[tuple[str, str]] = set()
        for _ in range(self.counts.punishments):
            subject = self.random.choice(actors)
            kind = self.random.choices(["warn", "kick", "mute", "ban"], weights=[45, 20, 25, 10], k=1)[0]
            can_be_active = kind in {"mute", "ban"} and (subject, kind) not in active_pairs
            is_active = can_be_active and self.random.random() < self.probabilities.punishment_active
            if is_active:
                active_pairs.add((subject, kind))
            created_at = self._past_ms(days=180)
            ends_at = None
            if kind in {"mute", "ban"} and self.random.random() < 0.65:
                ends_at = created_at + self.random.randint(3_600_000, 2_592_000_000)
            batch.punishments.append(
                {
                    "id": str(uuid.uuid4()),
                    "code": self._code("SP"),
                    "subject_actor_id": subject,
                    "issuer_actor_id": self.random.choice(issuers),
                    "server_origin_id": self.random.choice(servers).id,
                    "type": kind,
                    "reason": self.random.choice(PUNISHMENT_REASONS),
                    "note": self.fake.sentence(nb_words=12),
                    "is_silent": self.random.random() < 0.12,
                    "is_active": is_active,
                    "ends_at_ms": ends_at,
                    "lifted_cause": None if is_active else ("expired" if kind in {"mute", "ban"} else None),
                    "lifted_at_ms": None if is_active or kind not in {"mute", "ban"} else max(created_at, ends_at or created_at),
                    "lifted_by_actor_id": None,
                    "lift_note": None,
                    "created_at_ms": created_at,
                }
            )

    def _reports(
        self,
        batch: Batch,
        actors: list[str],
        staff: list[str],
        servers: list[Server],
    ) -> None:
        if len(actors) < 2:
            return
        for _ in range(self.counts.reports):
            reporter, subject = self.random.sample(actors, 2)
            created_at = self._past_ms(days=150)
            closed = bool(staff) and self.random.random() < self.probabilities.report_closed
            status = self.random.choice(["actioned", "dismissed", "duplicate"]) if closed else self.random.choice(
                ["open", "open", "under_review"]
            )
            assignee = self.random.choice(staff) if staff and self.random.random() < 0.6 else None
            closer = self.random.choice(staff) if closed else None
            report_id = str(uuid.uuid4())
            batch.reports.append(
                {
                    "id": report_id,
                    "code": self._code("SR"),
                    "reporter_actor_id": reporter,
                    "subject_actor_id": subject,
                    "selected_reason": self.random.choice(REPORT_REASONS),
                    "reason_description": self.fake.paragraph(nb_sentences=2),
                    "status": status,
                    "severity": self._severity(),
                    "resolution": self._resolution(status) if closed else None,
                    "origin_server_id": self.random.choice(servers).id,
                    "assigned_to_actor_id": assignee,
                    "triaged_by_actor_id": assignee,
                    "triaged_at_ms": created_at + self.random.randint(60_000, 3_600_000) if assignee else None,
                    "closed_by_actor_id": closer,
                    "closed_at_ms": created_at + self.random.randint(3_600_000, 86_400_000) if closed else None,
                    "resolution_note": self.fake.sentence(nb_words=10) if closed else None,
                    "created_at_ms": created_at,
                }
            )
            if staff and self.random.random() < 0.45:
                batch.report_comments.append(
                    {
                        "id": str(uuid.uuid4()),
                        "report_id": report_id,
                        "author_actor_id": self.random.choice(staff),
                        "author_argus_user_id": None,
                        "parent_comment_id": None,
                        "comment_text": self.fake.paragraph(nb_sentences=2),
                        "is_sticky": self.random.random() < 0.08,
                    }
                )

    def _backfill_argus_users(self, batch: Batch) -> None:
        known = {row["actor_id"] for row in batch.argus_users}
        for actor_id in batch.generated_staff_actor_ids:
            if actor_id in known:
                continue
            username = self._username()
            batch.argus_users.append(
                {
                    "id": str(uuid.uuid4()),
                    "username": username,
                    "email": f"{username.lower()}+{self.run_tag}@stress.inferris.test",
                    "password_hash": DEV_PASSWORD_HASH,
                    "role": "moderator",
                    "actor_id": actor_id,
                    "account_state": "active",
                }
            )

    def _actor_pool(self, batch: Batch) -> list[str]:
        ids = [actor.id for actor in self.catalog.regular_actors] + batch.generated_regular_actor_ids
        ids.extend(batch.generated_staff_actor_ids)
        return ids

    def _staff_pool(self, batch: Batch) -> list[str]:
        return [actor.id for actor in self.catalog.staff_actors] + batch.generated_staff_actor_ids

    def _server_pool(self, batch: Batch) -> list[Server]:
        generated = [Server(id=row["id"], name=row["name"], type=row["type"]) for row in batch.servers]
        return self.catalog.servers + generated

    def _staff_issuer(self) -> str:
        if self.catalog.staff_actors:
            return self.random.choice(self.catalog.staff_actors).id
        return self.catalog.seed_actor_id

    def _has_channel(self, key: str) -> bool:
        return any(channel.key == key for channel in self.catalog.channels)

    def _decode_flag_keys(self, value: int) -> set[str]:
        return {
            key
            for key, flag in self.catalog.flags.items()
            if value & (1 << flag.bit_position)
        }

    def _username(self, max_len: int = 16) -> str:
        while True:
            base = self.fake.user_name()
            compact = "".join(ch for ch in base if ch.isalnum() or ch == "_")[: max_len - 4]
            if not compact:
                compact = "Player"
            username = f"{compact}{self.random.randint(10, 9999)}"[:max_len]
            if username.lower() not in self._used_usernames:
                self._used_usernames.add(username.lower())
                return username

    def _chat_message(self) -> str:
        templates = [
            "anyone want to queue {word}",
            "gg that round was {word}",
            "where is the {word} portal",
            "lag check {number}",
            "selling extra blocks at spawn",
            "thanks for the help",
            "is the event starting soon",
            "that was closer than expected",
            self.fake.sentence(nb_words=self.random.randint(4, 12)),
        ]
        return self.random.choice(templates).format(
            word=self.fake.word(),
            number=self.random.randint(1, 999),
        )[:500]

    def _past_ms(self, *, days: int) -> int:
        now_ms = self._now_ms()
        return now_ms - self.random.randint(0, days * 86_400_000)

    def _recent_ms(self, *, days: int) -> int:
        return self._past_ms(days=days)

    @staticmethod
    def _now_ms() -> int:
        import time

        return int(time.time() * 1000)

    def _short_id(self, length: int) -> str:
        return "".join(self.random.choice(string.ascii_lowercase + string.digits) for _ in range(length))

    def _code(self, prefix: str) -> str:
        while True:
            code = f"{prefix}{self._short_id(10).upper()}"[:12]
            if code not in self._used_codes:
                self._used_codes.add(code)
                return code

    def _severity(self) -> str:
        return self.random.choices(["low", "medium", "high", "critical"], weights=[48, 34, 15, 3], k=1)[0]

    def _resolution(self, status: str) -> str:
        if status == "actioned":
            return "action_taken"
        if status == "duplicate":
            return "duplicate"
        return self.random.choice(["no_action", "insufficient_evidence", "false_report"])
