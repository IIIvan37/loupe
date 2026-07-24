# Session — 2026-07-24 — AO.2 vie et profondeur

## Done

- **Transitions motion sur les sept peaux de base** (`controls.module.css` :
  amber/secondary/ghost/quiet/confirm/step/numberField — les chips en
  héritent par `composes`) : couleur, bordure, fond, ombre sur
  `--motion-fast`/`--motion-ease`. `transform` exclu de la liste — le dip
  1 px pressé reste instantané à dessein.
- **Élévation de repos** : token `--elevation-rest`
  (`inset 0 1px 0 rgb(255 255 255 / 0.04)`) ; posé sur les faces pleines
  (amberButton, quietButton, stepButton) et composé devant `--shadow-1/2`
  des couches flottantes (dialog, toast, popover, menu d'import) — la
  profondeur lit la lumière du dessus, plus seulement l'ombre du dessous.
- **Halo Play** : pendant la lecture, le bouton respire un halo ambre
  (`play-breathe` 2,2 s sur `--amber-glow`), accroché à l'état existant
  `[aria-pressed='true']` — **zéro TSX, zéro test nouveau** (l'état était
  déjà exposé). Sous `prefers-reduced-motion`, le reset global effondre la
  pulsation et le halo statique demeure.
- Vérifié dans Chrome (5173) : animation `play-breathe` active et ombre
  ambre mesurées au style calculé pendant la lecture.

## Not done / remaining

- AO.3 (signature de marque : motif loupe/amber-teal récurrent, vocabulaire
  d'icônes) reste — le gradient waveform d'AO.1 en est la première pierre.

## Decisions

- **Le halo s'accroche à `aria-pressed`** — l'affordance visuelle dérive de
  l'état accessible déjà publié, jamais d'un attribut parallèle.
- **Reduced motion garde un halo statique** : l'information « ça joue »
  survit à l'opt-out du mouvement ; seule la respiration disparaît.
- **Le dip pressé reste hors transitions** (décision existante reconduite).

## Gate status

- typecheck / tests / biome / sheriff / knip / jscpd / impeccable /
  react-doctor / tokens : ✅ (gate exit 0, 2096 tests)
- mutation (Stryker) : **non lancée — slice 100 % CSS, aucun fichier
  `@app/core` touché** (périmètre muté intact, run AO.1 du jour fait foi).

## State to resume from

- **Single next action** : ouvrir la PR `feat/ao2-life-depth` → `main` (ce
  rapport dedans) ; après merge, STATUS sur `main` en doc-only, puis
  checkpoint d'approche AO.3.
- Gotchas : toute nouvelle peau interactive doit rejoindre la liste de
  transitions groupée en tête de `controls.module.css` et, si elle a un
  fond, porter `--elevation-rest`.
