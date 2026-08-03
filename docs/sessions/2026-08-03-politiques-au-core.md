# Session — 2026-08-03 — politiques au core (priorité 2 de la revue #357)

## Done

- **Speed-trainer — règle unique de désarmement** (`speedTrainerSurvives(seam)`,
  `domain/speed-trainer.ts`). L'union `SpeedTrainerSeam` nomme les sept
  transitions de session (loupe sélectionnée/ajustée/effacée/restaurée,
  looping on/off, tempo repris) ; la règle tient en une fonction : seuls
  `loupe-adjusted` et `looping-enabled` laissent la rampe vivre. Côté web,
  les **6 `stop()` défensifs** (4 dans `use-player.ts`, 2 dans
  `use-loop-editing.ts`) deviennent des `cross(seam)` — le site nomme
  l'événement, le core décide. `PlayerHandle.speedTrainer` s'élargit de
  `cross` (le sac pilote le player via le handle, jamais l'inverse —
  convention PR #306). Le `stop()` direct ne survit que sur le bouton
  « Arrêter la rampe » (commande utilisateur, pas un seam).
- **Transport — la politique par frame au core** (`resolvePlaybackTick`,
  `domain/playback-tick.ts`). Le playhead reste streamé hors React (décision
  perf Lot L.1) mais ce qu'une frame SIGNIFIE — wrap de la boucle armée
  (avec ou sans passe gagnée), arrêt en fin de piste réelle — est une
  fonction pure (11 tests dont 1 propriété). Le listener de
  `use-transport-engines.ts` n'exécute plus que le verdict. Le cas **`tick`
  mort du `transportReducer` est supprimé** (action + reducer + specs) — la
  moitié « supprimer » de l'alternative de la revue, la moitié « router »
  étant contraire à L.1. Effet ricochet vertueux : `public-surface.spec.ts` a
  exigé la dé-exportation de `wrapToLoop` et `completesLoopPass`, devenus
  internes au core.
- **Session — `restoreSession`/`sessionSaveInput`/`sessionSignature` au core**
  (`project/application/session.ts`, `project/domain/session-signature.ts`).
  Le use-case de restauration (~120 lignes web sans React) est un vrai
  use-case core derrière des ports en vocabulaire core (`importAudio` en
  bytes+nom, seats markers/loops/mixer/separation, `tempo.set/detect`,
  `metronome.enable/attach`, `onRestoreStep` **awaité**) ; la politique
  d'identité des boucles (relink par égalité des deux bords) et le fast-path
  tempo y vivent testés en valeurs (24 tests). `sessionSignature` rejoint le
  domaine project : **une seule définition de l'état canonique persisté**,
  signant les mêmes défauts de manifeste que le restore
  (`tuningOrDefault`, `fineTuneOrDefault`, `sanitizeBeatGrid`,
  `DEFAULT_METRONOME_SETTINGS`). Le web (`project-session.ts`) ne garde que
  ce que le core ne peut pas posséder : le wrap `File`, le paint entre deux
  décodes WAV synchrones, l'adoption i18n des kinds de structure, et
  l'**identité** du canal métronome (ADR 0012 — le core exporte les
  réglages `DEFAULT_METRONOME_SETTINGS`, le mixer web garde l'id).
- **Structurel** : `fine-tune` promu au kernel `shared/` (2ᵉ consommateur
  core : la signature) ; arête Sheriff `feature:project → feature:audio`
  (round-trip WAV des stems) ; l'oddité déclarée
  `web:projects → web:feature:tempo` **dissoute** (elle n'existait que pour
  `DEFAULT_METRONOME_CHANNEL`) ; `tuningOrDefault`/`sanitizeBeatGrid`
  dé-exportés du contrat public (plus aucun consommateur adaptateur) ;
  registre `application/README.md` à jour (2 lignes use-cases + notes
  transport/speed-trainer réécrites).
- **Mutation = le détecteur promis par la revue** : premier passage de
  Stryker sur ces politiques (jamais mutées côté web). Verdict initial :
  playback-tick et speed-trainer 100 %, mais `session.ts` 86 % et
  `session-signature.ts` 84,8 % —
  8 vrais trous tués par tests dédiés (clés absentes du save input, relink
  à un seul bord — start OU end seul, séparation aux stems manquants,
  `enable` vs `attach`, contenu des markers à effectif constant, motif de
  downbeats déphasé, « seul le motif de downbeats est signé » — grilles de
  longueurs différentes signent égal) ; les 6 survivants restants = mutants
  équivalents vérifiés un à un (gardes `&&`→`||` sous early-return, bornes
  de clamp, représentation `''`→`null` de la signature).

## Not done / remaining

- Garde-fous de la revue non inclus (assumé, lot dédié) : spec « actions
  câblées » (chaque variante d'action d'un reducer exporté exige un dispatch
  web), ban SCREAMING_CASE au niveau module dans `web/src/app`, extension de
  `mutation:diff` aux hooks `use-*.ts` du web.
- Le pré-vol quota/authz copié sur 4 sites (port local `auth-port.ts`) —
  cité par le même constat n° 1, non traité ici (proche de la slice UX
  throttle redeem).
- Suites du backlog : priorité 3 scalaires brandés, priorité 4 `renderChart`.

## Decisions

- **Transport : supprimer le `tick` mort plutôt que router la position par le
  reducer** — router chaque frame par React state annulerait la décision perf
  du Lot L.1 (re-render par frame) ; la politique est extraite en fonction
  pure à la place. Pas d'ADR : c'est l'application de l'ADR/décision L.1
  existante, consignée dans les en-têtes de `transport.ts`/`playback-tick.ts`.
- **Le désarmement du speed-trainer est un catalogue fermé de seams** — un
  futur site qui mute la loupe doit nommer sa transition ; changer la
  politique (ex. « un recall garde la rampe ») = 1 ligne core.
- **L'id du canal métronome reste au web** (ADR 0012 respecté) : le core ne
  possède que les réglages produits (`DEFAULT_METRONOME_SETTINGS`) ; sur le
  chemin vieux-manifeste le core passe `undefined` et l'adaptateur seat son
  click par défaut.
- Module watch : la nursery `core/src/domain` porte maintenant un cluster
  transport/lecture net (`transport`, `playback-tick`, `speed-trainer`,
  `playback-rate`, `pitch-shift`, `seek-step`) — candidat module
  `playback/` à la prochaine extraction (rule of three largement atteinte),
  non extrait ici pour garder le lot lisible.

## Gate status

- typecheck : ✅ (×3, un par commit)
- tests (with coverage) : ✅ 2461 tests, 178 fichiers (gate complet vert à
  chaque commit — pre-commit hook)
- mutation (Stryker, local, diff) : ✅ **95,02 %** (seuil 90) — run frais
  (cache incrémental purgé) après les 8 tests tueurs ; playback-tick
  **100 %**, speed-trainer **100 %**, session.ts 95,7 %,
  session-signature.ts 93,9 % — les 6 survivants restants sont les
  équivalents documentés ci-dessus (vérifiés un à un). Le run complet
  post-merge de CI reste le juge.
- biome / sheriff / knip / jscpd : ✅ (gate) — sheriff avec la nouvelle arête
  `project → audio` et `web:projects` réduit
- sonar : ✅ lu sur l'analyse CI de la PR #361 — **quality gate OK, 0 issue
  ouverte, 0 hotspot** (rien à triager dans `sonar-project.properties`)

## State to resume from

- **Single next action** : après merge de la PR #361, attaquer la
  **priorité 3 — scalaires brandés** (`Seconds`, `Ratio`, `Percent`,
  `Decibels`, `Cents`, `PitchClass`) avec le spec nom↔type + ratchet, cf.
  section Gardes-fous de
  [2026-08-03-revue-justesse-design.md](2026-08-03-revue-justesse-design.md).
- Gotchas :
  - `cross(seam)` ne couvre que les sites existants — un futur site de
    mutation de loupe doit penser à nommer son seam (le catalogue fermé aide,
    l'API ne force pas encore).
  - Les specs web de `project-session` ne testent plus que le mapping
    adaptateur (File, kinds i18n, click par défaut, narration) — les
    politiques sont testées dans `packages/core/src/project/application/session.spec.ts`.
  - `LiveSessionSnapshot` (core) ≠ `SessionSnapshot` (core, matériau de
    `projectFromSession`) — deux types distincts, attention aux imports.
