# Session — Lot AJ (AJ.1 + AJ.2) : offload-only, l'app arrête de mentir

**Date** : 2026-07-19
**Branche** : `feat/aj-offload-only` (partie de `main`)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AJ

## Contexte

Cap produit : UI/UX exceptionnelle, **offload-only** (le serveur Python local est
sorti du chemin nominal en T2.5). Le Lot AJ efface les reliquats du serveur retiré
qui **mentent à l'écran**. L'utilisateur a tranché le **Hard Tauri-only cut** pour
AJ.3 et, au checkpoint, le sort du client navigateur : **supprimer les adaptateurs
HTTP** (projets / import-URL deviennent desktop-only ; le navigateur = terrain de
jeu d'analyse parlant à Modal).

Cette PR livre **AJ.1 + AJ.2** (les deux couplés : on ne retire pas la sonde sans
refondre les gates ni la copy). **AJ.3** (renommage env + endpoint obligatoire +
suppression des adaptateurs HTTP + gate desktop-only des projets/import-URL) est
la PR 2, stackée sur cette branche.

## AJ.1 — retrait de la sonde `/health` et du chip « Serveur hors ligne »

- **Supprimé** `projects/use-server-health.ts` (+ sa spec) : la sonde
  `localhost:8000/health` 30 s et le type `ServerHealth`.
- **Chip retiré** : `SERVER_STATUS` (shell-header), la prop `serverStatus` +
  le rendu pastille de `header.tsx`, et les classes CSS `.serverStatus`/`.statusDot`
  (+ variantes `data-tone`). L'interface `ServerStatus` supprimée.
- **Prop `serverHealth` dé-câblée** de bout en bout : `workstation-shell` (prop
  `healthFetch` de test comprise) → `shell-main` → `shell-header` / `shell-analyser-row`
  → `analyser-row`.
- **Gate simplifiée** : plus de `localServerDown` ni de `blockedReason: 'server'`.
  La seule barrière restante est **hors-ligne** (`useOnline`, M1.4) pour les flux
  offloadés + le gate d'auth. Les accords gardent leur unique `blockedReason: 'no-grid'`
  (la grille de mesures ancre les accords). `errorCopyFor` allégé : les tables
  portent déjà la copy `network` neutre, plus besoin du paramètre `offloaded`.

## AJ.2 — copy neutralisée « service d'analyse »

Réécriture de `app/analyser/detection-copy.ts`. Mots bannis de la copy visible :
« serveur local », « server/README », « console du navigateur », « moteur »,
« Serveur hors ligne ».

- `network` (structure / chords / tempo / séparation) → **`ANALYSIS_OFFLOAD_UNREACHABLE`**
  (`analysis.error.network-offload` = « Service d'analyse injoignable — réessayer. »).
- `engine-unavailable` → « Service d'analyse indisponible pour le moment —
  réessayer plus tard. » (503 poids non chargés).
- `unknown` → « Erreur inattendue — réessayer. » (fin de « console du navigateur »).
- `timeout` / `too-large` → « — réessayer. » / « Piste trop volumineuse pour
  l'analyse. » (fin de « sur le serveur »).
- Cold-start (`analysis.cold-start`) → « Démarrage du **service** d'analyse
  (jusqu'à ~1 min)… » (fin de « moteur »).
- **Supprimés** : `STRUCTURE_NEEDS_SERVER`, `CHORDS_NEEDS_SERVER`,
  `SEPARATION_NEEDS_SERVER`, `SEPARATION_SERVER_BLOCK`, l'ancien `tempo.error.network`,
  les ids `header.server-*`. Catalogue `fr` régénéré (`i18n:extract --clean`,
  295 messages).

**Reste (PR 2 / AJ.3)** : `projects.unreachable` (« vérifier que le serveur local
est lancé ») — couplée au store projets HTTP, neutralisée quand les projets
passent desktop-only.

## Tests

Spécs alignées sur la réalité offload-only (aucune régression de comportement réel) :
suppression des tests devenus caducs (sonde `/health`, chip, `blockedReason='server'`,
double copy local/offload → une seule copy neutre) ; le test hors-ligne M1.4 et le
gate no-grid des accords restent couverts.

**Gate verte — 1935 tests** (149 fichiers), coverage 97,4 %, jscpd 0,08 %, knip
clean, typecheck 0. Stryker skippé (core intouché — refonte purement adaptateur/UI).

## Vérification

Refonte adaptateur + UI + copy ; pas de nouvelle logique cœur. Vérification
navigateur reportée à la fin d'AJ.3 (le cut structurel), quand les quatre couches
offload-only seront en place — la browser-verify se fait sur `5173` (allowlist
d'origine).

## Coordination

⚠️ Cette branche part de `main`, dont `STATUS.md` **retarde** sur la branche
`feat/desktop-native-menus` (non mergée, vérif bundle en attente) qui porte tout
l'historique Cap-v7 / Lots AB–AI + `roadmap-excellence-7.md`. `STATUS.md` n'est
donc **pas** ré-écrit ici pour éviter un conflit. Ordre de merge à trancher avec
l'utilisateur (menus d'abord, puis rebase AJ).
