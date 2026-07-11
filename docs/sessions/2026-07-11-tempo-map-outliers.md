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

## Not done / remaining
- **Parasites denses** (un double-fire après *chaque* beat) : hors de portée
  d'un garde par médiane (les gaps courts deviennent majoritaires). Documenté
  dans le code ; le vrai remède serait `dbn=True` (continuité de tempo) côté
  beat_this — coût dépendance/latence, non retenu pour ce lot.
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
- mutation (Stryker, local): ✅ **95,01 %** global, tempo.ts 94,29 %
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
