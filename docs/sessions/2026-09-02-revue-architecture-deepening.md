# Session — 2026-09-02 — revue d'architecture (deepening) : sept candidats, le player retenu

Revue « improve-codebase-architecture » (skill mattpocock, vocabulaire
codebase-design : module / interface / depth / seam / adapter / leverage /
locality, test de suppression). Point chaud choisi par l'historique : le
shell d'atelier (`workstation-shell.tsx`, 25 commits depuis le 25 juillet)
et les seams qu'il traverse vers le cœur. Deux enquêteurs parallèles (shell
web ; cœur + ports), dix constats bruts fusionnés en sept candidats. Le
rapport HTML vit hors dépôt (`C:\Users\PIDR01261\Downloads\architecture-review-loupe-20260902.html`) ;
l'essentiel est consigné ici pour la reprise.

## Done

- **Sept candidats**, par force :
  1. **Strong — Finir la migration du player vers les atomes.** Cinq
     `useState` restent dans `waveform/use-player.ts:156-168` (`metadata`,
     `loadedAudio`, `loadedBytes`, `timeRatio`, `fineTuneCents`) ; le shell
     est donc le seul à pouvoir les tenir et les distribue à 6 orchestrateurs
     + `ShellFooter` (12 props). C'est pourquoi `MAX_HOOKS_PER_COMPONENT`
     (25, `composition-invariants.spec.ts:27`) n'a jamais bougé. Clé de voûte
     de 3 et 7. Aucun ADR à rouvrir (0010 rule 2, 0011).
  2. **Strong — Un module « seat the click ».** La politique de siège du
     métronome (enable / attach / join / reseat) est re-décidée par 4
     appelants à partir de 4 faits lus à 25 sites ; le fix AU.1 (`d680885`)
     a touché 6 fichiers pour une règle. Feuille Mikado indépendante.
  3. **Strong — Le provider de session crée les adapters.** Dix copies du
     repli `explicit ?? session ?? createReal()`, `useStemStack` (pur
     forwarding) et un second `AudioSessionContext.Provider`. Note de
     conséquence sur l'ADR 0011 (« la prod sans Provider ») ; monter le player
     lui-même dans le provider = Worth exploring, après 1.
  4. **Strong / Worth exploring — Le seam « lancer une analyse ».** Quatre
     classes d'erreur de transport identiques (tempo, chords, structure,
     separation) + protocole gate/runId/abort/commit réécrit dans chaque hook
     avec dérives ; 0 contrat sur 4 ports d'analyse (promesse ADR 0002).
  5. **Worth exploring — Triangle structure ↔ repères ↔ grille** : une
     opération `reconcile` dans le module structure ; `relabelChartBySections`
     (6 positionnels + booléen), garde downbeat dupliquée, inverse
     `markerSections` sans foyer.
  6. **Worth exploring — `detectChords` assemble ses entrées** (mix sans
     batterie, ligne de basse, memo DSP dans `use-chord-detection.ts`).
  7. **Worth exploring — Seam projet ↔ session** : 23 deps web
     (`use-project-session.ts`), 11 callbacks cœur (`SessionRestoreDeps`),
     « piste fraîche » réinitialisée à 3 endroits. Après 1 ; la moitié cœur
     (plan de restauration comme valeur) reste Speculative.
- **Sain, à ne pas re-proposer** : seams d'`audio-session.ts`,
  `use-transport-engines.ts`, `use-mixer.ts`, `use-separation.ts`/`use-tempo.ts`
  (jeton de run), `shell-stage.tsx`, `shell-busy.ts`, `use-shell-shortcuts.ts`,
  `use-chart-with-structure.ts`, corps de `detectChords`, playback, speed
  trainer, count-in domain, les use-cases d'analyse, `ProjectStore` (seul
  contrat rejoué ×2), la surface publique (aucune valeur importée par > 6
  fichiers), `renderShell`.
- **Candidat 1 retenu par le pilote** ; grilling ouvert, tour 1 posé (8
  questions, réponses recommandées) — **sans réponse à la clôture**.
- Dettes de registre relevées : `application/README.md` cite encore
  `createFsProjectStore`, `createTauriTrackSource`, `collectFsGarbage`
  (disparus avec Tauri) ; le détecteur `ReturnType` ne voit pas les
  paramètres de fonction (`playbackSteppers`, `workstation-shell.tsx:120`).

