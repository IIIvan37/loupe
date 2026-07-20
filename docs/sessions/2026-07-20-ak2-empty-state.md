# Session — Lot AK.2 : l'empty-state qui vend

**Date** : 2026-07-20
**Branche** : `feat/ak2-empty-state` (part de `main`)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AK

## Décision (checkpoint utilisateur)

Remplacer la **table de raccourcis prématurée** de l'empty-state par les **trois
accroches de valeur** de la roadmap (choix confirmé : 3, pas 1 ni 4). Les
raccourcis restent dans le dialogue « ? » (`ShortcutsDialog`, déjà autonome).

## Changement

`EmptyState` : le `<dl>` de raccourcis (+ la prop `shortcuts`) est retiré ;
sous le hero, trois cartes « accroche » — icône + titre + bénéfice d'une ligne :
- **Séparer les pistes** — « Isoler voix, basse, batterie… »
- **Détecter accords & tempo** — « Grille d'accords et BPM automatiques »
- **Boucler & ralentir** — « Répéter un passage, ralentir sans changer la hauteur »

Icônes : petits **SVG inline** (`currentColor`, teintés ambre — l'`Icon`
partagé n'a que des glyphes média). Layout `flex-wrap` intrinsèque (Every
Layout, pas de media query) : rangée de 3 sur large, colonne quand ça serre.
Contenu **hissé en `HOSTS` module-scope** (react-doctor
`prefer-module-scope-static-value` — les `<Trans>` résolvent leur copie au
render sous le provider). Côté shell : `SHORTCUT_HINTS` + les imports
`describeKeyBindings`/`defaultKeyBindings` supprimés (le dialogue « ? » garde
les siens).

## Tests / gate

Spec `empty-state` : le test « liste les raccourcis » devient « vend les trois
accroches ». Un test tempo (`queryByText(/BPM/)` = pas de tempo avant analyse)
attrapait la copie « … et BPM automatiques » → resserré en `/\d+\s*BPM/` (un
read-out « 120 BPM », pas l'accroche). Gate **verte — 1925 tests**, react-doctor
clean, check:tokens clean (pas de classe fantôme), typecheck 0. Stryker skippé
(core intouché).

## Vérification

Contenu couvert au DOM (les trois accroches rendues, l'action d'import). Le
visuel exact (cartes, icônes, wrap) reste à un coup d'œil navigateur — layout
flex simple, faible risque.

## Reste du Lot AK

**AK.3** (import URL au niveau du fichier dans le hero — à concilier avec le
gating desktop-only d'AJ.3 : proposer File/URL seulement en desktop),
**AK.4** (divulgation beta amont + waitlist quand le code manque).
