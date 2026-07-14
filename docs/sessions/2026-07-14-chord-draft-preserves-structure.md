# Session — 2026-07-14 — chord draft preserves structure

## Done

- **Bug (rapporté)** : détecter la structure PUIS les accords effaçait la
  structure. Cause : le brouillon d'accords déduisait ses propres blocs
  neutres `[A]`/`[B]` (`deduceStructure`), et la sync chart→timeline du
  brouillon assis (`seatDraft` → `onSourceEdited` →
  `syncStructureMarkersFromChart` → `replaceStructureMarkers`) remplaçait les
  marqueurs Intro/Couplet/Refrain par ces ancres génériques (ou les effaçait
  quand le brouillon n'avait aucun en-tête).
- **Fix core** : `detectChords` accepte `sections?: DetectedSection[]` (la
  structure déjà connue) et découpe le brouillon avec `cutBySections`
  (exporté — le même fold que le relabel S.3b) au lieu de `deduceStructure` ;
  la tête `{key:}/{time:}` est conservée. Ordre inverse (accords d'abord)
  inchangé : pas de marqueur → pas de section → déduction.
- **Fix web** : `markerSections(markers)` (section-markers.ts) relit les
  marqueurs `kind:'structure'` en sections — libellés déjà en copy d'affichage,
  imprimés verbatim ; chaque section court jusqu'au marqueur suivant.
  `useChartWithStructure` le passe (mémoïsé) à la session chart →
  `useChordDetection` (via le latest-ref, donc frais au moment du detect).
- **Fixes de revue (3 finders parallèles, mécanismes confirmés sur le code)** :
  1. Section connue UNIQUE → `renderStructuredSource` supprimait l'en-tête
     (`runs.length === 1`) → la resync effaçait le dernier marqueur. Nouveau
     param `headLoneRun` (défaut false — déduction et relabel inchangés),
     activé par `detectChords` quand des sections sont fournies.
  2. `markerSections` filtre les libellés non imprimables en `[header]`
     (vide/multi-ligne, atteignables via `restore()` d'un projet — le rename UI
     les interdit) pour ne pas corrompre la grammaire du brouillon.
  3. Identité stable : `useMemo` sur `markerSections` dans le shell ;
     `.filter().filter()` fusionné (react-doctor) ; précondition non-vide
     documentée sur `cutBySections`.

## Not done / remaining

- **Limites v1 documentées (revue, acceptées)** :
  - `cutBySections` épingle la 1re section à la mesure 0 (règle anacrouse du
    relabel) : un unique marqueur tardif (ex. Refrain à 2:00) étiquette tout le
    morceau et la resync le déplace au début. Cas limite (la détection de
    structure couvre toujours le début).
  - Une section au-delà de la grille (marqueur dans un fade-out sans mesures
    détectées) est droppée par le fold → son marqueur est effacé par la resync.
  - Course : des marqueurs de structure posés PENDANT un run d'accords en vol
    ne sont pas vus (les sections sont lues au moment du clic).
  - Re-détection d'accords : les marqueurs `A`/`B` que la sync a créés depuis
    le premier brouillon deviennent la structure « connue » du second run
    (cohérent avec « la timeline fait autorité » ; supprimer les marqueurs
    rend la déduction).
- **Point #2 de la demande utilisateur — notation musicale des signatures**
  (empilée « 4 sur 4 » comme le chart Elton John, pas le texte « 4/4 ») :
  slice UI séparée, approche à confirmer avant de coder (convention).

## Decisions

- La structure « connue » d'une détection d'accords = les marqueurs
  `kind:'structure'` de la timeline, quelle que soit leur origine (détection,
  frappe d'un `[Header]`, sync d'un brouillon précédent). Le chart reste
  l'autorité ; la préservation passe par les EN-TÊTES du brouillon (pas par un
  contournement de la sync), donc le round-trip marqueurs → brouillon →
  marqueurs est l'invariant.
- `markerSections` reste dans le web à côté de son inverse `sectionMarkers`
  (symétrie du module), bien que le mapping soit pur core-types→core-types.

## Gate status

- typecheck : ✅ (via `pnpm gate` exit 0)
- tests (with coverage) : ✅ 1411 tests (+10 : 3 core detect-chords, 3 web
  markerSections, 1 shell régression structure→accords), coverage core tenue
- mutation (Stryker, local, core touché) : **93,46 %** (seuil 80), re-vérifié
  après les fixes de revue (score identique)
- biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅ (gate exit 0)

## State to resume from

- **Single next action** : point #2 — proposer l'approche (2–3 lignes) du
  rendu empilé des signatures (glyphe N-sur-M au début du premier système +
  aux changements de mètre, à la place du texte « 4/4 » du header meta et de
  l'annotation « 2/4 » en coin de mesure) et attendre la validation avant le
  test d'acceptation.
- Gotchas : `renderStructuredSource` a maintenant 4 params (le 4e,
  `headLoneRun`, ne doit rester `true` que pour les sections CONNUES) ;
  `cutBySections` exige des sections non vides (précondition documentée).
