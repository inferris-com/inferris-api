"""Isolated HTTP/CLI tests: python -B -m unittest discover -s scripts -p api_test.py -v."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

SCRIPT = Path(__file__).with_name("api.py").resolve()
DEV_KEY = "00000000-0000-0000-0000-000000000001.dev"


class Handler(BaseHTTPRequestHandler):
    def handle_request(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        url = urlsplit(self.path)
        status = 200
        headers = {"Content-Type": "application/json"}
        if url.path == "/auth/login":
            self.server.logins += 1
            if json.loads(body) != {
                "usernameOrEmail": "Developer",
                "password": "dev",
            } or self.headers.get("X-Api-Key"):
                status, data = 400, b"invalid login request"
            else:
                data = b'{"data":{"accessToken":"test-token"}}'
        elif url.path == "/slow":
            time.sleep(0.2)
            data = b"late"
        elif url.path == "/redirect":
            status, data = 302, b"redirect"
            headers["Location"] = "/auth/login"
        elif url.path == "/binary":
            data = bytes([0, 128, 255, 10])
        elif url.path == "/empty":
            status, data = 204, b""
        else:
            if url.path == "/error":
                status = 422
            data = json.dumps(
                {
                    "method": self.command,
                    "path": url.path,
                    "query": parse_qsl(url.query, keep_blank_values=True),
                    "headers": {
                        name.lower(): value for name, value in self.headers.items()
                    },
                    "body": body.decode("utf-8"),
                }
            ).encode("utf-8")
        self.send_response(status)
        for name, value in headers.items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass  # The timeout test intentionally closes the connection.

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = handle_request

    def log_message(self, *args):
        pass


class ClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="inferris-api-client-")
        cls.directory = Path(cls.temp.name)
        cls.env_file = cls.directory / ".env"
        cls.env_file.write_text(
            "API_KEY=file-key\nAPI_USERNAME=Developer\nAPI_PASSWORD=dev\n",
            encoding="utf-8",
        )
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.logins = 0
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def run_client(self, *args, stdin=b"", env=None, no_env=False):
        clean_env = {
            name: value
            for name, value in os.environ.items()
            if not name.startswith("API_")
        }
        clean_env.update(env or {})
        clean_env["PYTHONDONTWRITEBYTECODE"] = "1"
        config = ["--no-env"] if no_env else ["--env", str(self.env_file)]
        return subprocess.run(
            [sys.executable, str(SCRIPT), *config, "--base-url", self.base_url, *args],
            input=stdin,
            capture_output=True,
            cwd=self.directory,
            env=clean_env,
            timeout=10,
            check=False,
        )

    def response(self, result):
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        return json.loads(result.stdout)

    def test_configuration_precedence_and_dev_default(self):
        self.assertEqual(
            self.response(self.run_client("/echo"))["headers"]["x-api-key"], "file-key"
        )
        self.assertEqual(
            self.response(self.run_client("/echo", env={"API_KEY": "environment-key"}))[
                "headers"
            ]["x-api-key"],
            "environment-key",
        )
        self.assertEqual(
            self.response(
                self.run_client(
                    "GET",
                    "/echo",
                    "--api-key",
                    "flag-key",
                    env={"API_KEY": "environment-key", "API_AUTH": "bearer"},
                )
            )["headers"]["x-api-key"],
            "flag-key",
        )
        self.assertEqual(
            self.response(self.run_client("/echo", no_env=True))["headers"][
                "x-api-key"
            ],
            DEV_KEY,
        )

    def test_missing_default_env_file_and_help(self):
        standalone = self.directory / "standalone" / "api.py"
        standalone.parent.mkdir()
        standalone.write_bytes(SCRIPT.read_bytes())
        result = subprocess.run(
            [sys.executable, str(standalone), "/echo", "--base-url", self.base_url],
            capture_output=True,
            env={
                name: value
                for name, value in os.environ.items()
                if not name.startswith("API_")
            },
            timeout=10,
            check=False,
        )
        self.assertEqual(self.response(result)["headers"]["x-api-key"], DEV_KEY)
        help_result = self.run_client("--env", "missing.env", "--help")
        self.assertEqual(help_result.returncode, 0)
        self.assertIn(b"usage:", help_result.stdout)

    def test_query_encoding_and_explicit_headers(self):
        response = self.response(
            self.run_client(
                "/echo?existing=yes",
                "-q",
                "search=a & b",
                "-q",
                "tag=one",
                "-q",
                "tag=two",
                "-q",
                "empty=",
                "-H",
                "Authorization: Bearer manual=token",
                "-H",
                "X-Test=a=b: c",
            )
        )
        self.assertEqual(
            response["query"],
            [
                ["existing", "yes"],
                ["search", "a & b"],
                ["tag", "one"],
                ["tag", "two"],
                ["empty", ""],
            ],
        )
        self.assertEqual(response["headers"]["authorization"], "Bearer manual=token")
        self.assertNotIn("x-api-key", response["headers"])
        self.assertEqual(response["headers"]["x-test"], "a=b: c")
        self.assertEqual(
            self.response(self.run_client("/echo", "-H", "x-api-key=custom"))[
                "headers"
            ]["x-api-key"],
            "custom",
        )

    def test_json_fields_types_strings_and_unicode(self):
        response = self.response(
            self.run_client(
                "/echo",
                "-j",
                "name=Test Player",
                "-j",
                "count=2",
                "-j",
                "active=false",
                "-j",
                "missing=null",
                "-j",
                "ids=[1,2]",
                "-j",
                "id:=123",
                "-j",
                "text:=true",
                "-j",
                "label=Español",
                "-j",
                "special=NaN",
            )
        )
        self.assertEqual(response["method"], "POST")
        self.assertEqual(response["headers"]["content-type"], "application/json")
        self.assertEqual(
            json.loads(response["body"]),
            {
                "name": "Test Player",
                "count": 2,
                "active": False,
                "missing": None,
                "ids": [1, 2],
                "id": "123",
                "text": "true",
                "label": "Español",
                "special": "NaN",
            },
        )

    def test_body_files_stdin_and_methods(self):
        (self.directory / "request.json").write_bytes(b'{"nested":{"value":"hello"}}')
        self.assertEqual(
            self.response(self.run_client("PATCH", "/echo", "-d", "@request.json"))[
                "body"
            ],
            '{"nested":{"value":"hello"}}',
        )
        response = self.response(
            self.run_client(
                "/echo",
                "-X",
                "PUT",
                "-d",
                "@-",
                "-H",
                "Content-Type=text/plain",
                stdin=b"hello from stdin",
            )
        )
        self.assertEqual(response["method"], "PUT")
        self.assertEqual(response["body"], "hello from stdin")
        self.assertEqual(response["headers"]["content-type"], "text/plain")
        self.assertEqual(
            self.response(self.run_client("/echo", "-d", ""))["method"], "POST"
        )
        self.assertEqual(
            self.response(self.run_client("POST", "-j", "name=hello", "/echo"))[
                "method"
            ],
            "POST",
        )

    def test_authentication_modes(self):
        previous = self.server.logins
        self.assertEqual(
            self.response(self.run_client("/echo", "--auth", "bearer"))["headers"][
                "authorization"
            ],
            "Bearer test-token",
        )
        self.assertEqual(self.server.logins, previous + 1)
        self.assertEqual(
            self.response(
                self.run_client("/echo", "--auth", "bearer", "--token", "override")
            )["headers"]["authorization"],
            "Bearer override",
        )
        self.assertEqual(self.server.logins, previous + 1)
        self.assertEqual(
            self.response(
                self.run_client("/echo", "--auth", "minecraft", "--token", "session")
            )["headers"]["authorization"],
            "MinecraftSession session",
        )
        self.assertNotIn(
            "x-api-key",
            self.response(self.run_client("/echo", "--auth", "none"))["headers"],
        )

    def test_base_paths_urls_and_origin_checks(self):
        self.assertEqual(
            self.response(
                self.run_client("/echo", "--base-url", self.base_url + "/v1")
            )["path"],
            "/v1/echo",
        )
        self.assertEqual(
            self.response(self.run_client(self.base_url + "/echo"))["path"], "/echo"
        )
        foreign = self.run_client("http://example.invalid/echo")
        self.assertEqual(foreign.returncode, 2)
        self.assertIn(b"must match API_BASE_URL", foreign.stderr)

    def test_http_failures_redirects_empty_and_head(self):
        failure = self.run_client("/error")
        self.assertEqual(failure.returncode, 22)
        self.assertEqual(json.loads(failure.stdout)["path"], "/error")
        self.assertIn(b"HTTP 422", failure.stderr)
        previous = self.server.logins
        redirect = self.run_client("/redirect")
        self.assertEqual(redirect.returncode, 22)
        self.assertEqual(redirect.stdout, b"redirect\n")
        self.assertEqual(self.server.logins, previous)
        for args in (("/empty",), ("HEAD", "/echo")):
            result = self.run_client(*args)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, b"")

    def test_raw_output_files_and_response_headers(self):
        data = bytes([0, 128, 255, 10])
        self.assertEqual(self.run_client("/binary", "--raw").stdout, data)
        saved = self.run_client("/binary", "-o", "response.bin")
        self.assertEqual(saved.returncode, 0)
        self.assertEqual(saved.stdout, b"")
        self.assertEqual((self.directory / "response.bin").read_bytes(), data)
        headers = self.run_client("/echo", "-i")
        self.response(headers)
        self.assertIn(b"content-type: application/json", headers.stderr.lower())

    def test_invalid_inputs(self):
        for args in (
            (),
            ("/echo", "--unknown"),
            ("/echo", "-q", "invalid"),
            ("/echo", "--timeout", "0"),
            ("/echo", "--auth", "invalid"),
            ("GET", "/echo", "-d", "body"),
            ("/echo", "-d", "{}", "-j", "x=1"),
            ("POST", "/echo", "-X", "PATCH"),
            ("/echo", "--base-url", "file:///tmp"),
            ("/echo", "-H", "X-Test=bad\nvalue"),
            ("/echo", "--no-env"),
        ):
            with self.subTest(args=args):
                self.assertEqual(self.run_client(*args).returncode, 2)

    def test_timeouts_and_file_errors(self):
        timeout = self.run_client("/slow", "--timeout", "0.05")
        self.assertEqual(timeout.returncode, 1)
        self.assertIn(b"timed out", timeout.stderr)
        self.assertEqual(self.run_client("/echo", "-d", "@missing.json").returncode, 1)

    @unittest.skipUnless(os.name == "nt", "PowerShell is Windows-specific")
    def test_powershell_arguments(self):
        def quote(value):
            return "'" + str(value).replace("'", "''") + "'"

        # Exercise both the platform-independent command and the optional shortcut.
        for executable in ((sys.executable, SCRIPT), (SCRIPT.with_suffix(".cmd"),)):
            command = "& " + " ".join(quote(item) for item in executable)
            command += f" /echo --env {quote(self.env_file)} --base-url {quote(self.base_url)} --auth none -j 'name=Test Player' -j 'message=hello & world | foo' -q 'search=a & b' -H 'X-Test=a=b: c'; exit $LASTEXITCODE"
            encoded = base64.b64encode(command.encode("utf-16le")).decode("ascii")
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-EncodedCommand",
                    encoded,
                ],
                capture_output=True,
                cwd=self.directory,
                timeout=10,
                check=False,
            )
            response = self.response(result)
            self.assertEqual(
                json.loads(response["body"]),
                {"name": "Test Player", "message": "hello & world | foo"},
            )
            self.assertEqual(response["query"], [["search", "a & b"]])
            self.assertEqual(response["headers"]["x-test"], "a=b: c")


if __name__ == "__main__":
    unittest.main()
