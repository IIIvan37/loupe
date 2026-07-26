"""`loupe` — the distributable entry point (distribution D3).

Thin launcher over the FastAPI app: pick the port, refuse a busy one with an
actionable message, open the browser once `/health` answers, hand off to
uvicorn (which owns Ctrl-C). The heavy ML stacks stay lazy imports — the
distributed environment only carries fastapi/uvicorn/yt-dlp, and the analysis
endpoints answer "unavailable" the web app never calls (analyses run on Modal).
"""

from __future__ import annotations

import argparse
import contextlib
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from collections.abc import Callable

# 5173 belongs to Vite dev; 6173 keeps the mnemonic and the two can coexist.
DEFAULT_PORT = 6173


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="loupe",
        description="Démarre l'atelier loupe et ouvre le navigateur.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"port d'écoute local (défaut : {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="ne pas ouvrir le navigateur au démarrage",
    )
    return parser


def port_is_free(port: int, host: str = "127.0.0.1") -> bool:
    """True when nothing listens on `host:port` (bind probe, released at once)."""
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
        except OSError:
            return False
    return True


def _health_answers(url: str) -> bool:
    with (
        contextlib.suppress(OSError),
        urllib.request.urlopen(f"{url}/health", timeout=1) as response,  # noqa: S310
    ):
        return bool(response.status == 200)
    return False


def open_when_ready(
    url: str,
    *,
    opener: Callable[[str], object] = webbrowser.open,
    probe: Callable[[str], bool] = _health_answers,
    interval_seconds: float = 0.2,
    deadline_seconds: float = 15,
) -> None:
    """Open `url` as soon as the server answers; give up quietly past the
    deadline (the user still has the printed URL)."""
    deadline = time.monotonic() + deadline_seconds
    while True:
        if probe(url):
            opener(url)
            return
        if time.monotonic() >= deadline:
            return
        time.sleep(interval_seconds)


def _spawn_opener(url: str) -> None:
    threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()


def main(
    argv: list[str] | None = None,
    *,
    serve: Callable[..., object] | None = None,
    spawn_opener: Callable[[str], None] = _spawn_opener,
) -> int:
    args = build_parser().parse_args(argv)
    if args.port != 0 and not port_is_free(args.port):
        print(
            f"loupe : le port {args.port} est déjà occupé — relancer avec --port <numéro>.",
            file=sys.stderr,
        )
        return 1
    url = f"http://localhost:{args.port}"
    print(f"loupe : atelier sur {url} (Ctrl-C pour quitter)")
    if not args.no_browser:
        spawn_opener(url)
    run = serve
    if run is None:  # pragma: no cover — the real uvicorn handoff
        import uvicorn

        run = uvicorn.run
    run("app.main:app", host="127.0.0.1", port=args.port, log_level="info")
    return 0
