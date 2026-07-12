# Session — 2026-07-12 — split-shell-spec (O.3)

## Done
- **O.3** : `workstation-shell.spec.tsx` (2 438 lignes, 115 tests dans un seul
  `describe`) découpé **par parcours** en 9 fichiers colocalisés — aucun test
  réécrit, uniquement déplacés (stratégie d'intégration conservée) :
  - `workstation-shell.spec.tsx` — 3 tests (landmarks, onglets, empty-state)
  - `workstation-shell.import.spec.tsx` — 20 (picker armé, URL, drop, tags,
    import supplanté, échec de décodage)
  - `workstation-shell.tempo.spec.tsx` — 19 (détection, champ BPM, tap,
    ré-ancrage, métronome, count-in, reset à l'import)
  - `workstation-shell.transport.spec.tsx` — 11 (play/pause, timecode,
    sliders, marqueurs, seek waveform)
  - `workstation-shell.shortcuts.spec.tsx` — 16 (Espace, flèches, M/L/K/T,
    zoom, gardes dialog/champ/repeat)
  - `workstation-shell.loops.spec.tsx` — 11 (A/B, speed trainer, boucles
    sauvegardées)
  - `workstation-shell.stems.spec.tsx` — 8 (séparation, santé serveur,
    téléchargements WAV, export)
  - `workstation-shell.chords.spec.tsx` — 7 (restauration grille, suivi
    pitch, surbrillance mesure)
  - `workstation-shell.projects.spec.tsx` — 20 (save/reopen, restauration
    loupe/boucles/tempo/zoom, unload guard, dialogue Projets)
- Fixtures communes extraites dans **`shell-test-kit.tsx`** colocalisé :
  fakes des ports (engine, stems, separator, stores projets, health),
  `renderShell`, `importTrack`, `saveProjectAs`, `pointerGesture`,
  `installShellHooks()` (pointer-capture jsdom, `localStorage.clear`,
  `vi.restoreAllMocks`) appelé en tête de chaque spec. Les helpers
  mono-parcours (`stubDownload`, `fillImportUrl`, `shellRoot`,
  `fileTransfer`, `unloadPrevented`) restent locaux à leur spec.
- react-doctor sur le kit (nouveau fichier non-`.spec`, donc scanné) :
  `tapThrice` déroulé (3 taps explicites — la séquentialité horloge mockée
  était un faux positif « await in loop ») ; `deslop/unused-file` ignoré pour
  le kit dans `doctor.config.json` (même cas que le wrapper i18n de test).

## Not done / remaining
- **O.4** — extraire le fenêtrage TIMESTEP de `server/app/chords.py` en
  `btc_windows.py` pur testé (modèle `chord_spans.py`).
- **O.5** — basses code groupées : `AbortSignal` propagé dans
  `postWavForJson`, convention coverage `create-chord-detector.ts`,
  factorisation du boilerplate Popover (jscpd).

## Decisions
- Le kit de test partagé est un `.tsx` (JSX dans `renderShell`) nommé
  `shell-test-kit.tsx` ; il n'exporte que les symboles réellement consommés
  par au moins une spec (knip-propre), le reste demeure privé au module.
- Les hooks partagés passent par un `installShellHooks()` explicite plutôt
  que des hooks au top-level du module importé (enregistrement implicite
  fragile en vitest).

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1047 tests** (98 fichiers) — total inchangé
  avant/après découpage, aucun test perdu ni dupliqué.
- mutation (Stryker, local, if core touched) : **skipped** — core intouché
  (déplacement de specs web uniquement).
- biome / sheriff / knip / jscpd / impeccable / react-doctor / check:tokens : ✅

## State to resume from
- **Single next action** : ouvrir la PR O.3 puis attaquer **O.4** sur une
  branche `feat/o4-btc-windows` — extraire le calcul padding/fenêtres de
  [chords.py:150](../../server/app/chords.py#L150) en module pur
  `btc_windows.py` testé (le venv serveur vit dans `server/` — voir la
  mémoire « venv survives dir rename »).
- Gotchas : le kit étant hors `*.spec.tsx`, tout nouveau helper partagé y est
  scanné par react-doctor ; `your-song-elton-john-chart.pdf` traîne non
  suivi à la racine (fichier utilisateur, ne pas committer).
