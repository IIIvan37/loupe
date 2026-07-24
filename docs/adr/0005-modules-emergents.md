# ADR 0005 — Les modules de feature se découvrent, ils ne se décrètent pas

- **Statut** : accepté — mise en œuvre au lot TS.5 (mécanisme, puis une
  extraction par PR)
- **Date** : 2026-07-24 (adapté de l'ADR-0006 du template `hexagonal-tdd-starter` —
  dont le « field project » anonymisé est **loupe** ; les chiffres ci-dessous
  sont les vrais, revérifiés à la rédaction)

## Contexte

Le core de loupe est un hexagone pur et strictement gardé — et « la notion de
module y est perdue ». Mesuré sur l'arbre actuel :

- **49 fichiers à plat** dans `core/src/domain`, 11 dans `application`.
- [`ports.ts`](../../packages/core/src/application/ports.ts) est un god-file :
  **306 lignes, ~24 interfaces exportées** couvrant tous les sujets (décodage,
  lecture, stores, séparation, détections, archives, sources de pistes).
- Un **noyau de facto que personne n'a déclaré** : `beat-grid` est importé par
  17 fichiers du core (hors specs) ; avec `nearest-time`, `median` et
  `timecode`, c'est le langage temporel partagé du domaine — indiscernable
  d'un sibling ordinaire dans le dossier plat.
- Un DAG conceptuel implicite, presque cohérent —
  `audio ← rhythm ← harmony ← structure ← project` — écrit nulle part, imposé
  par rien.
- **Deux cycles conceptuels déjà nés**, chacun pointant un savoir mal placé :
  `harmonic-cycle → section-matching` (l'algorithme générique
  `sequenceAgreement`, un accord de séquences, piégé dans un module de
  concept) et `seek-step → key-bindings` (`SEEK_STEP_SECONDS`, une constante
  de transport, logée dans le fichier des raccourcis clavier).
- Le signal crie dans les noms de fichiers : `chord-*` ×5 (`chord-chart`,
  `chord-detection`, `chord-engraving`, `chord-key`, `chord-symbol`),
  `loop-*` ×3 (`loop-library`, `loop-region`, `snap-loop-region`), `stem-*`,
  `wav-*` — **le préfixe kebab-case est le proto-module**.

Cause racine : la méthode elle-même. `/new-feature-hexa` dit « créer
`domain/<name>.ts` » — chaque concept atterrit comme un fichier de plus dans
un dossier de couche plat. Les couches ne sont pas des modules : l'hexagone
garde la dimension dedans/dehors et ne dit rien du découpage du domaine.

Le remède évident — des dossiers feature-first dès le premier jour —
contredit l'invariant n° 2 du dépôt : au jour un, les bounded contexts sont
inconnus, et les nommer d'avance est du design spéculatif. Personne n'aurait
deviné `rhythm/harmony/structure/loops/separation` au jour un de loupe ; ils
ont *émergé*.

## Décision

**Les modules se découvrent, ils ne se décrètent pas.** Loupe adopte le
mécanisme de l'ADR-0006 du template, via le lot TS.5 du
[plan de resynchronisation](../template-sync-plan.md) :

1. **La nursery.** Les fichiers naissent à plat dans `domain/` et
   `application/` — légitime : un concept naissant n'a pas encore de
   frontière. `shared/` ne grossit que par **promotion** (un deuxième
   consommateur), jamais par création directe.
2. **Le signal, placé dans les rituels existants.** `/new-feature-hexa` force
   déjà la lecture du registre ; `/session-report` gagne la ligne « un
   préfixe/concept apparaît-il ≥ 3 fois ? » — la règle de trois, appliquée aux
   frontières.
3. **Le mécanisme pré-câblé** : règles Sheriff placeholder
   (`core/src/<feature>/{domain,application}`) dormantes dès maintenant — une
   extraction coûte un `git mv` de la tranche verticale (fichiers domain,
   *ses* use-cases, *ses* ports sortis de `ports.ts`), puis la gate énumère la
   frontière : chaque violation Sheriff est une décision — rejoindre le
   module, promouvoir en `shared/`, ou exception déclarée. Procédure Mikado :
   si résoudre une violation en soulève d'autres au-delà de ~2 niveaux,
   revert, extraire les prérequis d'abord. Contrôle de profondeur avant de
   clore (Ousterhout) : petite surface, grosse implémentation.
4. **Le ratchet** : les features n'importent pas la nursery (l'inverse est
   permis) — extraire ne peut qu'augmenter la structure.

Extractions candidates, dans l'ordre du DAG (dépendances d'abord) : `rhythm`,
`harmony`, `structure`, `loops`, `separation`, `project` ; promotions
`shared/` attendues : `median`, `nearest-time`, `timecode`. Les deux cycles
connus se réparent au passage : `sequenceAgreement` est promu comme algorithme
générique, `SEEK_STEP_SECONDS` rejoint le transport.

## Conséquences

- `ports.ts` cesse de pouvoir grossir en god-file : chaque extraction emporte
  ses ports (et, avec l'[ADR-0002](0002-contrats-de-ports-en-subpath-testing.md),
  ses contrats et ses fakes).
- La liste de violations de la gate devient l'instrument de découverte : un
  savoir mal placé surface le jour où il coûte deux minutes, pas au moment de
  l'archéologie.
- Un use-case qui traverse plusieurs features devient explicite : soit la
  preuve qu'elles n'en font qu'une, soit une composition déclarée
  (`detect-chords` traverse harmony+rhythm+structure et en serait une).
- Coût : un niveau d'imbrication de plus une fois les modules nés, et une
  liste d'exceptions depRules à tenir (une exception par semaine = frontière
  fausse).
- Le chantier est long (une extraction = une PR, intercalée avec le travail
  produit) ; entre-temps cet ADR et le plan sont la seule trace de la cible.

## Alternatives envisagées

- **Feature-first dès maintenant, en un chantier.** Renommer 60 fichiers et
  découper `ports.ts` en une PR : un conflit avec toute branche vivante, et
  des frontières décidées sur plan plutôt que découvertes par la gate.
  Rejeté ; l'extraction incrémentale converge vers le même état final.
- **Statu quo + documentation du DAG.** Loupe est précisément la preuve que ce
  que l'exemple ne modèle pas n'arrive pas : le DAG était réel, écrit nulle
  part, et deux cycles sont nés quand même. Rejeté.
- **Un outil de clustering qui propose les modules.** L'analyse est
  scriptable (`modules:hint` du template : clusters de préfixes + cohésion
  d'imports) et TS.5 l'embarque — mais en indice seulement ; nommer une
  frontière est un acte de domaine, jamais un verdict d'outil.
