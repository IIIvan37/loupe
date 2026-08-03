# Session — 2026-08-03 — revue justesse design

Revue de la **justesse du design** (le modèle correspond-il au domaine, les
abstractions sont-elles au bon endroit ?) — le seul angle que le gate ne mesure
pas : jscpd voit la duplication de *texte*, pas la duplication de *règle* ;
Sheriff vérifie la *direction* des dépendances, pas l'*altitude* de la logique.

**Méthode** : quatre lectures indépendantes et parallèles (harmonie/structure,
audio/boucles/rythme/mixer, couche application ports/use-cases, adapter
web + Supabase), chacune avec une grille critique explicite (fidélité au
domaine, obsession du primitif, hexagone de cérémonie, fuite de logique,
placement des règles serveur). Seuls les constats **recoupés** entre lecteurs,
avec preuves fichier:ligne vérifiées, sont retenus ici.

## Verdict d'ensemble

**Le design est fondamentalement juste — l'hexagone est réel, pas décoratif —
avec un défaut systémique d'altitude, une dette transversale de typage, et un
écart produit réel côté quota.**

Aucune des quatre lectures n'a trouvé d'hexagone de cérémonie :

- Ports sans vocabulaire technique (zéro Web Audio / localStorage / Supabase
  dans le core, vérifié par grep) ; `AudioRef` opaque par contrat explicite
  (`project/application/ports.ts`).
- Zéro import profond, zéro contournement depuis `packages/web` ; les 12
  use-cases importés chacun exactement une fois, un hook par use-case.
- `public-surface.spec.ts` est une vraie fitness function : échoue sur tout
  export orphelin, rejette `export *` et les défauts, fail-closed sur les
  imports namespace.

Points de modélisation remarquables (recoupés) :

- **Mixer** : `effectiveGains` dérive solo/mute au lieu de le stocker — la
  seule modélisation qui ne peut pas se désynchroniser ; règles épinglées par
  property tests (`separation/domain/mixer.ts`).
- **Rythme** : `barPosition` par battement (survit aux anacrouses), `TempoMap`
  en segments avec ruptures confirmées, médiane pour le tap tempo — le modèle
  de ce qu'un musicien entend, modes de défaillance nommés.
- **Harmonie** : la transposition préserve le texte source avec aller-retour
  prouvé par propriétés ; `walkForm` est l'unique interpréteur de la forme
  écrite (reprises, voltas, D.C.) — aucune seconde implémentation nulle part.
- **Encodeur de forme** : optimise pour le lecteur, pas la compression
  (`NAVIGATION_COST` : un D.C. coûte 10 parce que les musiciens détestent les
  sauts de page) ; tout repli refusé sauf lecture byte-identique.
- **Supabase** : RLS moindre-privilège exemplaire — zéro write policy, deux
  tables invisibles de la Data API, mutations en `SECURITY DEFINER` +
  `search_path = ''`, verrous `FOR UPDATE` sur chaque check-then-write.

## Défaut n° 1 — le core modélise les opérations, l'adapter possède les politiques

Constat convergent des quatre lectures — le plus solide de la revue.

- La machine à états du transport (wrap de boucle, arrêt fin de piste, bascule
  piste↔stems) vit dans `use-transport-engines.ts` (~100 lignes pilotées par
  refs) ; le cas `tick` de `transportReducer`
  (`packages/core/src/domain/transport.ts`) est **du code mort** — jamais
  dispatché en production, la même règle réimplémentée dans le hook.
- `restoreSession`
  (`packages/web/src/app/workstation-shell/orchestration/project-session.ts`,
  ~120 lignes, sans React, deps injectées) est un use-case qui vit côté web :
  migration de manifeste, politique d'identité des boucles par égalité de
  floats. Conséquence structurelle : la garde `mixerMatchesStems` de
  `saveProject` ne peut jamais se déclencher — son unique appelant construit
  la paire cohérente d'avance.
- `sessionSignature` (`packages/web/src/projects/session-signature.ts`)
  ré-implémente les défauts de manifeste que `saveProject`/`openProject`
  appliquent déjà — deux définitions de l'état canonique persisté, tenues
  d'accord par commentaires.
