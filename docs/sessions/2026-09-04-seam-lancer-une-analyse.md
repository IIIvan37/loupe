# Session — 2026-09-04 — candidat 4 : le seam « lancer une analyse »

Premier candidat de la liste de septembre après le merge de la PR #388. Branche
`refactor/analysis-run-seam`, quatre commits, PR pas encore ouverte.

## Done

- **Deux bugs de garde de commit corrigés, chacun prouvé rouge avant** :
  - `use-tempo.ts` et `use-separation.ts` ne pesaient que le jeton de run. Un
    import qui remplace la piste ne supersède pas le run en cours : le résultat
    de l'ancienne piste atterrissait sur la nouvelle (`a5f5458`).
  - `use-structure-detection.ts` **lisait** son jeton avant le mint au lieu de
    l'incrémenter, puis en prenait un neuf après. Deux gestes qui se chevauchent
    capturaient donc le même jeton : le premier gate résolu partait, le second
    geste abandonnait — le geste le plus récent était jeté, l'inverse de
    l'invariant « le dernier run gagne ». L'analyse facturée partait en prime
    sur une piste déjà remplacée (`4a06765`).
- **`isRunCurrent` (core, `application/analysis-run.ts`)** porte la règle : un
  run se commite si son jeton, la piste qu'il analysait et son drapeau
  d'abandon sont encore d'actualité. TDD strict, quatre tours — un test par
  terme. Appelée aux **huit** points de contrôle des quatre hooks.
- **La règle est partagée, pas le stockage** : tempo et séparation comptent par
  session dans un atome (un run superseded doit libérer le créneau serveur, et
  le superseder peut être une autre instance), chords et structure par instance
  dans une ref. La portée d'un jeton est l'affaire de la feature.
- **Revue `/simplify` en quatre angles**, dont trois constats appliqués
  (`0aae1b6`) : signature aplatie en trois arguments positionnels (le prédicat
  est symétrique, les étiquettes rallongeaient les gardes de 5 à 12 lignes) ;
  les deux contrôles intermédiaires de chords convertis ; `useLatest` remplacé
  par une lecture directe du store aux deux instants.
- Arête DAG déclarée : `web:feature:separation` → `web:feature:track`.
- **Vérifications** : `pnpm gate` vert, stampé `da24e1b1` (91,48 % lines).

## Not done / remaining

- **`pnpm test:mutation:diff` lancé, résultat non consigné ici** — le core a
  bougé, donc il est obligatoire avant la PR. Compter ~45 min.
- **PR pas encore ouverte** ; `pnpm sonar <PR#>` à lire une fois la CI passée.
- **Les gardes de fenêtre de gate de tempo et séparation ne pèsent toujours que
  le jeton.** Une piste remplacée pendant le mint laisse le run partir : un
  envoi de ~42 Mo et une analyse facturée pour une piste que personne ne
  regarde. Demande son test rouge — tranche à part.
- **Ni tempo ni séparation n'abortent sur changement de piste**, là où chords et
  structure ont un effet clé sur `loadedAudio` qui libère le créneau serveur.
  Même famille que le point précédent.
- **`loadedStore()` est écrit trois fois** (specs tempo, chords, structure), à
  huit lignes près identiques. Le dépôt sait exempter un module de test partagé
  (`packages/web/doctor.config.json` en porte déjà trois) — la règle de trois
  est atteinte.
- **Le double `supersede()` de la séparation** (`separate()` puis
  `runSeparation()`) survit : un geste brûle deux jetons. Latent, rien ne lit la
  valeur absolue.
- Registre `application/README.md` : cinq noms d'adapters morts sur douze lignes
  de ports, deux marqueurs « next slice » périmés. Réparation de dix minutes.

## Decisions

- **Factoriser la règle, pas le protocole.** Les quatre hooks divergent sur cinq
  axes à la fois (propriété du jeton, place du gate, nombre de points de
  contrôle, abandon ou non sur changement de piste, sémantique du cancel). Un
  `useAnalysisRun` écrit aujourd'hui prendrait une stratégie de stockage, un
  nombre variable de callbacks, un gate optionnel et une échappatoire — la
  mauvaise abstraction. Ce qui la rendrait payante est nommé : un cinquième hook
  du même protocole, ou la convergence du stockage des jetons, ou un quatrième
  terme dans la règle (epoch de session, id de projet).
- **`isRunCurrent` reste dans le core**, contre l'avis de deux angles de revue
  sur quatre. Leur argument est bon — pas de vocabulaire du domaine, mécanique
  de jeton React dans le contrat public. Le contre-argument est mesurable :
  `stryker.config.json` ne mute que `packages/core/src/**` et `mutation-diff`
  n'ajoute que les fichiers `use-*`. La déplacer vers `web/src/lib` la sortirait
  de la couverture mutation, sur une règle qui garde un vrai bug. À rouvrir si
  l'outillage sait muter `web/src/lib` sans faire exploser la durée.
- **Ce que le garde mesure**, après retour de conception : « la piste chargée
  a-t-elle changé pendant ce run », lue au départ et relue au commit. Pas
  « l'argument passé à `detect` est-il l'atome » — vingt tests existants ont
  refusé cette lecture, et `separation.restore()` rejoue un mix stocké qui n'est
  pas l'instance de l'atome.

## State to resume from

- **Single next action** : lire le score de `test:mutation:diff`, puis ouvrir la
  PR (titre couvrant les deux corrections + le seam) et lire `pnpm sonar <PR#>`.
- Tree state : stampé vert `da24e1b1` sur `0aae1b6` · propre · branche jamais
  poussée, PR inexistante.
- Gotchas :
  - **Une autre session Claude partage ce checkout** (`loupe-6c`). Prévenir
    avant tout run lourd ou toute bascule de branche.
  - Ne pas éditer les sources pendant Stryker : son résultat décrirait un arbre
    qui n'existe plus.
  - `test:mutation:diff` ~45 min ; un seul run lourd à la fois.
  - commitlint : sujet ≤ 100 caractères.
  - Sur ce PC : `NODE_USE_ENV_PROXY=1` devant `pnpm gate`, `pnpm test`,
    `pnpm sonar`, `git push`.
  - Reprise : `ls docs/sessions/*.md | sort | tail -1` — jamais `ls -t`.
