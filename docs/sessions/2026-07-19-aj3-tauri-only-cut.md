# Session — Lot AJ (AJ.3) : le Hard Tauri-only cut

**Date** : 2026-07-19
**Branche** : `feat/aj3-tauri-only-cut` (stackée sur `feat/aj-offload-only` / PR #225)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AJ

## Décision (checkpoint utilisateur)

Le **Hard Tauri-only cut** : le navigateur devient un **terrain de jeu
d'analyse** (import fichier + Modal) ; **projets et import-URL deviennent
desktop-only** et leurs entrées se **cachent entièrement** dans le navigateur
(pas d'affordance désactivée). Les adaptateurs HTTP sont **supprimés**.

## AJ.3a — endpoint obligatoire, `VITE_ANALYSIS_URL`

- Renommage global `VITE_STRUCTURE_URL → VITE_ANALYSIS_URL` (source + specs +
  `vite-env.d.ts` + `.env.local`) ; `VITE_SEPARATOR_URL` supprimé (script
  `dev:web` nettoyé).
- `analysis-endpoint.ts` : la const `ANALYSIS_URL ?? SERVER_URL` devient
  **`analysisUrl()`** — fonction qui **jette** si l'endpoint n'est pas
  configuré (fin du fallback silencieux vers `localhost:8000`). Les quatre
  factories (`create-{separator,tempo,chord,structure}-detector`) et
  `warm-up-analysis` l'appellent paresseusement (jamais en eval de module → les
  fakes injectés en test ne le déclenchent pas).
- `server-url.ts` supprimé. `isAnalysisOffloaded()` inchangé (seam de test :
  endpoint absent ⇒ gate no-op en dev/tests ; un build livré l'a toujours).

## AJ.3b — suppression des adaptateurs HTTP

- Supprimés : `projects/http-project-store.ts` (store + audio) et
  `audio/http-track-source.ts` (+ leurs specs).
- Branche navigateur de `createProjectStores()` → **null-object en mémoire**
  (list vide, save no-op, `audio.put` jette « desktop-only ») ; jamais
  atteinte puisque l'UI projets est cachée, garde les hooks constructibles.
- Branche navigateur de `createTrackSource()` → source qui **rejette**
  « URL import is desktop-only ».

## AJ.3c — entrées desktop-only cachées

Capacité `desktop` (défaut `isTauriShell()`, injectable en test) tissée de
`WorkstationShell` → `ShellHeader`, qui passe `undefined` pour **Enregistrer /
Projets / Importer depuis une URL** hors desktop. `ImportMenu` et `Header`
rendent l'entrée URL / les contrôles de sauvegarde seulement quand le callback
existe. Le kit de test rend en **mode desktop par défaut** (client nominal),
une spec dédiée (`workstation-shell.desktop-gating.spec.tsx`) vérifie le
masquage navigateur.

## AJ.3d — copy + commentaires

`projects.unreachable` neutralisée (« Impossible de lister les projets —
réessayer. ») ; commentaires « default: the local server » / « instead of the
local server » corrigés. Catalogue `fr` régénéré (295 msgs).

## Tests / kit

Le kit injecte désormais des **ports d'analyse inertes par défaut**
(tempo/chords/structure/separator/trackSource never-resolving) — sinon les vraies
factories jettent faute d'endpoint. Spec `create-project-stores` réécrite (store
navigateur inerte), asserts de copy `projects.unreachable` / séparation `network`
mis à jour, spec de gating ajoutée.

## Gate

**Verte — 1918 tests** (149 fichiers), coverage OK, knip clean, jscpd OK,
typecheck 0, arch/react clean. **Build de prod OK** (`VITE_ANALYSIS_URL` posé).
Stryker skippé (core intouché — refonte adaptateur/UI).

## Vérification

Comportement couvert par les tests d'intégration (masquage desktop-only,
gate hors-ligne, store navigateur inerte) + build de prod vert. Pas de drive
navigateur live (cas couvert par les tests ; cf. mémoire « browser-verify only
hard cases »). Le défaut `desktop = isTauriShell()` est une ligne, vérifié par
la logique + le build.

## Reste du Lot AJ

Lot AJ **complet** (AJ.1+AJ.2 en #225, AJ.3 ici). Suite roadmap v7 : **Lot AK**
(premier contact — funnel magic-link, empty-state, import-URL hero,
divulgation beta).
