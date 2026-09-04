# Session — 2026-09-04 — garde anti-test-vacuous et vitesse du gate

Tranche outillage née d'un rapport `/insights` sur ce dépôt : la panne
récurrente n'est pas le test rouge, c'est le test vert qui n'affirme rien.
Deux commits sur `refactor/player-to-atoms`, **PR #388 (draft)**, après le
pas 5 de la tranche « player → atomes ».

## Done

- **`check:tests`, nouvelle étape du gate** (`scripts/check-test-quality.ts`,
  commit `df9eb96`). Quatre règles sur les 187 fichiers de spec :
  - `skipped` — `.skip` / `.only` / `.todo` sur describe/it/test ;
  - `no-assertion` — un fichier de spec sans aucun `expect(` ;
  - `tautology` — `expect(X).toBe(X)` où les deux côtés sont le même texte
    **sans effet de bord** ;
  - `blind-corpus` — une spec qui **parcourt un répertoire** sans borner une
    taille par le bas.
- **Le détecteur se teste sur lui-même avant de rapporter quoi que ce soit.**
  Chaque règle doit rougir sur sa fixture, deux fixtures propres ne doivent
  rien déclencher. Une règle qui cesse de fire fait échouer le gate **même sur
  un arbre impeccable** — c'est la panne que le script existe pour attraper, et
  il ne s'en exempte pas.
- **Vacuité prouvée, pas déduite.** En remplaçant `/\.tsx?$/` par une extension
  bidon dans `composition-invariants.spec.ts`, les **trois** cliquets ADR 0010
  passent au vert sur un corpus vide — `MAX_RETURN_TYPE_PROPS = 0` compris,
  celui que le pas 5 venait d'étendre aux paramètres. Même résultat sur
  `folder-shape.spec.ts` (2 verts sur rien) et `docs/docs.spec.ts` (36 verts
  sur rien).
