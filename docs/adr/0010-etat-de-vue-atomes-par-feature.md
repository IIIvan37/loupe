# ADR 0010 — L'état de vue appartient à sa feature ; le shell compose, il ne détient pas

- **Statut** : accepté — **migration en feuilles Mikado** (`use-stem-stack` en
  feuille d'essai, gate vert entre chaque)
- **Date** : 2026-07-28

## Contexte

L'ADR du template « frontend-agnostic starter » pose qu'une UI est un adaptateur
comme un autre et que **« l'état de vue vit dans l'adaptateur »**. Loupe a
respecté cette règle à la lettre : `packages/web` est câblé dans Sheriff, ne
dépend que de `core:api`, et la direction des dépendances est verrouillée à
trois niveaux. Le gate est vert — `check:arch`, `check:react` (bloquant dès
warning), `check:design`, `check:dead`, `check:dup`.

Et pourtant la couche web a dérivé, parce que la règle ne dit pas **où**, dans
l'adaptateur, cet état vit. Mesuré sur `packages/web/src` :

- `ShellMainProps` porte **35 champs**. Sur 56 types `*Props`, 15 dépassent 10
  champs et 6 dépassent 15 — la médiane, elle, est à 5. C'est une traîne, pas
  une tendance générale.
- **29 props sont typées `ReturnType<typeof useX>`**, sur 13 hooks distincts. On
  ne passe pas des valeurs : on passe le sac entier retourné par un hook. Le
  couplage réel est un multiple des 35 champs, et Sheriff n'en voit rien — un
  import de type entre deux dossiers de `web` est parfaitement légal.
- `workstation-shell.tsx` appelle **24 hooks distincts**.
- **Aucun `createContext` dans tout le paquet.** Aucune bibliothèque d'état non
  plus. Les props sont le seul moyen de transport disponible.

La cause n'est pas une négligence de découpage : `app/` **est** déjà en tranches
par feature (`tempo`, `loops`, `markers`, `mixer`, `separation`, `lead-sheet`…),
exactement ce que [l'ADR 0005](0005-modules-emergents.md) prescrit. Le découpage
en dossiers a eu lieu ; le couplage est passé par l'autre canal.

L'origine se lit dans le graphe de dérivation entre hooks. Sur 47 hooks, en
écartant l'utilitaire `use-latest`, **8 hooks dérivent de l'état d'une autre
feature (16 arêtes)** — et **5 d'entre eux vivent dans `workstation-shell/`** :

| Hook de coordination | Lignes | Dérive de |
|---|---|---|
| `use-tempo-detection` | 181 | tempo, métronome, tap-tempo |
| `use-chart-with-structure` | 87 | chord-chart, structure |
| `use-separate-and-load` | 82 | tempo, mixer, séparation, métronome |
| `use-resume-gated-analysis` | 58 | tempo, séparation |
| `use-stem-stack` | 32 | mixer, séparation |

**440 lignes qui n'existent que pour câbler l'état d'une feature à celui d'une
autre, placées dans le shell parce que c'est le seul endroit qui possède les
deux.** Le shell n'est pas devenu gros par laisser-aller : il est devenu la
couche d'intégration de l'état inter-features, faute d'un mécanisme permettant à
une dérivation de vivre ailleurs. Les 24 hooks et les 35 props en découlent.

Le noyau de fait que personne n'a déclaré est visible lui aussi — `use-tempo` et
`use-separation` consommés chacun par 3 autres features, `use-mixer` et
`use-metronome` par 2. C'est le `beat-grid` de l'ADR 0005, transposé à l'UI.

Dernier élément, décisif : **loupe a déjà construit la moitié de la solution**.
`packages/web/src/lib/external-value.ts` est un store à sélecteurs de 40 lignes
bâti sur `useSyncExternalStore`, écrit pour que la position de lecture à 60 Hz
« coûte à un timecode exactement un rendu par seconde ». L'absence de contexte
n'est donc pas idéologique : le projet sait que le contexte re-rend tous ses
consommateurs et a construit l'abonnement sélectif pour son cas le plus exigeant.
Ce qui manque n'est pas le mécanisme, c'est sa généralisation — et la
**dérivation**, que `ExternalValue` ne sait pas faire.

## Décision

**Une feature possède son état et l'expose elle-même. Le shell compose, il ne
détient pas.** L'état de vue se range en trois étages, et le choix de l'étage
est explicite :

1. **Local au composant** — `useState`/`useReducer`, tant qu'un seul composant
   lit la valeur. Défaut ; on ne monte pas d'un étage par anticipation.
2. **Atome de feature (Jotai)** — dès qu'une seconde feature lit l'état, ou
   qu'une dérivation croise deux features. L'atome est déclaré **dans le dossier
   de la feature qui le possède**, jamais dans un fichier d'atomes central.
3. **Valeur externe** — `ExternalValue` reste pour ce qui change à la fréquence
   d'image (position de lecture, niveaux). Le graphe d'atomes ne descend pas là.

Les 5 hooks de coordination du shell deviennent des **atomes dérivés**, déclarés
chacun auprès de la feature dont ils relèvent, pas auprès du shell.

**Pourquoi Jotai plutôt qu'un contexte ou un store central.** Un contexte n'a pas
de sélecteur : toute écriture re-rend tous ses consommateurs, ce que le projet
refuse déjà pour le playhead. Un store central recréerait le god-file que
l'ADR 0005 diagnostique pour `ports.ts` — un `atoms.ts` de quarante entrées est
la même pathologie déplacée. Les atomes Jotai sont **décentralisés par
construction** : ils vivent auprès de leur feature, ce qui prolonge l'ADR 0005 au
lieu de le contredire, et ils composent (atomes dérivés), ce qui est précisément
ce qui manque à `ExternalValue`.

**Garde-fou, non négociable.** Un atome porte de l'**état de vue** et appelle des
use-cases du core. **Aucune logique de transition dans un write-atom.** Les
write-atoms peuvent contenir du code, et c'est le piège : une règle métier qui
migre là devient invisible à Sheriff, puisqu'un atome de `packages/web`
n'important rien du core est parfaitement légal. Ce serait la même classe de
dérive que celle qui a produit les 35 props — imports légaux, couplage invisible
— mais elle éroderait le core au lieu d'engraisser le shell, ce qui est un moins
bon marché. Les 5 hooks à migrer sont justement les plus chargés en logique :
c'est là que le risque est maximal.

**Invariants mécaniques**, ajoutés à `check:design` — le pendant de Sheriff pour
l'arbre de composition, que ni Sheriff ni react-doctor ne peuvent voir :

- aucune prop typée `ReturnType<typeof useX>` ;
- plafond de champs par type `*Props` ;
- plafond de hooks appelés par composant.

Les trois sont des cliquets : le seuil part au-dessus de l'existant et descend au
fil des migrations, comme le ratchet des docs.

**Migration en feuilles Mikado**, jamais en campagne : un hook de coordination
par étape, gate vert entre chaque. `use-stem-stack` (32 lignes, 2 dépendances)
est la feuille d'essai qui valide la forme avant d'engager les 440 lignes.

## Conséquences

Ce que ça achète :

- Les 440 lignes de câblage quittent le shell pour la feature concernée. Le shell
  redevient un composeur, et les props qui n'existaient que pour transporter
  l'état disparaissent avec.
- La dérivation croisée cesse d'être homeless : `use-resume-gated-analysis`
  devient un atome dérivé déclaré dans `app/analyser/`, plutôt qu'un hook de
  shell qui reçoit deux sacs en paramètres.
- L'abonnement devient sélectif partout, pas seulement sur le playhead.
- Les trois invariants attrapent mécaniquement une régression que cinq outils
  laissent aujourd'hui passer.

Ce que ça coûte, et il faut l'assumer :

- **Une dépendance runtime** de plus dans l'adaptateur, à auditer et à maintenir.
- **La migration des tests.** Les atomes demandent un store dans les tests ; le
  shell a à lui seul 13 fichiers de spec, dans un projet TDD-strict. C'est le
  poste le plus lourd, et il est étalé sur les feuilles Mikado.
- **Deux mécanismes d'état partagé coexistent** — atomes et `ExternalValue`. La
  frontière (fréquence d'image) doit rester explicite, sinon elle s'efface et
  l'un des deux absorbe l'autre par commodité.
- **Le garde-fou anti-érosion repose sur la revue**, pas sur un outil. C'est la
  faiblesse connue de cette décision : rien ne détecte automatiquement une règle
  métier tombée dans un write-atom.
- Jotai n'est pas le remède : la doctrine l'est. Adopter la bibliothèque sans les
  trois étages ni les invariants donnerait un `atoms.ts` central, c'est-à-dire le
  god-file déplacé.

## Alternatives envisagées

- **Généraliser `ExternalValue`.** Séduisant : le primitif existe, il est testé,
  il est à nous, zéro dépendance. Rejeté parce qu'il n'a pas de dérivation — les
  440 lignes de câblage devraient être réécrites à la main, ce qui est
  exactement le travail qu'on cherche à supprimer. C'est la mesure des 16 arêtes
  de dérivation croisée qui a tranché.
- **Un contexte par feature.** Décentralisé, sans dépendance. Rejeté : pas de
  sélecteur, donc toute écriture re-rend tous les consommateurs — le projet a
  déjà refusé ce compromis en écrivant `ExternalValue`.
- **Un store central (Redux Toolkit, Zustand).** Rejeté : recrée le god-file que
  l'ADR 0005 diagnostique, et la centralisation est précisément la pathologie
  qu'on soigne.
- **Statu quo, discipliné par la revue.** Rejeté par l'évidence : la couche web a
  un skill dédié et deux gates bloquants, et rien n'a signalé les 35 props ni le
  shell à 24 hooks. Ces outils vérifient des règles ; ce qui manque est une
  décision de placement, qu'aucun linter n'exprime.
- **Porter la doctrine dans le template plutôt qu'ici.** Rejeté : le template est
  volontairement frontend-agnostic et laisse la spécialisation au projet
  consommateur. Le choix d'une bibliothèque d'état relève de loupe.
