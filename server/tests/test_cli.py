"""The `loupe` entry point (distribution D3).

Thin launcher: pick the port (default 6173 — 5173 belongs to Vite dev), refuse
a busy port with an actionable message, open the browser once the server
answers `/health`, hand off to uvicorn. Everything effectful is injected so the
tests stay socket-fast and browser-free.
"""

from __future__ import annotations

import socket

from app.cli import DEFAULT_PORT, build_parser, main, open_when_ready, port_is_free


class TestParser:
    def test_defaults_to_the_loupe_port(self) -> None:
        args = build_parser().parse_args([])
        assert args.port == DEFAULT_PORT == 6173
        assert args.no_browser is False

    def test_accepts_a_custom_port_and_no_browser(self) -> None:
        args = build_parser().parse_args(["--port", "7000", "--no-browser"])
        assert args.port == 7000
        assert args.no_browser is True


class TestPortIsFree:
    def test_true_on_an_unused_port(self) -> None:
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            free_port = probe.getsockname()[1]
        assert port_is_free(free_port)

    def test_false_on_a_bound_port(self) -> None:
        with socket.socket() as taken:
            taken.bind(("127.0.0.1", 0))
            taken.listen(1)
            port = taken.getsockname()[1]
            assert not port_is_free(port)


class TestMain:
    def test_busy_port_fails_fast_with_an_actionable_message(self, capsys) -> None:
        with socket.socket() as taken:
            taken.bind(("127.0.0.1", 0))
            taken.listen(1)
            port = taken.getsockname()[1]
            served: list[dict] = []
            code = main(["--port", str(port)], serve=lambda *a, **kw: served.append(kw))
        assert code == 1
        assert served == []
        assert "--port" in capsys.readouterr().err

    def test_serves_the_app_on_the_loopback_and_requested_port(self) -> None:
        served: list[dict] = []
        code = main(
            ["--port", "0", "--no-browser"],
            serve=lambda app, **kw: served.append({"app": app, **kw}),
        )
        assert code == 0
        assert served[0]["app"] == "app.main:app"
        assert served[0]["host"] == "127.0.0.1"
        assert served[0]["port"] == 0

    def test_no_browser_skips_the_opener(self) -> None:
        watchers: list[str] = []
        main(
            ["--port", "0", "--no-browser"],
            serve=lambda *a, **kw: None,
            spawn_opener=lambda url: watchers.append(url),
        )
        assert watchers == []

    def test_spawns_the_browser_opener_with_the_local_url(self) -> None:
        watchers: list[str] = []
        main(
            ["--port", "0"],
            serve=lambda *a, **kw: None,
            spawn_opener=lambda url: watchers.append(url),
        )
        assert watchers == ["http://localhost:0"]


class TestOpenWhenReady:
    def test_opens_once_the_health_probe_answers(self) -> None:
        opened: list[str] = []
        answers = iter([False, False, True])
        open_when_ready(
            "http://localhost:6173",
            opener=opened.append,
            probe=lambda _url: next(answers),
            interval_seconds=0,
            deadline_seconds=1,
        )
        assert opened == ["http://localhost:6173"]

    def test_gives_up_quietly_when_the_server_never_answers(self) -> None:
        opened: list[str] = []
        open_when_ready(
            "http://localhost:6173",
            opener=opened.append,
            probe=lambda _url: False,
            interval_seconds=0,
            deadline_seconds=0,
        )
        assert opened == []
