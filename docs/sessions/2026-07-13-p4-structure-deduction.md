# Session — 2026-07-13 — p4-structure-deduction

## Done

- **PR #115 (P.3) mergée** en début de session — Lot P.3 clos.
- **P.4 phase 1 — déduction de structure** (décision de session : avant
  l'impression, déduire la structure du morceau depuis la détection — la
  phase « impression » reste en veille) :
  - **Domaine pur `chart-structure.ts`** : `deduceStructure(labels)` — la
    structure comme problème de compression (MDL) : le morceau entier est le
    tuilage à un bloc, chaque tuilage uniforme par longueur de section
    courante (16/12/8/4) est un candidat ; coût = mesures des blocs DISTINCTS
    + une référence par bloc ; à égalité la plus grande section gagne.
    Matching flou entre blocs : ≥ 3/4 des mesures **détectées** égales — le
    silence (blank-vs-blank) ne compte pour personne, une détection
    unilatérale compte comme désaccord. Les occurrences d'un même type votent
    par mesure (égalité → la première occurrence gagne) : le regroupement
    **nettoie** les accords mal détectés, pas seulement la mise en page.
  - **`renderStructuredSource(sections, barsPerRow)`** : en-têtes `[A]`/`[B]`
    (bijective base 26 après Z), paire adjacente pliée en `|: … :|`
    (splice sur la chaîne entière — chaque bloc rendu commence/finit par une
    barre), runs > 2 écrits en copies, section unique rendue à plat (aucune
    régression sur les brouillons sans structure). Un type = UN objet section
    partagé ; le renderer plie sur l'identité d'objet, l'invariant
    « même label ⇒ mêmes mesures » est structurel.
  - **`detectChords` branché** : le brouillon pré-rempli est désormais
    structuré (`deduceStructure` + `renderStructuredSource` au lieu du
    `renderChartSource` plat). README application mis à jour.
- **Tests** : 18 unitaires + 2 propriétés fast-check (générateur bruit +
  chansons structurées) — round-trip render→parse→`unrollChart` : aucune
  mesure perdue/inventée, contenu rejoué à l'identique. +1 test
  d'acceptation sur `detectChords` (pli en `|: :|`).
- **Mutation-driven hardening** : 2 passes Stryker ciblées →
  **100 % de mutants tués** sur `chart-structure.ts` (104 killed dont
  2 timeouts). Les survivants ont produit 5 tests (tie-break MDL, tie de
  vote, frontière exacte 3/4, tail non absorbé, désaccords directionnels)
  et 3 simplifications (garde redondante, `?? 0` mort, boucle `forEach`).
- **Revue 8 angles (medium)** : 5 constats corrigés en TDD — silence-compte-
  comme-accord (bug réel : blocs quasi vides fusionnaient et effaçaient un
  accord détecté), identité de run par objet (perte de contenu si label
  réutilisé), labels après Z, chirurgie de chaîne `withRepeatBars`, formule
  MDL dupliquée. 3 arbitrés (voir Decisions).

## Not done / remaining

- **PR à ouvrir** (ce rapport part dedans) — next action ci-dessous.
- Phase 2 (en veille, si l'usage le réclame) : port `StructureDetectionPort`
  audio (self-similarity / modèle de segments étiquetés) pour distinguer des
  sections à progression identique et nommer couplet/refrain.
- P.4 « impression » (le but initial du lot P.4 avant ce détour) toujours en
  veille.

## Decisions

- **La déduction produit un brouillon** que l'utilisateur corrige (même
  contrat que la détection d'accords) — jamais un écrasement d'une grille
  éditée ; l'UI existante (confirmation deux temps) couvre déjà ce chemin.
- **Arbitré — tie de vote à 2 occurrences garde la 1re** : une variation
  réellement jouée au 2e passage (G → E7) détectée à 1-1 est réécrite ; les
  reprises étant presque toujours identiques, c'est le nettoyage voulu — le
  brouillon reste éditable. À revisiter si ça mord (option : ne plier que
  l'exact-match).
- **Arbitré — runs > 2 écrits en copies** (pas de `×N` dans la grammaire) :
  un vamp ×8 sort à plat, identique à l'avant-P.4 — pas de régression, pli
  éventuel en phase 2.
- **Arbitré — tuilage uniforme sans offset de phase** : une intro de 4
  mesures devant des couplets de 8 rend la répétition invisible (sortie à
  plat, comme avant). La généralisation propre est un DP sur les points de
  coupe avec le même coût MDL — phase 2 si l'usage le réclame.

## Gate status

- typecheck : ✅ (via `pnpm gate` pre-commit sur chaque commit)
- tests (with coverage) : ✅ **1173 tests**, 101 fichiers ; coverage
  96,82 % st / 91,56 % br
- mutation (Stryker, local) : ✅ run complet 95,75 % (42 min) puis 2 runs
  ciblés post-hardening — **`chart-structure.ts` 100 % tués (104 mutants)** ;
  score global dernier run 96,13 %
- biome / sheriff / knip / jscpd : ✅ (5 clones CSS/TSX pré-existants,
  inchangés)

## State to resume from

- **Single next action** : pousser `feat/p4-structure-deduction` et ouvrir
  la PR (3 commits : feat + test hardening + fix revue, plus ce rapport).
- Gotchas :
  - `pnpm test:mutation -- --mutate <fichier>` ne passe pas les args
    (commander : « too many arguments ») — utiliser
    `npx stryker run --mutate "<glob>"` pour un run ciblé.
  - Stryker échoue sur son dry-run si la gate/vitest tourne en parallèle —
    le lancer seul.
  - Le générateur fast-check inclut un bras « chansons structurées »
    (blocs répétés) : le bruit pur ne répète presque jamais et laissait les
    chemins de pli non exercés — c'est lui qui a attrapé le bug du run de 3.
