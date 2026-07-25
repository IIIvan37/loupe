# Session — 2026-07-24 — ts3-pratique-adr

## Done

Lot **TS.3** du [plan de resynchronisation](../template-sync-plan.md) :
la pratique ADR du template `hexagonal-tdd-starter` arrive dans loupe.
Doc-only — rien d'autre que `docs/adr/` et ce report n'est touché.

- **`docs/adr/` créé** : `README.md` (frontière ADR vs session report,
  provenance, index) + `_TEMPLATE.md`, adaptés du template, en français.
- **Cinq ADR importés du template**, réécrits pour loupe avec un statut
  honnête :
  - [0001](../adr/0001-typescript-strip-only-sans-build.md) strip-only
    TypeScript sans build — accepté (sources vérifiées conformes ; le verrou
    `erasableSyntaxOnly` arrive par TS.1).
  - [0002](../adr/0002-contrats-de-ports-en-subpath-testing.md) contrats de
    ports en subpath `@app/core/testing` — accepté, mise en œuvre TS.4 puis au
    fil des extractions TS.5 ; motivé par le vrai incident PR #209 (fakes aux
    ids anglais → no-op silencieux).
  - [0003](../adr/0003-etat-ambiant-derriere-des-ports.md) état ambiant en
    valeurs/ports — accepté (déjà la pratique : `stamp {id, now}` du domaine
    projet, position de lecture streamée par `PlaybackEngine` ; zéro
    `Date.now`/`Math.random`/`crypto.*` dans le core, vérifié ; la spec de
    pureté lexicale arrive par TS.2).
  - [0004](../adr/0004-erreurs-attendues-valeurs-taguees.md) erreurs = valeurs
    taguées — **accepté avec migration au fil de l'eau** : la pratique réelle
    mélange `{ ok, error: string }` (projects.ts), classes d'erreur jetées
    (les 4 use-cases de détection) et `throw` domaine (wav-decoder sur entrée
    non fiable) ; l'écart est décrit, la cible et l'ordre de migration aussi.
  - [0005](../adr/0005-modules-emergents.md) modules émergents — accepté,
    mise en œuvre TS.5. Version **dé-anonymisée** de l'ADR-0006 du template
    (le « field project », c'est loupe) : chiffres revérifiés sur l'arbre —
    49 fichiers domain à plat, ports.ts 306 lignes / ~24 interfaces,
    beat-grid importé par 17 fichiers du core (noyau de facto avec
    nearest-time, median, timecode), cycles
    `harmonic-cycle → section-matching` et `seek-step → key-bindings`,
    préfixes chord-* ×5, loop-* ×3.
- **Quatre décisions propres à loupe actées** (elles n'avaient que
  sessions/plans comme trace) :
  - [0006](../adr/0006-responsive-intrinseque-every-layout.md) responsive
    intrinsèque Every Layout, zéro media query de viewport (trace : session
    2026-07-05).
  - [0007](../adr/0007-offload-calcul-audio-modal.md) calcul audio lourd sur
    Modal, cloud sans état, projets locaux (trace : roadmap v5 § Cap +
    client-leger-plan, 2026-07-16).
  - [0008](../adr/0008-copy-ui-lingui-ids-semantiques.md) copy UI via Lingui,
    ids sémantiques, catalogue source fr, infinitifs (trace : session
    2026-07-03).
  - [0009](../adr/0009-time-stretch-soundtouch.md) time-stretch SoundTouch
    MPL-2.0 — la candidate « Rubber Band (GPL) » s'est révélée être la
    décision *inverse* : Rubber Band, verrouillé au kickoff, a été remplacé
    le jour même (wrapper web crashant + levée de l'obligation GPL) ; l'ADR
    acte SoundTouch (trace : session 2026-06-28 + STATUS).
- **Non repris** (spécifiques au starter, dit dans le README) : ADR-0005
  template (bounded project state) et ADR-0007 template (frontend-agnostic
  starter).

## Not done / remaining

- `docs/STATUS.md` et le suivi de `docs/template-sync-plan.md` (case TS.3) se
  mettent à jour **sur main** après merge (convention : doc partagée hors
  branche de feature).
- Les statuts « mise en œuvre à venir » des ADR 0001 (flag TS.1), 0002
  (TS.4), 0003 (spec pureté TS.2) et 0005 (TS.5) sont à tenir : chaque lot
  concerné vérifie qu'il réalise ce que son ADR annonce.

## Decisions

- Toutes dans `docs/adr/` — c'est l'objet du lot ; voir
  [l'index](../adr/README.md). Les session reports futurs pointent vers un ADR
  au lieu de re-raisonner.
- Numérotation loupe autonome (0001–0009), ordre : les cinq pratiques
  importées du template d'abord, puis les décisions loupe par date.

## Gate status

- typecheck / tests / biome / sheriff / knip / jscpd : **non concernés** —
  lot doc-only, aucun fichier de code touché.
- mutation (Stryker) : non concerné (core intouché).

## State to resume from

- **Single next action** : merger la PR, puis cocher TS.3 dans le suivi du
  plan (commit doc-only sur main) ; enchaîner sur TS.4 (subpath testing +
  premier contrat), qui réalise l'ADR-0002.
- Gotchas / half-done edits : aucun — arbre propre, la branche ne contient
  que `docs/adr/` et ce report.
