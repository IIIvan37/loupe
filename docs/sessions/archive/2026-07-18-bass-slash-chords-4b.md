# Session — 2026-07-18 — bass-slash-chords-4b

Point 4/6 du lot pré-beta, slice **4b** (dernière du lot) : la vraie note de
basse depuis le stem séparé → **slash chords** (`C/E`) dans les grilles
détectées. Tout côté client/core, zéro changement serveur (comme 4a).

## Done

- **Core TDD `domain/bass-line.ts`** :
  - `bassNotePerMeasure(samples, sampleRate, grid)` — par mesure
    (downbeat→downbeat), FFT Hann **16384 points** (4096 = ~4 demi-tons de
    bin à E1, inutilisable dans le grave ; 16384 ≈ 2,7 Hz ≈ un demi-ton),
    registre borné 38–262 Hz, pic maximal **interpolé paraboliquement** (le
    centre de bin brut nomme faux les notes hors-bin — testé à 47,4 Hz :
    bin brut → G, interpolé → F♯), contesté si un pic ÉLOIGNÉ (> 3 bins,
    hors leakage) rivalise (×2) → mesure `undefined`, pas de slash.
  - `applyBassSlash(labels, bassNotes)` — slash sur cellule mono-accord
    quand la basse stable ≠ fondamentale ; mesure vide/deux-accords/token
    non-accord/slash déjà présent → intacte. Épellation dièses (le respell
    de clé aval possède les bémols — `applyBassSlash` tourne AVANT).
- **Use-case** : `DetectChordsInput.bassNotes?` optionnel, appliqué juste
  après `chordLabelPerMeasure` (types élargis : labels `string|undefined`).
- **Hook** : `useChordDetection` calcule `bassNotes` quand le stem `bass`
  est présent (downmix + grille) — s'appuie sur les stems 4a (explicites ou
  séparation implicite).
- Specs : 15 domaine (dont interpolation, registre, downbeats seuls,
  contestation) + 1 use-case bout-en-bout (`| C/E | Am | F | G/B |`).

## Not done / remaining

- **Browser-verify réel du flux complet** (séparation implicite Modal → mix
  sans batterie → slashes sur vraie musique) — l'item pré-beta déjà noté au
  rapport 4a, étendu à 4b.
- Slash sur mesures multi-accords (v2 si demandé).

## Decisions

- Fenêtre FFT basse dédiée (16384) — la résolution du registre grave n'est
  pas négociable ; le pic interpolé prime sur le repli chroma par classes
  (le leakage disperse les classes voisines à ce registre).
- Un slash n'est imprimé QUE sur basse stable et dominante — le doute
  n'imprime rien (une grille fausse coûte plus cher qu'une grille incomplète).

## Gate status

- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor :
  verts (`pnpm gate` exit 0).
- tests (with coverage) : vert — **1912 tests** (+35), seuils core tenus.
- mutation (Stryker, core touché) : `detect-chords.ts` **100 %**,
  `bass-line.ts` **83,2 %** (41 survivants au premier run → 20 tués en
  3 passes : filtre downbeats, plafond de registre, famille parabolique via
  le cas hors-bin, `classOfName` simplifié aux dièses — les branches bémol
  étaient du code mort). Les **21 restants documentés en famille** :
  positions de fenêtres redondantes sur fixtures mono-note (chaque fenêtre
  attrape le même sinus), tie-breaks d'égalité `>=`, bornes flottantes
  exactes, clamp de span. Global **91,47 %** (break 90).

## State to resume from

- **Single next action** : ouvrir la PR de `feat/bass-slash-chords` —
  **LOT PRÉ-BETA COMPLET** après merge. Puis : browser-verify du flux
  stems→accords sur Modal réel, et retour aux garde-fous beta (plafond
  Modal, SMTP custom) du « Prochain » du STATUS.
- Gotchas : `applyBassSlash` court AVANT le respell → toujours des dièses en
  entrée ; les octaves d'un slash tombent sur la même classe (un test de
  share/slash discriminant exige un multiple impair).
