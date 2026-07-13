# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. **Only the current step is detailed here** — the full
> story of every past step lives in its dated report under
> [docs/sessions/](sessions/); the history below keeps one line per step.

## Where we are

**Lot C chord-charts — COMPLET (2026-07-11)** : les trois slices livrées le
même jour. **Core** (PR #86 mergée) : port `ChordDetector` + agrégation pure
`chordLabelPerMeasure` (1 accord/mesure sur les intervalles
downbeat→downbeat) + `renderChartSource` + use-case `detectChords` →
brouillon de texte source. **Serveur** (PR #87 mergée) : spike BTC levé
(2,4 s CPU / 257 s d'audio), `POST /chords` (BTC vendoré MIT, poids
sha256-pinnés, 503 sans torch/poids), helper pur `chord_spans`. **Web**
(branche `feat/detect-chords-ui`) : adapter `createHttpChordDetector`
(traduction mir→tokens, `N`/`X`→silence), hook `useChordDetection` (jeton de
run, brouillon = édition manuelle persistée), bouton « Détecter les accords »
(confirmation deux temps avant écrasement, hints actionnables serveur/grille,
LiveStatus a11y). Gate **vert — 925 tests** (+19), serveur 127 pytest.

**En cours : [feuille de route v3](roadmap-excellence-3.md)** (évaluation
notée du 2026-07-11, 16,0/20). **Lots K et L clos** (PRs #89–#94 mergées —
voir l'historique ci-dessous).
**M.1 mergé (PR #95)** : `OriginGuardMiddleware` — 403 pour tout `Origin` hors
allowlist (CSRF « simple request »), same-origin de confiance, chaque valeur
dupliquée vérifiée.
**M.2 mergé (PR #96)** : `/download` borné (sémaphore, `max_filesize`, budget
wall-clock **total** 900 s — un trickle ne le réarme pas, `socket_timeout` 30 s)
et `/separate` reçoit le même budget (1800 s — son `events.get()` n'avait
aucun timeout).
**Lot M complet** (M.1 PR #95, M.2 PR #96, M.3 PR #97 mergées).
**N.1 mergé (PR #98)** : codes d'échec discriminés bout-en-bout pour la
détection d'accords + copy Lingui actionnable, `classifyTransportError`
partagé (conflit avec `main` résolu au merge — STATUS + catalogue régénéré).
**N.2 mergé (PR #99)** : raccourcis `L`/`K`/`T` (boucle/métronome/tap),
carte auto-dérivée, listener global durci (repeat + dialogues).
**N.3 mergé (PR #100)** : `transposedBy` persisté (absent ⇔ 0), transposition
appariée texte+offset en core, flag divergence **modulo 12**, « Transposer la
grille pour suivre » confirmé deux temps, `signedSemitones` partagé.
**N.4 mergé (PR #105)** : champ « mes. / ligne » flaggé (`aria-invalid` +
badInput), préférence localStorage posée au blur, ligne « Détecter » sous le
header — **Lot N clos**.
**O.1 mergé (PR #106)**, **interlude react-doctor 0.7.6 mergé (PR #107)**,
**O.2 mergé (PR #109)** — voir l'historique.
**O.3 mergé (PR #110)** :
`workstation-shell.spec.tsx` (2 438 lignes, 115 tests, un seul `describe`)
découpé par parcours en 9 specs colocalisées (`.import`, `.tempo`,
`.transport`, `.shortcuts`, `.loops`, `.stems`, `.chords`, `.projects` + le
socle landmarks) — aucun test réécrit, uniquement déplacés. Fixtures
communes dans `shell-test-kit.tsx` (fakes des ports, `renderShell`,
`importTrack`, `saveProjectAs`, `installShellHooks()` appelé en tête de
chaque spec) ; helpers mono-parcours restés locaux. Le kit, non-`.spec`
donc scanné par react-doctor : `tapThrice` déroulé (faux positif « await in
loop »), `deslop/unused-file` ignoré pour le kit (même cas que le wrapper
i18n). Gate vert **1047 tests** (total inchangé avant/après — aucun test
perdu), Stryker skipped (core intouché).
**O.4 mergé (PR #111)** : le
padding/fenêtrage TIMESTEP de `chords.py` (exclu de coverage + pyright)
extrait en `btc_windows.py` pur testé (`window_plan` → `{pad, slices}`,
6 pytest, modèle `chord_spans.py`), `_analyse` rebranché, équivalence
ancien/nouveau vérifiée par script. Serveur **163 pytest** (+6), pyright 0,
coverage 97,6 %.
**O.5 mergé (PR #112) — Lot O clos.** `AbortSignal`
bout-en-bout `/tempo`+`/chords` (ports core → use-cases → `postWavForJson` →
hooks ; abort au reset/override/nouveau run/changement de piste/démontage —
le sémaphore serveur est libéré), `create-chord-detector.ts` exclu de la
couverture avec ses jumeaux, boilerplate Popover factorisé en `PopoverForm`
(NameEditor + SpeedTrainerControls, clones jscpd résorbés). Gate vert
**1057 tests** (+10), **Stryker 95,2 %** (core touché). Revue 8 angles :
abort à l'unmount de useTempo ajouté ; import-menu volontairement non migré
(il lui faut anchor + form + hint — API à élargir seulement si un 4e
formulaire apparaît).
**Plan du Lot P écrit et validé**
([lead-sheet-chart-plan.md](lead-sheet-chart-plan.md)) sur la maquette
fournie (`your-song-elton-john-chart.pdf`, non versionnée — rendu cible +
fonctionnalités) ; trois arbitrages pris : rendu d'abord, sync lecture via
unroll dès P.2, en-tête dérivé de la session + directives `{…}` de surcharge.
**P.1 — rendu chart mergé (PR #113)** : directives `{k: v}`, `ChordGlyph`,
barres dessinées, `ChartHeader` dérivé + Petaluma Script OFL — voir
l'historique.
**P.2 — grammaire de forme + déroulement mergé (PR #114)** — voir
l'historique.
**P.3 mergé (PR #115)** — édition repliée, chart-first — voir l'historique.
**P.4 phase 1 — déduction de structure, sur `feat/p4-structure-deduction`
(PR à ouvrir)** : le brouillon de détection n'est plus plat — domaine pur
`chart-structure.ts` : `deduceStructure` (structure = compression MDL,
tuilages uniformes 16/12/8/4 vs morceau entier, matching flou ≥ 3/4 des
mesures **détectées** — le silence ne vote pas, vote majoritaire qui
nettoie les accords mal détectés) + `renderStructuredSource` (en-têtes
`[A]`/`[B]`, paire adjacente pliée en `|: … :|`, un objet section partagé
par type — pli sur l'identité). `detectChords` composé dessus. 2 propriétés
fast-check (round-trip render→parse→unroll, générateur avec chansons
structurées). **Stryker 100 % sur chart-structure.ts** (104 mutants, 2 runs
ciblés). Revue 8 angles : 5 constats fixés en TDD (dont silence-compte-
comme-accord qui effaçait un accord réel), 3 arbitrés (tie de vote garde la
1re occurrence ; runs > 2 écrits ; pas d'offset de phase — DP MDL en
phase 2 si besoin). Gate vert **1173 tests** (+22).
**Next : pousser la branche + ouvrir/merger la PR P.4 (phase 1). Ensuite :
P.4 impression (en veille) ou phase 2 structure (port audio) si l'usage le
réclame.**
Retrofit `/tempo` sur `classifyTransportError` toujours noté.
See [P.4](sessions/2026-07-13-p4-structure-deduction.md) ·
[P.3](sessions/2026-07-12-p3-collapsed-edit.md) ·
[P.2](sessions/2026-07-12-p2-form-unroll.md) ·
[P.1](sessions/2026-07-12-p1-chart-rendering.md) ·
[O.5](sessions/2026-07-12-grouped-lows-o5.md) ·
[O.4](sessions/2026-07-12-btc-windows.md) ·
[O.3](sessions/2026-07-12-split-shell-spec.md) ·
[O.2](sessions/2026-07-12-design-micro-drifts.md) ·
[interlude](sessions/2026-07-12-react-doctor-ref-mutations.md) ·
[O.1](sessions/2026-07-12-dead-accent-token.md).

## Historique (une ligne par étape, du plus récent au plus ancien)

### Lot P — lead-sheet chart (2026-07-12 → …)

- 2026-07-13 · **P.4 phase 1 — déduction de structure** (PR à ouvrir) :
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
  product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Plans

- [roadmap-excellence-3.md](roadmap-excellence-3.md) — **en cours** (Lots K–O,
  évaluation notée du 2026-07-11).
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
- Dependabot PR #53 (`@vitejs/plugin-react` v6, breaking Babel→oxc) — reporté.
- Vieux manifests *séparés* : re-`attach` sur le detect fire-and-forget peut
  écraser des réglages de fader faits pendant la fenêtre de détection —
  s'auto-répare à la sauvegarde; corriger seulement si ça mord.
