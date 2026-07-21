# Session — 2026-07-21 — al3-precise-speed-pitch

## Done
- **AL.3 — Vitesse/Hauteur précises** (roadmap v7, Lot AL). Core pur touché +
  adaptateur web ; l'idiome « retour neutre » partagé avec AM.2 traité ici.
  - **Core (TDD strict, red→green)** :
    - `stepTempoPercent(percent, direction)` + `TEMPO_PERCENT_STEP = 5`
      (arrondit avant le pas → le clavier ne laisse jamais un `102,5 %`,
      clampé aux bornes). `stepPitchSemitones(semitones, direction)` +
      `PITCH_SEMITONE_STEP = 1` (réutilise `clampPitchSemitones`). Property
      tests : le résultat reste toujours dans la plage jouable.
    - Deux `Command` neuves — `tempoStep`/`pitchStep {direction}` — bindées
      **par caractère** dans `defaultKeyBindings` : `[`/`]` = vitesse ±5 %,
      `{`/`}` = hauteur ±1 demi-ton (les crochets shiftés sont des caractères
      distincts, donc un `[` nu ne déclenche jamais la hauteur).
  - **Web** :
    - `StepperField` (extrait dans transport-bar) porte l'idiome pilule zoom :
      `−  slider  +  valeur éditable [unité]`. La valeur est un
      `CommitNumberField` (flagging N.4 : hors bornes / non-entier → `aria-invalid`)
      au lieu d'un span en lecture seule. Vitesse et Hauteur le composent
      (zéro clone jscpd — le risque de duplication vitesse↔pitch était réel).
    - Peau `.stepButton` **promue dans controls.module.css** (composée par la
      pilule zoom `.tick` **et** les steppers) → un seul « nudge d'un grain ».
    - `stepTempo`/`stepPitch` câblés bout-en-bout : `ShortcutActions` →
      `dispatch` → `useShellShortcuts` (deps `speed`/`pitch`) →
      `playbackSteppers(player)` (hissé module-scope, budget react-doctor). Les
      ± de la pilule ET les raccourcis passent par le **même** `stepTempoPercent`
      / `stepPitchSemitones` → aucune divergence.
    - **Fader dB : double-clic 0 dB** (`onDoubleClick → UNITY_GAIN_DB`) dans
      `stem-headers`, l'overlap AM.2 soldé ; double-clic slider vitesse/pitch =
      retour neutre (100 % / 0, déjà présent, porté par `StepperField`).
    - Aide clavier auto-dérivée : `describeCommand` gagne les deux cas
      (`shortcuts.tempo-*` / `shortcuts.pitch-*`), le dialogue « ? » les liste.
  - **Copy Lingui** : ids `transport.tempo-field`/`pitch-field`,
    `transport.tempo-up`/`down`, `transport.pitch-up`/`down`,
    `mixer.volume-reset`, `shortcuts.{tempo,pitch}-{up,down}` (infinitifs) ;
    `pnpm --filter @app/web i18n:extract` lancé (catalogue `fr` régénéré).
- **Vérif navigateur** (`localhost:5173`) : footer conforme — pilules
  `−  slider  +  100 %` (Vitesse) et `−  slider  +  0` (Hauteur), hauteur
  footer inchangée, zéro overflow, console propre. **Bug de compile attrapé au
  navigateur** que la gate ne voit pas (voir Decisions).

## Not done / remaining
- **AL.4 — speed-trainer découvrable** (déclencheur désactivé-avec-tooltip hors
  boucle + ligne d'aperçu des 4 champs) — prochaine tranche du Lot AL.
- **AM.2** (fader console : pas fin Shift/molette 0,5 dB, lecture dB éditable,
  fader plus long) reste au Lot AM — seul le double-clic 0 dB est anticipé ici.

## Decisions
- **`[`/`]` = vitesse, `{`/`}` = hauteur** (checkpoint utilisateur). Deux paires
  distinctes couvrent les deux axes au clavier ; les crochets shiftés sont des
  caractères à part entière, donc aucune collision avec la paire nue.
- **Pas fixe additif (±5 % / ±1 demi-ton), pas de snap sur grille** : `102 %`
  après un pas depuis `97 %` est acceptable et prévisible (moins de mutants) ;
  la valeur est presque toujours sur la grille de toute façon.
- **Read-out pitch éditable sans signe/unité** (« 2 » au lieu de « +2 ») : le
  champ éditable remplace `signedSemitones` ; la légende « Hauteur » + les ±
  portent le sens. Densité footer (AE) : pas d'unité longue « demi-tons ».
- **`composes` même-fichier = ordre significatif** : `.stepButton composes:
  touchTargetTall` a d'abord été placé **avant** la définition de
  `touchTargetTall` → `CssSyntaxError` au dev-server (« referenced class name …
  not found »), **invisible de la gate** (biome lint le texte, jsdom ne résout
  pas les `composes`). Bloc déplacé **après** `touchTargetTall`. Leçon :
  browser-verify attrape le pipeline CSS réel.

## Gate status
- typecheck: **OK**
- tests (with coverage): **OK — 1965 tests** (+16 : core steps + brackets,
  ± pilule, champ éditable, double-clic reset vitesse + fader), 153 fichiers.
  Couverture globale 97,12 % stmts.
- mutation (Stryker, local, core touché): **OK — 92,73 % scopé aux 3 fichiers
  changés** (≥ break 90). 4 survivants = **équivalents** documentés (bornes de
  clamp `<`/`>` → `<=`/`>=` dans `stepTempoPercent` + `clampPlaybackRate`
  préexistant ; `direction × 1` ↔ `÷ 1` dans `stepPitchSemitones`, STEP = 1).
- biome / sheriff / knip / jscpd: **OK** (jscpd 0,09 % — les 2 clones CSS sont
  préexistants et hors périmètre) ; impeccable **OK** ; react-doctor **0 issue**
  (WorkstationShell < 300 après `playbackSteppers` hissé) ; check:tokens/design
  **OK**.

## State to resume from
- **Single next action** : commit (2 commits : feat code, docs STATUS+rapport)
  → push `feat/al3-precise-speed-pitch` → `gh pr create` → merge, puis **AL.4**.
- Gotchas / half-done edits : aucun. Branche partie de `origin/main` (AL.2 =
  #235 mergé). **STATUS.md aussi condensé cette session** (journal « Where we
  are » de 1110 → ~22 lignes, chaque étape v4→v7 redescendue en une ligne
  d'historique) — ride dans le commit docs de cette PR.
- CI GitHub : cf. veille facturation (X.1) — vérifier que les jobs tournent.
