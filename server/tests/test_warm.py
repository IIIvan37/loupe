"""Best-effort model warm-up at boot (V.3).

`app.warm` owns the decidable part of the warm-up: the opt-out switch, the
best-effort loader sweep (one failing model must not block the others), and the
daemon-thread launch. The ML modules only contribute a `warm()` callable each.
Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

from app.warm import start_model_warmup, warm_enabled, warm_models


class TestWarmEnabled:
    def test_defaults_to_enabled_when_unset(self):
        assert warm_enabled(None) is True

    def test_zero_opts_out(self):
        assert warm_enabled("0") is False

    def test_zero_with_whitespace_opts_out(self):
        assert warm_enabled(" 0 ") is False

    def test_any_other_value_stays_enabled(self):
        assert warm_enabled("1") is True
        assert warm_enabled("") is True
        assert warm_enabled("no") is True


class TestWarmModels:
    def test_calls_every_loader_in_order(self):
        called: list[str] = []
        warm_models([lambda: called.append("a"), lambda: called.append("b")])
        assert called == ["a", "b"]

    def test_a_failing_loader_does_not_block_the_next(self):
        called: list[str] = []

        def boom() -> None:
            raise RuntimeError("weights unreachable")

        warm_models([boom, lambda: called.append("b")])
        assert called == ["b"]


class TestStartModelWarmup:
    def test_runs_loaders_on_a_daemon_thread(self):
        called: list[str] = []
        thread = start_model_warmup([lambda: called.append("a")], environ={})
        assert thread is not None
        assert thread.daemon is True
        thread.join(timeout=5)
        assert called == ["a"]

    def test_opt_out_starts_nothing(self):
        called: list[str] = []
        thread = start_model_warmup(
            [lambda: called.append("a")], environ={"LOUPE_WARM_MODELS": "0"}
        )
        assert thread is None
        assert called == []

    def test_no_loaders_starts_nothing(self):
        assert start_model_warmup([], environ={}) is None
