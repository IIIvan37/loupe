# Session — 2026-07-18 — ae-header-footer-density

Lot AE de la [roadmap v6](../roadmap-excellence-6.md) — l'irritant
utilisateur « headers et footers trop gros par rapport au reste du design »
(branche `feat/ae-header-footer-density`).

## Done

- **AE.1 — taille par défaut dans les peaux** : `.amberButton` /
  `.secondaryAction` / `.ghostButton` / `.confirmFace` portent désormais
  `font-size: var(--font-size-s)` — les actions du header (seuls contrôles
  de l'app sans taille explicite, rendus au 1rem du body via
  `button { font: inherit }`) retombent dans l'échelle. Ferme **par
  construction** le trou du verrou font-size (qui ne voit que les
  littéraux). Effet de bord assumé : les boutons du confirm-import-dialog
  (mêmes peaux, sans taille) s'alignent aussi.
- **AE.1 — peau `.chromeBar` partagée** : le chrome dupliqué header↔footer
  (le clone jscpd connu) promu dans controls.module.css ; chaque barre garde
  sa bordure, **son padding** (bouton de densité — leçon : surcharger le
  shorthand d'une peau composée est fragile, l'ordre de cascade inter-fichiers
  n'est pas garanti) et, pour le footer, son sticky.
- **AE.2 — densité** : padding bloc footer → `--space-2xs`, header →
  `--space-xs` ; le champ cents (qui culminait seul à ~70 px : input hérité
  à 1rem + 3 étages) passe en taille `s` avec input+« cents » sur un étage.
- **AE.3 — « Vitesse » dégonflé** : la parenthèse « (sans toucher au
  pitch) » déménage dans le tooltip du slider (fusionnée avec « double-clic
  pour revenir à 100 % ») ; catalogue ré-extrait.
- **Mesuré navigateur** (session Queen rouverte, projet sauvegardé) :
  header **63→55 px**, footer **94→58 px**, boutons header **32→28 px** à
  12,8 px. Capture visuelle vérifiée cohérente.

## Not done / remaining

- La restructuration 2 étages des champs Vitesse/Hauteur (option AE.2
  résiduelle, footer ~58→~48 px) — **à checkpointer avec l'utilisateur** si
  l'irritant persiste après cette passe.
- `.iconAction` (28 px) déjà aligné sur la nouvelle hauteur des boutons —
  rien à faire.

## Decisions

- **Toute peau interactive possède sa taille** (`s`) — l'omission ne peut
  plus fuir vers le défaut navigateur.
- Le padding reste chez le consommateur de `.chromeBar`, jamais dans la
  peau (fragilité de cascade inter-fichiers documentée dans la peau).

## Gate status

- `pnpm gate` : **vert** (exit 0) — 1914 tests.
- mutation (Stryker) : **skippé — zéro ligne de `@app/core` touchée**.

## State to resume from

- **Single next action** : Lot AD — le parcours accords dit vrai et ne gèle
  pas (AD.1 narration/annulation de la séparation implicite, AD.2 mesure
  puis Worker/nextPaint du bloc DSP, AD.3 memo V.1 restauré).
- Gotchas : specs ne pinnent pas la copy (ids Lingui) — le renommage
  « Vitesse » n'a touché que le catalogue.
