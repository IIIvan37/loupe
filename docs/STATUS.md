# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. Bounded by `docs/docs.spec.ts` : snapshot du PRÉSENT,
> pas un journal — le détail de chaque étape vit dans son rapport daté sous
> [docs/sessions/](sessions/) (5 actifs, le reste dans
> [sessions/archive/](sessions/archive/)).

## Where we are

**Cap distribution SOLDÉ (2026-07-26 → 07-31)** : loupe se distribue en
**serveur local + navigateur** — release v0.1.0, tap `iiivan37/loupe`, le
binaire `loupe` seul livrable (Tauri retiré #327, serveur unique #328),
`server/` = bibliothèque Modal + harnais dev/CI, parité des origins
verrouillée ([archive/distribution-plan.md](archive/distribution-plan.md),
[archive/serveur-unique-plan.md](archive/serveur-unique-plan.md)).
**Roadmap v7 soldée** ; **Lot TS clos**. Nursery : `detect-chords`,
`bass-line` ; `timecode` attend un 2e consommateur. Rappels : filtre Base UI
à retirer au prochain bump (#319) ; jamais de hook à effet de montage, seul
le seam `mixer: Mixer` en prop ([ADR 0010](adr/0010-etat-de-vue-atomes-par-feature.md)–[0013](adr/0013-un-dossier-se-lit-d-un-coup-d-oeil.md) en garde via cliquets).
**Beta distribuée le 2026-08-01** (v0.1.0 + [guide](guide-utilisateur.md) + code beta).
**Release v0.2.0 LIVRÉE le 2026-08-02** (PRs #342–#344, tag sur `9964aa5`
— premier tag sur un main intégralement vert) : CI réparée (shellcheck
windows #343, timeout mutation 120 min #344 — premier score complet
**93,10**), release vérifiée (bit exécutable, checksums, attestation, tap,
alias beta). Filtre Base UI maintenu (rappel #319) ; Modal + Edge à jour.
Rappels : templates OTP = opérateur ; session outillage (TS 6→7 #180,
plugin-react v6 #353 — Babel retiré, migration `@rolldown/plugin-babel`).
Prochain : **lot « retour au labo »** sur hexagonal-tdd-starter (plan du
2026-08-02 : filets CI, ignoreStatic, gate-stamp, heavy-runs, Sonar
opt-in ; détail au rapport).

## Historique (une ligne par ère ; détail = rapports datés dans sessions/)

- 2026-08-01 · **Roadmap excellence 8 + arrêt auto** (AR→AX #332→#340, #341) : premier contact, erreurs en français, blindage binaire, marque loupe/loop (wordmark, favicon), heartbeat 20 s + watchdog (grâce 180 s, `--no-auto-exit`).
- 2026-07-27 → 07-31 · **État de vue + forme des dossiers** (ADR 0010–0013, #287→#326) : atomes par feature, DAG web, DIP session, cliquet `ReturnType` 13 → 0, dossiers-composant partout, cliquets `folder-shape`/`foreign-css`. Boucle outillée (#297) + sortie de suite = signal (#319). Garde-fous beta soldés ([beta-checklist.md](beta-checklist.md)).
- 2026-07-25 → 07-26 · **Resync template (Lot TS)** : configs/CI, fitness functions, pratique ADR, subpath testing, 8 modules émergents (rhythm → project), link-checker des living docs.
- 2026-07-19 → 07-24 · **Roadmap excellence 7** (UX exceptionnelle) : Lots AJ (offload-only), AK (funnel), AL (boucles/vitesse), AM (mixer), AN (grammaire/gravure/romain), AO (waveform/vie/signature), AP (nativité desktop + revue) + fix auth desktop PKCE.
- 2026-07-18 → 07-19 · **Phase 2 desktop + solde v6** : sécurité desktop (PKCE, CSP, yt-dlp épinglé), export natif, menus natifs, SMTP beta, mutants form-encoder.
- 2026-07-16 → 07-18 · **Phase 2 client léger Tauri/Modal** : spike GO, deep-link auth, stores fs, yt-dlp sidecar, retrait du serveur du chemin nominal ; M1.1–M1.4 (tempo/accords/séparation sur Modal).
- 2026-07-16 · **Roadmap excellence 5** (17,2/20) : les cinq 🟠 (X.1–AA.1).
- 2026-07-14 → 07-16 · **Roadmap excellence 4** (Lots Q–W) : zonage shell, OperationStatus, boucles/nudge musicaux, perfs (V.1–V.5), design (W.1–W.5), Lot U sécurité/CI.
- 2026-07-13 → 07-14 · **Structure + pré-démo accords** : détection de structure (S.0–S.3), signatures rythmiques, marker kinds, multi-accords, orthographe tonale.
- 2026-07-13 · **J2 auth Supabase** : gating beta_codes, quota, Edge mint, PKCE web.
- 2026-07-10 → 07-13 · **Chord charts (Lots A–C + P)** : grille maison, transposition, détection BTC, rendu lead-sheet, forme/déroulé, impression.
- 2026-07-11 → 07-12 · **Roadmap excellence 3** (Lots K–O) : playhead externe, mémoire stems, garde Origin, erreurs discriminées, micro-dérives design.
- 2026-07-06 → 07-11 · **Tempo (Lots A–C) + roadmap excellence 2 (Lots F–J)** : beat_this, tempo map, octave, speed trainer, tempo manuel, count-in, a11y.
- 2026-07-05 → 07-06 · **Roadmap excellence 1 (Lots A–E)** : sécurité/discipline serveur, design system, responsive intrinsèque, feedbacks.
- 2026-06-28 → 07-04 · **Jalons fondateurs 1–3 + tronc fonctionnel** : atelier de base, séparation IA (Demucs), projets, i18n Lingui, persistance, import URL.

## Locked decisions (kickoff)

- **Time-stretch** : SoundTouch (`@soundtouchjs/audio-worklet`, MPL-2.0) — Rubber Band écarté (wrapper web cassé, GPL).
- **Séparation** : Demucs serveur (`server/`), moteurs WASM in-browser retirés ; **Phase 2 (2026-07-18)** : calcul offloadé sur **Modal**, le serveur local devient dev/CI.
- **Web stack** : React + Jotai · Base UI · Every Layout · CSS Modules + tokens · smart/dumb.
- **Extra gates** (blocking) : impeccable + react-doctor (`packages/web`) ; `check:tokens`, `check:i18n` (dérive du catalogue Lingui).
- **Per-slice loop** : `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` → `pnpm test:mutation:diff` → `pnpm sonar` → `/code-review` → `/session-report` → PR.

## Plans

- **En cours** : [roadmap-excellence-8.md](roadmap-excellence-8.md) (Lots AR→AX, revue du 2026-08-01).
- **Complets** : dans [docs/archive/](archive/) (plans clos + vision produit du kickoff).

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap · locale EN · boucle A/B au clavier · thème clair · undo/redo (écarté produit) · off-thread zip/encode · export MIDI par stem (Jalon 4).
- Dependabot #180 (TS 6→7) + #53 (`@vitejs/plugin-react` v6) — session outillage dédiée ;
  file débloquée (#310 config, #316 triage react-doctor 0.9.2 ; #315 supersédée par
  #317), merges = action opérateur.
- Races connues « si ça mord » : re-`attach` sur detect fire-and-forget (vieux manifests) · `addStem`/`play` sur bus stretch froid · worker DSP accords (774 ms).
- 8 issues Sonar assumées (inventaire 2026-08-01, quality gate OK) : S3776 complexité 16/15 `use-chord-detection.ts:172` (le vrai morceau) · S6825 aria-hidden focusable `waveform-canvas.tsx:52` · S8997 monkeypatch ×2 `test_limits.py` · mineures S5906 ×2 `spectrum.spec.ts`, S6582 `use-chord-detection.ts:301`, S7786 `http-project-store.ts:32`. Reprise à la prochaine passe qualité sur ces fichiers.
