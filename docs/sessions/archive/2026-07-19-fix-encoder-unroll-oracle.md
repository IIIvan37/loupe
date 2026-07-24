# Session — 2026-07-19 — fix : l'encodeur ne replie plus des passes inégales

## Done

- **Bug de correction dans `form-encoder`** (découvert via l'oracle
  `playedLabels(encode(song)) ≡ song`, qui échouait par intermittence en CI —
  fast-check tire une graine aléatoire). **Cause** : un cycle PROPRE de N
  copies d'une section dont la longueur n'est pas un pas de tuilage
  (`SECTION_LENGTHS = [16,12,8,4]`) — p.ex. 7 mesures — est tuilé en blocs de
  4 qui ne matchent que **tolérant** (≥ 75 %). Le planner votait ces blocs et
  les repliait en `|: :|`, or des barres de reprise **rejouent une seule
  copie verbatim** : les mesures divergentes disparaissaient → le playback ne
  correspondait plus à la détection. Contre-exemple réduit : intro `Db×4` +
  3× `[Em Em Em Em G G Em]`.
- **Fix (TDD)** : un repli (ou un vote) ne préserve le playback que si les
  passes sont **exactement identiques**. Deux gardes dans `planner`/`movesAt` :
  (1) un type imprime FIDÈLEMENT dès que ses passes ne sont pas toutes
  byte-identiques (généralisation de la règle « ending variants ») ; (2) une
  move de repli n'est offerte que si les passes de l'empan sont identiques.
  Helper `allIdentical`.
- **Correction d'un test AI.2 qui épinglait le bug** : « a written middle
  pass prints the type vote » affirmait que le vote *nettoie* une mesure
  bruitée — ce qui **viole** l'oracle. Réécrit : une passe divergente
  s'imprime fidèlement, playback = détection exacte (le compte de mesures
  reste préservé sous bruit, cf. la propriété « noise »).
- Non-régression : contre-exemple ajouté en test déterministe ; oracle
  stressé à **5000 tirages** (vert). Le nettoyage-par-vote reste dans
  `relabelChartBySections`/structure — l'encodeur, lui, préserve le playback.

## Not done / remaining

- 1 mutant NoCoverage = le garde défensif `first === undefined` d'`allIdentical`
  (empan vide, inatteignable via l'encodeur). Laissé tel quel.

## Gate status

- `pnpm gate` : ✅ exit 0
- tests : ✅ form-encoder 32, core 132 (encoder+structure+matching)
- mutation (Stryker, `--force` scopé) : form-encoder **88,46 %**, global
  **92,66 %** (break 90) ✅
- biome/sheriff/knip/jscpd : ✅

## State to resume from

- **Single next action** : ouvrir la PR (base `main`), merger — elle
  **déflake la CI** de `main` (l'oracle échouait ~1 run sur N).
- Gotcha : l'oracle `form-encoder` n'a pas de graine fixe — un échec CI futur
  sur ce test = un nouveau contre-exemple réel, pas un flake outillage.
