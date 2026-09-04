# Session — 2026-09-04 — garde anti-test-vacuous et vitesse du gate

Tranche outillage née d'un rapport `/insights` sur ce dépôt : la panne
récurrente n'est pas le test rouge, c'est le test vert qui n'affirme rien.
Trois commits sur `refactor/player-to-atoms`, **PR #388**, après le pas 5 de la
tranche « player → atomes ».

Le troisième commit est le plus instructif : une revue `/simplify` a retourné
le garde contre lui-même, **et il a cédé**. Sa règle `blind-corpus` était
vacuous de la façon exacte qu'elle traque.

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
- **Le garde retourné contre lui-même — commit `a87caf0`.** Revue `/simplify`
  en quatre angles (reuse, simplification, efficacité, altitude) sur les deux
  premiers commits. Deux vrais défauts, tous deux dans ce que la tranche
  annonçait :
  - **`check:tests` ne tournait pas au commit.** Ajouté au script `gate` de
    `package.json`, mais pas à `.husky/pre-commit`, qui porte sa PROPRE copie de
    la regex. Le hook finit par `gate-stamp.sh write` : il tamponnait donc
    l'arbre « gate vert » sans que l'étape y ait tourné, et un `pnpm gate`
    ultérieur sautait sur ce tampon. **Le tampon mentait.** Le commentaire du
    hook prétendait que la forme regex empêche la dérive — elle l'empêche DANS
    une liste, pas entre les DEUX listes ; `check:tokens` avait déjà disparu une
    fois. `docs/gate-parity.spec.ts` extrait les deux regex et refuse la dérive
    au gate, sur le modèle d'`origins-parity` ; prouvé rouge en retirant
    `check:tests` du hook.
  - **La règle `blind-corpus` était vacuous de la façon qu'elle traque.** Son
    drapeau « un plancher existe » était PAR FICHIER : n'importe quel
    `toBeGreaterThan` faisait taire la règle pour tous les marcheurs du fichier.
    `adr-pointers.spec.ts` passait au vert grâce au plancher sur les ids d'ADR,
    alors que son corpus de sources — celui sur lequel porte l'assertion — n'en
    avait aucun. Règle refaite PAR MARCHEUR, avec résolution des fonctions
    locales qui atteignent un marcheur et suivi transitif des liaisons
    (`callers = specs.filter(…)`).
  - **Quatre corpus aveugles trouvés, deux réels après vérification un par un** :
    `adr-pointers.spec.ts` (sources non bornées) et `docs.spec.ts` (`repoPaths`,
    qui échouait fermé mais par accident de ce qu'il assertait). Les deux
    reçoivent leur plancher. Les deux autres — `livingDocs`, `contractExports` —
    alimentent une table `it.each`, exemptées.
  - **Gaspillages mesurés** : `setParentNodes: true` payé pour rien (82 → 61 ms
    de parsing), la marche partait de la racine et traversait `target/` (1087
    dossiers sur 1253 pour zéro spec), `folder-shape.spec.ts` relançait ses deux
    marcheurs à chaque test.
- **Vérifications** : `pnpm gate` vert sur chaque commit, stampé `b7b1d141`
  (91,48 % lines, 2610 tests) · `pnpm test:mutation:diff` sorti proprement,
  aucun source du core ni hook web touché par les trois commits · mutation de
  la branche entière **90,44 %** (seuil 90) et Sonar **quality gate OK, 0 issue**,
  passés par la session parallèle.

## Not done / remaining

- **Correction des dépendances — tranche décidée, à part.** `Dependency audit`
  est rouge sur #388 **et sur `main` depuis le run du 2026-09-02** : 8 avis, 6
  hauts, tous transitifs sous `@commitlint/cli` (`fast-uri` <3.1.6, `js-yaml`
  >=4.0.0 <4.3.1, `nanoid` <3.3.18). Arbitrage rendu : trois lignes de
  `pnpm.overrides` + `pnpm install` sur une branche `chore/` **après** le merge
  de #388, pour que la réparation de `main` ne voyage pas dans une PR de
  refactor. Le rouge sur #388 est donc assumé, pas ignoré.
- **Le marcheur partagé qui lève** — la vraie profondeur, relevée par la revue
  d'altitude et non faite : douze marcheurs recopiés dans le dépôt
  (`readdirSync(dir, { withFileTypes: true }).flatMap(…)`) remplacés par un
  `walkFiles(root, keep, { min })` qui **lève** sous le seuil. Le plancher
  devient structurel au lieu d'être asserté, et `blind-corpus` se simplifie en
  « cette spec utilise-t-elle un `readdirSync` brut plutôt que le marcheur
  contrôlé ». **Piège de séquencement à respecter** : extraire ce marcheur
  ferait taire `blind-corpus`, qui ne verrait plus aucun `readdirSync` dans les
  specs — le détecteur tomberait dans sa propre panne d'en-tête. Re-clé la règle
  sur les **imports** d'abord, extraire ensuite.
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
- **`it.each(table)` est un plancher structurel — testé, pas déduit.** Vitest
  échoue avec « No test found in suite » sur une table vide ; vérifié sur une
  spec jetable avant d'écrire l'exemption. C'est ce qui distingue `livingDocs`
  et `contractExports` (couverts par construction) des deux corpus réellement
  aveugles. Sans cette vérification, la règle exigeait deux planchers
  redondants — ou, si je l'avais supposée sans tester, elle en aurait laissé
  passer deux.
- **Une garde se prouve sur elle-même, pas seulement sur les autres.** Les deux
  défauts de `a87caf0` avaient la même forme que ce que la tranche combat, et
  aucun des deux n'a été trouvé par raisonnement : le premier par une revue
  d'altitude comparant deux copies d'une même liste, le second en lançant la
  règle corrigée sur le dépôt et en vérifiant ses quatre signalements un par un.
  Le rapport de cette session avait été écrit AVANT, et affirmait la règle saine.
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

- **Single next action** : merger la PR #388 (sortie du draft, corps récrit
  pour les deux tranches ; `Quality gate` et `SonarCloud analysis` verts,
  `Dependency audit` rouge et assumé — voir « Not done »), puis ouvrir la
  branche `chore/` des dépendances.
- Tree state : stampé vert `b7b1d141` sur `a87caf0` · propre · **branche
  synchrone avec `origin`** · PR #388 ouverte, hors draft.
- Gotchas :
  - **Le gate a une étape de plus** : `check:tests`, et elle tourne désormais
    aussi dans `.husky/pre-commit`. Un `.skip` posé pour déboguer fait échouer
    le gate ET le commit — le retirer avant de committer.
  - **Ajouter une étape au gate demande TROIS éditions** : le script dans
    `package.json`, la regex de `gate`, la regex de `.husky/pre-commit`.
    `docs/gate-parity.spec.ts` échoue si la troisième manque — c'est la garde,
    pas la mémoire, qui tient cet invariant.
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
