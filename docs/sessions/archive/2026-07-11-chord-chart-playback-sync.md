# Session — 2026-07-11 — chord-chart-playback-sync

## Done

- **Sync lecture de la lead-sheet** : la grille suit la tête de lecture.
  - Core (TDD strict, red→green→refactor + triangulation) :
    **`measureIndexAt(grid, seconds)`** pur dans `domain/tempo.ts` — la i-ᵉ
    mesure de la lead-sheet ↔ le i-ᵉ intervalle downbeat→downbeat du
    `BeatGrid`, donc l'index = nombre de downbeats ≤ t, − 1 ; `undefined`
    avant le premier downbeat (anacrouse) ou sans grille → le surlignage se
    désactive proprement, exactement le modèle « le temps est une projection,
    pas un champ » du plan. Bornes épinglées (entrée pile sur le downbeat,
    au-delà de la fin → dernière mesure, grille vide) + propriété fast-check
    de monotonie. Boucle de comptage sans allocation (appelée à chaque frame).
  - Web : `LeadSheet` reçoit `currentMeasureIndex?` (index **global** à
    travers les sections — les sections sont une aide de lecture, pas un
    reset), rend `aria-current="true"` + lavis ambre « ce qui joue »
    (`--amber-glow`/`--amber-deep`) sur la mesure courante ; la projection est
    une ligne dans `ShellMain` depuis `positionSeconds` + `tempo.analysis.grid`.
  - Tests d'acceptation au niveau shell (fake engine `emit(seconds)`) :
    surlignage de la bonne mesure pendant la lecture, et **aucun** surlignage
    sans beat grid.
- **Bars-per-row configurable** : `.row` passe à
  `repeat(var(--bars-per-row, 4), …)` — un **paramètre de rendu** posé inline
  par `LeadSheet` (`barsPerRow?`), jamais un champ du modèle (piège « vue
  page » du plan évité). Champ numérique 1–12 dans l'en-tête du panneau,
  état brouillon local : un champ vidé/hors bornes garde la dernière
  disposition committée.
- **Revue de code (8 angles, findings vérifiés)** → 6 findings, 5 corrigés :
  memoïsation de `parseChart` dans `LeadSheet` (le parent tick ~60×/s en
  lecture — re-parser une source inchangée à chaque frame), comptage sans
  allocation dans `measureIndexAt`, `cx()` au lieu du concat manuel,
  **`.numberField` partagé** extrait dans `ui/controls.module.css` (composé
  par le `.bpmField` du tempo-panel et le `.barsField` de la grille),
  commentaire bars-per-row rendu honnête (état de montage, reset au
  changement de piste). Écarté : hook draft-numérique partagé (les deux
  champs ont des sémantiques de commit volontairement différentes —
  extraction spéculative).

## Not done / remaining

- Le réglage bars-per-row se réinitialise à 4 au changement de piste
  (état du panneau, assumé/documenté) — à lifter seulement si l'usage le
  réclame.
- Auto-scroll de la lead-sheet vers la mesure surlignée (long morceau =
  mesure courante hors viewport) — incrément d'ergonomie possible.
- Divergence mesures de la grille ↔ downbeats détectés (grille plus courte
  que le morceau) : au-delà de la dernière mesure saisie, rien n'est
  surligné — comportement voulu par le modèle i↔i, pas un bug.

## Decisions

- **Le surlignage est une projection dérivée, jamais stockée** — conforme au
  modèle du plan chord-charts ; `measureIndexAt` vit dans `domain/tempo.ts`
  (il ne connaît que le `BeatGrid`, pas le `ChordChart`).
- **bars-per-row = paramètre de rendu** (variable CSS inline), pas un champ
  du modèle ni du manifest — la transposition/l'export restent indépendants
  de la mise en page.
- `--accent` n'existe pas dans `tokens.css` : le token « ce qui joue » est
  `--amber*` (au passage : `tempo-panel.module.css:76` référence `--accent`,
  bug latent pré-existant, hors slice).

## Gate status

- typecheck : ✅ (exactOptionalPropertyTypes : les props optionnelles
  « valeur signifiante » déclarent `| undefined` explicitement)
- tests (with coverage) : ✅ **875 tests** (+16), statements 96,2 %
- mutation (Stryker, local) : ✅ score global **95,14** ;
  `measureIndexAt` **0 survivant** (les 9 survivants de `tempo.ts` sont
  pré-existants : `buildTempoMap`/`buildManualGrid`/`appendTap`) ;
  chord-chart/chord-symbol toujours à 100 %
- biome / sheriff / knip / jscpd : ✅ (jscpd content grâce au `.numberField`
  factorisé plutôt que copié)

## State to resume from

- **Single next action** : ouvrir la PR de `feat/chord-chart-playback-sync`
  (4 commits : sync + bars-per-row + revue + ce rapport), puis choisir le
  prochain incrément — **Lot C chord-charts** (endpoint `/chords` BTC +
  port `ChordDetector`, lever d'abord les 2 angles morts du plan : spike
  Demucs et dispo des poids) ou **Lot J** de
  [roadmap-excellence-2](../roadmap-excellence-2.md).
- Gotchas : les hooks pre-commit relancent tout le gate — ne pas committer
  pendant qu'un Stryker tourne (contention CPU, timeouts) ; la nuit du
  2026-07-10→11 des runs ont mis >1 h par mise en veille machine, pas un
  problème de code.