- La règle « quand le speed-trainer se désarme » est éclatée sur **5 sites
  dans 2 fichiers** d'adapter (`use-player.ts`, `use-loop-editing.ts`) ;
  `MAX_OCTAVE_SHIFT = 2` est dupliqué dans `use-tempo.ts` et
  `tempo-panel.tsx` et absent du core qui exporte pourtant `foldTempoOctave` ;
  `overrideMeter` ré-implémente un *reject* là où le core offre un *clamp*
  (`clampBeatsPerBar`).
- Le pré-vol quota/authz est copié autour de 4 sites d'appel de use-cases,
  sur un port local au web (`auth-port.ts`) invisible du registre.

**Ce n'est pas théorique** : le bug v0.2.1 (gains gelés du mixer, PR #355)
était exactement cette classe — le modèle core était juste, c'est la poussée
impérative des gains côté adapter qui s'est désynchronisée. La surface exposée
reste la même : ces politiques ne sont testées qu'en rendus jsdom
d'intégration, et Stryker ne mute que le core (`stryker.config.json`).

## Défaut n° 2 — aucune quantité n'est typée

Secondes, ratio, pourcent, dB, gain linéaire, demi-tons, cents, BPM : tout est
`number` nu. Cicatrices déjà visibles dans le code :

- `speed-trainer.ts` ré-implémente un clamp en espace pourcent avec un
  commentaire expliquant que l'aller-retour `/100 · *100` corrompt les floats
  — un rapport de bug sur les unités non typées, écrit en commentaire.
- Le port pitch documente « nombre entier de demi-tons »
  (`application/ports.ts`) ; son propre adapter l'appelle avec
  `semitones + cents/100` (`use-player.ts`).
