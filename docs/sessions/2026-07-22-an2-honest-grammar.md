# Session — 2026-07-22 — AN.2 : la grammaire ne ment plus (diagnostics)

## Done

- **Périmètre arbitré : « diagnostics seuls »** — la ligne de retour de parse
  + le marquage sheet. Les snippets insérables de l'Aide du format (volet 3)
  restent en veille.
- **Core pur `chartDiagnostics(source)`** (chord-chart.ts) : `measureCount`,
  `spans` (le walk AN.1, porté par le résultat — un seul walk pour le locus et
  les diagnostics), `measuresPerLine`, `suspectTokens` (round-trip
  parse∘format partagé avec les rewriters via `reprintableChordSymbol` +
  pitch réel exigé pour la fondamentale **et** la basse slash, `N.C.` toléré,
  fermata pelée), `unreachableMeasures` (indices écrits ∉ `unrollChart` :
  queue morte après `{d.c.}`+`{fine}`, volta au-dessus du nombre de passes).
  Le walk AN.1 est généralisé en `measureSites` interne (span + tokens
  d'accords par mesure, strip structurel miroir de `parseCell`).
- **Web — ligne de retour de parse** (chord-chart-panel.tsx), édition
  seulement, entre la sheet et le textarea : « Mesures lues : N · sur cette
  ligne : M » (la variante ligne suit le caret), avertissements amber
  « N accords douteux : x3, … » (ICU plural, exemples dédupliqués + ellipse)
  et « N mesures jamais jouées par la forme ».
- **Web — marquage sheet** : mesures suspectes en outline amber pointillé
  (`data-suspect`), mesures jamais jouées délavées (`data-unreachable`) —
  affordances d'édition uniquement (sets `undefined` hors édition, print
  neutralisé dans global.css).
- **Le panel passe sous 300 lignes** (react-doctor `no-giant-component`) :
  `PanelHeader` extrait + trois composants de feedback (placeholders ICU aux
  noms lisibles).
- **Revue (3 finders) — 7 corrections appliquées** : basse slash inconnue
  (`F/x`) désormais signalée ; fuite print des marques (outline/opacity)
  neutralisée ; diagnostics gatés sur `editing` + walk dédupliqué (spans
  portés par `ChartDiagnostics`) ; placeholder `{line}` renommé `{onLine}` ;
  pluriels « (s) » convertis en ICU plural (précédent
  `analyser.summary-sections`) ; garde round-trip extrait et partagé ;
  ellipse sur les exemples tronqués.
- **Incident maîtrisé** : un sous-agent de revue mort sur erreur API a
  tronqué chord-chart.ts (568 lignes, commentaire non terminé) ; restauré
  intégralement depuis le diff sauvegardé au scratchpad (`git checkout` +
  `git apply --include`), vérifié par typecheck + suite complète.

## Not done / remaining

- Snippets insérables dans l'Aide du format (volet 3) — en veille.
- `chordTokensOf` duplique le strip structurel de `parseCell` sans garde
  d'égalité `chordTokens.length ≡ chords.length` — un futur token structurel
  oublié produirait de faux suspects ; à couvrir si la grammaire s'étend
  (ajouter le construct au corpus du property test).
- La believabilité ne connaît pas les accords exotiques mais valides du point
  de vue de l'utilisateur (tout ce qui round-trip avec un pitch réel passe) —
  aucun cas remonté, à élargir si ça mord.

## Decisions

- **AN.2 = diagnostics seuls** ; les avertissements sont des **affordances
  d'édition** (jamais en vue lecture, jamais imprimés) — même contrat que le
  locus AN.1.
- `ChartDiagnostics` **porte les spans** : un seul walk sert le locus et les
  diagnostics ; `measureSourceSpans` reste l'API fine.
- Le garde round-trip est **unique** (`reprintableChordSymbol`) : les
  rewriters (transpose/respell) et les diagnostics ne peuvent plus diverger
  sur « qu'est-ce qu'un accord sûr ».
- Copy à compte : **ICU plural obligatoire** (précédent
  `analyser.summary-sections`), pas de « (s) ».

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 2014 tests, 153 fichiers
- mutation (Stryker, local, `--force --mutate chord-chart.ts`) : run final en
  cours au moment de la rédaction — résultat consigné dans la PR (le run
  intermédiaire post-restauration était vert à 96+ % avant les correctifs de
  revue).
- biome / sheriff / impeccable / react-doctor / knip / jscpd : ✅
  (react-doctor a imposé la découpe du panel <300 lignes — fait)

## State to resume from

- **Single next action** : vérifier le score Stryker final, ouvrir la PR de
  `feat/an2-honest-grammar` (rapport inclus), puis après merge : STATUS/
  roadmap sur main (doc-only) et arbitrer la suite du Lot AN (AN.3
  transposition juste · AN.4 gravure Real Book · AN.5 chiffrage romain).
- Gotchas : le walk `measureSites` doit rester le miroir de
  `parseChart`/`parseRow` — toute évolution de grammaire touche les deux ET
  le corpus du property test ; les messages à compte passent par les
  descripteurs `msg` + `i18n._({...msg, values})` (macro `t` seule ne porte
  pas l'ICU plural) ; en cas de fichier tronqué par un agent, le diff de
  revue sauvegardé au scratchpad est la bouée — toujours le sauvegarder avant
  de lancer les finders.
