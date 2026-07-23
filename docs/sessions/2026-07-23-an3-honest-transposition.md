# Session — 2026-07-23 — AN.3 : transposition juste et lisible

## Done

- **Périmètre arbitré : « sans sélecteur de cible »** — re-épelage auto,
  read-out, retour à la tonalité écrite, bascule ♯/♭. Le sélecteur des 12
  tonalités (« aller en Mib » direct) reste en veille.
- **Core `parseKeyName` / `transposeKey`** (chord-key.ts, TDD + property
  round-trip `parseKeyName(keyName(k)) ≡ k`) : l'inverse de `keyName`,
  tolérant espaces/accidentals unicode, refuse la prose. `transposeKey`
  déplace la tonique modulo 12.
- **Re-épelage auto à la transposition** (`transposeChart` →
  `respellUnderKey`) : `{key: C}` +1 arrive en Db et la grille lit
  `Db | Bbm`, plus jamais `C# | A#m`. **Règle affinée par la revue** : le
  respell ne tire que sur un vrai changement (skip octave/zéro — les
  épellations au repos survivent) et **uniquement vers une tonalité bémol**
  (en tonalité dièse la sortie du transposeur est déjà conventionnelle — un
  respell serait un no-op, et le skip protège les chromatiques volontaires).
- **Exports publics** : `respellChartSource`, `Key`/`keyName`/`parseKeyName`/
  `transposeKey`, `Accidental` (le « 0 import web » de la roadmap est soldé).
- **Web — KeyRow** (chord-chart-panel.tsx) : read-out
  « Tonalité : C → Eb (+3) » (ou « Grille transposée de +1 » sans `{key}`),
  bouton « Revenir à la tonalité écrite » (= `onTranspose(-transposedBy)`),
  chips ♯/♭ appliquant `respellChartSource` via le chemin d'édition existant
  (aucune plomberie nouvelle). Le panel reste <300 lignes (KeyRow extrait).
- **Revue (2 finders) — 4 corrections appliquées** : respell restreint
  (octave + bémol seulement, docs re-vraies, 3 tests tueurs Stryker) ; garde
  d'identité sur ♯/♭ (un no-op visuel ne re-déclenche plus la sync des
  marqueurs de structure — elle pouvait les **effacer** sur grille vide) ;
  props de KeyShift unifiées (`keys` toujours entier) ; export mort
  `keyAccidental` retiré.

## Not done / remaining

- Sélecteur de tonalité cible — en veille (périmètre).
- Le **reset ne restaure pas les chromatiques bémol en tonalité dièse**
  (`Bb7` → `A#7` au retour) : perte pré-existante de `transposeNote` (épelle
  dièse), rendue visible par le bouton ; le chip ♭ répare en un clic.
  Restaurer à l'octet près exigerait de persister la source écrite — à faire
  si ça mord.
- La préférence ♯/♭ n'est pas sticky (le prochain transpose re-normalise) —
  design assumé, préférence de lecture ponctuelle.
- `{key}` mid-grille (modulation) serait re-épelé sous la tonalité de tête —
  construct déjà signalé « douteux » par AN.2, accepté.
- Survivants Stryker `detectKey` (profils Krumhansl, ~24) : **pré-existants**,
  le fichier n'était couvert qu'à travers detect-chords — passe de mutants
  dédiée si on retouche detectKey.

## Decisions

- **Le respell auto corrige uniquement ce que le mouvement a abîmé** : jamais
  l'épellation de l'utilisateur au repos (octave verbatim), jamais en
  tonalité dièse (no-op prouvable). C'est la règle qui rend la feature sûre.
- ♯/♭ = réécriture de la source par le chemin d'édition standard (pas d'état
  nouveau) ; un résultat identique ne committe rien.
- `keyAccidental` reste interne au core — la surface publique n'expose que ce
  que les adapters consomment.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 2035 tests, 153 fichiers
- mutation (Stryker, local, `--force --mutate chord-key.ts chord-chart.ts`) :
  ✅ nouveau code chord-key **0 survivant** ; chord-chart : 3 survivants de la
  zone neuve tués par tests dédiés (skip octave en tonalité bémol, arrivée
  dièse garde C#m) — run de confirmation consigné dans la PR ; break global
  90 tenu.
- biome / sheriff / impeccable / react-doctor / knip / jscpd : ✅
  (react-doctor a re-imposé <300 lignes → KeyRow extrait)

## State to resume from

- **Single next action** : vérifier le run Stryker de confirmation, ouvrir la
  PR de `feat/an3-honest-transposition` (rapport inclus) ; après merge :
  STATUS/roadmap sur main, puis **AN.4 — gravure Real Book** (décision déjà
  actée : `maj7→M7`, pas de triangle) et AN.5 (chiffrage romain).
- Gotchas : ne jamais lancer Stryker pendant `pnpm gate` (collision sur
  `coverage/`, crash du sandbox) ; le respell auto ne doit jamais s'étendre
  aux mouvements d'octave ni aux tonalités dièses sans re-passer par les
  tests tueurs de chord-chart.spec (« octave guard », « sharp arrival »).
