# Stress Seed

Generates artificial load data on top of the Kysely development seed. It assumes
the base seed has already created ranks, badges, flags, chat channels, servers,
and the Seed Script actor.

Install Python dependencies:

```sh
python3 -m pip install -r scripts/requirements.txt
```

Preview a small run:

```sh
python3 -m scripts.stress_seed --preset tiny --dry-run
```

Write the default artificial data:

```sh
python3 -m scripts.stress_seed
```

Generate staff and Argus users explicitly:

```sh
python3 -m scripts.stress_seed --include-staff --players 500
```

Run only selected generators:

```sh
python3 -m scripts.stress_seed --only players,sessions --players 1000 --sessions 3000
```

Staff generation is off by default. Generated admins receive the developer badge,
staff receive staff rank/privilege/Argus access, and regular players are excluded
from staff-only flags, privileges, Argus accounts, and staff badges. Staff status
does not force the player's active chat channel; `--staff-active-channel-probability`
controls the chance that generated staff start in the staff channel.
