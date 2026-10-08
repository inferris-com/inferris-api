#!/usr/bin/env python3
"""Small cross-platform endpoint testing client; see api.README.md."""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import sys
import time
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEV_KEY = "00000000-0000-0000-0000-000000000001.dev"


class InputError(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Inferris API client. GET by default; a body defaults to POST.",
        usage="%(prog)s [METHOD] <path-or-url> [options]",
        epilog="Body goes to stdout; status/timing go to stderr. See scripts/api.README.md.",
        allow_abbrev=False,
    )
    parser.add_argument("target", nargs="+", metavar="[METHOD] path-or-url")
    parser.add_argument(
        "-X", "--request", metavar="METHOD", help="Explicit HTTP method"
    )
    parser.add_argument(
        "-q",
        "--query",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Encoded query parameter; repeatable",
    )
    parser.add_argument(
        "-H",
        "--header",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help="Header; NAME:VALUE also works; repeatable",
    )
    bodies = parser.add_mutually_exclusive_group()
    bodies.add_argument(
        "-j",
        "--json",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="JSON fields; KEY:=VALUE forces a string; repeatable",
    )
    bodies.add_argument(
        "-d", "--data", metavar="BODY", help="Body text, @file, or @- for stdin"
    )
    parser.add_argument(
        "-i", "--include", action="store_true", help="Response headers to stderr"
    )
    parser.add_argument(
        "-o", "--output", metavar="FILE", help="Save exact response bytes"
    )
    parser.add_argument(
        "--raw", action="store_true", help="Exact response bytes to stdout"
    )
    parser.add_argument(
        "--auth",
        choices=["api-key", "bearer", "minecraft", "none"],
        help="Authentication mode (default api-key)",
    )
    parser.add_argument("--api-key", help="Override API_KEY and select api-key auth")
    parser.add_argument("--token", help="Override API_TOKEN for bearer/Minecraft auth")
    parser.add_argument(
        "--base-url", help="Override API_BASE_URL (default http://localhost:3000)"
    )
    env = parser.add_mutually_exclusive_group()
    env.add_argument(
        "--env",
        type=Path,
        metavar="FILE",
        help="Alternate dotenv file (relative to cwd)",
    )
    env.add_argument(
        "--no-env",
        action="store_true",
        help="Skip dotenv loading; process environment still applies",
    )
    parser.add_argument(
        "--timeout", help="Network timeout in seconds (default 30; API_TIMEOUT)"
    )
    return parser


def load_config(args: argparse.Namespace) -> dict[str, str]:
    config = {}
    if not args.no_env:
        path = args.env if args.env is not None else Path(__file__).with_name(".env")
        try:
            text = path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            if args.env is not None:
                raise
        else:
            try:
                from dotenv import dotenv_values
            except ImportError as error:
                raise InputError(
                    "Install dotenv support: python -m pip install python-dotenv"
                ) from error
            config = {
                key: value
                for key, value in dotenv_values(stream=io.StringIO(text)).items()
                if value is not None
            }
    return {**config, **os.environ}


def setting(flag, config: dict[str, str], name: str, default=None):
    return flag if flag is not None else config.get(name, default)


def pair(value: str, separator: str = "=") -> tuple[str, str]:
    name, found, content = value.partition(separator)
    if not name or not found:
        raise InputError(f"Expected NAME{separator}VALUE: {value}")
    return name, content


def json_body(fields: list[str]) -> bytes:
    body = {}
    for field in fields:
        key, value = pair(field)
        force_string = key.endswith(":")
        if force_string:
            key = key[:-1]
        if not key:
            raise InputError("JSON field names cannot be empty")
        if not force_string:
            try:
                value = json.loads(value)
                # JSON has no NaN/Infinity. Treat them as ordinary strings.
                json.dumps(value, allow_nan=False)
            except (ValueError, OverflowError):
                value = pair(field)[1]
        body[key] = value
    return json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")


