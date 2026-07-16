# Session — 2026-07-16 — M1.4 : santé par endpoint, UX hors-ligne, narration

## Done
- **Erreurs séparation typées (le contrat N.1 étendu)** — core en TDD strict :
  `SeparationErrorCode`/`SeparationFailure` dans le domaine, `SeparationError`
  + `separateTrack` → `{ok:false, code, detail}` (le detail ne va qu'à la
  console), reducer `fail` typé. Adapter : `typedFetch` dans `http-separator`
  (TypeError → `network`, statuts délibérés via `transportFailureOfStatus`
  exporté de `post-wav-json` — l'interprétation vit à un seul endroit), sur le
  POST `/separate` ET les GET de stems. Copy : `SEPARATION_ERROR_COPY` +
  override offload `analysis.error.network-offload` (X.1) — « lancer le
  serveur local » ne s'affiche plus jamais quand le moteur est sur Modal.
- **UX hors-ligne** : hook `useOnline` (`useSyncExternalStore` sur
  online/offline), prop `online` sur `AnalyserRow` — le hors-ligne ne bloque
  QUE les flux offloadés (le serveur local vit sur localhost et marche sans
  réseau) : séparation/structure/accords désactivés avec la copy partagée
  `analysis.blocked-offline`, la face idle du tempo (X.2) désactivée aussi.
  Tout le local (lecture, boucles, grille, projets, stems séparés) intouché.
- **Narration cold start séparation** : le segment « Démarrage du moteur
  d'analyse (jusqu'à ~1 min)… » (copy R.3) monte sur la barre de progression
  réelle après 4 s quand le flux est offloadé.
- Au passage : `hf_xet==1.5.2` dans l'image Modal (layer séparé après
  requirements — le cache torch survit) pour des bakes HF plus rapides ;
  répond au warning « Xet Storage… falling back to regular HTTP download »
  vu dans les logs Modal.
- **Vérif réelle** (app 5173, serveur local éteint, compte beta, MP3 réels
  fournis par l'utilisateur) : « The Logical Song » (4:09) séparée sur Modal
  en **72 s** clic→6 stems dans le mixer (tous présents : Voix, Batterie,
  Basse, Guitare, Claviers, Autres) — le transport plein débit ne mord pas
  sur cette connexion, l'option compression du plan reste au tiroir ;
  narration cold-start VISIBLE sur la face busy ; mode Offline DevTools →
  structure/accords désactivés avec la copy hors-ligne, retour en ligne →
  déblocage immédiat sans rechargement.

## Not done / remaining
- Le plafond de dépense / alerte de facturation Modal (dashboard) — toujours
  à poser avant d'exposer la séparation aux beta-testeurs.
- « Somebody To Love » (le second MP3) non utilisé — disponible pour de
  futures vérifs réelles.

## Decisions
- Le hors-ligne ne gate QUE l'offload : `navigator.onLine` est optimiste
  (portail captif), la ceinture est l'erreur `network` typée au clic.
- La sonde de santé n'est PAS étendue à Modal (reconfirme M1.1) : pas de
  cold start facturé au chargement ; la santé par endpoint effectif est
  portée par le gating (offload ⇒ hors de la santé locale, hors-ligne,
  erreurs typées au clic).

## Gate status
- typecheck: ✅ (`pnpm gate` exit 0)
- tests (with coverage): ✅ **1650 tests** (+10), 97,21 % statements
- mutation (Stryker, local, core touché): ✅ **94,01 %** (seuil 90)
- biome / sheriff / knip / jscpd / react-doctor: ✅ (gate exit 0)

## State to resume from
- **Single next action** : ouvrir la PR de M1.4 puis — **Phase 1 terminée** —
  passer à **T2.1** (spike coquille Tauri + inventaire licences, GO/NO-GO),
  ou aux 🟢 v5 au fil de l'eau.
- Gotchas :
  - `AnalyserRow` prend maintenant `online: boolean` — tout nouveau flux
    offloadé doit passer par `offlineBlocks(offloaded)` ;
  - les ids Lingui nouveaux : `analysis.blocked-offline`,
    `separation.detect-failed`, `separation.detect-needs-server`,
    `separation.error.*` (l'ancien `separation.failed` avec placeholder a
    disparu — extract déjà passé) ;
  - WorkstationShell est à ~300 lignes pile de nouveau — la prochaine slice
    shell devra probablement extraire quelque chose.