- **Les trois corpus aveugles reçoivent leur plancher**, chacun prouvé dans les
  deux sens (vert sur l'arbre réel, rouge sur le marcheur cassé) :
  `MIN_CORPUS_FILES = 150` sur 192 sources · `MIN_COUNTED_SOURCES = 150` et
  `MIN_TSX_FILES = 90` · `ACTIVE_ROOT_DOCS_MIN = 3` et `ACTIVE_SESSIONS_MIN = 1`.
- **Skill `/next-step`** : « continuer » devient un passage déterministe — lire
  STATUS et le rapport le plus récent, énoncer un contrat de périmètre,
  exécuter, clore. Il s'arrête et demande dans trois cas : arbre sale, STATUS
  et rapport en désaccord, pas déjà fait.
- **Trois puces dans CLAUDE.md** (Working method) : contrat de périmètre avant
  d'écrire ; un vert ne prouve rien tant qu'il n'a pas été rouge ; un checkout,
  une session.
- **Bug `biome.json`** : `"!**/.claude"` correspond à un segment `.claude`
  **n'importe où** dans le chemin absolu. Depuis un worktree sous
  `.claude/worktrees/`, biome ne voyait **aucun** fichier et sortait en erreur.
  Ancré à la racine (`"!.claude"`) : 0 → 351 fichiers vérifiés. Les huit autres
  étapes du gate marchaient déjà dans le worktree.
- **`maxWorkers` local `/3` → `/2`** (commit `9be7a91`), mesures reproduites
  ici avant application : 4 workers 115 s · 7 workers 92 s puis 94 s, deux runs
  pleinement verts à 2607 tests · sans couverture 81 s → 79 s · 12 workers 96 s
  **et un test rouge**. Le commentaire du fichier disait le contraire de la
  mesure ; il est récrit.
- **Vérifications** : `pnpm gate` vert sur chaque commit, stampé `ba6d3d83`
  (91,48 % lines) · `pnpm test:mutation:diff` sorti proprement, aucun source du
  core ni hook web touché par ces deux commits · Sonar non relu à ce pas.

## Not done / remaining

- **Reste du pas 5, inchangé** : `pnpm test:mutation:diff` sur le périmètre de
  la branche (~44 min) et `pnpm sonar 388`, puis récrire le titre de la PR #388
  pour la tranche entière et la sortir du draft.
- **Fixtures sur disque pour les 4 scripts détecteurs** (`check-css-tokens.sh`,
  `check-i18n.sh`, `check-sonar-triage.sh`, `check-shell.ts`) : prévues au plan,
  non faites. Elles demandent un argument de chemin par script, un couple
  `clean/` + `violation/`, et des exclusions dans knip, jscpd et biome — sans
  quoi les pièges cassent le gate. Le garde ne couvre donc aujourd'hui que les
  fitness functions en specs.
- **jsdom → happy-dom** reste la piste sous 80 s, non mesurée. `isolate: false`
  écarté : les atomes Jotai sont des singletons de module, une fuite d'état
  entre fichiers ne se verrait pas comme une erreur mais comme un test qui ment.
- Après la tranche : affordance UX du throttle redeem, puis découvrabilité du
  click.

## Decisions

- **Pas d'ADR neuf.** Le pas ajoute un détecteur et un plancher ; aucune
  frontière ni invariant ne change.
- **Auto-test interne plutôt que fixtures sur disque, pour `check:tests`.** Des
  fixtures auraient demandé de toucher `vitest.config.ts` (zone d'une session
  parallèle au moment du choix) et d'exclure des pièges de knip, jscpd et
  biome. Les sources en dur dans le script coûtent zéro configuration et
  tournent à chaque gate. Le prix : elles ne testent pas le balayage réel du
  disque — d'où la garde séparée « moins de 100 fichiers de spec trouvés =
  échec ».
- **`blind-corpus` ne vise que les parcours de répertoire.** Première règle
  écrite sur « importe `node:fs` » : deux faux positifs (`dense-rows-wrap`,
  `origins-parity`), qui lisent des fichiers **nommés** avec `readFileSync` —
  lequel lève si le fichier manque, donc ne peut pas se taire.
- **`tautology` exempte les expressions contenant un appel, un `await` ou un
  `new`.** Deux faux positifs au premier run : `expect(memo(a)).toBe(memo(a))`
  affirme que deux appels rendent la même référence, ce qui est tout l'intérêt
  d'un memo. La forme est passée dans les fixtures « clean » pour verrouiller.
- **Le plancher de `folder-shape` porte sur la somme des sources comptées, pas
  sur le nombre de dossiers.** Première version fausse : `walk()` rend ses 83
  entrées même avec un filtre cassé, chacune comptant zéro — tous les comptes
  sous le maximum, cliquet vert, rien de gardé.
- **La couverture reste dans le gate par commit.** C'était la piste évidente
  pour l'accélérer ; la mesure la tue — à 7 workers elle ne coûte que 13 s
  (92 vs 79) et les seuils du core sont un vrai garde-fou. Élargir les workers
  rend plus, pour zéro perte de signal.
- **La moitié des cœurs est l'optimum mesuré, pas un palier vers la pleine
  largeur.** 12 workers ne rendent rien de plus et sortent un rouge.
- **Deux sessions Claude, un checkout : la coordination s'est faite à la main.**
  Travail mené dans un worktree isolé pour ne pas déplacer `docs/STATUS.md`
  sous la session parallèle, puis cherry-pické ici (un conflit dans
  `composition-invariants.spec.ts`, résolu en gardant les deux côtés : cliquet
  du pas 5 **et** plancher de corpus). Worktree supprimé depuis. Le worktree
  sous `.claude/worktrees/` était lui-même le déclencheur du bug biome —
  à savoir avant d'en réouvrir un.

## State to resume from

- **Single next action** : `/quality-gate` sur `refactor/player-to-atoms`
  (`pnpm test:mutation:diff` + `pnpm sonar 388`), puis récrire le titre de la
  PR #388 pour la tranche entière et la sortir du draft.
- Tree state : stampé vert `ba6d3d83` sur `9be7a91` · propre · branche en avance
  de trois commits sur `origin` (`df9eb96`, `9be7a91`, ce rapport) · PR #388
  draft.
- Gotchas :
  - **Le gate a une étape de plus** : `check:tests`. Un `.skip` posé pour
    déboguer fait maintenant échouer le gate — le retirer avant de committer.
  - **Les planchers de corpus se relèvent, jamais ne descendent.** Si une
    suppression de fichiers en fait rougir un, la question est de savoir si le
    marcheur voit encore l'arbre — pas de baisser le plancher.
  - `pnpm test:mutation:diff` prend **~44 minutes** sur le périmètre de la
    branche : un seul run lourd à la fois, et prévenir toute session parallèle.
  - commitlint : sujet ≤ 100 caractères, et **pas de start-case** — un sujet
    ouvert par un identifiant PascalCase (`ShellFooter…`) est rejeté.
  - Sur ce PC : `NODE_USE_ENV_PROXY=1` devant `pnpm gate`, `pnpm test`,
    `pnpm sonar`, `git push`.
  - Reprise : `ls docs/sessions/*.md | sort | tail -1` — jamais `ls -t`.
