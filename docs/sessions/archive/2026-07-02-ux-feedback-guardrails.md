# Session — 2026-07-02 — ux-feedback-guardrails

## Done

- **UX audit** (post-Jalon 3, code-level) then the **« feedback & garde-fous »
  slice** on `fix/ux-feedback-guardrails` — the audit's blocking findings,
  web-only:
  - Project errors were 100% silent (`useProjects.error` never rendered) →
    dismissible `AlertBanner` (role="alert", French per-operation messages);
    a failing `list` now shows « Serveur injoignable — vérifie que le serveur
    local est lancé » instead of an indistinguishable empty list.
  - No busy states on multi-MB save/open → `useProjects.busy`,
    « Enregistrement… » (header, disabled) and « Ouverture… » (dialog row,
    all actions locked).
  - Destructive actions unguarded → inline two-step delete (« Supprimer » →
    « Confirmer ? », 4 s auto-revert) and confirm-before-open when a session
    is loaded (« La session actuelle sera remplacée »).
  - Fake detected chips (hardcoded B♭ min / 96 BPM / 4/4 shown as
    machine-detected) removed; Header prop kept for real detection later.
  - Server status dot in the header (`/health` poll, 30 s): hors ligne (red)
    / séparation indisponible (amber — this torch-less PC) / prêt (green).
    `SERVER_URL` extracted to `projects/server-url.ts`, shared with the
    separator factory.
  - One-click re-save once a project exists + « Renommer… » popover.
  - `:focus-visible` rules on transport, header, mixer, projects dialog,
    markers (explicit, matching the app-dialog pattern).
- Full analysis (priorities beyond this slice) delivered in-conversation:
  J2.6 export next, real tempo detection, tempo/pitch/zoom persistence,
  speed trainer, per-project loops, undo.

## Not done / remaining

- Browser click-through of save/open (carried over from J3.3) — now much
  safer to demo thanks to the banners/confirmations.
- Rest of the analysis backlog (export J2.6 first).

## Decisions

- Errors as a dismissible banner (no toast system yet); « unsaved work »
  approximated by « a track is loaded » for the open confirmation.
- No new red token: reused the same accent the separation error already uses.

## Gate status

- typecheck / biome / sheriff / impeccable / react-doctor / knip / jscpd: ✅
  (`pnpm gate` exit 0, also at pre-commit)
- tests (with coverage): ✅ **340 passed** (was 316; +24)
- mutation: **skipped — no `@app/core` change** (web-only slice).

## State to resume from

- **Single next action**: open the PR for `fix/ux-feedback-guardrails`,
  merge, then browser-verify save/open and pick the next slice (recommended:
  **J2.6 export**).
- Gotchas: header now polls `/health` every 30 s (test port `healthFetch`
  injectable); `refresh()` sets `listError`, not `error`.
