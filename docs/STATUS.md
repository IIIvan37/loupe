# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. Bounded by `docs/docs.spec.ts` : snapshot du PRÉSENT,
> pas un journal — le détail de chaque étape vit dans son rapport daté sous
> [docs/sessions/](sessions/) (5 actifs, le reste dans
> [sessions/archive/](sessions/archive/)).

## Where we are

**Lot AO clos** ([roadmap v7](roadmap-excellence-7.md), Lots AJ→AQ ; AJ→AO
livrés) : AO.1 (#246), AO.2+AO.3 (#247). En passant : **auth desktop réparée
et vérifiée en bundle** (#248, PKCE cold start ; item checklist beta coché).
**Prochain : au choix — Lot AP (nativité desktop : AP.2 garde de fermeture
native, AP.3 fenêtre persistée + titre, AP.4 métadonnées bundle) ou Lot AQ
(vocabulaire et copy : AQ.1 lexique morceau/piste, AQ.2 anti-anglais + ton)** ;
checkpoint d'approche avant chaque slice UI.

**Plans actifs** : [roadmap v7](roadmap-excellence-7.md) (UX exceptionnelle, en
cours) · [client-leger-plan.md](client-leger-plan.md) (**Phase 2 Modal + Tauri
terminée**) · [template-sync-plan.md](template-sync-plan.md) (resync template,
lots TS.1–TS.5). **Garde-fous beta restants** (cf.
[beta-checklist.md](beta-checklist.md)) : plafond de dépense Modal (mesuré
~3,67 $/mois), SMTP custom **déjà câblé** (Resend/`iiivan.org`), re-seed des
codes legacy, PKCE en bundle à rejouer.

## Historique (une ligne par ère ; détail = rapports datés dans sessions/)

- 2026-07-19 → 07-24 · **Roadmap excellence 7** (UX exceptionnelle) : Lots AJ (offload-only), AK (funnel), AL (boucles/vitesse), AM (mixer), AN (grammaire/gravure/romain), AO (waveform/vie/signature) + fix auth desktop PKCE.
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

- **En cours** : [roadmap-excellence-7.md](roadmap-excellence-7.md) (Lots AJ–AQ) · [template-sync-plan.md](template-sync-plan.md) (TS.1–TS.5).
- **Complets** : [client-leger-plan.md](client-leger-plan.md) · [roadmap-excellence-6.md](roadmap-excellence-6.md) · [roadmap-excellence-5.md](roadmap-excellence-5.md) · [roadmap-excellence-4.md](roadmap-excellence-4.md) · [roadmap-excellence-3.md](roadmap-excellence-3.md) · [roadmap-excellence-2.md](roadmap-excellence-2.md) · [roadmap-excellence.md](roadmap-excellence.md) · [chord-charts-plan.md](chord-charts-plan.md) · [tempo-detection-plan.md](tempo-detection-plan.md) · [jalon-2-plan.md](jalon-2-plan.md) · [jalon-1-plan.md](jalon-1-plan.md).

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap · locale EN · boucle A/B au clavier · thème clair · undo/redo (écarté produit) · off-thread zip/encode · export MIDI par stem (Jalon 4).
- Dependabot #180 (TS 6→7) + #53 (`@vitejs/plugin-react` v6) — session outillage dédiée.
- Races connues « si ça mord » : re-`attach` sur detect fire-and-forget (vieux manifests) · `addStem`/`play` sur bus stretch froid · worker DSP accords (774 ms).
