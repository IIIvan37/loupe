# Session — 2026-07-31 — cliquet foreign-css à 0 (ADR 0013, règle 5 soldée)

## Done

- **`MAX_FOREIGN_CSS_IMPORTS` 10 → 0** (branche `refactor/foreign-css-zero`,
  PR #325 ouverte ; baissé AVANT le refactor) — plus aucun composant
  n'importe le `module.css` d'un autre :
  - Régions shell : `shell-main`/`shell-stage`/`shell-drop-layer` extraient
    leurs blocs ; `workstation-shell.module.css` se réduit à `.shell`.
  - Confirm-dialogs : la rangée `actions`/`cancel`/`confirm` monte dans le
    kit `app-dialog` (précédent : format-help, shortcuts la composaient
    déjà) ; chaque dialog compose son css propre.
  - `stepper-field` : compose le vocabulaire `field` du transport-bar
    (partagé avec la rangée cents du bar), emporte ses blocs stepper ;
    dossier-composant.
  - `gain-fader` : sort ses blocs dB/fader de `stem-headers.module.css` ;
    dossier-composant.
  - `import-menu` : compose les skins d'action du header. `live-status` :
    compose `srOnly` du kit controls.

## Not done / remaining

- Feuille B du nettoyage (session en cours, branche suivante) : balayage
  dossiers-composant sur TOUS les dossiers restants (waveform, markers,
  tempo, mixer, loops, separation, transport-bar, header, analyser, account,
  projects, lib…) + descente du cliquet `folder-shape` (11 aujourd'hui).

## Decisions

- Le vocabulaire partagé d'une feature (field du transport-bar, skins
  d'action du header) reste dans la feuille de LA feature et se compose via
  `@/` — pas de kit global pour un partage à deux fichiers.

## Gate status

- `pnpm gate` ✅ complet (tampon `a22b2b0c`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (1158).
- `pnpm --filter @app/web build` ✅ (vérifie les `composes`).
- mutation : **sans objet** — aucune source core touchée.
- sonar : analyse PR #325 en cours au moment du rapport — à relire avant
  merge.

## State to resume from

- **Single next action** : feuille B — balayage dossiers-composant tous
  dossiers + descente `folder-shape`, puis retour aux garde-fous beta / 1re
  release.
- Gotchas : ceux du rapport précédent (build vite après tout déplacement
  CSS ; chemins en dur des docs vivants et de `dense-rows-wrap.spec`).
