# Endpoint testing client

A small curl-like Python client. Uses the standard library for HTTP and the existing `python-dotenv` script dep for configuration

I sometimes switch to Windows from my ordinary Linux, so a clean client helper is preferable on my end without WSL2; this was mainly created to suite my needs.

Requires Python 3.10+. Install dotenv support if needed:

```sh
python -m pip install python-dotenv
```

Run `<python> scripts/api.py` from the repo root (often `python` Win; `python3` Linux/macOS). You can also run it from another directory using its full path. The default environment file is always `scripts/.env`, next to the client.

Copy the `API_*` settings from [`.env.example`](.env.example) into `scripts/.env`, keeping existing database settings. That file is ignored by Git. Process environment variables override the file; CLI flags override both. The client does not read the API's root `.env`. Without configuration, it targets `http://localhost:3000` using the Developer superadmin key. `--api-key` works without an environment file.

## Everyday requests

These commands work in PowerShell, Bash, & Zsh:

```sh
# GET, with the configured API key automatically attached
python scripts/api.py /players
python scripts/api.py GET /actors -q limit=5

# Query parameters are URL encoded; repeat -q for multiple values
python scripts/api.py /players -q limit=10 -q offset=0

# JSON fields avoid embedded double quotes entirely. A body defaults to POST.
python scripts/api.py POST /auth/login --auth none -j usernameOrEmail=Developer -j password=dev

# Numbers, booleans, null, arrays, and objects parse as JSON; other values are strings.
# Force numeric-looking IDs and JSON-looking text to stay strings with :=.
# Field names are literal: dotted names do not create nested objects.
python scripts/api.py PATCH /actors/123 -j 'label=Test Player' -j 'id:=123'

# For nested/large JSON, put the body in a file. File paths are relative to cwd.
python scripts/api.py POST /actors -d '@scripts/request.json'

# Headers accept either NAME=VALUE or curl's NAME:VALUE syntax
python scripts/api.py /players -H X-Request-Id=manual-test -i
python scripts/api.py /players -H 'Accept: application/json'

# Bearer auth logs in with API_USERNAME/API_PASSWORD for each invocation,
# unless API_TOKEN (or --token) is set. Tokens are never saved to disk.
python scripts/api.py /auth/me --auth bearer
python scripts/api.py /auth/me --auth bearer --token your-access-token
python scripts/api.py /players --api-key another-key
python scripts/api.py /players --no-env --api-key another-key
python scripts/api.py /players --auth minecraft --token your-session-token

# Test unauthenticated routes or supply your own Authorization header
python scripts/api.py /health --auth none
python scripts/api.py /auth/me -H 'Authorization=Bearer your-access-token'

# Exact response output, saved bytes, alternate configuration, and timeouts
python scripts/api.py /players --raw
python scripts/api.py /players -o players.json
python scripts/api.py /players --env scripts/staging.env --timeout 5
python scripts/api.py /health --base-url http://localhost:3000 --auth none
python scripts/api.py --help
```

Stdin works with `-d '@-'`. In PowerShell:

```powershell
Get-Content -Raw scripts/request.json | python scripts/api.py POST /actors -d '@-'
```

In Bash/Zsh:

```sh
python scripts/api.py POST /actors -d '@-' < scripts/request.json # needs confirming
```

Replace example IDs and payloads with valid values for the endpoint you are testing. `-j` builds a flat JSON object; use a body file for nested data. `-d` also accepts inline body text. Bodies default to `Content-Type: application/json`; override it with `-H` when sending another format. `-X METHOD` is available as an alternative to the positional method. GET and HEAD reject bodies.

JSON responses are pretty printed by default. Text output uses UTF-8. The response body goes to stdout; HTTP status, timing, and all the optional response headers (`-i`) go to stderr. `--raw` writes exact bytes to stdout; `-o` writes exact bytes to the named file (overwriting it).

`--no-env` skips dotenv loading; process environment variables and CLI flags still apply. `--api-key` selects API key auth even if the environment configures bearer mode; an explicit `--auth` takes precedence. Explicit `Authorization` or `X-Api-Key` headers replace automatic authentication. `--auth none` disables automatic authentication but still sends explicit headers. Authenticated absolute URLs must have the same origin as the configured base URL; choose another target with `--base-url`. Redirects are returned without following them. A base URL may include a path prefix; `/players` and `players` both retain that prefix. The timeout applies to blocking network operations, including bearer login.

Exit codes are `0` for HTTP 2xx, `22` for other HTTP responses (body still printed), `2` for invalid arguments/configuration, and `1` for network, file, or bearer-login failures. PowerShell exposes the result as `$LASTEXITCODE`; Bash/Zsh use `$?`.

Run the client's  local HTTP tests:

```sh
python -B -m unittest discover -s scripts -p api_test.py -v
```

Optional Windows shortcut remains available @ `.\scripts\api`- it uses the same Python client. The npm shortcuts are `npm run api --` and `npm run test:api-client`; in PowerShell, use `npm.cmd` to avoid the npm shim swallowing option flags.
