# Session — 2026-07-11 — tempo-map-outliers (K.2)

## Done
- **K.2 de la [roadmap v3](../roadmap-excellence-3.md)** : les tempos absurdes
  (~750 BPM sur « Somebody to Love ») venaient de beats **insérés** par le
  détecteur (double-fire sur une subdivision), que le garde-fou de
  `buildTempoMap` — conçu pour des beats *manqués* — lisait comme deux ruptures
  confirmées. Correction en **trois couches** :
  1. **Core** : `sanitizeBeatGrid` (exportée sur la surface publique) — filtre
     des gaps < 0,4× la **médiane locale fenêtrée** (±8 gaps, fenêtre glissée
     aux bords, gaps positifs seulement), avec **préférence au downbeat** dans
     une paire trop proche. `buildTempoMap` s'en sert en préfiltre.
  2. **Serveur** : `drop_spurious_beats(beats, downbeats, tolerance)` dans le
     module pur `beat_positions.py`, même algorithme, appliqué par
     `tempo_payload` — les nouvelles détections n'embarquent plus les parasites
     (grille waveform et stem de clic compris).
  3. **Seam de restauration** ([project-session.ts](../../packages/web/src/app/workstation-shell/project-session.ts)) :
     la grille persistée passe par `sanitizeBeatGrid` à l'ouverture — les
     projets sauvés **avant** le correctif s'auto-réparent (clic parasite du
     métronome et gridline en trop disparaissent, pas seulement le read-out).
- La review interne (8 angles + vérification par exécution) a durci le premier
  jet (médiane globale + keep-first), qui avait 4 défauts confirmés : downbeat
  orphelin (double-fire sur/avant la barre → métrique corrompue jusqu'à
  `detectMeter`), vraie section rapide >2,5× décimée (régression vs main),
  gaps nuls empoisonnant la médiane, et vieux projets non réparés. Tous fixés
  et testés (exemples + property fast-check « base tempo + parasites insérés →
  un seul segment au bon bpm », dont un contre-exemple réel trouvé par
  fast-check : cluster de parasites en début de grille → fenêtre glissée).