- Le wrap modulo-12 des pitch classes est réécrit 8 fois ; « ce token est-il
  vraiment un accord » est gardé à 4 endroits dont un dans le web
  (`chord-glyph.tsx` porte deux regex de grammaire d'accord en TSX).
- `CountIn` réutilise le type `BeatGrid` avec une autre origine temporelle
  *et* un autre référentiel de vitesse (`metronome.ts`) — passer ses beats à
  `snapLoopRegionToGrid` typecheckerait et produirait n'importe quoi.
- Un intervalle de temps est modélisé 4 façons (`LoopRegion`,
  `DetectedSection`, `TempoSegment`, `SectionAnchor`≡`Marker` sans id) ; deux
  formats de `Result` et 6 classes d'erreur quasi identiques coexistent dans
  la couche application.

## Défaut n° 3 — en harmonie, le texte source *est* le modèle

- `parseChart` n'a pas d'inverse (`renderChart` n'existe pas) : chaque édition
  de grille est une réécriture de *texte* gardée par heuristiques, et la même
  grammaire de ligne est implémentée trois fois à la main — le code l'avoue
  (« Mirrors parseChart's line dispatch statement for statement »,
  `chord-chart.ts`). Seuls les property tests tiennent les copies ensemble.
- La cellule de mesure `'C G'` (espace = séparateur) est la monnaie du module
  structure : alias déclaré 4×, re-parsée par `indexOf(' ')` /
  `includes(' ')` en trois endroits, produite par `playedLabels` qui jette
  reprises, voltas et fermatas au passage.
- Murs de fidélité assumés mais réels : pas de D.S./segno (le `dc` de
  `ChartForm` cumule deux rôles), pas de placement des accords dans la mesure
  au-delà de la moitié, pas d'anacrouse, pas de changement de tonalité en
  cours de grille, `6/8` accepté en lecture mais jamais réémis.

## Écart produit — le quota mesure des mints, pas des analyses

Le constat le plus concret de la revue (`supabase/`, Edge Function, gate) :

- Le SQL annonce « ~20 analyses par mois » ; `consume_analysis()` est débité
  par **mint de jeton**, le jeton vit 300 s, et les quatre flux d'analyse
  (tempo, accords, structure, séparation) partagent le cache. **Quatre
  analyses en moins de 5 minutes = 1 unité de quota** — la règle serveur et le
  produit livré décrivent deux choses différentes (~4×).
- Un utilisateur throttlé au redeem (U.3) voit « Code invalide » pendant
  15 minutes : l'indistinguabilité est un bon choix sécurité, l'absence
  d'affordance UX n'en est pas un.
- `consume_analysis` est granté à `authenticated` : un navigateur signé peut
  brûler son quota en RPC direct sans jamais recevoir de jeton (self-grief
  seulement, mais le commentaire « the Edge Function is the only writer »
  est faux).
- Les tests SQL (`supabase/tests/`, bons, écrits test-first) — les seules
  règles qu'un client hostile ne peut pas contourner — **ne tournent pas en
  CI** (`ci.yml` ne lance que deno check/lint/fmt).

## Gardes-fous — correctifs proposés pour loupe

L'outil transversal est le **ratchet** (le pattern `STATUS_MAX_LINES` de
`docs/docs.spec.ts` appliqué à un compte de violations) : borne épinglée au
niveau actuel, qui ne peut que décroître — stoppe l'hémorragie sans exiger le
refactor big-bang. Bloquant pour le neuf, ratchet pour l'existant.

**Altitude** (partiellement mécanisable — le jugement « ceci devrait être un
use-case » reste humain) :

- Spec « actions câblées » : chaque variante d'action d'un reducer exporté du
  core exige au moins un site de dispatch dans `packages/web` — l'esprit de
  `public-surface.spec.ts` descendu au niveau des variantes d'union ; le
  `tick` mort échouerait aujourd'hui.
- Constantes numériques SCREAMING_CASE interdites au niveau module dans
  `packages/web/src/app` : elles viennent de `@app/core` (whitelist
  d'exceptions vue triée dans le spec, comme `sonar-project.properties`).
- **Étendre `mutation:diff` aux hooks `use-*.ts` de web** — le seul détecteur
  *général* d'altitude : un mutant qui survit dans un hook est exactement le
  signal « politique non testée en valeurs ». Aujourd'hui Stryker ne mute que
  le core, précisément la moitié déjà bien testée.
- Process : étape dans `.claude/skills/new-feature-hexa/` — « nomme les
  politiques de la slice ; chaque politique est une fonction core avant
  d'être un `if` dans un hook ».

**Unités** (entièrement mécanisable) :

- Scalaires brandés unité par unité ; le garde-fou devient le typechecker.
  Adoption forcée par un spec nom↔type (API TypeScript) : tout paramètre
  `*Seconds` porte le brand `Seconds` — activable par ratchet.
- Grep-ban immédiat, style `purity.spec.ts` : le littéral `% 12` interdit
  hors d'un unique module pitch-class.

**Texte-comme-modèle** (ratchet en attendant le refactor `renderChart`) :

- Compte épinglé des fonctions harmony/structure prenant `source: string`.
- Liste fermée des fichiers autorisés à contenir la grammaire de ligne
  (trois aujourd'hui, jamais quatre).
- À terme, le contrat définitif est la propriété fast-check
  `render ∘ parse = id` — l'idiome déjà pratiqué pour la transposition.

**Ports** (issus de la lecture SOLID, cf. discussion en fin de rapport) :

- Une suite de contrat exécutable **par port**, rejouée par chaque adapter —
  généraliser le pattern `projectStoreContract` (aujourd'hui 1 port sur 12).
  C'est LSP rendu testable : `http-tempo-detector` qui fabrique
  `barPosition: (index % 4) + 1` n'aurait pas passé un contrat sémantique.
- Spec « pas de méthode optionnelle dans une interface de port » (dix lignes,
  style `purity.spec.ts`) + ratchet sur le nombre de méthodes par port — une
  méthode optionnelle est une interface qui avoue être plusieurs (ISP) ;
  `spectrum?()` / `setStemFilter?()` n'auraient pas pu naître.

**Quota/SQL** (le plus rentable) :

- Leg CI : stack Supabase local + exécution de `supabase/tests/`.
- Test de grants exécutable (requête `pg_catalog` vs allowlist versionnée) —
  « the Edge Function is the only writer » devient un test.
- Test « un flux d'analyse = un débit » — ne peut s'écrire qu'après la
  décision produit.

Sélection si on n'en construit que trois : le leg CI Supabase (valeur max,
effort min), la mutation sur les hooks (la classe du bug v0.2.1), le grep-ban
`% 12` + premier brand `Seconds` (le pied dans la porte).

## Gardes-fous — préventifs (futur starter, documentés ici pour le moment)

Destinés à `hexagonal-tdd-starter` ; **portage différé**, consignés ici en
attendant. En greenfield, tout ratchet devient règle bloquante dès le premier
commit (zéro dette), et les specs par scan de source sont **inertes tant que
le pattern n'existe pas** — on peut livrer la batterie complète sans
étrangler l'exploration initiale.

- **Principe racine — la logique vit là où les tests la tirent.** La méthode
  TDD a protégé le core de loupe à la perfection, mais les slices « UI » ont
  eu leur test d'acceptation en jsdom, et les politiques ont suivi le test
  dans les hooks. Règle de méthode : *le premier test rouge d'une slice
  n'importe que `@app/core`* ; les tests jsdom n'affirment que du câblage.
- **Règles « paires obligatoires »**, inertes jusqu'à la première occurrence :
  tout `parseX` exige `renderX` + property test `render ∘ parse = id` dans le
  même module (le texte-comme-modèle ne peut pas naître) ; tout reducer
  exporté exige ses variantes dispatchées.
- **Brands dès le premier type** : un module d'unités livré par le template
  (le pattern en trois lignes) + la règle nom↔type active d'emblée — quasi
  gratuit à prévenir, ruineux à guérir.
- **Contract-first serveur** : le squelette du leg CI Supabase livré *avant*
  la première migration ; les constantes produit (quotas, TTL, seuils) à
  source unique consommée ou vérifiée par les deux côtés — un commentaire SQL
  qui énonce un nombre est un mensonge en attente.
- **Méta-garde-fou** : livrer le harnais (un spec de design où une règle
  s'ajoute en dix lignes) pour que le garde-fou se pose à la *première*
  occurrence d'un smell, pas à la vingtième — loupe montre que les fitness
  functions arrivent après la douleur. Et un principe de culture : **un ADR
  sans enforcement est un vœu** — chaque décision durable désigne le spec qui
  la vérifie, ou la raison pour laquelle c'est impossible.
- **Limite honnête** : la fidélité au domaine (segno manquant, anacrouse
  impossible) n'est pas outillable — glossaire par module de domaine tenu
  comme un livrable, et l'expert sollicité sur les *types* avant l'UI.

## Discussion — value objects contre l'obsession du primitif

Le VO est le remède classique au défaut n° 2, mais sous sa **forme
fonctionnelle**, pas la classe DDD (qui se bat contre le typage structurel,
l'aller-retour JSON des manifestes, jotai et fast-check) :

- **Le triplet** : brand (distinction nominale, coût runtime zéro) + smart
  constructor (l'invariant de construction) + module d'opérations (le
  domicile). Le brand seul n'est que le tiers du VO — c'est le constructeur
  qui le transforme de cérémonie en preuve.
- **Le principe sous-jacent — parse, don't validate** : le type transporte la
  preuve que la validation a eu lieu ; on parse une fois à la frontière, le
  doute ne se propage plus. Contre-exemple limpide dans loupe :
  `parseChordSymbol` total (ne peut pas échouer) ⇒ la preuve n'existe pas ⇒
  « est-ce vraiment un accord » re-gardé à 4 endroits dont un en TSX. Un
  `parseChordSymbol: string → ChordSymbol | Unparsed` supprime les gardes en
  les rendant inutiles.
- Loupe fait déjà des VOs **composites** (`makeLoopRegion` normalise,
  opérations à côté, égalité par valeur) — ce sont les *scalaires* qui sont
  nus.
- **Limites** : l'algèbre des unités (`Seconds × Ratio = Seconds`) vit dans
  les fonctions de conversion explicites — le gain est de forcer à *penser*
  la conversion (le bug percent/ratio du speed-trainer était une conversion
  supposée identité), pas seulement le typecheck. Et le sur-VO se filtre par
  un test simple : *un échange d'unités typecheckerait-il aujourd'hui en
  produisant du non-sens ?* Cas subtil : `CountIn`/`BeatGrid` — même unité,
  mais origine et référentiel différents ⇒ type distinct ou paramètre
  fantôme, pas un brand d'unité.
- Bonus TDD : un arbitrary fast-check par VO ⇒ les générateurs ne produisent
  plus d'états illégaux. Et les décisions orphelines trouvent un domicile
  (« deux régions sont-elles la même boucle ? » — aujourd'hui une égalité de
  floats inline dans `project-session.ts` — appartient à un
  `LoopRegion.equals` décidé une fois).

## Discussion — confrontation SOLID

La revue avait trouvé des violations SOLID sans les nommer. Relecture des
cinq principes, traduits pour un core fonctionnel :

- **S** (une raison de changer) : `detectChords` orchestre *et* sérialise le
  ChordPro ; les hooks mêlent glue et politique. Le moins mécanisable — seul
  proxy : la co-évolution dans `git log`, signal faible.
- **O** : **s'inverse partiellement en fonctionnel** — les unions fermées du
  domaine violent OCP délibérément et c'est correct (l'exhaustivité est la
  feature) ; OCP ne s'applique qu'aux frontières. Réussite : le 4e détecteur
  ajouté sans modifier les trois autres. Échecs : `spectrum?()` (étendre en
  modifiant le port) ; `ChartForm` en trois scalaires (ajouter le D.S. exige
  de modifier le type — le `NavigationMark[]` proposé est le redesign
  conforme).
- **L** : le plus mécanisable et le plus troué — contrat sémantique vérifié
  pour 1 port sur 12 ; `http-tempo-detector` invente `barPosition`,
  `use-player` viole le contrat « entier » du port pitch. La machine existe
  déjà (`projectStoreContract`) : la généraliser.
- **I** : violation au manuel — `StemPlaybackEngine`, 13 méthodes, quatre
  seams, deux méthodes optionnelles (l'interface qui avoue être plusieurs,
  feature-detect chez les consommateurs). Facilement mécanisable (cf.
  gardes-fous Ports ci-dessus).
- **D** : le seul déjà machiné à trois niveaux (Sheriff, Biome, purity +
  public-surface) — et ça se voit. Nuance attrapée quand même : `AuthPort`
  possédé par `packages/web` alors que la politique qu'il exprime est de
  niveau application — DIP structurel ✓, DIP de *propriété* ✗, la partie
  qu'aucun graphe de dépendances ne voit.
- Méfiance envers les « scores SOLID » automatiques : les métriques OO
  (LCOM, couplage) lisent mal un core fonctionnel, et un chiffre gamable
  devient un objectif au lieu d'un signal.

## Discussion — la méthode fait-elle émerger un design ?

Conclusion méthodologique des quatre lectures : **oui, et loupe en est la
preuve — mais l'émergence a une physique**, quatre lois toutes visibles dans
le code.

Ce qui a réellement émergé : la structure en modules elle-même (l'ADR
« modules émergents » — extraits quand ils sont apparus, seams réels,
acycliques) ; les modèles raffinés par le rouge-vert (`effectiveGains`
dérivé, `TempoMap` aux ruptures confirmées — des designs qui portent la
trace de cas limites découverts un test à la fois) ; une surface 100 %
tirée par la consommation (zéro code mort, zéro concept spéculatif).

Les quatre lois :

1. **Le design émerge là où est la pression des tests.** `restoreSession`
   est un use-case *bien conçu* (sans React, deps injectées) qui a émergé
   dans l'adapter : l'émergence a eu lieu, la forme est bonne, seule la
   couche est fausse — le design suit le gradient de feedback, et le
   gradient était dans les tests jsdom.
2. **L'émergence est dépendante du chemin — les asymétries se
   fossilisent.** `parseChart` sans inverse n'est pas une décision : le
   premier besoin était de lire ; les trois implémentations de la grammaire
   sont la sédimentation de l'ordre d'arrivée des besoins. Ne se rembourse
   que par refactor volontaire.
3. **Ce qui ne produit jamais de rouge n'émerge jamais.** 855 commits, pas
   un scalaire brandé : l'obsession du primitif ne fait échouer aucun test.
   Les types sont des hypothèses qu'on pose, pas des conséquences des
   tests. Même loi pour les contrats de port (rien ne rougit quand
   l'adapter invente `barPosition`).
4. **L'émergence ne dépasse pas les questions posées.** Pas de segno, pas
   d'anacrouse : le principe « jamais spéculatif » — celui-là même qui donne
   le zéro code mort — garantit aussi que le modèle est exactement
   l'intégrale des besoins passés. La fidélité au domaine ne s'émerge pas,
   elle s'injecte (glossaire, expert sur les types, maquette) — la règle
   CLAUDE.md « confirmer l'approche avant une slice UI » l'avait déjà
   appris d'un rework.

**Formulation retenue** : la méthode ne fait pas émerger le design — elle le
rend *émergeable* (le filet de tests garde le design plastique au lieu de
figer). L'émergence se joue dans le troisième temps du cycle, le refactor,
et le refactor conceptuel (nommer la politique, remonter l'altitude, poser
le VO) exige un œil que ni le rouge ni le vert ne fournissent — TDD donne
l'*occasion* de designer, il ne designe pas à ta place.

D'où la lecture finale des gardes-fous de ce rapport : ce ne sont pas des
contrôles *sur* l'émergence, ce sont des **pressions sélectives ajoutées à
l'environnement**. La mutation sur les hooks crée le signal rouge que la
loi n° 3 réclame pour les politiques ; les contrats par port le créent pour
LSP ; « premier test rouge core-only » déplace le gradient de la loi n° 1
vers le core ; la revue périodique est la pression globale qui corrige ce
que les pressions locales optimisent trop localement. Le design émerge
toujours ; il émerge dans la direction des pressions installées. Choisir
ses fitness functions, c'est choisir la forme vers laquelle le système
évolue — une définition assez exacte du travail d'architecte dans une
méthode émergente.

## Discussion — hooks web : le smart/dumb a pivoté, la taxonomie manque

Constat : la partie web multiplie les hooks, tantôt adapters, tantôt
remplaçants d'un smart component, sans découpage smart/dumb affiché.

Relecture : **le découpage existe mais a pivoté de 90°** — hooks
intelligents / composants bêtes / un unique composition root
(`workstation-shell`, 407 lignes de pur câblage). C'est le successeur
canonique de container/presentational (idiome déprécié par son propre
auteur après les hooks), pas son absence. La revue le confirme : les
composants *sont* dumb (`chord-chart-panel` : 655 lignes, zéro fetch,
toutes les règles déléguées au core), à deux fuites près déjà au rapport
(`chord-glyph`, positionnement D.C./Fine dans `lead-sheet`).

Le vrai manque : les hooks jouent **trois métiers sans convention qui les
distingue** —

1. **hook-moteur** (adapter hexagonal : brancher un port/moteur sur le
   cycle de vie React — `use-transport-engines`, l'injection de
   `use-player`) ;
2. **hook-use-case** (protocole d'appel d'un use-case : jeton de course,
   abort, garde de commit) — et la revue a mesuré sans le nommer que la
   taxonomie émerge déjà : **les 12 use-cases sont importés exactement une
   fois chacun, un hook par use-case** ;
3. **hook-politique** — le métier qui ne devrait pas exister (le problème
   d'altitude).

Conséquence mesurée de l'absence de convention : chaque hook invente son
pattern — trois régimes de vérité d'état coexistent (atom, `ExternalValue`
hors React, `stateRef` + miroir « fragile by construction »), et le
protocole runId+AbortController est réécrit à la main dans ~5 hooks — un
indice-de-pattern au sens de la discussion précédente (la même force
résolue cinq fois ⇒ un `useSupersedableRun` unique manque).

Proposition (décision **ADR ou pas : à prendre**, non tranchée ici) :

- Ne pas restaurer smart/dumb au niveau composant (avec jotai, le
  container classique n'a plus de raison d'être ; le shell le remplace).
- Nommer la taxonomie au niveau hook : trois genres (moteur / use-case /
  vue), un hook appartient à un genre, un hook qui en mélange deux se
  scinde. Écrire la règle déjà émergée « un hook par use-case ».
- Extraire `useSupersedableRun` (5 copies → 1).
- Un régime de vérité d'état par défaut, les exceptions argumentées.
- Fitness function possible à terme : un hook = un genre.

Lecture par la physique de l'émergence : « un hook par use-case » est la
loi n° 2 en version heureuse (une asymétrie de chemin devenue bonne
convention sans décision) ; les trois régimes de vérité d'état sont la
même loi en version malheureuse (trois chemins en cours de
fossilisation). Nommer la taxonomie maintenant, c'est choisir laquelle
des deux sédimentations continue.

## Discussion — `useLatest` : justifié, documenté, et remplaçable pour partie

État des lieux : 26 sites d'appel dans 12 fichiers.
`packages/web/src/lib/use-latest.ts` implémente la variante **render-pure**
du pattern (écriture du ref dans un effet, jamais pendant le rendu — sûre
sous Strict Mode et rendu concurrent), avec un commentaire qui montre que le
compromis est compris. Au-dessus de la moyenne des implémentations en
circulation, dont beaucoup écrivent pendant le rendu.

Pedigree : le « latest ref pattern » est documenté (Abramov, *Making
setInterval Declarative*, 2019 ; K. C. Dodds, *The Latest Ref Pattern in
React*), livré dans `react-use` et `ahooks`, et reconnu par le core team —
la RFC `useEvent` (2022) devenue **`useEffectEvent`, stable depuis React
19.2** (loupe est sur react 19.2.8 : l'API est disponible dans le projet
aujourd'hui).

Tri des usages par la taxonomie ci-dessus :

1. **Abonnement monté une fois** (hook-moteur : callback de position du
   moteur, drag de fader, raccourcis) — le cas d'école, légitime. Désormais
   **remplaçable par `useEffectEvent`**, et mieux : un Effect Event lit
   directement les props/state du dernier rendu, donc les refs de *données*
   disparaissent aussi — le cluster de sept `useLatest` de
   `use-transport-engines.ts` se réduirait à un
   `onTick = useEffectEvent(…)` abonné une fois. Nuance : ça nettoie le
   **symptôme**, pas la cause — la machine à états resterait dans
   l'adapter ; le correctif de fond reste le `playbackReducer` core.
2. **Handle stable** (ADR-0011, `use-player.ts` : cinq fonctions emballées
   dans une façade retournée) — **non remplaçable** : un Effect Event ne
   peut être ni passé à un enfant, ni retourné, ni appelé hors des Effects
   du composant qui le définit. `useLatest` reste le bon outil là.
3. **Ref de donnée du domaine avec un `if` dessus** — le drapeau rouge
   d'altitude, quel que soit l'emballage : une décision se prend dans un
   callback au lieu d'un reducer. Critère mécanisable (`useLatest` d'une
   valeur non-fonction + branchement dans le même effet).

Règle de discrimination retenue : abonnement long-vécu qui lit du frais →
`useEffectEvent` ; identité stable exportée → `useLatest` (seul cas
légitime restant) ; ref de domaine branché → politique à remonter au core.
À intégrer à l'éventuel ADR taxonomie des hooks.

## Decisions

- Rien d'appliqué : revue en lecture seule, ce rapport est le livrable.
- Taxonomie des hooks web : documentée ci-dessus, le choix d'en faire un
  ADR (ou une simple convention) reste à prendre — y intégrer la partition
  `useEffectEvent`/`useLatest` (stable depuis React 19.2, projet sur
  19.2.8).
- Les gardes-fous préventifs visent `hexagonal-tdd-starter` mais restent
  documentés ici pour le moment — portage explicitement différé.
- Priorités proposées (ordre de valeur) :
  1. **Quota** : débiter par flux d'analyse ou renommer l'unité — écart
     produit réel ; + faire tourner `supabase/tests/` en CI.
  2. **Rapatrier les politiques dans le core** : machine transport (supprimer
     le `tick` mort ou router la position par lui — l'un des deux, jamais les
     deux), `restoreSession`/`sessionSignature` comme use-cases, règle unique
     de désarmement du speed-trainer — la classe du bug v0.2.1.
  3. **Scalaires brandés** (`Seconds`, `Ratio`, `Percent`, `Decibels`,
     `Cents`, `PitchClass`, index écrit/joué) — la discipline
     qu'`OctaveFactor` et `direction: -1|1` montrent déjà abordable.
  4. Harmonie : `renderChart` inverse de `parseChart`, une seule grammaire.

## State to resume from

- **Single next action** : décider si l'écart de quota est un bug (débiter par
  flux) ou une décision produit (renommer l'unité en « session d'analyse ») —
  tout le reste du lot 1 en découle.
- Les quatre rapports détaillés (inventaires complets, verdicts par critère,
  ~40 preuves fichier:ligne chacun) ne sont pas versionnés ; ce rapport est la
  synthèse recoupée.