def http_url(value: str) -> str:
    try:
        url = urlsplit(value)
        if (
            url.scheme not in ("http", "https")
            or not url.hostname
            or url.username is not None
            or url.password is not None
        ):
            raise ValueError
        _ = url.port  # Validate port syntax/range before sending a request.
        if any(ord(char) < 33 for char in url.netloc):
            raise ValueError
    except ValueError as error:
        raise InputError(
            "URLs must use HTTP(S), with a valid host/port and no embedded credentials"
        ) from error
    return urlunsplit(
        (
            url.scheme,
            url.netloc,
            quote(url.path, safe="/%:@!$&'()*+,;=-._~"),
            quote(url.query, safe="%=&?/:@!$'()*+,;~-._"),
            "",
        )
    )


def origin(url: str) -> tuple[str, str, int]:
    parts = urlsplit(url)
    return (
        parts.scheme,
        parts.hostname,
        parts.port or (443 if parts.scheme == "https" else 80),
    )


def set_header(headers: dict[str, str], name: str, value: str) -> None:
    name, value = name.strip(), value.strip()
    if (
        not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", name)
        or "\r" in value
        or "\n" in value
    ):
        raise InputError("Invalid header name or value")
    try:
        value.encode("latin-1")
    except UnicodeEncodeError as error:
        raise InputError("Header values must use Latin-1 characters") from error
    headers[name.lower()] = value


def send(
    url: str, method: str, headers: dict[str, str], body: bytes | None, timeout: float
):
    request = Request(url, data=body, headers=headers, method=method)
    try:
        response = build_opener(NoRedirect()).open(request, timeout=timeout)
    except HTTPError as error:
        response = error  # Preserve HTTP error bodies and redirects for diagnostics.
    with response:
        return response.status, response.reason, response.headers, response.read()


def authenticate(headers, mode, config, args, base_url, timeout):
    if mode == "none" or "authorization" in headers or "x-api-key" in headers:
        return
    if mode == "api-key":
        key = setting(args.api_key, config, "API_KEY", DEV_KEY)
        if not key:
            raise InputError("Set API_KEY, pass --api-key, or use --auth none")
        set_header(headers, "X-Api-Key", key)
        return
    token = setting(args.token, config, "API_TOKEN")
    if not token and mode == "bearer":
        if not config.get("API_USERNAME") or not config.get("API_PASSWORD"):
            raise InputError(
                "Bearer auth needs API_TOKEN or API_USERNAME and API_PASSWORD"
            )
        body = json.dumps(
            {
                "usernameOrEmail": config["API_USERNAME"],
                "password": config["API_PASSWORD"],
            }
        ).encode("utf-8")
        status, _, _, data = send(
            urljoin(base_url, "auth/login"),
            "POST",
            {"Content-Type": "application/json", "Accept": "application/json"},
            body,
            timeout,
        )
        if not 200 <= status < 300:
            raise RuntimeError(f"Bearer login failed: HTTP {status}")
        try:
            token = json.loads(data)["data"]["accessToken"]
        except (ValueError, KeyError, TypeError) as error:
            raise RuntimeError(
                "Bearer login response did not contain data.accessToken"
            ) from error
    if not isinstance(token, str) or not token:
        raise InputError(f"{mode} auth needs API_TOKEN or --token")
    set_header(
        headers,
        "Authorization",
        f"{'Bearer' if mode == 'bearer' else 'MinecraftSession'} {token}",
    )


