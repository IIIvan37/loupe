# Session — 2026-08-01 — Lot AS : le chargement se voit, la progression dit vrai

## Done
- **AS.1 — contrat de progression honnête.** `SeparationState.progress` devient
  `number | undefined` : `undefined` à l'idle et au `start` (mint + cold start
  + upload restent sous barre **indéterminée**), posé au premier tick réel du
  moteur. Même correctif sur l'import URL : `UrlImportProgress` porte la phase
  dès le submit mais la fraction seulement au premier tick (bootstrap yt-dlp
  jusqu'à ~5 min). `OperationStatus` savait déjà rendre l'indéterminé — seul
  le contrat mentait.
- **AS.2 — la fin de séparation ne fige plus à 100 %.** Nouvelle phase de
  domaine `retrieving` (`SeparationPhase`) : l'adaptateur HTTP narre les fetch
  de stems (fraction n/total, un tick par stem décodé) et cède une frame
  (`nextPaint`, idiome R.4) avant chaque `decodeWav`. L'analyser-row garde la
  face busy sous « Récupération des pistes… ».
- **AS.4 — l'ouverture de projet ne gèle plus.** `restoreSession` décode les
  WAV stockés séquentiellement, narre « piste n/total » (`onRestoreStep`) et
  peint entre chaque stem ; le chip du header dit « Ouverture de « X »… —
  piste n/total » (id `header.opening-stem`). Test shell déterministe à rAF
  contrôlé (frames figées puis pompées).
- **AS.5 — la zone repliée n'avale plus l'opération.** `ShellSection.fold`
  gagne `operation` : segment « Séparation des pistes… 43 % » dérivé des mêmes
  états (`separationOperationSummary`), rendu en bouton qui rouvre la zone.
  Labels de phase partagés via `SEPARATION_PROGRESS_LABELS` (detection-copy).
- **AS.3 — overlay de prise en charge** (checkpoint d'approche validé : 3 flux,
  scrim léger). Le pattern `.dropOverlay` est promu en overlay busy plein
  viewport (`ShellDropLayer`, `data-testid="take-charge-overlay"`), piloté par
  les états existants uniquement : ouverture de projet (avec piste n/total) >
  import URL (phase + %) > décodage fichier. `pointer-events: none` (l'Annuler
  du header reste cliquable), `aria-hidden` (l'annonce reste aux canaux
  existants — un % qui tique dans une live region spammerait l'AT).
  Dérivation partagée header/overlay dans `regions/shell-busy.ts` (msg + i18n._).
- Hors lot : retrait de l'email personnel du guide utilisateur (commit doc-only
  `2ec3b92` sur `main`) — le canal public est GitHub Issues.

## Not done / remaining
- L'annonce AT des flux de chargement reste portée par les canaux existants ;
  si un retour beta signale un manque, envisager un LiveStatus dédié au
  take-charge (sans le % dans le texte).
- Les 2 mutants survivants de `separation.ts` (93,55 %) sont au-dessus du seuil ;
  le run CI post-merge fait foi.

## Decisions
- **`retrieving` entre dans le vocabulaire du domaine** (`SeparationPhase`) :
  la récupération des stems est une attente réelle (~250 MB) que le port narre
  comme les autres phases — l'adaptateur HTTP est le seul émetteur, le serveur
  n'y touche pas.
- **`progress: undefined` = « pas encore mesuré »** partout (séparation, import
  URL) : un 0 % posé d'office est un mensonge de contrat, l'indéterminé est
  l'état honnête. Candidat leçon extractible (loupe-is-a-lab) : « no fake
  zero » comme règle de contrat de progression.
- **Une seule dérivation des labels busy** (`shell-busy.ts`) partagée par la
  ligne du header et l'overlay AS.3 — deux faces, zéro dérive.

## Gate status
- typecheck : ✅ (stampé au commit `d2c7b68`)
- tests (with coverage) : ✅ — suites core + web vertes, seuils tenus
- mutation (Stryker, local, diff) : ✅ 93,34 % global (seuil 90) ;
  `separation.ts` 93,55 % (2 survivants, CI post-merge autoritaire)
- biome / sheriff / knip / jscpd : ✅ (gate complet en pre-commit sur chaque
  commit du lot)
- SonarCloud : analyse CI à lire après l'ouverture de la PR (`pnpm sonar <PR#>`)

## State to resume from
- **Single next action** : merger la PR du lot AS après CI verte + lecture
  `pnpm sonar <PR#>`, puis attaquer le **Lot AT** (les filets reviennent :
  `rust.yml` path-filtré, release exige le vert — borné par l'expiration du
  PAT au 2026-08-31).
- Gotchas : les tests shell qui figent les frames (`vi.stubGlobal` sur rAF)
  doivent geler APRÈS l'ouverture des dialogues Base UI (ils consomment des
  frames pour sortir de `data-starting-style`) ; `vi.unstubAllGlobals()` en
  `finally`.
