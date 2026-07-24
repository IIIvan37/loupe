# 2026-07-24 — TS.2 : fitness functions du template

**Lot** : TS.2 du [plan de resynchronisation template](../template-sync-plan.md).
**Branche** : `test/ts2-fitness-functions`.

## Ce qui a été fait

Trois specs d'invariants portées depuis `IIIvan37/hexagonal-tdd-starter`
(`template/main`), adaptées à l'arborescence loupe :

1. **`packages/core/src/purity.spec.ts`** — détecteur d'état ambiant
   (`Math.random`, `Date.now`, `performance.now`, `crypto.*`, `process.env`,
   `globalThis`, accès calculés sur globaux, `require()`) + détecteur
   d'imports étrangers (le hexagone n'importe que lui-même, seam `vitest`
   réservée à un futur dossier `testing/` — TS.4). Scan récursif de
   `core/src` ; le core actuel est propre, adoption quasi verbatim (seuls les
   chemins d'exemple synthétiques ont été renommés).
2. **`packages/core/src/public-surface.spec.ts`** — chaque export **valeur**
   de `core/src/index.ts` doit avoir au moins un consommateur hors core.
   Adaptations : les consommateurs sont les `.ts` **et** `.tsx` de
   `packages/*/src` hors core (guard `existsSync` — `packages/desktop` n'a
   pas de TypeScript aujourd'hui) ; test ajouté pour l'import multi-lignes
   avec spécificateurs `type` inline. La grammaire barrel (rejet des
   `export *`, default, valeurs inline) passait déjà sur notre `index.ts`.
   **17 exports orphelins détectés et retirés** (voir plus bas).
3. **`docs/docs.spec.ts`** — bornes STATUS ≤ 60 lignes non vides, pas de
   liens vers des rapports individuels, ≤ 5 session reports actifs +
   convention de nommage `<YYYY-MM-DD>-<slug>.md`. La section « path truth »
   (les living docs ne nomment que des chemins existants) du template est
   **différée** : à porter maintenant que `docs/adr/` existe (TS.3 mergé).
   Câblage : `docs` ajouté à l'`include` du `tsconfig.json` racine,
   `docs/**/*.spec.ts` ajouté à l'`include` vitest (coverage inchangée).

## Exports orphelins retirés de `index.ts`

`detectMeter`, `measureSourceSpans`, `transposeChartSource`,
`chromaFromSpectrum`, `detectInstruments`, `PRESENCE_THRESHOLD`,
`stemEnergy`, `SEEK_STEP_SECONDS`, `loopContains`, `clampGainDb`,
`dbToAmplitude`, `GAIN_DB_FINE_STEP`, `PITCH_SEMITONE_STEP`,
`MAX_PLAYBACK_RATE`, `MIN_PLAYBACK_RATE`, `TEMPO_PERCENT_STEP`,
`projectFromSession` — tous restent définis (et testés) dans leurs fichiers
domaine, que le core continue d'utiliser en interne. Seul consommateur
externe touché : `use-mixer.spec.tsx` recalculait des attendus via
`dbToAmplitude` → oracle local `10^(db/20)` dans la spec.

## Docs remises en borne

- `docs/STATUS.md` : 694 → 47 lignes non vides (historique effondré en une
  ligne par ère, liens de sessions individuels supprimés — le détail vit
  déjà dans les rapports datés).
- `docs/sessions/archive/` créé (+ README) ; **198 rapports archivés** (196 à
  l'ouverture du lot + 2 après le merge de TS.1/TS.3 qui ont ajouté leurs
  rapports), 5 actifs.

## Différé / notes

- **`shared/result.ts` non porté** (volontaire) : aucun consommateur
  aujourd'hui — knip (bloquant) le signalerait et l'invariant outside-in
  interdit le spéculatif. À adopter au premier besoin réel.
- Section « path truth » de `docs.spec.ts` : à reprendre avec TS.3 (ADR).
- La seam `vitest`-dans-`testing/` de `purity.spec.ts` est inerte tant que
  TS.4 n'a pas créé le subpath `@app/core/testing`.

## Validation

- `pnpm gate` : vert (typecheck, biome, sheriff, impeccable, react-doctor,
  tokens, tests + coverage, knip, jscpd).
- `pnpm test:mutation -- --force` : score en clôture de PR (voir corps de
  la PR).