def main(argv=None) -> int:
    args = build_parser().parse_intermixed_args(argv)
    config = load_config(args)
    targets = args.target[:]
    positional_method = targets.pop(0).upper() if len(targets) == 2 else None
    if len(targets) != 1:
        raise InputError("Expected [METHOD] <path-or-url>; use --help")
    if positional_method and args.request and positional_method != args.request.upper():
        raise InputError("Positional method conflicts with --request")
    has_body = bool(args.json) or args.data is not None
    method = (
        args.request or positional_method or ("POST" if has_body else "GET")
    ).upper()
    if not re.fullmatch("[A-Z]+", method):
        raise InputError("HTTP method must contain letters only")
    if has_body and method in ("GET", "HEAD"):
        raise InputError(
            f"{method} cannot have a body; use --query or a different method"
        )
    mode = setting(args.auth, config, "API_AUTH", "api-key")
    if args.auth is None and args.api_key is not None:
        mode = "api-key"
    if mode not in ("api-key", "bearer", "minecraft", "none"):
        raise InputError("--auth must be api-key, bearer, minecraft, or none")
    try:
        timeout = float(setting(args.timeout, config, "API_TIMEOUT", "30"))
    except ValueError as error:
        raise InputError("Timeout must be a positive number of seconds") from error
    if not math.isfinite(timeout) or not 0 < timeout <= 2_147_483:
        raise InputError(
            "Timeout must be a positive number of seconds (at most 2147483)"
        )
    base_url = http_url(
        setting(args.base_url, config, "API_BASE_URL", "http://localhost:3000")
    )
    base = urlsplit(base_url)
    base_url = urlunsplit(
        (base.scheme, base.netloc, base.path.rstrip("/") + "/", "", "")
    )
    endpoint = targets[0]
    url = http_url(
        urljoin(
            base_url,
            endpoint if endpoint.startswith("//") else endpoint.removeprefix("/"),
        )
    )
    if mode != "none" and origin(url) != origin(base_url):
        raise InputError(
            "Authenticated URL must match API_BASE_URL; use --base-url or --auth none"
        )
    query = urlencode([pair(item) for item in args.query])
    if query:
        parts = urlsplit(url)
        url = urlunsplit(
            (
                parts.scheme,
                parts.netloc,
                parts.path,
                parts.query + ("&" if parts.query else "") + query,
                "",
            )
        )
    headers = {"accept": "application/json"}
    for header in args.header:
        equals, colon = header.find("="), header.find(":")
        separator = ":" if colon >= 0 and (equals < 0 or colon < equals) else "="
        set_header(headers, *pair(header, separator))
    body = None
    if args.json:
        body = json_body(args.json)
    elif args.data is not None:
        if args.data == "@-":
            body = sys.stdin.buffer.read()
        elif args.data.startswith("@"):
            body = Path(args.data[1:]).read_bytes()
        else:
            body = args.data.encode("utf-8")
    if has_body and "content-type" not in headers:
        headers["content-type"] = "application/json"
    authenticate(headers, mode, config, args, base_url, timeout)
    start = time.perf_counter()
    status, reason, response_headers, data = send(url, method, headers, body, timeout)
    print(
        f"HTTP {status} {reason} ({round((time.perf_counter() - start) * 1000)} ms)",
        file=sys.stderr,
    )
    if args.include:
        for name, value in response_headers.items():
            print(f"{name}: {value}", file=sys.stderr)
        print(file=sys.stderr)
    if args.output:
        Path(args.output).write_bytes(data)
    elif args.raw:
        sys.stdout.buffer.write(data)
    elif data:
        try:
            text = data.decode(
                response_headers.get_content_charset() or "utf-8", errors="replace"
            )
        except LookupError:
            text = data.decode("utf-8", errors="replace")
        try:
            text = json.dumps(json.loads(text), indent=2, ensure_ascii=False)
        except ValueError:
            pass
        sys.stdout.write(text if text.endswith("\n") else text + "\n")
    return 0 if 200 <= status < 300 else 22


if __name__ == "__main__":
    # Make text output consistent even on Windows consoles and redirected pipes.
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stderr.reconfigure(encoding="utf-8", newline="\n")
    try:
        sys.exit(main())
    except InputError as error:
        print(f"api: {error}", file=sys.stderr)
        sys.exit(2)
    except TimeoutError:
        print("api: Request timed out", file=sys.stderr)
        sys.exit(1)
    except (OSError, URLError, HTTPException, RuntimeError, ValueError) as error:
        message = (
            "Request timed out"
            if isinstance(getattr(error, "reason", None), TimeoutError)
            else str(error)
        )
        print(f"api: {message}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
