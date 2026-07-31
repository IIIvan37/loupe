# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. Bounded by `docs/docs.spec.ts` : snapshot du PRÉSENT,
> pas un journal — le détail de chaque étape vit dans son rapport daté sous
> [docs/sessions/](sessions/) (5 actifs, le reste dans
> [sessions/archive/](sessions/archive/)).

## Where we are

**Cap distribution acté (2026-07-26)** : loupe se distribue en **serveur
local + navigateur** ([distribution-plan.md](distribution-plan.md) ; D1–D6
clos, PRs #275–#285) ; **prochain distribution : 1re release taguée** (tap +
`HOMEBREW_TAP_TOKEN`, cf. `docs/RELEASING.md`). Le shell **Tauri passe en
sommeil**. **Roadmap v7 soldée** ; **Lot TS clos**. Nursery à dessein :
`detect-chords`, `bass-line` ; `timecode` attend un second consommateur.
**Boucle outillée** (PR #297) : `check:i18n` au gate, tampon de fraîcheur du
gate, `pnpm sonar`, workers vitest bornés en local.
**Chantier état de vue / shell**
([ADR 0010](adr/0010-etat-de-vue-atomes-par-feature.md),
[0011](adr/0011-shell-layout-contexte-session-audio.md),
[0012](adr/0012-graphe-de-modules-web.md)) : sacs de feature en atomes
soldés — #287→#306 livrées (DAG web #299, player #300, repères/tempo/mixer/
zoom #301–#304, séparation #305, loops #306 ; cliquet `ReturnType` 13 → 7).
**L'interface étroite de session (DIP) est en cours** : sur les 12 entrées du
seam, **un seul port gras** — `StemPlaybackEngine`, 15 membres, 3 tranches
disjointes (mixer 5, transport 7, séparation 1) ; les 8 autres sont déjà des
interfaces à 1–2 membres. **2 tranches sur 3 nommées au seam** :
`StemAudioSource` (`useStemAudio()`, PR #307) et `StemMixGraph`
(`useStemMixGraph()`, livré par la PR #308) — ni `useSeparation` ni
`useMixer` ne nomment plus le port core. **Prochaine étape : la tranche transport**,
commune aux deux moteurs (d'où l'échange déjà possible dans
`use-transport-engines`), puis les 7 `ReturnType` restants, deps
d'orchestrateurs à dériver des atomes. Checkpoint UI par slice.

**Garde-fous beta restants** ([beta-checklist.md](beta-checklist.md)) : plafond
Modal (~3,67 $/mois), SMTP Resend, re-seed codes legacy, PKCE bundle à rejouer.

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
- **Extra gates** (blocking) : impeccable + react-doctor (`packages/web`) ; `check:tokens`, `check:i18n` (dérive du catalogue Lingui).
- **Per-slice loop** : `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` → `pnpm test:mutation:diff` → `pnpm sonar` → `/code-review` → `/session-report` → PR.

## Plans

- **En cours** : [distribution-plan.md](distribution-plan.md) (D1–D6 clos ; reste la 1re release taguée + le tap).
- **Complets** : dans [docs/archive/](archive/) (plans clos + vision produit du kickoff).

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap · locale EN · boucle A/B au clavier · thème clair · undo/redo (écarté produit) · off-thread zip/encode · export MIDI par stem (Jalon 4).
- Dependabot #180 (TS 6→7) + #53 (`@vitejs/plugin-react` v6) — session outillage dédiée.
- Races connues « si ça mord » : re-`attach` sur detect fire-and-forget (vieux manifests) · `addStem`/`play` sur bus stretch froid · worker DSP accords (774 ms).
