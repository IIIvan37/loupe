# Session — 2026-07-18 — spectrum-harmonics

Point 3/6 du lot pré-beta « problèmes d'UI » (stacké sur #205 → #204).
Cadrage précisé par l'utilisateur : **distinguer, pas filtrer** — certaines
classes du Spectre ne sont que des harmoniques d'une note plus grave (quinte
fantôme du 3ᵉ partiel…), il faut les différencier visuellement sans les
masquer. Rendu validé au checkpoint : segments empilés même teinte (plein =
joué, estompé = harmonique), traitement identique pause/lecture.

## Done

- **Core TDD** : `chromaWithHarmonics(magnitudes, sampleRate)` →
  `{ chroma, harmonicShare }` (`domain/chroma.ts`). Pics = maxima locaux
  STRICTS en bande [32, 2100] Hz au-dessus d'un plancher relatif
  (`PEAK_FLOOR` 5 % du pic dominant) ; un pic est « harmonique » si un pic
  plus grave l'explique comme multiple entier k = 2…8
  (`HARMONIC_MAX_MULTIPLE`), tolérance ±30 cents élargie à un bin plein dans
  le grave (bins > cents sous ~600 Hz). `chroma` reste exactement
  `chromaFromSpectrum` — hauteurs de barres inchangées, la part harmonique
  par classe est une info EN PLUS. Biais assumé documenté : une vraie note
  posée sur le multiple d'une autre (octave, quinte à vide) lit harmonique —
  d'où « probables » dans la légende.
- **UI** : `ChromaView` empile deux segments par barre (well en colonne,
  joué plein en bas, harmonique même teinte opacité 0,35 au-dessus — hauteur
  totale inchangée) + légende « Estompé : harmoniques probables d'une note
  plus grave. » (`analysis.chroma-legend`). `data-testid`
  `chroma-harmonic-*` pour les specs.
- **Browser-verify réel** (WAV synthétique La 220 + partiels 2× et 3ᵉ fort) :
  **E entièrement estompé** (100 % harmonique — la quinte fantôme), **A =
  69 % plein + 31 % estompé** (fondamentale + octave), légende visible.
  Bonus vérifié sur la même page : cartes de raccourcis 5/6 et panneau à
  3 onglets (6/6) rendus correctement.

## Not done / remaining

- Point 4/6 : grilles d'accords sur stem de basse (dernier du lot pré-beta).

## Decisions

- Distinction par **opacité, même teinte** (pas deux couleurs) ; hauteur de
  barre = énergie totale, seule la répartition plein/estompé change.
- Le marquage est « probable » par construction (ambiguïté octaves/quintes
  réelles) — la légende le dit, on n'affirme pas.

## Gate status

- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor :
  verts (`pnpm gate` exit 0).
- tests (with coverage) : vert — **1887 tests** (+21), seuils core tenus.
- mutation (Stryker, core touché) : `chroma.ts` **94,44 %** (37 survivants
  au premier run → 30 tués en 2 passes TDD : plateaux, plancher relatif,
  bornes de bande exactes, fondamentale sous-bande, pic hors-bande, dernier
  bin, unisson désaccordé/garde k=1, 8ᵉ partiel, accumulation par classe) —
  global **91,91 %** (break 90). Les **7 restants sont équivalents
  documentés** : lectures hors-bornes (×3, `?? 0` les absorbe), seed
  `["Stryker was here"]` (filtré par le plancher), `new Array()` sparse
  (sémantique identique via `?? 0`), borne float du plancher (0.05×m
  inexact en binaire), garde lower-only redondante avec k<2.

## State to resume from

- **Single next action** : ouvrir la PR (stackée sur
  `feat/musical-seek-notes-tab` #205) puis attaquer le point 4/6 — grilles
  d'accords sur stem de basse : checkpoint d'approche à faire (Demucs en
  prod expose `/separate` + stems ; à décider : router quel signal vers BTC
  — stem de basse seul pour la basse du chord label ? mix sans batterie ? —
  et le coût d'une séparation implicite avant détection).
- Gotchas : les multiples pairs (octaves) retombent sur la MÊME classe — un
  test de share à 1 exige un multiple impair (×3) ; deux bins adjacents ne
  peuvent pas être deux pics (maxima stricts).
