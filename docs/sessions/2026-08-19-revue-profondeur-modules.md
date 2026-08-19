# Session — 2026-08-19 — revue de profondeur des modules

Revue d'architecture menée avec `/improve-codebase-architecture` (plugin
`mattpocock-skills`, installé le jour même). Question posée : **où loupe
fait-il porter aux appelants ce qu'un module devrait tenir ?** — c'est-à-dire
où une interface superficielle (presque aussi complexe que son
implémentation) pourrait devenir profonde.

Angle distinct des revues précédentes : la revue SOLID (2026-08-04) jugeait
des *principes*, celle-ci juge la **profondeur** au sens Ousterhout, avec le
vocabulaire du skill `codebase-design` — module, interface, profondeur, seam,
adaptateur, levier, localité, et le **test de suppression** (supprimer le
module : la complexité disparaît, ou réapparaît chez N appelants ?).

**Méthode** : cadrage par les points chauds du `git log` (200 commits) plutôt
que balayage complet, lecture préalable des ADR 0002–0013 pour ne pas
re-litiger ce qui est décidé, puis quatre explorateurs parallèles
(shell/orchestration, core, adaptateurs audio, vertical accords). Les
affirmations les plus tranchantes ont ensuite été **vérifiées à la main** —
deux ont été corrigées, voir « Corrections » plus bas.

Rendu visuel (schémas avant/après) :
<https://claude.ai/code/artifact/62d9dea5-6189-47c2-9922-5e5c7f2bfb06>

## Verdict d'ensemble

Un motif domine les huit candidats : **le protocole est écrit chez les
appelants, pas derrière une interface**. Ordre d'appels, règles de
supersession, tables de décision, conditions d'accord entre deux
assemblages — tout cela existe et fonctionne, mais sous forme de commentaires
en prose répétés à N endroits, que rien ne vérifie et qui ont déjà divergé
dans au moins trois cas mesurés.

C'est le revers exact d'une qualité du dépôt : la discipline « décision → ADR
ou commentaire au point de friction », qui avait défendu 14 constats sur 20 à
la revue SOLID, produit ici sa contrepartie. Le commentaire tient la règle
tant qu'on le lit ; il ne la tient pas quand un cinquième appelant arrive.

Les zones chaudes du `git log` confirment le cadrage : `workstation-shell`
concentre 278 touches de fichiers sur 200 commits, loin devant `lead-sheet`
(70), `waveform` (56), `ui` (55), `mixer` (53).

## Les huit candidats

Classés par force de preuve. Les quatre premiers ont été trouvés
**indépendamment par plusieurs explorateurs**.

### 01 — Le run d'analyse supersédable n'a que des adaptateurs · Strong (3 explorateurs)

`use-tempo.ts:169-232` · `use-chord-detection.ts:110-351` ·
`use-structure-detection.ts:69-175` · `use-separation.ts:145-245` ·
`use-import-from-url.ts:63-115` · `web-audio-{playback,stem-playback}.ts`

Le même protocole — bumper un jeton monotone, avorter la requête précédente,
re-vérifier après chaque `await`, ne committer que si le run est encore le
dernier — est réécrit **six fois**, sous quatre noms (`runId`, `loadId`,
`loadToken`, `importId`), et a déjà divergé sur trois axes :

- **où le jeton est bumpé** : avant la gate pour les accords (`:197`), après
  pour la structure (`:139`), atomiquement avec l'abort pour tempo et
  séparation ;
- **où le transfert précédent est avorté** : tard pour accords/structure — si
  la gate du nouveau run échoue (quota épuisé), l'ancien controller n'est
  jamais avorté et **garde le créneau d'analyse distant** ;
- **où le run vit** : `useRef` par instance pour accords/structure, atome de
  session pour tempo/séparation (ces deux-là portent le commentaire « le
  supersédeur peut être une autre instance »).