## Not done / remaining

- Le tour 1 du grilling attend les réponses du pilote (ci-dessous). Rien
  n'est codé.
- Le HTML de la revue n'est pas versionné (choix du skill : rien dans le
  dépôt) ; ce rapport en est la trace.

## Decisions

- Aucune frontière ni invariant touché ; pas d'ADR. Les sept candidats sont
  compatibles avec les ADR 0002–0013 ; seule une note de conséquence sur
  l'ADR 0011 accompagnerait le candidat 3.

## State to resume from

- **Single next action** : obtenir les réponses au tour 1 du grilling du
  candidat 1, puis ouvrir la tranche (branche + PR) dans l'ordre Mikado
  recommandé. Les 8 questions et les réponses recommandées :
  1. Périmètre : les cinq états en atomes de valeur dans
     `waveform/player-atoms.ts`, `loadedBytes` compris → **oui**.
  2. Verbes (`importFile`, `togglePlayback`, `setTimeRatio`,
     `setPitchSemitones`, `setFineTuneCents`, `restoreTuning`, `restoreLoop`)
     sur `PlayerHandle` via `useLatest`, jamais en write-atom (garde ADR
     0010) ; handle à plat, `Pick` chez les consommateurs → **oui**.
  3. `usePlayer` reste monté dans le shell, `AudioSessionWithPlayer`
     inchangé (le provider = candidat 3) → **oui**.
  4. Atome dérivé `tuning` (typé `ProjectTuning`) dans `player-atoms.ts`,
     lit `viewportZoomAtom` (même dossier) → **oui**.
  5. Le count-in à 0 param + `countingInAtom` : **tranche suivante**.
  6. `MAX_HOOKS_PER_COMPONENT` descendu à la valeur mesurée dans la PR ;
     détecteur `ReturnType` étendu aux paramètres → **oui aux deux**.
  7. Tests : specs de hooks sèment `createStore()` + Provider (modèle
     `use-separate-and-load.spec.tsx`) ; `fakePlayerHandle()` dans
     `shell-test-kit.tsx` (deux copies existent : `loop-atoms.spec.tsx`,
     `audio-session.spec.tsx`) ; specs shell inchangées → **oui**.
  8. Ordre Mikado par valeur, un commit chacun, gate vert à chaque pas :
     `loadedAudio` → `metadata`, `loadedBytes` → `timeRatio` +
     `fineTuneCents` + `tuning` → verbes sur le handle → shell nettoyé,
     `ShellFooter` en région `regions/shell-footer/` (smart, passe des props
     au `transport-bar` dumb), cliquets → **cet ordre**.
- Tree state : `main` propre à `8d38374` (PR #387 mergée, Quality gate CI
  vert) ; stamp local absent (le gate a tourné dans un worktree, supprimé
  depuis) — aucun code modifié depuis.
- Gotchas :
  - Le skill `mattpocock-skills:improve-codebase-architecture` n'apparaît pas
    dans la liste chargée mais existe sur disque
    (`~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3/skills/engineering/`) ;
    l'invoquer par son nom fonctionne. Il enchaîne sur `grilling` puis
    `domain-modeling` (loupe n'a pas de `CONTEXT.md` : le vocabulaire vit
    dans `application/README.md` et les ADR).
  - Consommateurs de `loadedAudio` à migrer (non-spec) : `use-tempo-detection`,
    `use-chart-with-structure`, `use-resume-gated-analysis`, `use-stem-export`,
    `use-chord-detection`, `use-chord-chart-session`, `use-structure-detection`,
    `use-structure-markers`, `use-modal-warmup`, et le shell (`canSeparate`,
    `separateAndLoad(loadedAudio)`).
  - `SONAR_TOKEN` toujours à renouveler : la PR #387 a été mergée avec le
    check « SonarCloud analysis » en FAILURE (403 au provisionnement JRE),
    donc le check requis ne bloque pas le propriétaire du dépôt. Tant que le
    token n'est pas régénéré, `sonar.qualitygate.wait` n'a jamais été
    exercé et aucune PR n'a de verdict Sonar.
