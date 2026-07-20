# Session — Lot AK.4 : divulgation beta amont + escape sans code

**Date** : 2026-07-20
**Branche** : `feat/ak4-beta-disclosure` (part de `main`)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AK

## Décision (checkpoint utilisateur)

- **Divulgation (A)** — une **ligne unique en tête de zone Analyse** plutôt qu'un
  hint répété sous chacun des quatre boutons Détecter (4× = bruit). Les boutons
  restent **cliquables** : un clic ouvre déjà le menu compte via le gate, et
  AK.1 reprend l'analyse après connexion — la ligne ne fait qu'ôter la surprise.
- **Escape sans code (B)** — un lien **mailto** (« pas de code ? Demander un
  accès », sujet pré-rempli) plutôt qu'une URL de waitlist (page inexistante) ;
  adresse `ivan.duchauffour@gmail.com`.

## Changement

- **`AnalysisGateNotice`** ([packages/web/src/app/account/analysis-gate-notice.tsx](../../packages/web/src/app/account/analysis-gate-notice.tsx))
  — composant smart lisant le **même `AuthPort`** que le gate au clic (les deux
  ne peuvent donc pas se contredire). Rendu :
  - déconnecté → « Connectez-vous pour débloquer les analyses. »
  - connecté non-membre (status chargé, `!member`) → « Entrez un code beta… »
  - membre / quota / status en cours de chargement / `auth` null (Supabase non
    configuré) → **rien**. Le quota épuisé reste au clic (état mensuel
    transitoire, pas un « vous ne pouvez pas commencer »). Padlock SVG inline
    ambre.
  Placé au-dessus de `ShellAnalyserRow` dans la section Analyse, il **auto-résout**
  `appAuth()` (aucun prop-drilling ; `auth` injectable en test).
- **`AccountMenu`** (formulaire beta, branche `!status.member`) : lien
  `.requestAccess` en `mailto:` sous « Valider le code », constante
  `BETA_ACCESS_MAILTO`.
- **i18n** : `analysis.locked-sign-in`, `analysis.locked-beta`,
  `account.no-code-request`.

## Tests / gate

- `analysis-gate-notice.spec` (nouveau) : disclosure sign-in (déconnecté),
  disclosure code (non-membre), silence (membre), rien (`auth` null).
- `account-menu.spec` : le lien mailto est présent pour un non-membre (`href`
  commence par `mailto:`).

Gate **verte — 1936 tests** (+5), coverage 97,1 %, react-doctor clean,
check:tokens clean, typecheck 0, knip/jscpd OK. Stryker skippé (core intouché).

## Vérification

Comportement couvert au DOM (les trois états de disclosure + le lien mailto). La
ligne n'apparaît qu'avec un `AuthPort` réel (Supabase configuré) donc pas dans
les tests shell (auth null) ni dans le navigateur web local sans backend — coup
d'œil final en desktop/beta, layout d'une ligne, faible risque.

## Lot AK — clos

AK.1 (funnel magic-link) · AK.2 (empty-state qui vend) · AK.3 (import URL au
niveau du fichier) · AK.4 (divulgation beta + escape). **Prochain : Lot AL** (la
boucle de pratique au niveau d'un vrai outil).
