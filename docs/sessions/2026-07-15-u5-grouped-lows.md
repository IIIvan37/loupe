# Session — 2026-07-15 — u5-grouped-lows

## Done

Les trois basses groupées de U.5, une par commit :

- **Allowlist d'origines env-drivée sur les trois surfaces** (`refactor(server)`
  1/3). `server/app/origins.py` nouveau module pur (`env_list` extrait de
  `main.py` + `allowed_origins()`), consommé par `main.py` (CORS + OriginGuard
  + hosts) et par `modal_app.py` (CORS — la liste hardcodée supprimée, la
  valeur vient de `LOUPE_ALLOWED_ORIGINS` sur le secret `loupe-analyze-jwt`).
  L'Edge Function lit la même variable via `Deno.env`
  (`parseAllowedOrigins` exporté pur, parsing miroir du Python). Défaut partagé
  = les deux origines 5173. Runbook J2 § 0bis : le tableau des trois
  emplacements + « env change, jamais une édition de code ».
- **`boundaries_to_segments` extrait au module pur** (2/3). La fonction
  fence-post vivait dans `structure.py` (exclu coverage + pyright — le trou
  O.4, même moule) ; déplacée verbatim dans `structure_segments.py` à côté de
  `stitch_segments`, 3 pytest épinglent le contrat breakpoints→segments.
- **Split mécanique de `tempo.ts`** (3/3). 524 lignes / 26 exports / 4 concepts
  → `beat-grid.ts` (grille + mètre + octave fold), `tempo-map.ts`
  (segmentation + sanitize), `manual-tempo.ts` (override + tap), `median.ts`
  (l'helper partagé). Code déplacé verbatim, API publique inchangée
  (`index.ts` re-pointé), spec splitté pareil — compte de tests identique
  avant/après (vérifié par le finder « removed-behavior » : les 98 cas et tous
  les exports retrouvés ligne à ligne).
- **Revue 8 angles → 9 fixés, 4 écartés documentés** (commit fixes) :
  - `*` dans `LOUPE_ALLOWED_ORIGINS` aurait flippé CORSMiddleware en
    wildcard-allow-all sur Modal (aucun OriginGuard là-bas) → filtré des deux
    côtés, fail-closed, testé (finder A — le seul correctness réel).
  - Tests hermétiques à l'env opérateur : `server/tests/conftest.py` scrub
    `LOUPE_ALLOWED_ORIGINS`/`HOSTS` avant l'import de `app.main` ;
    `Deno.env.delete` avant l'import dynamique du handler ; assertions
    `parseAllowedOrigins('')`/`('*')` → set vide (set-but-empty ≠ défauts).
  - Réuse : `typicalBar` (song-structure) recodait la médiane → `median.ts` ;
    clamp beats/bar dupliqué remeterGrid/buildManualGrid →
    `clampBeatsPerBar` exporté de beat-grid.
  - Doc : bloc doc orphelin de `buildTempoMap` recollé (la constante
    tolérance remontée au-dessus), contrat « liste vide → NaN » documenté sur
    `median` (localReferenceGap s'y appuie), « 6 temps » → « 6 beats »
    (convention comments-in-English), lignes blanches résiduelles modal_app.
  - Écartés : helpers gridOf/steadyTimes dupliqués entre specs (specs
    jscpd-ignorés, colocalisation assumée) ; export test-only de
    `parseAllowedOrigins` (voulu — testable sans stack live) ; test de parité
    inter-langages lisant origins.py depuis Deno (overkill pour 2 constantes,
    le runbook porte le contrat) ; vieux plans complets citant tempo.ts
    (documents datés, pas de churn).

## Not done / remaining

- **Redéploiement** : le filtre `*` et l'env-drive ne sont en prod qu'après
  `modal deploy modal_app.py` + `supabase functions deploy mint-analyze-token
  --use-api` (aucune urgence : sans la variable, comportement identique à
  avant — défauts 5173).
- Reste roadmap v4 : T.1–T.3, V.1–V.4, W.3–W.5.

## Decisions

- **`*` refusé dans l'allowlist, fail-closed** — un wildcard aurait des
  sémantiques divergentes par surface (allow-all sur Modal, inerte sur l'Edge) ;
  la liste vide se remarque tout de suite, le wildcard silencieux non.
- **Set-but-empty ≠ unset** : variable posée mais vide = « aucune origine »
  (verrouillage volontaire), jamais les défauts — testé en Python ET en Deno.
- Le split spec duplique ses petits helpers par fichier (pas de kit partagé) :
  les specs sont hors jscpd et hors coverage, la colocalisation prime.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ **1462 web** (121 fichiers — même compte
  avant/après le split, aucun test perdu) · **221 pytest** serveur (+7),
  coverage 97,9 % · Deno check/lint/fmt ✅, tests stack-free 2/2 (la suite
  live-stack n'a pas été relancée — parsing pur seul touché côté Edge).
- mutation (Stryker, local) : ✅ **93,55 %** (break 90) — beat-grid 91,3 %,
  tempo-map 91,9 %, manual-tempo 91,5 %, median 100 %.
- biome / sheriff / knip / jscpd : ✅ (jscpd sous le seuil 1,0 % resserré
  hier).

## State to resume from

- **Single next action** : merger la PR U.5, puis attaquer **T.1** (roadmap
  v4 — séquencement : T.1–T.3 puis V.1).
- Gotchas : au prochain deploy Modal/Edge, rien à faire de plus — mais pour
  ajouter l'origine déployée/Tauri, suivre le runbook § 0bis (3 env à poser,
  valeurs identiques). `clampBeatsPerBar` est exporté de `beat-grid.ts` pour
  `manual-tempo.ts` mais volontairement absent de l'API publique (`index.ts`).
