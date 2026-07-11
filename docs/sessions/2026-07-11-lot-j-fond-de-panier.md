# Session — 2026-07-11 — lot-j-fond-de-panier

## Done

Le **Lot J complet** (fond de panier, [roadmap-excellence-2](../roadmap-excellence-2.md)),
en 5 PRs indépendantes branchées sur `main` (la sync lecture #80 venait d'être
mergée) :

- **J.1 — tokens sémantiques** (PR #81) : `--danger`/`--ok` remplacent les
  détournements de `--stem-vocals`/`--stem-guitar` sur toutes les surfaces
  d'erreur/destructives et les pastilles santé (mêmes teintes, découplées) ;
  `--scrim` unifie les deux backdrops (0.55 vs 0.6) ; `--disabled-opacity`
  remplace six `opacity: 0.5` épars. CSS pur.
- **J.2 — états `:active`** (PR #82) : enfoncement de 1px
  (`translateY`, `:active:not(:disabled)`) sur les trois skins partagés
  (propagation par `composes`) + skins locaux (transport `.control`, header
  `.secondaryAction`/`.confirmAction`, zoom `.tick`). Instantané, sans
  transition — rien à neutraliser pour `prefers-reduced-motion`.
- **J.4 — dédup moteurs Web Audio** (PR #83) : le clone de 32 lignes signalé
  par jscpd remonte dans **`createStretchTransport(durationOf)`**
  (web-audio-shared) — contexte paresseux, bus SoundTouch, horloge de position,
  boucle rAF, re-baseline du ratio ; chaque moteur ne garde que sa gestion de
  sources. **Vérifié navigateur** (moteur mono : lecture, pause, seek, fin
  naturelle, relecture, tempo 50 % → horloge à mi-vitesse réelle) ; le moteur
  stems roule sur le même châssis, logique propre reprise à l'identique.
- **J.3 — quota disque du store audio** 🟠 (PR #84) : `store_audio` refuse
  (507) un blob nouveau au-delà de `LOUPE_MAX_AUDIO_STORE_MB` (défaut 10 Go) ;
  re-save idempotent toujours accepté ; `/download` traduit le refus en
  événement NDJSON `error` (le 200 streaming est déjà parti). TDD (4 tests
  rouges d'abord).
- **J.5 — annulation des opérations longues** (PR #85, cette branche) :
  `AbortSignal` optionnel sur les ports `StemSeparator`/`TrackSource`, relayé
  par `separateTrack`/`importFromUrl` (TDD) ; adaptateurs HTTP : signal sur
  chaque fetch. `cancel()` = abort + bump du runId + idle — le rejet avorté est
  un résultat périmé, jamais une erreur ; `reset()` aborte aussi (libère le
  serveur). UI : « Annuler » fantôme sous la progression de séparation et à
  côté du chip « Téléchargement… » du header.

## Not done / remaining

- Export zip non annulable (travail local CPU, pas un adaptateur HTTP) — reste
  en veille avec le off-thread encode.
- Annulation non vérifiée navigateur (exige le serveur Demucs en marche) —
  couverte aux niveaux hook/panneau, câblage abort→fetch mince.
- Les PRs #81–#85 sont **ouvertes, non mergées** ; branches indépendantes de
  `main`, pas de conflit attendu (fichiers disjoints, sauf `common.cancel`
  réutilisé sans modification de catalogue autre que les références).

## Decisions

- **Annulation = supersede + abort**, pas un état domaine : le réducteur de
  séparation n'a pas changé ; l'UI bump le runId et le rejet du run avorté est
  avalé comme résultat périmé. Les ports prennent un `AbortSignal?` optionnel —
  contrat hexagonal explicite plutôt qu'un signal injecté à la construction.
- **Tokens statut ≠ palette stems** : les erreurs ne dépendent plus des
  couleurs de stems (recolorer un stem ne repeint plus les erreurs).
- Le quota disque est la **seule** borne du store (le GC ne réclame que les
  orphelins) ; 507 actionnable (supprimer des projets ou relever la variable).

## Gate status

- typecheck : ✅ (à chaque PR)
- tests (avec couverture) : ✅ **880 tests** (+5 depuis #80 : 2 core signal,
  2 hooks cancel, 1 panneau) ; couverture 96,2 / 90,0
- mutation (Stryker, local) : ✅ **95,14** global (seuil 80) — inchangé
- biome / sheriff / knip / jscpd : ✅ — le clone TypeScript web-audio a
  **disparu** du rapport jscpd (7 → 6 sur ce périmètre)
- serveur (J.3) : ✅ 112 pytest (cov 97 %), ruff, pyright

## State to resume from

- **Single next action** : merger les PRs #81–#85 (indépendantes), puis
  attaquer le **Lot C chord-charts** (endpoint `/chords` BTC + port
  `ChordDetector`) en levant d'abord les 2 angles morts : spike Demucs
  (gain de la pré-séparation à mesurer sur nos pistes) et dispo effective des
  poids (BTC/ChordFormer) — cf. [chord-charts-plan](../chord-charts-plan.md).
- Gotchas : la roadmap-excellence-2 est **entièrement cochée** une fois le
  Lot J mergé (penser à cocher J.1–J.5 en fin de fichier) ; `verify` navigateur
  de J.4 fait sur le moteur mono uniquement (stems = même châssis).
