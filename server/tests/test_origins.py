"""Unit tests for the shared browser-origin allowlist (env-driven)."""

from __future__ import annotations

import pytest

from app.origins import allowed_origins, env_list


class TestAllowedOrigins:
    def test_defaults_to_the_dev_origins_when_the_env_is_unset(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("LOUPE_ALLOWED_ORIGINS", raising=False)
        assert allowed_origins() == [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    def test_reads_a_comma_separated_allowlist_from_the_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("LOUPE_ALLOWED_ORIGINS", "https://loupe.example,http://localhost:5173")
        assert allowed_origins() == [
            "https://loupe.example",
            "http://localhost:5173",
        ]

    def test_a_wildcard_entry_is_dropped_not_forwarded(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # '*' would flip CORSMiddleware to allow-all (and Modal has no
        # OriginGuard backstop) — fail closed instead.
        monkeypatch.setenv("LOUPE_ALLOWED_ORIGINS", "*")
        assert allowed_origins() == []

    def test_trims_whitespace_and_drops_empty_entries(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A trailing comma or spaces around entries must not admit '' as an
        # origin (CORSMiddleware would treat it as a real value).
        monkeypatch.setenv("LOUPE_ALLOWED_ORIGINS", " https://loupe.example , ,")
        assert allowed_origins() == ["https://loupe.example"]


class TestEnvList:
    def test_an_env_var_that_is_all_separators_falls_back_to_nothing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Explicitly-set-but-empty stays empty: the operator said "no entries",
        # which must not silently reopen the defaults.
        monkeypatch.setenv("LOUPE_TEST_LIST", ",,")
        assert env_list("LOUPE_TEST_LIST", "a,b") == []