La complexité cognitive 16/15 signalée par Sonar sur `use-chord-detection.ts`
est un **symptôme** : quatre de ses branches sont la même question posée
quatre fois, faute d'un module capable d'y répondre.

**Solution** — un module « le run courant de type X » : démarrer (supersède et
avorte), un signal, un garde qui n'exécute un commit que si ce run est
toujours le dernier.

**Test de suppression** : rien à supprimer aujourd'hui, c'est le test inverse
qui tranche — la complexité est déjà présente six fois.

**ADR** : orthogonal à 0007 et 0010. La boîte du run reste un atome de
feature ; seul le protocole devient partagé.

### 02 — « Qui occupe le mix » est une machine à états sans module propriétaire · Strong (2)

`use-metronome.ts:42-165` · `use-run-tempo-detection.ts:41-45` ·
`use-tempo-detection.ts:117-137` · `use-separate-and-load.ts:59-91` ·
`project-session.ts:88-107` · `mixer-atoms.ts:42` · `use-stem-stack.ts:35`

Le mix a quatre occupations possibles (vide, piste+click, stems, stems+click)
et tout flux qui pose de l'audio doit décider comment s'asseoir sans écraser
celui qui est arrivé avant. Personne ne possède cette décision :

- **quatre verbes de siège** (`enable`/`attach`/`join`/`reseat`) dont le corps
  fait un seul `mixer.restore`/`addStem`/`replaceStem`, préconditions en
  commentaires ;
- la table de décision **rejouée à cinq sites** ;
- **deux vérités concurrentes** pour « un click est-il assis ? » —
  `metronomeEnabledAtom` et `mixer.state.some(id === METRONOME_ID)` — tenues
  en phase par la seule adjacence des lignes dans `startFreshTrack` ;
- `DEFAULT_METRONOME_CHANNEL` **redéfini six fois** dans quatre fichiers ;
- `separationOwnsMix` threadé depuis le shell, d'où **trois `useLatest`** pour
  éviter un instantané périmé.

La fuite se voit au test : `workstation-shell.chords.spec.tsx:150` doit
commenter quel moteur observer, et le kit rend les deux moteurs.

**Test de suppression** : le supprimer *est* le statu quo. L'introduire
concentre.

### 03 — Ce qu'une session persiste est épelé cinq fois · Strong (2)

`core/project/application/session.ts:28-85, 212-328` ·
`core/project/domain/session-signature.ts:25-138` ·
`use-project-session.ts:193-265`

Le core nomme déjà le concept (`LiveSessionSnapshot`, `SignedSession`), mais
le web rassemble la session vivante **deux fois à la main**, à trente lignes
d'écart (`liveSignature` puis `handleSave`), avec le même conditionnel
`activeLoop`, le même gating sur `stemsReady`, le même appel à `liveTempo()`.

L'invariant est un commentaire, pas du code : « signer le métronome à la MÊME
condition qu'une sauvegarde le persiste ». Ce commentaire existe parce que les
deux *peuvent* diverger — et le mode de panne est silencieux : un champ ajouté
au save mais pas à la signature donne « Enregistré » alors que l'édition est
perdue au prochain open ; le miroir donne un projet rouvert modifié à jamais.

**Solution** — un `liveSession()` unique dont save et signature dérivent, et
l'invariant devient une property (`sign(save(s)) = sign(open(save(s)))`) au
lieu de huit commentaires « must match ».

**Test de suppression** : concentre. Nuance : `sessionSaveInput` seul est un
passe-plat ; c'est `sessionSignature` qui gagne sa place.

### 04 — La boucle grille ↔ structure : deux directions, deux portes anti-rebond invisibles · Strong (2)

`marker-atoms.ts:15-26` · `use-markers.ts:66-88` ·
`{chart-marker-sync,relabel-chart,section-markers}.ts` ·
`use-chord-chart-session.ts:58-70` · `use-chart-with-structure.ts:104-148` ·
`core/structure/domain/chart-structure.ts:324, 403`

