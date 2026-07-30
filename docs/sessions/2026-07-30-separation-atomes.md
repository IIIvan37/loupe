# Session — 2026-07-30 — le sac separation en atomes, les régions le lisent elles-mêmes (ADR 0010)

## Done

- **Cinquième feuille « sacs de feature en atomes »** (branche
  `refactor/separation-atoms`, PR #305 ouverte) : tout l'état de `useSeparation`
  quitte le hook pour `separation-atoms.ts` — `separationStateAtom` (machine
  d'états, transitions restées dans le `separationReducer` du core),
  `separationDescriptorsAtom` (identités des stems, jamais le PCM),
  `separationExportErrorAtom`, et `separationRunAtom` (jeton de run + abort
  controller, boîte mutée en place, init par store — le pattern
  `tempoRunAtom` de la PR #302).
- **Diagnostic préalable (la question de la feuille)** : `useSeparation` ne
  pilote PAS d'adaptateur à état — le port `StemSeparator` est du HTTP sans
  état (une requête par run) et le PCM vit déjà dans le moteur de stems, en
  session depuis la PR #303. Donc atomes seuls (cas tempo/zoom), pas de
  nouvelle entrée de session ; le hook LIT la session existante pour ses
  défauts (`session.separator`, `session.stemEngine.stemAudio` en repli de
  `pcmOf`).
- **Spec rouge d'abord** (`separation-atoms.spec.tsx`) : deux instances
  `useSeparation` sous UN store partagent la face « analysing », le cancel
  croisé (l'abort atteint le run partagé, pas une ref privée) et les stems
  commis — rouge sur le `useReducer`/refs privés, verte sur les atomes.
- **Trois consommateurs lisent eux-mêmes** : `ShellMain`, `ShellAnalyserRow`
  et `useSeparateAndLoad` appellent `useSeparation()` nu ; le prop/dep
  `separation: ReturnType<typeof useSeparation>` tombe des trois. Cliquet
  `MAX_RETURN_TYPE_PROPS` **13 → 10** (`composition-invariants.spec.ts`).
- **Arête Sheriff explicite** : `web:feature:separation →
  web:feature:audio-session` (le hook atteint le port et le moteur par la
  session, ADR 0011) — commentée dans `sheriff.config.ts` comme les arêtes
  mixer/tempo.
- Les interfaces étroites restent servies par l'instance du shell
  (`useStemStack`) : `useChartWithStructure` (type structurel),
  `useStemExport` (`Separation`), `useProjectSession`, `gateReasonsOf` —
  hors cliquet, mêmes atomes désormais.

## Not done / remaining

- **10 props `ReturnType` restants** : `loops` + `loopEditing` (ShellMain),
  `loopEditing` (ShellStage), `chart`/`chordChart` (lead-sheet),
  `tempo`+`metronome` (use-tempo-detection), `mixer`+`metronome`
  (use-separate-and-load), `tempoDetection` (use-resume-gated-analysis).
  Candidat suivant naturel : le sac `loops`/`loopEditing`.
- L'**interface étroite de session (DIP)** reste en feuille d'après.

## Decisions

- Aucune décision nouvelle — application des ADR 0010/0011 telles quelles.
  La feuille confirme le critère des deux précédentes sur un cas mixte :
  un sac dont la feature CONSOMME des ports/singletons de session sans en
  posséder migre en atomes seuls, et son hook prend ses défauts dans la
  session au lieu de les recevoir en paramètres — la session n'accueille
  une entrée nouvelle que pour un état d'adaptateur à identité unique
  (PCM, graphe de gains).
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `191e6706`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ (après déclaration de l'arête) · design/react ✅ ·
  tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (1123 tests web), couverture 96,82 %
  statements / 92,27 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : à lire sur la PR une fois l'analyse CI posée (~5 min après le
  push) — reporté dans la PR avant merge.

## State to resume from

- **Single next action** : feuille 0010 suivante — le sac `loops`/
  `loopEditing` en atomes (état de vue pur a priori : vérifier quand même
  si un adaptateur à état se cache derrière, même question rituelle) ;
  puis l'interface étroite de session (DIP).
- Gotchas :
  - `separationRunAtom` est une boîte mutée en place (jamais rendue) —
    interne à `useSeparation`, aucun autre module ne doit la toucher ;
    l'abort d'unmount passe par `myControllerRef` (une instance lectrice
    qui se démonte ne doit pas tuer un run qu'elle n'a pas lancé).
  - Le repli `pcmOf` → `session.stemEngine.stemAudio` rend `undefined`
    hors provider enrichi : un stem sans PCM est simplement omis (contrat
    documenté), pas une erreur — `useStemStack` continue de passer
    `stemPlayback.stemAudio` explicitement car il vit AU-DESSUS du
    provider enrichi.
  - `stemAudio` est une closure sans `this` — l'extraire du moteur est sûr.
