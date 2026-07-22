# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. **Only the current step is detailed here** — the full
> story of every past step lives in its dated report under
> [docs/sessions/](sessions/); the history below keeps one line per step.

## Where we are

**Lot AL — la boucle de pratique au niveau d'un vrai outil — CLOS** ([roadmap
v7](roadmap-excellence-7.md), Lots AJ→AQ ; AJ, AK, AL clos). AL.1→AL.4 livrés
(AL.4 = #237) — détail en Historique. **Lot AM en cours** : AM.1 (lanes
cliquables, PR #239).

**AM.2 mergée (PR #240).** **AM.3 (confiance visible) écartée** le 2026-07-22 —
décision produit : le degré de confiance apporte peu à l'utilisateur, le
tooltip existant suffit (une implémentation complète — core `describeConfidence`
+ chip — a été jetée avant PR).
**Prochain : AM.4** — EQ lisible (Hz affichés + reset neutre + mention
session-only) + mini-mètres par stem (tap analyser).

**Plans actifs** : [roadmap v7](roadmap-excellence-7.md) (UX exceptionnelle, en
cours) · [client-leger-plan.md](client-leger-plan.md) (**Phase 2 Modal + Tauri
terminée** — loupe = app de bureau Tauri + Modal, aucun Python local nominal).
**Garde-fous beta restants** (hors roadmap, cf.
[beta-checklist.md](beta-checklist.md)) : plafond de dépense Modal (mesuré
~3,67 $/mois), SMTP custom **déjà câblé** (Resend/`iiivan.org`, DMARC posé),
re-seed des codes legacy, PKCE en bundle à rejouer.

## Historique (une ligne par étape, du plus récent au plus ancien)

### Roadmap excellence 7 (2026-07-19 → …) — UX exceptionnelle

- 2026-07-22 · **AM.3 — confiance visible : écartée** (décision produit, aucune
  PR) — le degré de confiance apporte peu ; roadmap v7 mise à jour
- 2026-07-21 · **AM.2 — fader console** (PR #240) : pas fin 0,5 dB (molette +
  Shift+flèches via core `stepGainDb`) +
  lecture dB éditable (`CommitNumberField`), fader extrait en `GainFader` →
  [rapport](sessions/2026-07-21-am2-console-fader.md)
- 2026-07-21 · **AM.1 — lanes cliquables** (PR #239) : surface pointeur unique
  sur `StemLanes` → clic n'importe où cale la lecture (même
  `onSeekRatio`/`pointerRatio` que la waveform) + trait de survol unique
  traversant toutes les lanes →
  [rapport](sessions/2026-07-21-am1-clickable-lanes.md)
- 2026-07-21 · **AL.4 — speed-trainer découvrable** (PR #237, **Lot AL clos**) :
  déclencheur désactivé-avec-tooltip hors boucle (fini le contrôle caché) + ligne
  d'aperçu dérivée des 4 champs par le core pur `previewSpeedTrainer` (même
  `normalisePolicy` que `startSpeedTrainer`, oracle `recordLoopPass`) →
  [rapport](sessions/2026-07-21-al4-trainer-discoverable.md)
- 2026-07-21 · **AL.3 — vitesse/hauteur précises** (PR #236) : pilule éditable (± + slider +
  `CommitNumberField`), core `stepTempoPercent`/`stepPitchSemitones` partagé par
  les ± et les raccourcis `[`/`]` (vitesse) et `{`/`}` (hauteur), fader dB
  double-clic 0 dB (overlap AM.2), `.stepButton` promue + `StepperField` extrait
  → [rapport](sessions/2026-07-21-al3-precise-speed-pitch.md)
- 2026-07-20 · **AL.2 — poignées A/B dignes** (PR #235) : hotzone 12→18 px,
  `:hover`/`:active`/`:focus-visible` (`scaleX(2)` compositor-only + halo), flash
  de la beat-line au snap via `snappedEdgeRatios` (même snap que le commit) →
  [rapport](sessions/2026-07-20-al2-handles-dignes.md)
- 2026-07-20 · **AL.1 — feedback de calage de boucle** (PR #234) : read-out
  début→fin·durée (tabular-nums), étiquette timecode flottante (drag + nudge),
  curseur de survol waveform, hook `use-waveform-gestures` →
  [rapport](sessions/2026-07-20-al1-loop-calibration-feedback.md)
- 2026-07-20 · **AK.4 — divulgation beta amont + escape mailto** (PR #233) :
  état « connectez-vous pour débloquer » + lien waitlist/mailto quand le code
  manque — **Lot AK clos** (AK.1 #228 · AK.2 #229 · AK.3 #232 · AK.4 #233)
- 2026-07-20 · **AK.3 — import URL dans le hero** (PR #232) : champ « Coller un
  lien » inline (desktop-only) + paste-anywhere, `UrlImportField` partagé
  ImportMenu/EmptyState → [rapport](sessions/2026-07-20-ak3-url-import-hero.md)
- 2026-07-20 · **AK.2 — empty-state qui vend** (PR #229) : trois accroches de
  valeur (icône + bénéfice) à la place de la table de raccourcis prématurée →
  [rapport](sessions/2026-07-20-ak2-empty-state.md)
- 2026-07-20 · **AK.1 — funnel magic-link** (PR #228) : « lien envoyé » enrichi
  (adresse, Renvoyer + cooldown 30 s, Changer d'adresse) + reprise auto de
  l'analyse gatée après connexion (`useResumeGatedAnalysis`) →
  [rapport](sessions/2026-07-20-ak1-magic-link-funnel.md)
- 2026-07-19 · **AJ.3 — Hard Tauri-only cut** (Lot AJ complet) :
  `VITE_ANALYSIS_URL` obligatoire, adaptateurs HTTP supprimés, projets/save/
  import-URL cachés hors desktop (capacité `desktop`) →
  [rapport](sessions/2026-07-19-aj3-tauri-only-cut.md)
- 2026-07-19 · **AJ.1 + AJ.2 — l'app arrête de mentir** (PR #225) : sonde
  `/health` + chip « Serveur hors ligne » retirés, `blockedReason='server'`
  effondré, copy d'erreur → « service d'analyse » →
  [rapport](sessions/2026-07-19-aj1-aj2-offload-only.md)
- 2026-07-19 · **Cap UI/UX exceptionnelle acté** : éval multi-agents 8 axes UX
  (~13,5/20), séquencement Lots AJ→AQ →
  [roadmap-excellence-7](roadmap-excellence-7.md)

### Phase 2 desktop + solde v6 (2026-07-18 → 07-19)

- 2026-07-19 · **Menus natifs macOS — AP.1** (branche
  `feat/desktop-native-menus`) : barre FR (Loupe/Fichier/Édition/Fenêtre/Aide)
  → `useNativeMenu` sur les mêmes handlers, `guardedProjectSave` extrait
- 2026-07-19 · **Export natif desktop** (solde AH.1) : flux deux temps
  `pick_export_path` (NSSavePanel) + `write_export` (octets côté Rust), seam
  `deliverFile`, IPC webview ~8 MB/s mesuré →
  [rapport](sessions/2026-07-19-desktop-native-export.md)
- 2026-07-19 · **SMTP beta câblé** : Resend sur `iiivan.org`, magic link réel
  reçu, DMARC posé (API Netlify) → [beta-checklist.md](beta-checklist.md)
- 2026-07-18 · **AI.2 (solde) — passe mutants form-encoder** : 71,2 → 89,34 %
  (tests only, 48 mutants tués), global core 92,75 % →
  [rapport](sessions/2026-07-18-ai2-form-encoder-mutants.md)
- 2026-07-18 · **AF + AG + AH.1 + AI.2 — tous les 🟠 v6** (PR à ouvrir) :
  relabel préserve la tête, headChord slash-blind, l'import ne minte plus,
  export/impression désactivés-avec-hint sous Tauri, checklist beta écrite →
  [rapport](sessions/2026-07-18-af-ai-review-fixes.md)
- 2026-07-18 · **Lot AD — parcours accords** (PR #212) : `phase` exposée, cancel
  accords annule la séparation, DSP 774 ms mesuré derrière `nextPaint`, cache
  DSP par (piste, stems, grille) → [rapport](sessions/2026-07-18-ad-chords-path.md)
- 2026-07-18 · **Lot AE — headers/footers** (PR #211) : `font-size:s` par défaut
  sur les peaux interactives, `.chromeBar` partagée, header 63→55 px / footer
  94→58 px → [rapport](sessions/2026-07-18-ae-header-footer-density.md)
- 2026-07-18 · **Lot AC + AI.1 — sécurité desktop** (PR #210) : yt-dlp épinglé
  version+sha256, deny scope fs, CSP réelle, auth desktop en **PKCE**, CI Rust →
  [rapport](sessions/2026-07-18-ac-desktop-security.md)
- 2026-07-18 · **Évaluation notée v6** (16,75/20 — première baisse, honnête ;
  sécurité/perf desktop ↓) → [roadmap-excellence-6](roadmap-excellence-6.md)
- 2026-07-18 · **Fix ids stems français** (PR #209, lot pré-beta soldé) : 4a/4b
  no-opaient (`bass`/`drums` vs `basse`/`batterie`), fakes réalignés sur
  stem_manifest.py → [rapport](sessions/2026-07-18-stem-ids-french-fix.md)
- 2026-07-18 · **4b — slash chords depuis la basse** (PR #208) :
  `bassNotePerMeasure` (FFT 16384) + `applyBassSlash` mono-accord →
  [rapport](sessions/2026-07-18-bass-slash-chords-4b.md)
- 2026-07-18 · **4a — accords sur mix sans batterie** (PR #207) : `monoMixWithout`
  client-side, séparation implicite best-effort →
  [rapport](sessions/2026-07-18-chords-on-stems-4a.md)
- 2026-07-18 · **3/6 — harmoniques distinguées au Spectre** (PR #206) :
  `chromaWithHarmonics`, barres deux segments (joué/harmonique) →
  [rapport](sessions/2026-07-18-spectrum-harmonics.md)
- 2026-07-18 · **5/6 + 6/6 — seek musical + retrait onglet Notes** :
  `seekStepSeconds` (temps/mesure, `adjacentGridTime` partagé), 4 bindings
  flèches → [rapport](sessions/2026-07-18-musical-seek-notes-tab.md)
- 2026-07-18 · **2/6 — Spectre en pause + navigation** (PR #204) :
  `spectrumFromSamples` pur, callback `pausedSpectrum`, lecture au seek en pause
  → [rapport](sessions/2026-07-18-spectrum-paused.md)
- 2026-07-18 · **1/6 — fix scroll parasite du suivi de grille** (PR #203) :
  `followScrollTop` pur scopé à `data-sheet-scrollport` (fini `scrollIntoView`)
  → [rapport](sessions/2026-07-18-fix-lead-sheet-follow-scroll.md)

### Phase 2 — client léger Tauri/Modal (2026-07-16 → 07-18)

- 2026-07-18 · **T2.5 — retrait du serveur du chemin nominal** (sortie Phase 2) :
  desktop = client nominal, origins Tauri par défaut dans `origins.py` + miroir
  Deno, déployé/curl-vérifié (aucun secret touché)
- 2026-07-18 · **T2.3 — import URL desktop yt-dlp** (PR #196) : binaire yt-dlp
  (Unlicense) en sous-process Rust `download_track`, parité de gardes avec
  `download.py`, self-update 1×/jour → [rapport](sessions/2026-07-18-t23-ytdlp-sidecar.md)
- 2026-07-17 · **T2.2 + AA.2 — stores filesystem** (PR #194, + Sonar #195) :
  `parseProject` runtime, `fs-project-store` (sha256, atomique, GC) sur seam
  `ProjectFs`, binding `tauri-fs`, sweep GC barrière au démarrage →
  [rapport](sessions/2026-07-17-t22-fs-stores.md)
- 2026-07-17 · **T2.1bis — deep link auth** (PR #193) : magic link →
  `loupe://auth-callback`, `setSession` explicite, plugin Rust `deep-link`,
  Supabase site_url/allowlist → [rapport](sessions/2026-07-17-t21bis-deep-link-auth.md)
- 2026-07-17 · **T2.1 — spike Tauri : GO** : coquille Tauri 2 dans
  `packages/desktop`, 3 cas WebKit durcis passés, aucun bloquant de licence →
  [rapport](sessions/2026-07-17-t21-spike-tauri-go.md)
- 2026-07-17 · **Grille d'accords : forme vs déroulé** (PR à ouvrir) : `:| xN` +
  `{form: Nx}`, `detectCycle`/`deduceInstances`/`encodeChartSource` (DP coût),
  oracle fast-check `playedLabels(encode)≡song` →
  [rapport](sessions/2026-07-17-chord-grid-form-rollout.md)
- 2026-07-16 · **M1.4 — santé/hors-ligne/narration** (Phase 1 Modal terminée) :
  `SeparationError` typée, `useOnline` (bloque QUE l'offload), narration
  cold-start → [rapport](sessions/2026-07-16-m14-sante-horsligne-narration.md)
- 2026-07-16 · **M1.3 — séparation sur Modal** : router `separation`
  (`max_containers=1`, concurrence 8), bearer sur `/separate` + GET `/stems`,
  gate `ensureAnalysisToken` → [rapport](sessions/2026-07-16-m13-separation-modal.md)
- 2026-07-16 · **M1.2 — quota/coût séparation** : spike L4 (~4,7 s à chaud,
  0,57 GB VRAM, ~$0.001) → **décision : quota unique inchangé** →
  [rapport](sessions/2026-07-16-m12-separation-quota-cost.md)
- 2026-07-16 · **M1.1 — tempo + accords sur Modal** : `/tempo`+`/chords` à côté de
  `/structure` (un conteneur, même gate JWT), web sur `ANALYSIS_URL`, un seul
  mint → [rapport](sessions/2026-07-16-m11-tempo-chords-modal.md)

### Roadmap excellence 5 (2026-07-16) — les cinq 🟠

- 2026-07-16 · **AA.1 — veille CVE pip** (PR #174, les cinq 🟠 livrés) : bloc
  `pip` sur `/server` dans dependabot.yml →
  [rapport](sessions/2026-07-16-aa1-pip-advisories.md)
- 2026-07-16 · **Z.1 — clics métronome hors bande chroma** (PR #173) :
  BEAT/DOWNBEAT 1000/2000→2400/3200 Hz, bornes CHROMA exportées + invariant TDD
  → [rapport](sessions/2026-07-16-z1-click-out-of-chroma-band.md)
- 2026-07-16 · **Y.1 — EQ par stem replié en popover** (PR #172) : la rangée
  LC/HC (régression T.8b) déménage dans un popover « EQ », marque `data-filtered`
  → [rapport](sessions/2026-07-16-y1-stem-eq-popover.md)
- 2026-07-16 · **X.2 — relance après annulation du tempo** (PR #171) : état
  `cancelled` sur `useTempo`, face idle « Détecter le tempo » au lieu de
  disparaître → [rapport](sessions/2026-07-16-x2-tempo-cancel-idle.md)
- 2026-07-16 · **X.1 — structure dé-gatée en offload** (PR #170) : `blockedReason`
  structure dérivé de `serverHealth` seulement en local, copy
  `structure.error.network-offload` → [rapport](sessions/2026-07-16-x1-offload-gating.md)
- 2026-07-16 · **Évaluation notée v5** (17,2/20, tous les axes montent) →
  [roadmap-excellence-5](roadmap-excellence-5.md) (Lots X–AA + cap client léger)

### Roadmap excellence 4 (Lots Q–W, 2026-07-14 → 07-16)

- 2026-07-16 · **T.8b — EQ par stem** (Lot T clos) : `StemFilter`/`setStemFilter`,
  deux biquads parqués plats, `mixer.setFilter` session-only →
  [rapport](sessions/2026-07-16-t8b-stem-eq.md)
- 2026-07-16 · **T.8a — Spectre chroma** (PR #168) : `chromaFromSpectrum` pur,
  tap `AnalyserNode` pass-through, `ChromaView` 12 barres →
  [rapport](sessions/2026-07-16-t8a-spectrum-chroma.md)
- 2026-07-16 · **T.7 — fine-tune ±50 cents** (PR #167) : `fineTuneCents` séparé
  de la transposition, moteurs en demi-tons+cents, `ShellFooter` extrait →
  [rapport](sessions/2026-07-16-t7-fine-tune.md)
- 2026-07-16 · **T.6 — découvrabilité** (PR #166) : dialog « Aide du format »,
  section « Gestes », AT honnête (seek clavier des tags) →
  [rapport](sessions/2026-07-16-t6-discoverability.md)
- 2026-07-16 · **T.5 — BPM/mètre au standard N.4** (PR #165) : `CommitNumberField`
  gagne `isValid` + `aria-invalid`/badInput → [rapport](sessions/2026-07-16-t5-bpm-meter-invalid.md)
- 2026-07-16 · **T.4 — Cmd/Ctrl+S = Enregistrer** (PR #164) : bindé meta+S/ctrl+S,
  traverse la garde champ-texte → [rapport](sessions/2026-07-16-t4-cmd-s.md)
- 2026-07-16 · **W.5 — basses design groupées** (PR #163, Lot W clos) : `.kbd` +
  `.secondaryAction` promus, check `styles.X↔classes`, reliquats O.2 soldés →
  [rapport](sessions/2026-07-16-w5-grouped-lows.md)
- 2026-07-16 · **W.4 — typo chart sur tokens** (PR #162) : tokens chart dédiés
  (Petaluma rend ~20 % plus petit), verrou `font-size` absolu →
  [rapport](sessions/2026-07-16-w4-chart-type-scale.md)
- 2026-07-16 · **W.3 — faux-gras synthétisés** (PR #161) : les trois `font-weight:
  600` sur graisses absentes corrigés → [rapport](sessions/2026-07-16-w3-faux-bold.md)
- 2026-07-16 · **V.4 — playhead en `transform`** (PR #160, Lot V complet) :
  `left:%`→`translateX(px)` compositor-only + `will-change` →
  [rapport](sessions/2026-07-16-v4-playhead-transform.md)
- 2026-07-16 · **V.3 — warm des modèles au démarrage local** (PR #159) :
  `app/warm.py` (opt-out, best-effort, thread démon) →
  [rapport](sessions/2026-07-16-v3-warm-models.md)
- 2026-07-16 · **V.5 — buffer de décodage partagé** (PR #158) : `audio-buffer-memo`
  (WeakMap), deux copies ~88 MB évitées, fail-safe probe →
  [rapport](sessions/2026-07-16-v5-audio-buffer-memo.md)
- 2026-07-16 · **V.2 — unload du moteur mono-piste** (PR #157) : `unload()` sur
  `PlaybackEngine`, hand-back en reload paresseux →
  [rapport](sessions/2026-07-16-v2-engine-unload.md)
- 2026-07-16 · **V.1 — upload d'analyse mono + 24 kHz** (PR #156) : uploads 3,67×
  plus légers, résultats identiques → [rapport](sessions/2026-07-16-v1-analysis-upload.md)
- 2026-07-15 · **T.3 — chart navigable** (PR #155) : `measureSeekTime` pur
  (inverse de la projection), mesures en `<button>` avec grille →
  [rapport](sessions/2026-07-15-t3-navigable-chart.md)
- 2026-07-15 · **T.2 — nudge musical** (PR #154) : `nudgeSeconds` (beat adjacent,
  downbeat avec Shift), waveform + marker-rail branchés →
  [rapport](sessions/2026-07-15-t2-musical-nudge.md)
- 2026-07-15 · **T.1 — boucles musicales** (PR #153) : `snapLoopRegionToGrid`,
  drag-to-loop aimanté (Alt échappe), « Boucler la section » →
  [rapport](sessions/2026-07-15-t1-musical-loops.md)
- 2026-07-15 · **U.5 — basses groupées** (PR #152, Lot U clos) : allowlist
  env-drivée sur 3 surfaces (`origins.py`), `structure_segments.py`, split
  `tempo.ts` → [rapport](sessions/2026-07-15-u5-grouped-lows.md)
- 2026-07-15 · **U.4 — cliquets resserrés** (PR #151) : jscpd 1,0 %, Stryker
  break 90 → [rapport](sessions/2026-07-15-u4-ratchets.md)
- 2026-07-15 · **U.3 — brute-force codes beta + plancher secret** (PR #148) :
  `redeem_beta_code` throttlé (verrou 15 min), CHECK entropie ≥32, plancher
  secret ≥32 des deux côtés → [rapport](sessions/2026-07-15-u3-beta-brute-force.md)
- 2026-07-15 · **U.2 — job CI deno** (PR #150) : job `edge-functions`
  (check+lint+fmt) → [rapport](sessions/2026-07-15-u2-deno-ci.md)
- 2026-07-15 · **U.1 — analyze gate** (PR #147) : middleware auth Modal extrait
  en `app/analyze_gate.py`, ordre gate→CORS, kit mint JWT partagé →
  [rapport](sessions/2026-07-15-u1-analyze-gate.md)
- 2026-07-15 · **W.1 + W.2 — dense rows wrap + peau « Confirmer ? »** (PRs #145,
  #146) : `flex-wrap` sur les 2 rangées denses ; `.confirmFace` partagée
  (danger-rouge) → [W.1](sessions/2026-07-15-w1-dense-rows-wrap.md) ·
  [W.2](sessions/2026-07-15-w2-confirm-face.md)
- 2026-07-15 · **R.4 — busy peint avant le gel** (PR #144, Lot R clos) :
  `nextPaint()` avant zip/ré-encode, chip busy header sur `OperationStatus` →
  [rapport](sessions/2026-07-15-r4-export-busy.md)
- 2026-07-15 · **R.3 — cold start narré** (PR #143) : busy monté avant
  `await gate()`, face structure explique après ~4 s →
  [rapport](sessions/2026-07-15-r3-cold-start.md)
- 2026-07-15 · **R.2 — annulation des détections** (PR #142) : `cancel()` sur les
  3 hooks, « Annuler » sur les 4 flux → [rapport](sessions/2026-07-15-r2-detection-cancel.md)
- 2026-07-15 · **R.1 — OperationStatus** (PR #141) : primitive barre+libellé+
  Annuler, portée par `DetectionAction`/séparation/décodage →
  [rapport](sessions/2026-07-15-r1-operation-status.md)
- 2026-07-15 · **Q.4 + Q.5 — header groupé + speed renommé** (PR #140, Lot Q
  clos) : familles par le gap, slider « Vitesse (sans toucher au pitch) » →
  [rapport](sessions/2026-07-15-q4-q5-header-speed.md)
- 2026-07-15 · **Q.3 — zone Analyse repliable** (PR #138/#140) : `ShellSection`
  pliable, résumé teal replié, `useAnalysisFold` →
  [rapport](sessions/2026-07-15-q3-analysis-fold.md)
- 2026-07-15 · **Q.2 — rangée « Analyser »** : primitive `DetectionAction` +
  `AnalyserRow`, SeparationPanel supprimé, empreinte stable →
  [rapport](sessions/2026-07-15-q2-analyser-row.md)
- 2026-07-14 · **Q.1 — zonage de la colonne** (PR #137) : `ShellSection` × 3
  zones (Timeline/Analyse/Partition), `.sectionLabel` unifié →
  [rapport](sessions/2026-07-14-q1-shell-zoning.md)
- 2026-07-14 · **Évaluation notée v4** (16,1/20, six axes + 2 enquêtes ciblées
  sur les irritants d'usage) : 45 constats confirmés →
  [roadmap-excellence-4](roadmap-excellence-4.md) (Lots Q–W)

### Structure + pré-démo accords (2026-07-13 → 07-14)

- 2026-07-14 · **Multi-accords par mesure + erreurs `/tempo` discriminées** (PR à
  ouvrir) : `chordLabelPerMeasure` vote les deux moitiés (`'C G'`),
  `TempoDetectionError` typée sur `classifyTransportError` →
  [rapport](sessions/2026-07-14-multi-chords-tempo-errors.md)
- 2026-07-14 · **Fix icônes + « + Section »** (PRs #134, #135) : marqueur de
  structure à la main (`addSectionAt`, `Maj+M`) guide la détection →
  [rapport](sessions/2026-07-14-add-section-marker.md)
- 2026-07-14 · **Fix labels dupliqués** (PR #132) : `adoptStructureKinds` à la
  restauration (projets pré-marker-kinds) →
  [rapport](sessions/2026-07-14-restore-structure-marker-kinds.md)
- 2026-07-14 · **Notation empilée des signatures** (PR #131) : composant
  `TimeSignature` (glyphe N/M), signature de tête dans la gouttière →
  [rapport](sessions/2026-07-14-stacked-time-signature.md)
- 2026-07-14 · **Fix la détection d'accords efface la structure** (PR #130) :
  `detectChords` accepte `sections`, découpe par `cutBySections` →
  [rapport](sessions/2026-07-14-chord-draft-preserves-structure.md)
- 2026-07-13 · **Pré-démo #3 — signatures rythmiques** (PR #129) : `{time: N/M}`
  tête + mid-grid, dominant meter, beats/bar éditable →
  [rapport](sessions/2026-07-13-time-signatures.md)
- 2026-07-13 · **Pré-démo #2 — marqueurs ↔ structure** (PR #128) : marker kinds
  + sync chart→timeline → [rapport](sessions/2026-07-13-marker-kinds-structure-sync.md)
- 2026-07-13 · **Pré-démo #1 — orthographe tonale + vocabulaire étendu** (PR
  #127) : `detectKey` Krumhansl → `{key}` + ré-épellage #/b, BTC 170 classes →
  [rapport](sessions/2026-07-13-chord-grid-vocab-key.md)
- 2026-07-13 · **S.3b — réétiquetage de la grille d'accords** : fold pur
  `relabelChartBySections` (grille en mesures jouées, 1 bloc/section, accords
  verbatim) → [rapport](sessions/2026-07-13-structure-web-s3b.md)
- 2026-07-13 · **S.3a — marqueurs de structure web** (PR #120) : bouton
  « Détecter la structure » → marqueurs de section →
  [rapport](sessions/2026-07-13-structure-web-s3.md)
- 2026-07-13 · **S.2 — core structure** (PR #119) : `StructureDetector` port +
  `detectStructure` + `snapSectionsToGrid` →
  [rapport](sessions/2026-07-13-structure-core-s2.md)
- 2026-07-13 · **S.1 — serveur `POST /structure`** (PR #118) : `chunk_plan` +
  `stitch_segments` purs + shell torch `structure.py`, SongFormer/MuQ/MusicFM
  vendorés → [rapport](sessions/2026-07-13-structure-detection-s0-s1.md)
- 2026-07-13 · **S.0 — spike structure : GO** (SongFormer + chunking, MPS/torch
  2.12, chunking 180 s obligatoire) →
  [plan](structure-detection-plan.md) · [rapport](sessions/2026-07-13-structure-detection-s0-s1.md)

### Offload Modal — auth (2026-07-13)

- 2026-07-13 · **J2 — auth Supabase** (PR #126, déployé/vérifié en prod) : token
  statique → auth par-utilisateur (gating `beta_codes`, quota ~20/mois, gate
  paresseuse), 2.1 schéma+RLS, 2.2 Edge `mint-analyze-token`, 2.3 vérif HS256
  Python, 2.4 web (`AuthPort`, `AccountMenu`) →
  [runbook](j2-supabase-runbook.md) · [rapport](sessions/2026-07-13-j2-supabase-auth.md)
- 2026-07-13 · **J1 — offload Modal token statique** (PRs #123–#125) : endpoint
  Modal `/structure` (bearer statique), routage adapter + warm-on-import →
  [plan](modal-offload-impl-plan.md)

### Lot P — lead-sheet chart (2026-07-12 → …)

- 2026-07-13 · **P.4 impression** (PR #117) : « Imprimer » +
  `data-print-region` conditionnel + stylesheet print `:has` (chart seule,
  html/body aplatis), BarsPerRowField extrait →
  [rapport](sessions/2026-07-13-p4-print.md)
- 2026-07-13 · **P.4 phase 1 — déduction de structure** (PR #116 mergée) :
  `deduceStructure` MDL + vote nettoyant + `renderStructuredSource`
  (`[A]`, `|: :|`), detectChords structuré, Stryker 100 % sur le fichier →
  [rapport](sessions/2026-07-13-p4-structure-deduction.md)
- 2026-07-12 · **P.3 — édition repliée** (PR #115 mergée) : chart-first,
  textarea derrière « Modifier » (aria-expanded/controls, focus remis),
  hint d'état vide, helpers typeGrid/chartEditor →
  [rapport](sessions/2026-07-12-p3-collapsed-edit.md)
- 2026-07-12 · **P.2 — grammaire de forme + unrollChart** (PR #114 mergée) :
  reprises/voltas/{d.c.}/{coda}/{fine}/fermata, unroll pur (fast-check),
  surlignage sur la forme déroulée →
  [rapport](sessions/2026-07-12-p2-form-unroll.md)
- 2026-07-12 · **P.1 — rendu chart** (PR #113 mergée) : directives `{k: v}`,
  ChordGlyph, barres dessinées, ChartHeader dérivé + Petaluma Script OFL →
  [rapport](sessions/2026-07-12-p1-chart-rendering.md)

### Roadmap excellence 3 (2026-07-11 → …)

- 2026-07-12 · **O.5 — basses code groupées** (PR #112 mergée, Lot O clos) : AbortSignal
  /tempo+/chords bout-en-bout, coverage create-chord-detector aligné,
  `PopoverForm` partagé → [rapport](sessions/2026-07-12-grouped-lows-o5.md)
- 2026-07-12 · **O.4 — btc_windows.py pur** (PR #111) : fenêtrage
  TIMESTEP extrait de chords.py, `window_plan` testé (6 pytest), _analyse
  rebranché → [rapport](sessions/2026-07-12-btc-windows.md)
- 2026-07-12 · **O.3 — split workstation-shell.spec** (PR #110) : 115
  tests répartis en 9 specs par parcours + `shell-test-kit.tsx` colocalisé →
  [rapport](sessions/2026-07-12-split-shell-spec.md)
- 2026-07-12 · **O.2 — micro-dérives design** (PR #109 mergée) : transitions
  sur tokens motion, focus toast amber, marker-rail/ruler tokenisés,
  `--tracking-label` → [rapport](sessions/2026-07-12-design-micro-drifts.md)
- 2026-07-12 · **Interlude — react-doctor 0.7.6 / hook `useLatest`** (PR #107
  mergée) : 14 refs mutées au rendu purifiées (écriture en effet), Dependabot
  débloqué → [rapport](sessions/2026-07-12-react-doctor-ref-mutations.md)
- 2026-07-12 · **O.1 — token mort `--accent` + check:tokens** (PR #106
  mergée) :
  erreur tempo re-colorée via `errorLine`, gate verrouillé par un diff
  var() utilisées/définies →
  [rapport](sessions/2026-07-12-dead-accent-token.md)
- 2026-07-12 · **N.4 — micro-frictions panneau accords** (PR #105 mergée) :
  champ mes./ligne flaggé (aria-invalid + badInput), préférence localStorage
  posée au blur, ligne « Détecter » sous le header →
  [rapport](sessions/2026-07-12-chord-panel-frictions.md)
- 2026-07-12 · **N.3 — divergence pitch ↔ grille** (PR #100 mergée) :
  `transposedBy` persisté, transposition appariée en core, flag modulo 12,
  « Transposer la grille pour suivre » confirmé deux temps →
  [rapport](sessions/2026-07-12-pitch-chart-divergence.md)
- 2026-07-12 · **N.2 — raccourcis L/K/T + gardes repeat/dialog** (PR #99
  mergée) : toggles boucle/métronome/tap au clavier, carte auto-dérivée,
  listener global durci →
  [rapport](sessions/2026-07-12-practice-toggle-shortcuts.md)
- 2026-07-12 · **N.1 — erreurs accords discriminées + Lingui** (PR #98) :
  codes typés bout-en-bout, `classifyTransportError` partagé, copy
  actionnable annoncée →
  [rapport](sessions/2026-07-12-chord-detection-error-codes.md)
- 2026-07-11 · **M.3 — lows serveur groupés, Lot M clos** (PR #97) : timeout
  d'inférence qui tire vraiment (`abandon_on_cancel`), `FileResponse`,
  épinglage documenté → [rapport](sessions/2026-07-11-server-lows-m3.md)
- 2026-07-11 · **M.2 — /download borné** (PR #96) : sémaphore + `max_filesize`
  + budget total (et `/separate` aussi) →
  [rapport](sessions/2026-07-11-harden-download.md)
- 2026-07-11 · **M.1 — garde Origin CSRF** (PR #95) : `OriginGuardMiddleware`,
  403 hors allowlist, same-origin de confiance →
  [rapport](sessions/2026-07-11-origin-guard.md)
- 2026-07-11 · **L.4 — memo WAV encodé** (PR #94, **Lot L clos**) :
  `encodeWavMemo` WeakMap, le mix encodé une fois pour `/tempo`/`/chords`/
  `/separate`/export piste → [rapport](sessions/2026-07-11-wav-encode-memo.md)
- 2026-07-11 · **L.3 — mémoire stems** (PR #93) : le moteur multitrack unique
  gardien du PCM des stems (~500 MB vs ~1 GB sur 6 stems), `stemAudio(id)` sur
  le port, sources paresseuses zéro-copie →
  [rapport](sessions/2026-07-11-stems-memory.md)
- 2026-07-11 · **L.2 — suivi par pages du ZoomStage** (PR #92) :
  `followScrollLeft` pur, plus d'écriture `scrollLeft` par frame, grâce 2 s au
  scroll manuel → [rapport](sessions/2026-07-11-zoom-stage-page-follow.md)
- 2026-07-11 · **L.1 — playhead hors état React** (PR #91) :
  `createExternalValue` + playhead impératif — 8 commits React/5 s contre
  ~60–120/s → [rapport](sessions/2026-07-11-playhead-external-store.md)
- 2026-07-11 · **Lot K — grille & tempo** (PRs #89/#90) : `sanitizeBeatGrid`
  deux passes + filtre miroir serveur (K.2) ; scrollport LeadSheet + suivi du
  playhead + footer sticky (K.1) →
  [K.2](sessions/2026-07-11-tempo-map-outliers.md) ·
  [K.1](sessions/2026-07-11-lead-sheet-scrollport.md)
- 2026-07-11 · **Évaluation notée v3** (16,0/20, six axes dont performance) :
  revue multi-agents vérifiée adversarialement, 35 constats confirmés →
  [roadmap-excellence-3](roadmap-excellence-3.md) (Lots K–O)

### Plan chord-charts (2026-07-10 → …)

- 2026-07-11 · **Lot C serveur + web — détection ACE bout-en-bout** (PR #87 +
  PR web) : `POST /chords` BTC vendoré sha256-pinné, adapter mir→tokens,
  bouton « Détecter les accords » → brouillon confirmé →
  [serveur](sessions/2026-07-11-chords-endpoint.md) ·
  [web](sessions/2026-07-11-detect-chords-ui.md)
- 2026-07-11 · **Lot C core — détection d'accords** (PR #86) : port
  `ChordDetector` + `chordLabelPerMeasure` + `renderChartSource` +
  `detectChords` → brouillon source →
  [rapport](sessions/2026-07-11-chord-detection-core.md)
- 2026-07-11 · **Sync lecture de la lead-sheet** (PR #80) : `measureIndexAt`
  pur (mesure ↔ intervalle downbeat→downbeat, projection jamais stockée),
  surlignage `aria-current` + bars-per-row configurable →
  [rapport](sessions/2026-07-11-chord-chart-playback-sync.md)
- 2026-07-10 · **Transposition de la grille** (PR #79) :
  `transposeChartSource(source, ±n)` réécrit le texte source en préservant la
  mise en page ; garde round-trip par token, accidentals unicode →
  [rapport](sessions/2026-07-10-chord-chart-transpose.md)
- 2026-07-10 · **Persistance de la grille** (PR #78) : `ProjectChordChart
  { source }` signé dans le manifest (absent ⇔ vide), état lifté au shell,
  restauré à l'ouverture, reset à l'import ; piège du test vacuement vert
  durci par import intermédiaire ; extraction `use-shell-drop.ts` →
  [rapport](sessions/2026-07-10-chord-chart-persistence.md)
- 2026-07-10 · **Lot A/B — socle lead-sheet** (PR #77) : `chord-symbol` +
  `chord-chart` purs (format grille maison, round-trip fast-check),
  `LeadSheet` CSS Grid zéro lib + saisie live ; moteur ACE arbitré = BTC
  (MIT) ; Stryker 100 % sur les fichiers chord ; vérif navigateur → fix
  tokens (accords invisibles) →
  [rapport](sessions/2026-07-10-chord-charts-lot-a-b.md)

### Roadmap excellence 2 (Lots F → J, 2026-07-07 → 07-11)

- 2026-07-11 · **Lot J — fond de panier** (PRs #81–#85 mergées) : tokens
  sémantiques, `:active`, dédup moteurs Web Audio, quota disque, annulation —
  roadmap-excellence-2 **entièrement cochée** →
  [rapport](sessions/2026-07-11-lot-j-fond-de-panier.md)
- 2026-07-09/10 · **Lot I.3 — count-in du métronome, LOT I COMPLET** (PR #76) :
  une mesure de clics avant le départ — atterrissage calé sur la grille,
  accents phasés sur la mesure du morceau, tempo entendu; adaptateur one-shot
  robuste à l'autoplay → [rapport](sessions/2026-07-09-metronome-count-in.md)
- 2026-07-09 · **Lot I.2 — tempo manuel** (PR #75) : tap-tempo (médiane), champ
  BPM éditable, calage de phase; `ManualTempo` signé/persisté →
  [rapport](sessions/2026-07-09-manual-tempo.md)
- 2026-07-09 · **Lot I.1 — speed trainer** (PR #74) : rampe de tempo par
  passes de boucle; plancher tempo 40 %; la boucle confine la tête →
  [rapport](sessions/2026-07-09-speed-trainer.md)
- 2026-07-08 · **Lot H — a11y live-regions** (PR #73) : séparation et
  détection tempo annoncées (primitive `LiveStatus`) →
  [rapport](sessions/2026-07-08-web-a11y-live-regions.md)
- 2026-07-08 · **Lot G — confiance utilisateur** (PR #72) : suppression
  deux-temps repère/boucle, erreurs actionnables (réimport, retry tempo),
  drop non-audio signalé → [rapport](sessions/2026-07-08-web-user-trust-lot-g.md)
- 2026-07-07 · **Lot F — hygiène serveur** (PR #70) : cap `/download` 🔴,
  sémaphore `/tempo`, `wav_decode` torch-free testé, README resync →
  [rapport](sessions/2026-07-07-server-hygiene-lot-f.md)
- 2026-07-06 · **Évaluation notée v2** (15,3/20) →
  [roadmap-excellence-2](roadmap-excellence-2.md) (Lots F–J, suivi coché en fin
  de fichier)

### Plan tempo (Lots A → C, 2026-07-06 → 07-07)

- 2026-07-07 · **Lot C — tempo variable** (PR #69) : `buildTempoMap`/`tempoAt`
  dérivés de la grille (jamais persistés), read-out suit la tête →
  [rapport](sessions/2026-07-07-tempo-map.md)
- 2026-07-06 · **Lot B.2 — serveur `beat_this`** (PR #68) : beats + downbeats
  transformer (mesure réelle), humble object `beat_positions` 100 % →
  [rapport](sessions/2026-07-06-tempo-beat-this-server.md)
- 2026-07-06 · **Lot B.1 — contrat `/tempo` enrichi** (PR #67) : `barPosition`
  par beat, `detectMeter`, `beatsPerBar` persisté →
  [rapport](sessions/2026-07-06-tempo-enriched-contract.md)
- 2026-07-06 · **Lot A — correction d'octave ×2/÷2** (PR #66) :
  `foldTempoOctave`, `octaveShift` signé/persisté →
  [rapport](sessions/2026-07-06-tempo-octave-toggle.md)

### Roadmap excellence 1 (Lots A → E, 2026-07-05 → 07-06)

- 2026-07-06 · **Lot E.1 — split `use-player`** : `use-loop` +
  `use-transport-engines` extraits (comportement préservé) →
  [rapport](sessions/2026-07-06-web-split-use-player.md)
- 2026-07-06 · **Lot E trio — dette de complexité** (PR #63) :
  `isSyntheticStem`, handler nommé, no-op map supprimé →
  [rapport](sessions/2026-07-06-web-complexity-debt-trio.md)
- 2026-07-06 · **Lot D.3 — feedbacks manquants** : garde URL inline, primitive
  toast (Base UI), confirmations export/save →
  [rapport](sessions/2026-07-06-web-feedbacks.md)
- 2026-07-06 · **Lot D.2 — « Séparer » ↔ santé serveur** : bouton désactivé +
  hint actionnable hors-ligne / sans moteur →
  [rapport](sessions/2026-07-06-web-separate-server-health.md) · D.1 undo/redo
  → veille (décision produit)
- 2026-07-05 · **Lot C.5 — micro-motion overlays** →
  [rapport](sessions/2026-07-05-web-overlay-micromotion.md)
- 2026-07-05 · **Lot C.4 — boutons unifiés + icônes SVG** →
  [rapport](sessions/2026-07-05-web-unify-buttons-icons.md)
- 2026-07-05 · **Lot C.3 — design system (type/élévation/z-index/radius)** —
  incl. le piège Base UI « z-index sur le Positioner » →
  [rapport](sessions/2026-07-05-web-design-system-tokens.md)
- 2026-07-05 · **Lot C.2 — responsive intrinsèque (Every Layout, 0 media
  query)** (PR #58) → [rapport](sessions/2026-07-05-web-responsive-tactile.md)
- 2026-07-05 · **Lot C.1 — DnD natif + empty-state** (PR #57) →
  [rapport](sessions/2026-07-05-web-dnd-empty-state.md)
- 2026-07-05 · **Lot B — discipline serveur** (PR #54/#55/#56) : pytest élargi,
  gate serveur CI torch-free (ruff+pyright+coverage), humble objects extraits →
  [B.1](sessions/2026-07-05-server-pytest-breadth.md) ·
  [B.2](sessions/2026-07-05-server-lint-types-ci.md) ·
  [B.3](sessions/2026-07-05-server-humble-objects.md)
- 2026-07-05 · **Lot A — sécurité serveur** (PR #48/#49/#50/#51) : pip runtime
  supprimé 🔴, CORS/TrustedHost, caps + semaphore + tmp durci, loopback-only →
  [A.1](sessions/2026-07-05-server-no-runtime-pip.md) ·
  [A.2](sessions/2026-07-05-server-cors-host.md) ·
  [A.3](sessions/2026-07-05-server-resource-limits.md) ·
  [A.4](sessions/2026-07-05-server-loopback-and-filename.md) — roadmap :
  [roadmap-excellence](roadmap-excellence.md)
- 2026-07-05 · **Housekeeping** : jscpd 14→7, tabs, coverage web gatée 85/80 →
  [rapport](sessions/2026-07-05-dry-tabs-coverage.md)

### Tronc fonctionnel (2026-07-03 → 07-04)

- 2026-07-04 · **UI clarity pass** (PR #46) : mix sommé, boucles en sidebar,
  séparation relocalisée → [rapport](sessions/2026-07-04-ui-workstation-clarity.md)
- 2026-07-04 · **Persistance métronome** (PR #41) : `ProjectTempo` sur le
  manifest, reopen sans serveur →
  [rapport](sessions/2026-07-04-metronome-persistence.md)
- 2026-07-04 · **Import depuis URL** (PR #42) : port `TrackSource`, yt-dlp
  serveur, menu Importer → [core](sessions/2026-07-04-import-from-url-core.md) ·
  [adapter+UI](sessions/2026-07-04-import-from-url-adapter-ui.md)
- 2026-07-04 · **Métronome-stem** (PR #40) : clic synthétisé comme stem du
  mixer, auto-détection à l'import →
  [rapport](sessions/2026-07-04-metronome-stem.md)
- 2026-07-03 · **Détection de tempo réelle** (PR #39, serveur librosa) →
  [rapport](sessions/2026-07-03-tempo-detection.md)
- 2026-07-03 · **Persistance tempo/pitch/zoom** (PR #38) →
  [rapport](sessions/2026-07-03-persist-tempo-pitch-zoom.md)
- 2026-07-03 · **i18n Lingui** (PR #37) + shell éclaté en régions →
  [rapport](sessions/2026-07-03-i18n-lingui.md)
- 2026-07-03 · **Garde session non enregistrée** (PR #36) →
  [rapport](sessions/2026-07-03-dirty-session-guard.md)
- 2026-07-03 · **UI polish** (PR #35) : marqueurs draggables, gutter DAW →
  [rapport](sessions/2026-07-03-ui-polish.md)

### Jalons fondateurs (2026-06-28 → 07-02) — tous livrés

- **Jalon 1 — atelier de base** (import/waveform, transport, time-stretch
  SoundTouch, repères, boucles A/B, zoom, raccourcis) : complet + poli —
  plan [jalon-1-plan.md](jalon-1-plan.md), rapports datés du 2026-06-28.
- **Jalon 2 — séparation IA** : serveur local FastAPI + Demucs
  (`htdemucs_6s`) derrière le port `StemSeparator` (les moteurs WASM
  in-browser ont été retirés), détection d'instruments, mixer multitrack,
  export stems zip. Clos le 2026-07-02 —
  plan [jalon-2-plan.md](jalon-2-plan.md),
  [vérif export](sessions/2026-07-02-jalon2-export-verify.md).
- **Jalon 3 — projets** : domaine `Project` pur, ports + use-cases, adapter
  serveur HTTP (blobs content-addressed), boucles par projet, save
  incrémental, races corrigées; polish (rename `server/`, renommage projet,
  GC blobs) mergé PR #43/#44/#45 —
  [polish](sessions/2026-07-04-jalon3-polish.md),
  [état de session UX](sessions/2026-07-02-ux-session-state.md).
- **J4.1 — import URL** livré avec le tronc fonctionnel (ci-dessus).

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** — **REVISED (2026-06-30): a local server is now the default
  and required path.** In-browser WASM (demucs.cpp GGML / onnxruntime-web) hit a
  quality+speed wall (quantised models, wasm32 memory ceiling, no native GPU). A
  **FastAPI + Demucs** backend (`server/`, GPU-capable, outside the hexagon)
  implements the same `StemSeparator` port via an HTTP/NDJSON contract;
  `createSeparator` returns the HTTP adapter. **The in-browser WASM engines were
  removed** — server-side Demucs is the single supported engine. htdemucs weights
  are research-only — fine for this non-commercial tool, not for a commercial
  product. **Phase 2 (2026-07-18)** : le calcul est offloadé sur **Modal**, le
  serveur local devient dev/CI + lib déployée par Modal.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Plans

- [roadmap-excellence-7.md](roadmap-excellence-7.md) — **en cours** (Lots AJ–AQ,
  UX exceptionnelle, éval du 2026-07-19).
- [client-leger-plan.md](client-leger-plan.md) — **complet** (Phase 1 Modal +
  Phase 2 Tauri livrées ; loupe = app de bureau + Modal).
- [roadmap-excellence-6.md](roadmap-excellence-6.md) — **complet** (Lots AC–AI,
  éval du 2026-07-18).
- [roadmap-excellence-5.md](roadmap-excellence-5.md) — **complet** (Lots X–AA +
  cap client léger, éval du 2026-07-16).
- [roadmap-excellence-4.md](roadmap-excellence-4.md) — **complet** (Lots Q–W,
  éval du 2026-07-14).
- [roadmap-excellence-3.md](roadmap-excellence-3.md) — **complet** (Lots K–P,
  éval du 2026-07-11).
- [roadmap-excellence-2.md](roadmap-excellence-2.md) — **complet** (Lots F–J ;
  J en PRs #81–#85, suivi coché en fin de fichier).
- [chord-charts-plan.md](chord-charts-plan.md) — **complet** (Lots A/B/C
  livrés ; Lot D ChordPro = optionnel, en veille).
- [tempo-detection-plan.md](tempo-detection-plan.md) — complet (Lots A–C).
- [roadmap-excellence.md](roadmap-excellence.md) — complet (Lots A–E).
- [jalon-2-plan.md](jalon-2-plan.md) · [jalon-1-plan.md](jalon-1-plan.md) —
  complets.

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap (coûteux, si l'usage le réclame).
- Locale EN (infra Lingui prête, seul `fr` existe).
- Chemin clavier pour créer une boucle A/B (design à concevoir avant de coder).
- Thème clair (décision produit).
- Undo/redo (D.1) — écarté produit : faible ROI pour un outil de pratique.
- Off-thread zip/encode — l'export gèle l'UI quelques secondes (~229 MB
  mesurés) sur une piste de 4 min.
- Jalon 4 — export MIDI par stem (basic-pitch), différenciateur audio→notation.
- Dependabot #180 (TypeScript 6→7) + #53 (`@vitejs/plugin-react` v6, breaking
  Babel→oxc) — reportés (session outillage dédiée).
- Vieux manifests *séparés* : re-`attach` sur le detect fire-and-forget peut
  écraser des réglages de fader faits pendant la fenêtre de détection —
  s'auto-répare à la sauvegarde; corriger seulement si ça mord.
- Race `addStem`/`play` sur bus stretch froid (revue V.5, préexistante) :
  play pendant l'enregistrement du worklet (~100–500 ms au premier
  chargement) peut créer deux sources pour un même stem, la première
  orpheline (inarrêtable jusqu'à sa fin naturelle) — corriger si ça mord.
- Worker pour le DSP accords (774 ms uniques mesurés AD) — follow-up si ça mord.