Un seul invariant — les en-têtes `[Section]` et les repères de structure sont
le même fait en deux notations — implémenté par deux demi-mécanismes qui ne
partagent rien, avec **deux mécanismes de silence différents**, aucun visible
dans les types :

- markers → grille : silencé parce qu'on écrit via `useChordChart` et non
  `useChordChartSession` — *or les deux hooks retournent la même forme*, donc
  rien n'empêche un futur appelant de se tromper ;
- grille → markers : silencé parce que `setSections` contourne `commit`, alors
  que toute autre transition y passe.

S'y ajoute une **boîte mutable dans un atome en lecture seule**, dont le slot
est assigné par un effet du shell et invoqué depuis `useMarkers.commit` :
propriétaire unique par convention, un second monteur gagnerait en silence.

Fragilité relevée : `relabelChartFromSections` repasse par
`sectionDisplayLabel` des libellés déjà de la copie d'affichage. Idempotent
seulement parce qu'aucune chaîne française (`Couplet`, `Refrain`) ne
collisionne avec un tag moteur (`verse`, `chorus`) — un accident, pas un
invariant.

**ADR 0010** : la boîte mutable est défendable (l'ADR interdit la logique dans
les atomes d'écriture, pas les slots). Le constat porte sur l'**asymétrie**
des deux directions. Le travail « texte-comme-modèle » (#364–366) n'est pas
remis en cause : ce module s'appuierait dessus.

### 05 — Le transport stretch expose des leviers, pas des verbes · Strong

`web-audio-shared.ts:138-162` (14 membres) · `web-audio-playback.ts:51-122` ·
`web-audio-stem-playback.ts:80-256`

Interface de 14 membres devant ~160 lignes, chaque membre étant un levier brut
assorti d'une règle d'ordre écrite en commentaire — dans **la seule zone du
dépôt qui se déclare non testée** (« jsdom n'a ni Web Audio ni AudioWorklet »).

- Les deux moteurs appellent **`beginRun` dans un ordre différent** : après
  `node.start()` dans l'un, avant la création des sources dans l'autre. Comme
  `startedAt` est la ligne de base de la position, c'est le même concept avec
  deux origines — et aucun test ne peut le voir.
- `cancelFrame()` avant `stopAt()` : la paire est écrite à la main **à six
  endroits**.
- `ensureStretch()` doit résoudre avant que `outputNode()` ait un sens —
  exactement la course « bus stretch froid » consignée dans `docs/STATUS.md`.
- `setTimeRatio(ratio, applyToSources)` prend un callback uniquement parce que
  le transport ne peut pas atteindre les sources : la découpe est au mauvais
  endroit.
- `play`/`pause`/`seekTo` **dupliqués ligne pour ligne** entre les deux
  moteurs, modulo trois différences.

**Test de suppression — le plus intéressant du lot** : supprimer
`createStretchTransport` fait réapparaître la complexité *deux fois*, donc il
gagne sa place ; mais supprimer aussi l'un des deux moteurs et rien n'est
perdu. C'est un **champ partagé**, pas un module profond.

### 06 — La fenêtre asynchrone du mix n'est pas représentable, et `reset` ne vide pas le graphe · Strong (vérifié)

`use-mixer.ts:161-234` · `audio-session.ts:91-102` ·
`web-audio-stem-playback.ts:144-191`

`load`, `addStem` et `replaceStem` renvoient des promesses que le mixer jette
toutes (`void engine.load(…)`), si bien qu'aucun appelant ne peut savoir quand
le mix devient audible — alors que c'est exactement la fenêtre qu'ouvre
l'attente du bus stretch. `stemsActiveAtom` a déjà basculé (posé
synchroniquement) : un `play()` dans cette fenêtre démarre des sources muettes.

- `restore` dépend d'une **garantie de préfixe synchrone non écrite au port** :
  il pousse les gains sauvegardés juste après un `void engine.load(…)`, ce qui
  ne marche que parce que l'adaptateur réel vide ses gains *avant* son premier
  `await`. Un adaptateur conforme qui les viderait après effacerait
  silencieusement tous les faders restaurés.
- **`reset` ment sur ce qu'il fait** (vérifié) : documenté « vide le mixer et
  ses lanes », son corps ne touche que les lanes, et **il n'existe aucun
  `engine.load([])` dans tout l'arbre**. Après un import frais, le moteur stems
  tient encore les buffers de la piste précédente, et `stemAudio()` les sert
  encore.
- Quatre fakes, **tous dégénérés** sur la dimension dont l'adaptateur réel est
  fait : `load: vi.fn(async () => {})`.

**À confirmer au navigateur** : la conséquence mémoire du `reset` incomplet est
déduite du code, pas mesurée — zone non observable en jsdom.

### 07 — `SessionRestoreDeps` : 13 membres, un adaptateur à 90 % passe-plat · Strong

`core/project/application/session.ts:117-204` (88 lignes d'interface) et
`:212-328` (~115 lignes d'implémentation) · `project-session.ts:24-113` (le
seul adaptateur)

L'adaptateur retransmet **huit des treize membres verbatim** ; quatre seulement
contribuent (l'enveloppe `File`, l'adoption des kinds de structure, le canal de
click par défaut, `nextPaint`). L'interface fait remonter des préoccupations
d'adaptateur dans le core (`setSuppressAutoDetect` documenté comme « le garde
one-shot du shell », `onRestoreStep` attendu pour laisser le navigateur
peindre), et le type est remodelé sur **trois couches** (core → `Omit`/`Pick`
web → `Omit` encore).

**Test de suppression — le seul du lot à échouer** : tel qu'écrit, supprimer
`restoreSession` retirerait 88 lignes de types et un adaptateur de 50 lignes
pour n'en déplacer que ~115 chez son unique appelant : la complexité
**rétrécirait**. C'est ce verdict qui en fait une cible d'approfondissement
plutôt qu'un gardien à conserver tel quel.

**Solution** — ne pas supprimer (la politique appartient au core, l'ADR 0003
plaide pour) mais rétrécir : que la restauration *retourne une description
ordonnée de ce qu'il faut asseoir*, valeur que l'adaptateur exécute.

### 08 — « La timeline des mesures » est un concept manquant · Worth exploring (2)

`chart-structure.ts:370, 408, 464` · `song-structure.ts:50` ·
`chord-detection.ts:31` · `bass-line.ts:53` · gardes : `detect-chords.ts:113`,
`chart-marker-sync.ts:18`, `use-structure-markers.ts:51`,
`shell-analyser-row.tsx:50`

Six sites reconstruisent `grid.filter(downbeat).map(time)` ; cinq autres
réécrivent « pas de downbeat, donc ne rien faire » avec **trois définitions
différentes de « ne rien faire »** (échec tagué, retour muet, bouton
désactivé). `measureSeekTime` et `chartSectionAnchors` sont la même projection
et redérivent chacun le tableau des downbeats.

`chart-structure.ts` (585 l., 15 exports) porte deux concepts : la déduction
MDL de la structure et le mapping positionnel grille↔chart.

*Worth exploring* plutôt que Strong : la duplication est certaine, le gain
dépend de savoir si les cinq gardes veulent vraiment la même réponse — non
vérifié.

## Recommandation

**Commencer par le 01.** Seul candidat trouvé indépendamment par trois
explorateurs sur quatre ; seul dont la divergence produit déjà une conséquence
observable (le créneau d'analyse distant retenu). Il fait tomber le waiver
Sonar S3776 sans le viser, ne touche à aucune décision d'ADR, et c'est le
mieux borné des huit : six appelants, un protocole, aucune UI. Les candidats
02 et 04 touchent des features en cours de migration Mikado sous les
ADR 0010–0011 ; celui-ci non.

## Corrections apportées aux constats bruts

Deux affirmations d'explorateurs ont été vérifiées puis **corrigées** avant
publication — elles sont consignées ici pour que personne ne les reprenne dans
leur version initiale :

1. **Le garde de commit tempo** est bien le plus faible des trois
   (`use-tempo.ts:218` teste le seul `runId`, là où
   `use-chord-detection.ts:262-268` teste aussi l'identité de l'audio et le
   signal d'abort). Mais l'explorateur en tirait un **bug vivant** (« la piste B
   reçoit la grille de la piste A ») : c'est faux. `startFreshTrack` appelle
   `tempo.reset()`, qui appelle `supersede()`. La protection existe — elle est
   simplement dans un autre fichier, portée par l'ordre des lignes plutôt que
   par le garde.
2. **Le seam mort de `barsPerRow`** est réel (aucun appelant de production ne
   passe l'argument de `detect(barsPerRow?)`, seul le spec le fournit), mais la
   divergence de layout annoncée était surestimée : le commentaire `:173-175`
   documente le repli comme voulu. Rétrogradé de candidat à note.

## Noté, pas retenu en candidat

- **`barsPerRow`** — un paramètre à retirer, pas un module à créer (voir
  ci-dessus).
- **Le réducteur de session tempo** — `useTempo` (399 l.) assemble lui-même
  borne de pliage, précédence d'ancre et validité du métrique (cette dernière
  réécrite une troisième fois dans la vue) alors que le core n'exporte que les
  primitives. Le core a déjà trois réducteurs du même genre.
- **« Ceci écraserait du travail non sauvegardé »** — prédicat profond et bien
  nommé, mais quatre gardes réinventés autour, avec quatre règles de
  désarmement séparément inventées. Les trois gestes UI sont légitimement
  différents ; c'est la politique qui est dupliquée.
- **Le registre a dérivé** — `packages/core/src/application/README.md` documente
  encore des jumeaux Tauri/FS de trois ports qui n'existent plus nulle part :
  trois seams présentés comme réels sont en fait hypothétiques. À corriger
  avant que quelqu'un raisonne sur la substituabilité à partir de ce tableau.
- **Règles non écrites relevées au passage** — le contrat « aucun membre n'est
  extrait » d'`audio-session.ts` est énoncé puis violé (`use-stem-stack.ts:29`
  passe `stemPlayback.stemAudio` nu) ; `useMixer` jette si le moteur stems
  manque, `usePlayer` en construit un privé (même singleton, deux règles).
- **Examiné puis écarté** — `chord-chart.ts` est déjà profond : un seul parcours
  `scanChart` nourrit parseur, spans et diagnostics, `renderChart` reste
  l'imprimeur unique. À laisser tel quel.

## Gate status

Revue documentaire : aucun code touché, aucun test à rejouer. Le commit est
doc-only, donc le hook pre-commit ne joue que la fitness function
`docs/docs.spec.ts` (36 tests ✅). `docs/sessions/` étant plein (5/5), le
plus ancien rapport (`2026-08-04-revue-solid-isp.md`) part dans
`sessions/archive/` par la même occasion.

`docs/STATUS.md` **n'est pas modifié** : il est exactement à sa borne (60/60
lignes non vides), et ce rapport étant le plus récent de `docs/sessions/`, le
protocole de reprise (STATUS + rapport le plus récent) le trouve sans ligne
d'index supplémentaire.

## State to resume from

- **Single next action** : choisir un candidat et le passer au grilling
  (`/grilling` du plugin, ou le chemin maison `/new-feature-hexa` →
  `/tdd-cycle`). Le 01 est la recommandation.
- Rien n'est en cours côté code : cette session n'a produit que ce rapport et
  la configuration des skills (`docs/agents/`, bloc `## Agent skills` dans
  `CLAUDE.md`).
- Gotcha : les huit candidats citent des numéros de ligne datés du
  2026-08-19. Revérifier avant d'agir si des PR ont atterri entre-temps.