- **2ᵉ passe, sur retour utilisateur (« Don't Stop Me Now », 25–30 s)** : les
  parasites étaient bien filtrés, mais la **transition** intro 100 BPM → corps
  158 BPM exposait un défaut distinct — deux gaps « confirmés » suffisaient à
  `buildTempoMap` pour croire un tempo, donc le fill de batterie bruité créait
  des micro-segments 207 → 187 → 68 → 162 BPM. Ajout d'un **support minimal
  par segment** (`MIN_SEGMENT_SUPPORT = 4` gaps ≈ une mesure, dernier segment
  exempté pour les ritardandos finaux) : sur la grille réelle du projet, la
  carte passe de **21 à 7 segments** — 100 BPM jusqu'à 30,3 s puis 157,9, et
  l'outro garde son vrai ralentissement (79 → 83 → 97). Fixture de test tirée
  du motif réel + test frontière (changement tenu exactement 4 gaps → cru).

- **3ᵉ passe, sur retour utilisateur (clics parasites à 28 s)** : les beats du
  fill (0,28–0,32 s d'écart, trois faux downbeats consécutifs !) passaient le
  plancher anti-double-fire (0,4× médiane locale ≈ 0,2 s) mais contredisaient
  le tempo **cru** à cet instant (100 BPM → période 0,6 s). `sanitizeBeatGrid`
  travaille désormais en **deux passes** : (1) double-fires vs médiane locale
  (downbeat gagne), (2) bruit off-tempo vs la carte consolidée interne — un
  beat < 0,55× la période du tempo en vigueur est jeté (keep-first : les flags
  downbeat d'une zone poubelle sont eux-mêmes poubelle). Sur la grille réelle :
  clics 27,80 → 28,38 → 29,58 réguliers, tempo rapide seulement à partir de
  29,94 s (l'entrée réelle du groupe). `detectTempo` (use-case) sanitize aussi
  la grille — les détections fraîches sont couvertes quel que soit l'adaptateur.

## Not done / remaining
- **Modulation métrique anticipée** (« Don't Stop Me Now », 30→38 s) : le
  morceau module 104 → 156 BPM (×1,5) au piano ~8 s avant l'entrée de la
  batterie ; beat_this suit le piano (beats réguliers à 158 dès ~30 s) alors
  que le pouls ressenti — confirmé par autocorrélation d'onsets librosa —
  reste à ~104 jusqu'à 38 s. **Expérience menée avec l'accord utilisateur** :
  `dbn=True` (madmom installé depuis git, py3.14) produit une transition plus
  propre mais bascule encore plus tôt (28,7 s) — ce sont les activations du
  réseau, pas le post-traitement ; madmom désinstallé, venv restauré. Des
  beats soutenus et cohérents ne sont récusables par aucune heuristique de
  gaps, et ×1,5 n'est pas repliable par octave. **Remède produit** : édition
  locale du tempo (forcer un BPM sur une plage) — ajouté en veille roadmap.
- **Parasites denses** (un double-fire après *chaque* beat) : hors de portée
  d'un garde par médiane (les gaps courts deviennent majoritaires). Documenté
  dans le code.
- Mutants survivants dans `sanitizeBeatGrid` : arithmétique de bord de fenêtre
  (±1 index de gap, clamp) et frontière `<`/`<=` — quasi-équivalents en
  pratique (mesure nulle), assumés.
- Le read-out du panneau tempo reste sans clamp cosmétique — voulu (un clamp
  masquerait un bug de données).

## Decisions
- **Pas de repli d'octave par segment ni de clamp [40, 220]** dans
  `buildTempoMap` (pourtant évoqués par la roadmap K.2) : une fois les beats
  parasites filtrés, aucun test ne les exige, et un repli global casserait les
  ballades légitimement lentes (< 40 BPM) — YAGNI, `foldTempoOctave` manuel
  existe.
- **Médiane locale fenêtrée (±8 gaps) plutôt que globale** : une section rapide
  soutenue domine sa propre fenêtre (survit), un burst court reste minoritaire
  partout (filtré). La fenêtre **glisse** aux bords au lieu d'être tronquée.
- **Le downbeat gagne dans une paire trop proche** (core : flag `downbeat` ;
  serveur : coïncidence avec la liste `downbeats` sous tolérance) — sinon le
  keep-first jette le vrai beat quand le parasite le précède et orphelin le
  downbeat au-delà de la tolérance d'appariement (0,05 s).

## Gate status
- typecheck: ✅ (gate exit 0)
- tests (with coverage): ✅ 935 web/core (+7) · 134 pytest serveur (+7),
  couverture serveur 97 %
- mutation (Stryker, local): ✅ **94,93 %** global, tempo.ts 93,82 %
  (baseline 93,69 avant le lot)
- biome / sheriff / knip / jscpd: ✅ · ruff + ruff format + pyright serveur ✅
- Note : un flake `workstation-shell.spec.tsx` (timer Base UI ToastProvider
  après teardown jsdom, « window is not defined ») a fait échouer la gate une
  fois, passé au retry — 2ᵉ occurrence du jour, candidat Lot O.

## State to resume from
- **Single next action** : ouvrir la PR de cette branche
  (`fix/tempo-map-outliers`), la merger, puis attaquer **K.1** (grille
  d'accords : scrollport borné + scrollIntoView) — slice UI ⇒ checkpoint
  d'approche utilisateur d'abord (déjà posé en fin de conversation, en attente
  de validation).
- Gotchas : le PDF `your-song-elton-john-chart.pdf` (référence Lot P, sous
  droits) traîne non versionné à la racine — il bloque l'exception doc-only du
  hook main ; le déplacer temporairement pour tout commit doc-only sur main.
  La vérification navigateur n'a pas été jugée nécessaire (logique pure +
  property tests + le cas utilisateur exact en fixture) — re-détecter le tempo
  sur « Somebody to Love » à l'usage validera en réel.
