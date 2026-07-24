# Session — 2026-07-24 — ts5-2-rhythm-extraction

## Done

- **TS.5.2 — première extraction de module : `rhythm`**
  ([ADR-0005](../adr/0005-modules-emergents.md), procédure Mikado — les
  prérequis d'abord, puis un `git mv` de la tranche verticale) :
  - **Promotions `shared/` (les prérequis, 1 niveau)** :
    - `shared/median.ts` (ex-domain ; consommé par rhythm ET song-structure) ;
    - `shared/error-message.ts` (ex-application ; 8 use-cases) ;
    - `shared/decoded-audio.ts` — `DecodedAudio` sorti de `ports.ts` : le type
      PCM que parlent presque tous les ports pilotés (decoder, players,
      détecteurs, séparateur) — le langage audio du kernel.
  - **`rhythm/domain/`** : `beat-grid`, `tempo-map`, `manual-tempo`,
    `metronome`, `nudge-time` (+ leurs specs).
  - **`rhythm/application/`** : `detect-tempo` (+ spec) et `rhythm/application/ports.ts`
    — `TempoDetector` + `DetectedTempo` sortis du `ports.ts` de la nursery
    (première fonte du god-file : 306 → 274 lignes).
  - **`rhythm/testing/`** : `metered-grid-fixture` (consommé uniquement par des
    specs — il sort du scope muté par Stryker, correct pour une fixture).
  - La nursery importe rhythm librement (12 fichiers repointés) ; `index.ts`
    ré-exporte depuis le module — aucun changement de surface publique.
- **Frontière énumérée par la gate** : une seule violation au premier passage
  (typecheck : `metronome.spec` → `chroma`, repointé vers la nursery) ; Sheriff
  vert d'emblée — les trois promotions étaient exactement la frontière.
- **Tags prouvés par injection** (puis revert) : import nursery injecté dans
  `rhythm/domain/beat-grid.ts` → Sheriff rouge `feature:rhythm → nursery` —
  la preuve que les placeholders dormants ont bien tagué le module (un module
  non tagué serait passé vert en silence).
- **`pnpm modules:hint` après extraction** : le cluster `detect-*` a disparu
  (detect-tempo parti) ; reste `chord-*` ×5, cohésion 6/0 — le candidat
  `harmony`.
- Registre `application/README.md` : ligne d'en-tête « les modules extraits
  gardent leurs entrées ici, fichiers dans `core/src/<feature>/application` ».
- Rotation sessions : `2026-07-24-ts1-template-configs.md` → `archive/`.

## Not done / remaining

- **Périmètre volontairement exclu de rhythm** (décisions ci-dessous) :
  `fine-tune`, `speed-trainer`, `seek-step`.
- Contrat + fake `TempoDetector` (ADR-0002) : à écrire quand on touchera
  l'adapter tempo web — aucun contrat n'existait avant l'extraction, rien à
  emporter.
- Jumeaux structurels de `DecodedAudio` dans `wav-decoder` / `analysis-mix`
  (déclarés du temps où domain ne pouvait pas voir le type applicatif) :
  unifiables sur `shared/decoded-audio.ts` au fil de l'eau.
- Extractions suivantes (ordre DAG) : `harmony`, `structure`, `loops`,
  `separation`, `project` ; promotions `nearest-time`/`timecode` avec elles.

## Decisions

- **`fine-tune` n'est PAS rhythm** malgré la liste du plan : le fichier est un
  ajustement de **hauteur** en cents (famille pitch-shift) — nommer une
  frontière est un acte de domaine, le plan est corrigé par le terrain.
- **`speed-trainer` exclu** (importe loop-region + playback-rate : il
  appartient à la constellation loops/transport) ; **`seek-step` exclu** (le
  cycle connu `seek-step → key-bindings`, à réparer avec le transport).
- **`DecodedAudio` promu `shared/`** plutôt que ré-exporté par le `ports.ts`
  nursery : les consommateurs importent le kernel directement, `ports.ts` doit
  fondre, pas devenir un relais.
- Le cluster `detect-*` (hint pré-extraction, cohésion 0/6) confirmé non-module
  : use-cases transverses, chacun suivra sa feature.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 162 fichiers, 2318 tests
- mutation (Stryker, local, `--force`) : ✅ 92,68 % (seuil break 90)
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; ratchet vérifié
  par injection sur le module réel)

## State to resume from

- **Single next action** : ouvrir la PR TS.5.2, puis **TS.5.3 — extraction
  `harmony`** (`chord-*` ×5 + chroma, roman-numeral, harmonic-cycle,
  bass-line…) : elle importera `rhythm` (beat-grid) → première depRule
  inter-features explicite `'feature:harmony': [sameTag, 'shared',
  'feature:rhythm']`, et devra régler le cycle `harmonic-cycle →
  section-matching` (promouvoir `sequenceAgreement` en algorithme générique).
- Gotchas : dans rhythm, `shared/` s'importe en `../../shared/…` ; les specs
  peuvent importer la nursery (invisibles pour Sheriff) — seul le code de prod
  est tenu par le ratchet ; `pnpm exec stryker run --force` (le `--` de pnpm
  mange l'option sinon).
