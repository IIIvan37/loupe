# Session — 2026-08-03 — scalaires brandés

Priorité 3 du backlog de la revue justesse design
([2026-08-03-revue-justesse-design.md](2026-08-03-revue-justesse-design.md),
défaut n° 2 « aucune quantité n'est typée »).

## Done

- **`shared/units.ts`** : le pattern brand en trois lignes (`Unit<Name>`)
  et les six scalaires de la revue — `Seconds`, `Ratio`, `Percent`,
  `Decibels`, `Cents`, `PitchClass`. Constructeurs fins (le brand atteste la
  **dimension** ; la validité de plage reste aux clamps de domaine, qui
  deviennent les vrais smart constructors), conversions nommées
  `percentToRatio`/`ratioToPercent` (l'algèbre d'unités vit dans des
  conversions explicites, jamais inline), opérations pitch-class
  (`pitchClass`, `pitchClassOfHz`).
- **Un seul modulo-12** : les 14 littéraux `% 12` de 6 fichiers (harmonie,
  bass-line) migrés sur `pitchClass()` ; la duplication Hz→MIDI→classe de
  `chroma.ts`/`bass-line.ts` absorbée par `pitchClassOfHz`. Un balayage
  élargi (`% NOTES.length`, wraps par `.length`, `/ 12`…) n'a trouvé aucune
  réécriture sous une autre orthographe.
- **Adoption par les frontières** (« parse, don't validate ») :
  `clampGainDb → Decibels`, `clampTempoPercent`/`stepTempoPercent → Percent`,
  `clampPlaybackRate → Ratio`, `clampFineTuneCents` /
  `fineTuneOrDefault → Cents`, `Key.tonicPc: PitchClass` (harmonie entière,
  0 site web), politique/état du speed-trainer en `Percent`,
  `PlaybackTickInput.atSeconds: Seconds` (parsé du flux moteur dans
  `use-transport-engines`), contrat de `useSpeedTrainer` en `Percent`.
  Les `/100`·`*100` inline (workstation-shell, use-player) remplacés par les
  conversions nommées ; le formulaire trainer parse ses champs
  (`percent(fieldNumber(…))`).
- **`unit-discipline.spec.ts`** (racine core, style `purity.spec.ts`) :
  ban bloquant du littéral `% 12` hors `shared/units.ts` + **cliquet
  nom↔type** sur les sources de production de core ET web — un nom suffixé
  unité typé `number` nu est compté par suffixe et épinglé au présent mesuré
  (`Seconds` 74, `Ratio` 16, `Db` 7, `Cents` 6, `Percent` 1,
  `Pc`/`PitchClass`/`Decibels` 0). Au-dessus du pin = violation ; en dessous
  = pin périmé à abaisser dans la même PR (la sémantique `check:sonar`).
  Détecteurs auto-testés (évasions, suffixe le plus long, commentaires).
- **`public-surface.spec.ts` a mordu** : `decibels` et `pitchClass` exportés
  sans consommateur de production → déplacés sur `@app/core/testing` (besoin
  spec-only) ; la production web reçoit ses valeurs brandées des clamps et ne
  construit jamais ces deux unités.
- Huit mutants équivalents près des bornes identifiés comme intuables
  (`<` vs `<=` au point exact de la borne rend la même valeur) ; le seul
  survivant sur une ligne du lot (`bass-line.ts` — branche dièse de
  `classOfName` sans couverture) tué par un test dédié.

## Not done / remaining

- Le cliquet à 74 `*Seconds: number` est le gros de l'adoption restante —
  descente opportuniste : tout lot qui touche un fichier listé abaisse son
  pin. Idem `Ratio` 16 (dont `timeRatio` persisté du manifeste), `Db` 7,
  `Cents` 6, `Percent` 1.
- `use-player.ts` passe toujours `semitones + cents/100` au port pitch qui
  documente « entier » — c'est la violation de contrat L de la revue,
  périmètre du chantier « contrats de ports », pas de celui-ci.
- Cas subtil consigné par la revue, toujours ouvert : `CountIn`/`BeatGrid`
  (même unité, référentiels différents) relève d'un type distinct, pas d'un
  brand d'unité.
- Suites du backlog : priorité 4 `renderChart`, puis retour au labo starter
  (EN TOUT DERNIER).

## Decisions

- **Le brand atteste la dimension, le clamp atteste la plage** : les
  constructeurs d'`units.ts` sont des casts fins documentés ; chaque unité à
  invariant de plage garde son smart constructor de domaine (`clampGainDb`,
  `clampTempoPercent`, …) qui parse le brut de la frontière en valeur
  brandée. Un seul endroit du dépôt a le droit de caster : `shared/units.ts`
  (vérifié : zéro `as <Brand>` ailleurs).
- **Adoption pilotée par le cliquet, pas par un big-bang** : les types
  s'adoptent frontière par frontière ; `unit-discipline.spec.ts` épingle le
  reste et ne peut que descendre. Sémantique stricte des pins (en dessous =
  échec aussi) pour qu'ils ne pourrissent pas.
- **`decibels`/`pitchClass` sont des exports de test** : la surface publique
  n'expose que ce que la production consomme ; les specs adaptateurs passent
  par `@app/core/testing`.
- Module watch : rien de neuf — le candidat `playback/` (transport /
  playback-tick / speed-trainer) déjà noté reste d'actualité.

## Gate status

- typecheck : ✅ (0 erreur, les brands compilent core + web)
- tests (with coverage) : ✅ 181 fichiers / 2510 tests puis +1 (mutant tué),
  couverture ~91,4 % statements — gate stampé `640f2117`
- mutation (Stryker, local, diff) : ✅ **94,72** (seuil 90), scope = nursery
  + shared + harmony + separation + project ; `units.ts` 100 %,
  `fine-tune.ts` 100 % ; survivants restants = dette pré-existante de
  fichiers touchés sur 1-3 lignes (bass-line/chord-chart/chord-key) + mutants
  équivalents de bornes. Le run CI post-merge reste la référence.
- biome / sheriff / knip / jscpd : ✅ (react-doctor : `useRef(percent(100))`
  hissé en constante module ; sinon rien)
- sonar : PR #362 ouverte depuis `refactor/scalaires-brandes` — verdict à
  consigner après l'analyse CI (~5 min post-push).

## State to resume from

- **Single next action** : après merge de la PR #362, attaquer la
  **priorité 4 — `renderChart`** (l'inverse de `parseChart`, contrat visé
  `render ∘ parse = id` en property test, cf. section Texte-comme-modèle de
  [2026-08-03-revue-justesse-design.md](2026-08-03-revue-justesse-design.md)).
- Gotchas :
  - Le cliquet est **exact** : brander un scalaire listé sans abaisser son
    pin dans `unit-discipline.spec.ts` fait échouer le gate (message
    indique le pin cible).
  - `decibels`/`pitchClass` s'importent depuis `@app/core/testing` dans les
    specs web — pas depuis `@app/core` (public-surface refuse l'orphelin).
  - Les arbitraries fast-check se brandent en `.map(percent)` /
    `.map(decibels)` / `.map(pitchClass)` — l'idiome est déjà posé dans les
    specs mixer/chord-key/roman-numeral.
