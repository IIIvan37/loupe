"""Best-effort model warm-up at server boot (V.3).

The detection models (beat_this, BTC, SongFormer) build lazily on their first
request — but tempo detection fires automatically on import, so the first
detection of every session pays the model load (and, on a first-ever launch,
the weights download). Modal solved this with `@modal.enter`; this is the local
server's equivalent: a daemon thread launched from the lifespan that calls each
available module's `warm()`.

Strictly best-effort: errors are swallowed loader by loader (the lazy build +
503 fallback remains the contract), and the thread is a daemon so it never
delays shutdown. Opt-out with `LOUPE_WARM_MODELS=0`. Each module's loader is
double-check-locked, so warming racing a first request builds the model once.
"""

from __future__ import annotations

import contextlib
import os
import threading
from collections.abc import Callable, Iterable, Mapping, Sequence

Loader = Callable[[], object]


def warm_enabled(value: str | None) -> bool:
    """Warm unless explicitly opted out with LOUPE_WARM_MODELS=0."""
    return value is None or value.strip() != "0"


def warm_models(loaders: Iterable[Loader]) -> None:
    """Call every loader, swallowing failures — one cold model must not block
    the others, and the lazy + 503 path stays the fallback."""
    for load in loaders:
        with contextlib.suppress(Exception):
            load()


def start_model_warmup(
    loaders: Sequence[Loader], *, environ: Mapping[str, str] = os.environ
) -> threading.Thread | None:
    """Launch the warm-up daemon thread; None when opted out or nothing to warm."""
    if not loaders or not warm_enabled(environ.get("LOUPE_WARM_MODELS")):
        return None
    thread = threading.Thread(
        target=warm_models, args=(list(loaders),), name="model-warmup", daemon=True
    )
    thread.start()
    return thread
