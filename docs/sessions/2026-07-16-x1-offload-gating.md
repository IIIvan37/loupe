# Session — 2026-07-16 — x1-offload-gating

## Done
- **X.1 (roadmap v5)** : la détection de structure n'est plus gatée sur la
  santé du serveur **local** quand elle part sur Modal, et la copy cesse de
  prescrire le mauvais remède.
  - `shell-main.tsx` : `blockedReason: 'server'` n'est dérivé de
    `serverHealth` que si `!isAnalysisOffloaded()` — en mode offload le bouton
    reste actif ; pas de sonde de l'endpoint Modal en remplacement (une sonde
    au chargement de page réveillerait le conteneur GPU facturé — décision
    validée au checkpoint d'approche), l'erreur typée parle au clic.
  - `analyser-row.tsx` : `StructureDetectionControl.mayColdStart` renommé
    **`offloaded`** — il porte les deux usages (détail cold-start R.3 + choix
    de copy X.1). Sur `error: 'network'` offloadé, la ligne d'échec dit
    « Service d'analyse injoignable — réessayer. » au lieu de « Lancer le
    serveur local… ».
  - `detection-copy.ts` : nouvel id Lingui `structure.error.network-offload`
    (+ `i18n:extract`, msgstr rempli).
- Tests : 2 specs composant (copy réseau local vs offload) + 2 specs shell
  (gating : bloqué en local avec santé offline, actionnable en offload —
  `vi.stubEnv('VITE_STRUCTURE_URL', …)` + `healthFetch('unreachable')`).
- **Browser-verify** (astuce port 5174 rejeté par l'allowlist d'origines →
  « Serveur hors ligne » garanti sans toucher au serveur de l'utilisateur) :
  header « Serveur hors ligne », **« Détecter la structure » actif sans
  hint**, pendant que Séparer/accords restent gatés et que le tempo affiche
  son erreur réseau locale — le périmètre X.1 (structure seule) est respecté.
  Pas de clic sur Détecter (ça minterait un token : quota + cold start
  facturé).

## Not done / remaining
- Tempo, accords et séparation restent gatés/copiés sur le serveur local —
  correct tant qu'ils y tournent ; ils basculeront avec **M1.1/M1.4**
  ([client-leger-plan.md](../client-leger-plan.md)), qui généralisera « santé
  de l'endpoint effectif par opération ».
- Une panne Modal n'est toujours pas détectable avant le clic (choix assumé :
  pas de sonde du conteneur facturé) ; si un endpoint de santé hors conteneur
  apparaît côté Modal, à re-peser en M1.4.
- ShellMain est à 299/300 lignes de son budget react-doctor — le prochain
  ajout devra extraire quelque chose.

## Decisions
- **Pas de sonde de l'endpoint Modal** (checkpoint validé) : en mode offload,
  la disponibilité se constate au clic via l'erreur typée — une sonde au
  chargement réveillerait le conteneur GPU facturé à chaque visite.
- `offloaded` remplace `mayColdStart` sur `StructureDetectionControl` : un
  seul fait (« le moteur tourne sur l'offload »), deux conséquences UI
  (narration cold-start, copy réseau).
- Le `dist/` périmé (construit par la revue v5 pour mesurer le bundle) faisait
  échouer react-doctor (`artifact-baas-authority-surface`) : supprimé — les
  artefacts de mesure ne doivent pas survivre aux revues.

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1595 tests** (+4), coverage 96,8 % st. /
  91,66 % br.
- mutation (Stryker, local, if core touched) : **skippé — core intouché**
  (packages/web seul).
- biome / sheriff / knip / jscpd : ✅ (jscpd 0,26 %, react-doctor 0 issue —
  après purge du dist/ périmé et ShellMain ramené sous les 300 lignes).

## State to resume from
- **Single next action** : ouvrir la PR de `feat/x1-offload-gating`, puis
  enchaîner **X.2** (face idle « Détecter le tempo » après annulation —
  roadmap v5, le 2ᵉ des cinq 🟠 avant la Phase 1 Modal).
- Gotchas / half-done edits : aucun edit en suspens. Pour browser-vérifier un
  état « Serveur hors ligne » sans tuer le serveur de l'utilisateur : servir
  l'app sur 5174 (`--port 5174 --strictPort`, origin rejetée par l'allowlist).
  `.env.local` pointe VITE_STRUCTURE_URL sur Modal — l'app dev est donc
  toujours en mode offload.
