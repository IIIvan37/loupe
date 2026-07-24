# ADR 0004 — Les échecs attendus sont des valeurs taguées ; les bugs crashent

- **Statut** : accepté — **migration au fil de l'eau** (la pratique actuelle
  n'est pas conforme, l'écart est décrit ci-dessous)
- **Date** : 2026-07-24 (adapté de l'ADR-0004 du template `hexagonal-tdd-starter`)

## Contexte

La doctrine du template : un échec *attendu* (entrée invalide, store
inaccessible) est une **valeur taguée** dans la signature
(`Result<T, E>` avec `E` union fermée de tags) ; un *bug* n'est pas attrapé et
crashe fort. Trois raisons : un tag donne au caller de quoi brancher (un
`error: string` non), une exhaustivité `never` casse le build quand un cas
apparaît, et un `try/catch` large déguise les `TypeError` en échecs polis.

**La pratique réelle de loupe, relevée à la rédaction, mélange trois styles :**

1. **Unions `{ ok, error: string }`** dans
   [projects.ts](../../packages/core/src/application/projects.ts)
   (`saveProject`, `listProjects`, `loadProject`) — la bonne *forme* (l'échec
   est dans la signature), mais `error` est une phrase, pas un tag : l'UI ne
   peut que l'afficher, jamais brancher. Et le `catch (e)` de clôture mappe
   *tout* — y compris un bug — vers `{ ok: false }`.
2. **Classes d'erreur jetées** par les use-cases de détection :
   `TempoDetectionError`, `ChordDetectionError`, `SeparationError`,
   `StructureDetectionError` (chacune `extends Error`). L'échec est hors
   signature ; le tri repose sur `instanceof`, fragile à travers une frontière
   de package.
3. **`throw new Error('…')` dans le domaine** — pour des violations de
   contrat de programmation (`downmix`, `waveform`, `track` : là, crasher est
   correct) mais aussi pour de l'entrée non fiable
   ([wav-decoder.ts](../../packages/core/src/domain/wav-decoder.ts) : « not a
   WAV stream » est un échec attendu d'un fichier utilisateur, pas un bug).

## Décision

Adopter la doctrine, sans big bang :

- **Cible.** Échec attendu ⇒ `Result<T, E>` avec `E` union fermée de tags
  (`{ kind: '…' }`), jamais une phrase ; wording et présentation décidés par
  l'adapter (chez loupe : une clé Lingui par tag, exhaustivité vérifiée par
  `never`). `try/catch` uniquement autour d'un appel de port, mappé vers son
  tag ; tout le reste propage — un bug doit crasher, pas devenir un
  `{ ok: false }`.
- **Le type `Result` partagé arrive au lot TS.2** du
  [plan de resynchronisation](../template-sync-plan.md).
- **Migration au fil de l'eau** : tout nouveau code applique la cible ; le
  code existant migre quand on le touche pour une autre raison, en commençant
  par ce qui rapporte — remplacer `error: string` par des tags dans
  `projects.ts` (et resserrer son `catch` sur les seuls appels de ports),
  taguer les erreurs de détection, faire de `wav-decoder` un parseur qui
  retourne un `Result`. Pas de campagne dédiée : une signature d'erreur se
  migre quand son use-case bouge.

## Conséquences

- Deux styles coexisteront un temps ; cet ADR est la boussole qui dit lequel
  est le legacy. Le critère en revue : du code *nouveau* qui jette une classe
  d'erreur pour un échec attendu, ou qui retourne `error: string`, est à
  corriger avant merge.
- Ajouter un tag cassera le build à chaque site d'affichage jusqu'à ce qu'il
  soit traité — c'est le bénéfice, et c'est plus de cérémonie que `throw` :
  chaque site d'appel déballe un `Result`.
- Le `catch` large de `saveProject` reste, jusqu'à sa migration, un endroit où
  un bug peut se déguiser en échec métier — connu, borné, tracé ici.

## Alternatives envisagées

- **Déclarer la pratique actuelle conforme.** Faux : rien ne distingue un
  `TypeError` d'un disque plein dans `saveProject`, et aucun caller ne peut
  brancher sur un `error: string`. Un ADR qui l'aurait maquillé n'aurait pas
  survécu à sa première lecture utile.
- **Big-bang de migration.** Toucher 4 use-cases de détection, le domaine WAV
  et tout le flux projets d'un coup, sans besoin produit — du risque pur pour
  du beau. Rejeté au profit du fil de l'eau.
- **Garder les classes d'erreur mais les typer mieux.** L'échec reste hors
  signature et le tri reste `instanceof` ; c'est le problème, pas la solution.
- **Une bibliothèque `Result` (neverthrow, fp-ts).** Comme le template :
  ~30 lignes maison suffisent et se lisent de bout en bout ; à revisiter si
  des chaînes `map`/`andThen` apparaissent.
