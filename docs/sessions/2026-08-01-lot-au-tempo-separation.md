# Session — 2026-08-01 — Lot AU : le tempo et la séparation se parlent

## Done

- **AU.1 — Le click rejoint les stems** : en ordre « séparer d'abord, tempo
  ensuite », aucun chemin ne siégeait le click (détection, tap, BPM tapé le
  sautaient dès qu'une séparation possédait le mixeur ; un tempo atterrissant
  pendant la séparation était perdu par closure périmée). Réparé en
  quatre couches, TDD rouge→vert à chaque étage :
  - réducteur core : `addChannel` porte le canal complet (gain reclampé,
    no-op sur id déjà mixé) ;
  - `useMixer.addStem(stem, source, channel?)` : réglages explicites +
    poussée des gains effectifs (un click né muet doit naître silencieux
    dans le moteur, qui défaulte à l'unité) ;
  - `useMetronome.join(grid, audio, channel)` : le click **rejoint** le mix
    qui joue (`addStem`), sans restore qui couperait la lecture ; si un
    click est déjà en place, swap de la PCM (`replaceStem`), canal conservé ;
  - les trois chemins de seating branchés sur `join` quand
    `separationOwnsMix` (use-run-tempo-detection + `seatManualClick`) ;
    `use-separate-and-load` lit `analysis` et `mixer` **à la résolution**
    (`useLatest`) — un tempo posé pendant les ~70 s de séparation siège
    désormais le click dans le restore stems+click.
- **AU.2 — `--port` ne piège plus** : toute page loopback
  (`http://localhost:<port>` / `http://127.0.0.1:<port>`) passe par **motif**
  sur chaque surface gardée — la liste `LOUPE_ALLOWED_ORIGINS` ne gate plus
  que les origins non-loopback. `LOCAL_ORIGIN_PATTERN` dans `origins.py`
  (OriginGuard + CORS du harnais et de Modal), miroir Deno dans
  `mint-analyze-token`, jumeau écrit main dans `netguard.rs` ; parité du
  motif Python ↔ Deno verrouillée par `docs/origins-parity.spec.ts`
  (le Rust par ses tests unitaires). Runbook § 0bis documente l'acceptation.
  Effet collatéral : le dev Vite sur 5174/5175 n'est plus refusé non plus.
- **AU.3 — Cold-start narré sur le tempo** : les deux faces busy du
  `TempoItem` (OperationStatus et le « Réessayer » en cours) portent
  `detail` (`analysis.cold-start`) + `detailAfterMs: 4000` — même copie,
  même délai que séparation/structure/accords ; la première analyse du
  parcours n'est plus muette ~50 s sur moteur froid.

## Not done / remaining

- AU.1 vérifié par tests (unitaires + orchestration) — pas de browser-verify
  du scénario complet « séparer puis taper un BPM » (réservé aux cas que les
  tests n'atteignent pas ; les trois chemins et la closure sont couverts).
- L'acceptation loopback d'AU.2 ne prend effet **sur les surfaces
  distantes** qu'au prochain déploiement Modal + Edge Function.

## Decisions

- **Le click tardif REJOINT le mix, il ne le re-siège pas** : sur un mix
  séparé qui joue, le chemin est `mixer.addStem` (un canal de plus), jamais
  `restore` (qui recharge le moteur et coupe la lecture). `attach` reste le
  chemin du chargement groupé (séparation ou restauration), `join` celui du
  tempo tardif.
- **Loopback = confiance par motif, pas par liste** : un Origin
  `http://localhost:<port>` est la machine de l'utilisateur ; l'env ne sert
  plus qu'aux origins déployés. Le motif existe en 3 exemplaires (Python,
  Deno, Rust) — la parité est un test, pas une discipline.

## Gate status

- typecheck : ✅ · biome / sheriff / design / react / tokens / i18n /
  check:shell : ✅ · knip / jscpd : ✅ (gate stampé)
- tests (with coverage) : ✅ (91,3 % statements, seuils tenus) ; catalogue
  Lingui inchangé (copies réutilisées)
- mutation (Stryker, diff) : ✅ **93,46 %** (seuil 90) — `mixer.ts` 97,78 %
- serveur Python : ✅ 191 tests, ruff + pyright verts, couverture 98,6 %
- Rust : ✅ 58 tests, fmt + clippy verts · Deno : check/lint/fmt verts
- Sonar : quality gate OK sur main (8 issues assumées inventoriées en
  Veille) ; l'analyse de la PR #337 arrive ~5 min après le push — à lire
  avant merge

## State to resume from

- **Single next action** : Lot AV — les erreurs parlent français (AV.1 :
  codes discriminés sur la ligne NDJSON d'import URL + table Lingui), depuis
  un main à jour après merge de la PR #337.
- Gotchas : si le numéro de PR n'est pas #337, corriger STATUS/Suivi avant
  merge ; le déploiement Modal/Edge (AU.2 distant) est une action opérateur
  séparée (`modal deploy` + `supabase functions deploy`).
