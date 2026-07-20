# Session — Lot AK.3 : l'import URL au niveau du fichier

**Date** : 2026-07-20
**Branche** : `feat/ak3-url-import-hero` (part de `main`)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AK

## Décision (checkpoint utilisateur)

Deux forks tranchés avant l'acceptance test :
- **Surface** — champ « Coller un lien » **inline** sous le bouton « Importer un
  fichier » dans le hero (option explicite de la roadmap), + un handler paste sur
  tout le hero qui pré-remplit le champ si le presse-papier tient une URL
  supportée. Pas un menu File/URL (moins paste-friendly).
- **Réutilisation** — **extraire un composant partagé** `UrlImportField` plutôt
  que dupliquer la validation/markup depuis `ImportMenu`.

Gating : l'URL reste **desktop-only** (yt-dlp, offload-only Lot AJ) — le champ
n'apparaît que quand `onImportUrl` est fourni (`desktop ? urlImport.submit :
undefined`), comme le menu du header.

## Changement

- **`UrlImportField`** ([packages/web/src/app/ui/url-import-field.tsx](../../packages/web/src/app/ui/url-import-field.tsx))
  — nouvelle unité partagée : le champ `type=url` contrôlé, l'avertissement
  « hôte non supporté » (a11y `aria-invalid`/`aria-describedby`/`role=alert`), le
  bouton submit et le hint « YouTube · SoundCloud ». Elle porte l'**invariant qui
  ne doit jamais diverger** entre les deux surfaces : validation contre
  `isSupportedSourceUrl` (la même politique que rejette le use-case). L'état de la
  chaîne reste chez le consommateur (contrôlé) pour permettre le seed-au-paste et
  le reset à la réouverture. `secondaryAction` slot pour le Cancel du popover ;
  `inputRef` pour le focus post-paste.
- **`ImportMenu`** rebranché sur `UrlImportField` : ~55 lignes de champ/validation
  supprimées, le popover ne garde que son titre + le `Popover.Close` en
  `secondaryAction`. Classes CSS mortes retirées (`.hint`, `.warning`, `.input`,
  `.actions`, `.submit`).
- **`EmptyState`** : nouvelles props `onImportUrl?`/`urlBusy` ; quand présentes,
  un bloc « ou collez un lien » + `UrlImportField` sous le bouton fichier
  (largeur `min(24rem, 100%)` pour ne pas s'effondrer dans le hero centré).
  Handler `onPaste` sur le hero : un lien supporté collé n'importe où pré-remplit
  le champ et le focus (un paste non supporté est laissé tel quel).
- **i18n** : ids neutralisés `header.import-url-{field,hint,submit,unsupported}`
  → `import.url-*` (le champ n'est plus « header »), + `empty.or`. Le titre du
  popover reste `header.import-url-title`. `i18n:extract` a nettoyé les anciens.

Feedback UX (progress/erreur) inchangé : le `ShellHeader` reste rendu au-dessus
du hero, donc un download lancé depuis l'empty-state narre « Téléchargement… » +
Annuler dans la busy-line et remonte l'échec dans l'`AlertBanner` du header.

## Tests / gate

- `url-import-field.spec` (nouveau) : warning + submit bloqué (hôte non
  supporté), submit du lien trimmé (hôte supporté), verrou field+submit sous
  `busy`.
- `empty-state.spec` : champ absent en navigateur, import d'un lien collé au
  niveau fichier (desktop), seed du champ quand un lien supporté est collé sur le
  hero.
- `import-menu.spec` + `workstation-shell.import.spec` : ids `import.url-*` ; le
  helper `fillImportUrl` retourne désormais le popover et les assertions se
  `within`-scopent (l'empty-state idle expose aussi un champ → requête
  document-wide ambiguë).

Gate **verte — 1931 tests**, coverage 97,1 %, react-doctor clean, check:tokens
clean (aucune classe fantôme), typecheck 0, knip/jscpd OK. Stryker skippé (core
intouché).

## Vérification

Comportement couvert au DOM (validation, submit, paste-seed, gating desktop) +
intégration shell (import URL bout-en-bout via le menu). Le rendu visuel exact
du champ inline dans le hero (desktop-only, donc non atteignable par le
navigateur web sur 5173) reste un coup d'œil dans Tauri — layout flex simple,
faible risque.

## Reste du Lot AK

**AK.4** — divulgation beta amont sur les boutons Détecter + lien waitlist/mailto
dans le formulaire de code quand il manque. Lot AK ensuite clos.
