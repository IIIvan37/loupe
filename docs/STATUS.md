# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. Bounded by `docs/docs.spec.ts` : snapshot du PRÉSENT,
> pas un journal — le détail de chaque étape vit dans son rapport daté sous
> [docs/sessions/](sessions/) (5 actifs, le reste dans
> [sessions/archive/](sessions/archive/)).

## Where we are

**Cap distribution acté (2026-07-26)** : loupe se distribue en **serveur
local + navigateur** ([distribution-plan.md](distribution-plan.md), lots
D1–D6 ; motifs : multi-OS, yt-dlp local, zéro signature, un moteur web). Le
shell **Tauri passe en sommeil** (canal signé réactivable, CI conservée).
**Roadmap v7 soldée** ([archive](archive/roadmap-excellence-7.md)) ; **Lot TS
clos** ([archive](archive/template-sync-plan.md)). Nursery à dessein :
`detect-chords`, `bass-line` ; `timecode` attend un second consommateur.
**D1–D6 clos** (PRs #275–#285, détail dans sessions/) ; **prochain
distribution : 1re release taguée** (tap + `HOMEBREW_TAP_TOKEN`,
cf. `docs/RELEASING.md` ; Ubuntu ARM64 natif différé). **Chantier parallèle —
état de vue** ([ADR 0010](adr/0010-etat-de-vue-atomes-par-feature.md), #286) :
la feature possède son état, le shell compose. Feuilles livrées : mixer (#287),
tempo (#290), séparation (#292) — cliquet `ReturnType` 26 → 23. Revue
d'architecture (2026-07-29) : cap validé, correctifs livrés (#293, #294).
**Clé de voûte de
l'[ADR 0011](adr/0011-shell-layout-contexte-session-audio.md) posée (PR #295)** :
`AudioSessionProvider` (ports seuls), 7 hooks lisent `arg ?? session ?? réel`,
`WorkstationShellProps` fond à `desktop` seul. **Prochaine feuille : le player
en référence stable** (ShellFooter se sert seul, cliquet 23 → 21), puis ADR
graphe de modules web + tags Sheriff (3 cycles relevés), puis interface
étroite de session (DIP). Chaque feuille descend ≥1 cliquet
(`composition-invariants.spec.ts`) dans sa PR ; les feuilles d'infrastructure
en sont exemptées (documenté au rapport). Checkpoint UI avant chaque slice.

**Garde-fous beta restants** (cf. [beta-checklist.md](beta-checklist.md)) :
plafond Modal (mesuré ~3,67 $/mois), SMTP custom câblé (Resend), re-seed des
codes legacy, PKCE en bundle à rejouer.

## Historique (une ligne par ère ; détail = rapports datés dans sessions/)

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
- **Extra gates** (blocking, `packages/web` only) : impeccable + react-doctor.
- **Per-slice loop** : `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` → `pnpm test:mutation` → `/code-review` → `/session-report` → PR.

## Plans

- **En cours** : [distribution-plan.md](distribution-plan.md) (D1–D6 clos ; reste la 1re release taguée + le tap).
- **Complets** : dans [docs/archive/](archive/) (plans clos + vision produit du kickoff).

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap · locale EN · boucle A/B au clavier · thème clair · undo/redo (écarté produit) · off-thread zip/encode · export MIDI par stem (Jalon 4).
- Dependabot #180 (TS 6→7) + #53 (`@vitejs/plugin-react` v6) — session outillage dédiée.
- Races connues « si ça mord » : re-`attach` sur detect fire-and-forget (vieux manifests) · `addStem`/`play` sur bus stretch froid · worker DSP accords (774 ms).
