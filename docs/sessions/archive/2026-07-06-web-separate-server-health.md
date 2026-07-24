# Session — 2026-07-06 — web-separate-server-health

Lot **D.2** — câbler l'action « Séparer » à la santé du serveur. Web-only, pas de
cœur. Branche `feat/web-separate-server-health` (off `main`).

## Done
- **`serverHealth` threadé jusqu'au bouton « Séparer ».** Le `ServerHealth`
  (`checking`/`offline`/`no-separation`/`ready`), déjà calculé dans le shell pour
  le chip du header, descend maintenant à `SeparationPanel` via `ShellMain`
  (nouvelle prop `serverHealth` sur les deux).
- **Le bouton se désactive quand le serveur ne peut pas séparer.** `SeparationPanel`
  mappe `offline`/`no-separation` → un `MessageDescriptor` (table `SERVER_BLOCK`) ;
  `disabled={!canSeparate || serverBlock !== undefined}`. `checking` et `ready` ne
  bloquent pas — `checking` est transitoire au boot, désactiver flasherait le
  bouton off puis on.
- **Un hint actionnable remplace le silence** (le cœur de la valeur) : au lieu du
  clic → attente → erreur, on lit d'emblée « Serveur hors ligne — démarrer le
  serveur local pour séparer les pistes. » ou « Ce serveur ne fournit pas de moteur
  de séparation. ». Le hint « idle » habituel est masqué quand un blocage serveur
  s'affiche (pas de double message).
- **Lingui** : 2 nouveaux ids (`separation.server-offline`,
  `separation.server-no-separation`), `i18n:extract` lancé (msgstr FR remplis).
- **Specs** (3, par clé sous `I18nTestingProvider`) : offline → disabled + hint,
  no-separation → disabled + hint, checking → enabled + pas de hint.

## Not done / remaining
- **Browser-verify** : reste à faire **sur le Mac** (ce PC WSL2 n'a pas de Chrome —
  cf. mémoire). À vérifier : serveur éteint → bouton grisé + hint « hors ligne » ;
  serveur torch-less → hint « pas de moteur » ; serveur prêt → bouton actif.
- D.3 (feedbacks manquants) est la prochaine slice du Lot D.

## Decisions
- **D.1 undo/redo reporté en veille** (décision produit avec l'utilisateur). « Quasi
  gratuit architecturalement » ≠ « fort levier » : outil de *pratique*, état
  éditable trivial à refaire à la main, mixeur = surface de contrôle live (Cmd+Z sur
  un fader contre-intuitif). Réévaluable si une édition destructive coûteuse
  apparaît. Roadmap § D.1 mise à jour + tracking `[~]`.
- **`checking` ne bloque pas le bouton** : seuls les états définitifs
  (`offline`/`no-separation`) désactivent, pour éviter un flash au premier probe.
- **`SeparationPanel` importe le type `ServerHealth`** de `projects/use-server-health.ts`
  (type-only, code web-interne — pas de franchissement de frontière hexagonale ;
  Sheriff/Biome verts).

## Gate status
- typecheck: **green** (Done).
- tests (with coverage): **green** — 576 passed (65 files), seuil web 85/80 tenu.
- mutation (Stryker, local): **skipped** — aucun package muté touché (cœur intact).
- biome / sheriff / knip / jscpd: **green** — sheriff « No issues found », jscpd
  **5 clones** (inchangé), knip/dead Done, check:design Done.
- react-doctor : **green** (v0.7.1, « No issues found! »). En cours de session,
  `check:react` affichait un « 1 accessibility warning » fantôme : `node_modules`
  avait dérivé vers **react-doctor 0.5.8** (le lockfile épingle 0.7.1, un
  faux-positif a11y corrigé depuis). `pnpm install` a réconcilié → 0.7.1, gate
  verte. Lockfile inchangé. (cf. mémoire `react-doctor-score-api-phantom`.)

## State to resume from
- **Single next action** : browser-verify D.2 sur le Mac (3 cas ci-dessus), puis
  merger la PR ; ensuite attaquer **D.3** (feedbacks manquants).
- Gotchas / half-done edits : aucun. `messages.po` régénéré par `i18n:extract`
  (`--overwrite --clean`) — ne pas rééditer les msgstr à la main. Indentation JSX de
  `<ShellMain>` dans `workstation-shell.tsx` déjà normalisée par biome.
