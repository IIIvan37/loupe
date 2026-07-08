# Session — 2026-07-08 — web-user-trust-lot-g

## Done
- **Lot G (roadmap-excellence-2) complete** on branch `feat/web-user-trust-lot-g`
  (off `main`, Lot F merged as PR #70) — the three highest-impact UX frictions,
  all web-only (no core touched).
- **G.1 — two-step confirm on marker/loop removal.** The `EntryRow` remove
  button in [analysis-panel.tsx](../../packages/web/src/app/analysis-panel/analysis-panel.tsx)
  now arms a « Confirmer ? » on the SAME relabeled button (focus preserved,
  blur disarms, 4 s auto-revert) — the projects-dialog `RowAction` pattern,
  reusing `useTwoStepConfirm`. One armed removal at a time across both lists,
  keys prefixed `marker:`/`loop:` so ids can never collide across kinds. New
  ids `markers.confirm-remove` / `loops.confirm-remove`; armed face styled
  `.entryConfirm` (destructive accent, inset outline — no geometry shift).
- **G.2 — error dead-ends opened.** (a) The import error stage
  ([waveform-view.tsx](../../packages/web/src/app/waveform/waveform-view.tsx))
  now shows a translated plain-words headline (`waveform.import-error`), keeps
  the decoder's technical detail beside it, and offers « Importer un autre
  fichier » (`waveform.reimport` → `openFilePicker`, threaded
  shell → ShellMain → ShellStage). (b) A failed tempo detection gets a
  « Réessayer » button (`tempo.retry`) that re-runs the exact auto-detect flow.
- **`use-tempo-detection.ts` extracted** ([new hook](../../packages/web/src/app/workstation-shell/use-tempo-detection.ts)):
  the detect → seat-metronome flow (auto-run on fresh PCM, one-shot
  suppress-on-open guard, retry, octave fold) moved out of `WorkstationShell` —
  wiring the retry had pushed the shell over react-doctor's large-component
  threshold (311 lines); the extraction cleared it.
- **G.3 — unsupported-drop feedback.** `useFileDrop` gains a required
  `onRejected` callback (fires when a drop carries files but none is audio;
  text/link drops stay silent). The shell shows a dismissible « Format non
  supporté — déposer un fichier audio. » `AlertBanner` (`drop.unsupported`) —
  banner = the documented error channel; toasts stay success-only.
- **/code-review (high) found 2 real bugs, both fixed test-first:**
  1. A successful retry (or a slow auto-detect resolving late) called
     `metronome.enable`, whose `mixer.restore([piste, métronome])` **wiped the
     separated stems** already in the mixer. Fix: the hook reads « does a
     separation own the mix ? » (`stemsReady`) through a ref **at resolve
     time** — the analysis still lands (BPM/grid/map) but the mix stays
     intact. This also closes a pre-existing race (slow detect finishing after
     a separation). Mirrors the restore path's `seatMetronome` (`attach` vs
     `enable`) precedent.
  2. The drop warning survived a successful picker/URL import (stale « format
     non supporté » over a loaded track). Fix: any import reaching `loading`
     clears it (render-adjust pattern, like the projects dialog's disarm).
  Plus one simplification (tempo-panel's two adjacent `error !==
  undefined` blocks merged into one fragment).

## Not done / remaining
- **Browser-verify pending** (jsdom covers the flows; worth a quick eye pass):
  armed « Confirmer ? » face in the tight sidebar rows, the error-stage layout
  inside the zoom stage (`.errorStage` renders where the fixed-height waveform
  container would), banner stacking with the header banners.
- The tempo error message itself is still the raw server/decoder string
  (untranslated) — only import got the plain-words treatment; the roadmap only
  asked for the retry CTA on tempo.
- After a retry succeeds **with a separation already loaded**, the click is NOT
  seated (deliberate — no `attach` possible without the stem sources at hand;
  re-separating seats it). Documented in the hook's comment.

## Decisions
- **`metronome.enable` is un-separated seating only** — any late/retried
  detection must not reshape a mixer a separation owns; ownership is read at
  promise-resolve time, not call time. (Same doctrine as `seatMetronome` in
  project-session.)
- **Banner vs toast**: a rejected drop is an error-channel event → AlertBanner,
  keeping toasts the quiet success channel (D.3 decision upheld).
- Lot G shipped as **one branch/one PR** (same shape as Lot F).

## Gate status
- typecheck: green.
- tests (with coverage): **666 passed** (71 files); web coverage 95.71 % /
  88.72 % (branches).
- mutation (Stryker, local): **skipped — no `@app/core` change** (web-only lot;
  verified `packages/core` untouched in the diff).
- biome / sheriff / knip / jscpd: all green; jscpd **5 clones** (unchanged);
  react-doctor **0 issues** (the shell split cleared the new warning).
  `i18n:extract` run (152 messages, 6 new ids).

## State to resume from
- **Single next action**: push `feat/web-user-trust-lot-g` and open the PR;
  after merge, start **Lot H** (a11y des opérations longues — `role="status"`
  on the separation progress + tempo « Analyse… », announce the detected BPM;
  ~½ session) per [roadmap-excellence-2](../roadmap-excellence-2.md).
- Gotchas: `useFileDrop`'s second param is **required** — any future caller
  must decide its rejection feedback. The retry button only renders when
  `tempo.error` is set AND the track is loaded (TempoPanel is `isLoaded`-gated).
