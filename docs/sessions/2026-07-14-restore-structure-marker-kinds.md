# Session — 2026-07-14 — restore: structure marker kinds (labels dupliqués)

## Done

- **Bug (rapporté)** : relancer « Détecter la structure » duplique les labels
  sur le rail / la liste Repères. Repro utilisateur : sur un **projet
  existant** ré-ouvert. Cause : un projet sauvegardé **avant** les marker
  kinds (PR #128) a persisté ses marqueurs de structure comme marqueurs
  simples ; restaurés verbatim ils se lisent comme des repères personnels,
  que `replaceStructureMarkers` préserve — chaque détection ajoute donc son
  jeu à côté (la duplication apparaît dès le 1er run, remarquée au 2e).
- **Fix** : migration à la restauration — `adoptStructureKinds(markers)`
  (section-markers.ts) re-tague `kind: 'structure'` tout marqueur sans kind
  dont le libellé appartient au vocabulaire des sections, dans les deux
  orthographes (tag brut `verse`/`outro`… via `SECTION_LABEL_TAGS` exporté de
  section-label.ts, et copy d'affichage « Intro/Couplet/… »). Branché dans
  `restoreSession` (project-session.ts). Les sauvegardes post-kinds
  round-trippent leur `kind` et passent inchangées.
- Coût assumé : un repère personnel nommé exactement « Couplet » etc.
  redevient écrasable par une détection (manifest non versionné — pas de
  meilleur discriminant).

## Not done / remaining

- Pas de version de schéma dans le manifest projet : la migration est
  heuristique par vocabulaire. Si un jour le manifest gagne une version,
  conditionner la migration dessus.

## Decisions

- Migration à la RESTAURATION (adapter web), pas dans le core : le
  vocabulaire d'affichage est une affaire d'UI (i18n), et le core ne connaît
  pas la provenance des libellés.

## Gate status

- typecheck : ✅ (`pnpm gate` exit 0)
- tests (with coverage) : ✅ 1408 tests (+4 : 3 `adoptStructureKinds`,
  1 `restoreSession`)
- mutation (Stryker) : **skippé — core intouché** (fix 100 % packages/web)
- biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅ (gate exit 0)

## State to resume from

- **Single next action** : merger les trois PRs (#130 structure↔accords,
  #131 notation empilée, celle-ci) — elles touchent toutes docs/STATUS.md
  (blocs adjacents), petits conflits à résoudre au fil des merges — puis
  vérif navigateur pré-démo bout-en-bout sur The Logical Song, sur un projet
  RÉ-OUVERT (le cas qui a mordu).
- Gotchas : un projet déjà pollué par des doublons s'auto-répare — à la
  ré-ouverture les deux jeux (anciens sans kind, nouveaux avec) portent le
  kind structure, donc la prochaine détection les remplace tous d'un coup.
