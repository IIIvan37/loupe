"""Track-download endpoint for loupe — yt-dlp, optional at runtime.

Implements the HTTP contract the web `http-track-source` adapter speaks:

    POST /download             body = {"url": "..."} (application/json)
      -> 200 application/x-ndjson, streamed line by line:
           {"type":"progress","phase":"downloading"|"transcoding","fraction":0..1}
           {"type":"done","ref","title","duration"?,"uploader"?}   (last line)
           {"type":"error","message"}                              (on failure)

The heavy lifting is **yt-dlp** (YouTube / SoundCloud extraction); this module is
only the glue + transport. `main` imports it lazily so a host without yt-dlp
still serves the rest — `/download` then answers with an NDJSON error line.

The fetched audio is parked in the SAME content-addressed `/audio` store the
project blobs use (via `projects.store_audio`), so the web client resolves the
bytes with a plain `GET /audio/{ref}`. We ask yt-dlp for `bestaudio[ext=m4a]`
so the common case needs no ffmpeg re-encode — the downloaded m4a/AAC decodes
straight in the browser's `decodeAudioData`.

Single-user, localhost — no auth. The host allowlist mirrors the core's
`isSupportedSourceUrl`: yt-dlp is a powerful fetcher, so we never point it at an
arbitrary URL.
"""

from __future__ import annotations

import json
import logging
import queue
import tempfile
import threading
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import urlparse

import yt_dlp
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .projects import store_audio

logger = logging.getLogger("loupe.download")
router = APIRouter()

# Mirror of the core's supported-source policy: only these hosts (and their
# subdomains) are fetchable. Keeps yt-dlp from being used as an open proxy.
_SUPPORTED_HOSTS = ("youtube.com", "youtu.be", "soundcloud.com")


def _is_supported(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    return any(host == h or host.endswith(f".{h}") for h in _SUPPORTED_HOSTS)


def _event(payload: dict) -> bytes:
    return (json.dumps(payload) + "\n").encode("utf-8")


def progress_fraction(status: dict) -> float | None:
    """The download completion in [0, 1] from a yt-dlp progress hook.

    None unless we're downloading and have both a total and a done count — a
    missing/zero total (yt-dlp not yet knowing the size) yields no fraction.
    """
    if status.get("status") != "downloading":
        return None
    total = status.get("total_bytes") or status.get("total_bytes_estimate")
    done = status.get("downloaded_bytes")
    if total and done is not None:
        return min(1.0, done / total)
    return None


def _make_options(out_dir: Path, on_progress) -> dict:
    """yt-dlp options: audio-only, no playlist, m4a-preferred, progress-hooked."""
    return {
        "format": "bestaudio[ext=m4a]/bestaudio",
        "outtmpl": str(out_dir / "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [on_progress],
    }


def _extract(url: str, out_dir: Path, on_progress) -> dict:
    """Download the track once, returning yt-dlp's info dict."""
    # yt-dlp types its options as a private TypedDict and returns a private
    # `_InfoDict`; we treat both as plain dicts at the boundary.
    with yt_dlp.YoutubeDL(_make_options(out_dir, on_progress)) as ydl:  # pyright: ignore[reportArgumentType]
        return ydl.extract_info(url, download=True)  # pyright: ignore[reportReturnType]


def _download(url: str, out_dir: Path, events: queue.Queue) -> None:
    """Fetch on a worker thread, pushing progress onto `events`.

    yt-dlp's progress hook fires on the same thread; we translate it into
    `downloading` fractions. A `('done', info)` or `('error', message)` tuple
    ends the stream. A stale extractor (a service changed its player) surfaces a
    clear message telling the operator to run `pip install -U yt-dlp` themselves —
    a request never triggers a package install (that would be remote code pulled
    over the network and executed in-process).
    """

    def on_progress(status: dict) -> None:
        fraction = progress_fraction(status)
        if fraction is not None:
            events.put(("progress", fraction))

    try:
        info = _extract(url, out_dir, on_progress)
        events.put(("done", info))
    except yt_dlp.utils.DownloadError:  # pyright: ignore[reportAttributeAccessIssue]
        events.put(
            (
                "error",
                "download failed — the extractor may be out of date; "
                "run `pip install -U yt-dlp` in the server venv and retry",
            )
        )
    except Exception:  # noqa: BLE001 - logged server-side, generic to the client
        logger.exception("download failed")
        events.put(("error", "download failed"))


def _download_stream(url: str) -> Iterator[bytes]:
    """Run the download, streaming live NDJSON progress then the parked-ref done.

    FastAPI iterates this sync generator in a threadpool; the fetch runs on a
    further worker thread so we can yield its progress as it arrives (mirrors
    `/separate`).
    """
    if not _is_supported(url):
        yield _event({"type": "error", "message": f"unsupported source URL: {url}"})
        return

    yield _event({"type": "progress", "phase": "downloading", "fraction": 0.0})

    with tempfile.TemporaryDirectory(prefix="loupe-download-") as tmp:
        out_dir = Path(tmp)
        events: queue.Queue = queue.Queue()
        worker = threading.Thread(target=_download, args=(url, out_dir, events), daemon=True)
        worker.start()

        info = None
        while True:
            kind, payload = events.get()
            if kind == "progress":
                yield _event({"type": "progress", "phase": "downloading", "fraction": payload})
            elif kind == "error":
                yield _event({"type": "error", "message": payload})
                return
            else:  # done
                info = payload
                break

        # Extraction/parking step — signalled as `transcoding` so the client's
        # progress bar completes even though the common m4a path needs no
        # re-encode.
        yield _event({"type": "progress", "phase": "transcoding", "fraction": 1.0})

        files = list(out_dir.iterdir())
        if not files:
            yield _event({"type": "error", "message": "download produced no file"})
            return
        ref = store_audio(files[0].read_bytes())

    done = {"type": "done", "ref": ref, "title": info.get("title") or "Sans titre"}
    if info.get("duration") is not None:
        done["duration"] = float(info["duration"])
    if info.get("uploader"):
        done["uploader"] = info["uploader"]
    yield _event(done)


@router.post("/download")
async def download(request: Request) -> StreamingResponse:
    body = await request.json()
    url = body.get("url", "")
    return StreamingResponse(
        _download_stream(url),
        media_type="application/x-ndjson",
    )
