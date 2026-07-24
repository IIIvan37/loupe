# ADR 0003 — L'état ambiant (temps, ids) entre dans le core en valeurs, jamais en globaux

- **Statut** : accepté (c'est la pratique en vigueur ; cet ADR l'acte)
- **Date** : 2026-07-24 (adapté de l'ADR-0003 du template `hexagonal-tdd-starter`)

## Contexte

L'invariant n° 1 du dépôt (« pure, agnostic core ») interdit l'I/O dans le
hexagone. Mais l'impureté qui mord au quotidien n'est pas le réseau ou le
filesystem — c'est le **non-déterminisme** : `Date.now()`, `Math.random()`,
`crypto.randomUUID()`. Un domaine qui lit l'horloge devient silencieusement
intestable, et une règle sur les noms de globaux ne peut structurellement pas
l'exprimer (`Math` est légitime, `Math.random()` ne l'est pas).

## Décision

Traiter l'état ambiant — temps, aléa, identifiants — comme de l'I/O : il est
résolu **à la frontière** par l'adapter, et entre dans le core sous forme de
valeur ou de port. C'est déjà la pratique de loupe, dont voici les exemples
canoniques :

- **Le temps et les ids en valeurs d'entrée.** Le domaine projet reçoit un
  `stamp` (`{ id, now }`) : `createdAt`/`updatedAt` dérivent de `stamp.now`
  ([project.ts](../../packages/core/src/domain/project.ts),
  [projects.ts](../../packages/core/src/application/projects.ts)) ;
  `renameProject` reçoit `now: number`. C'est l'adapter web qui appelle
  `Date.now()` et `crypto.randomUUID()`
  ([use-projects.ts](../../packages/web/src/projects/use-projects.ts),
  [use-markers.ts](../../packages/web/src/app/markers/use-markers.ts)).
- **L'horloge de lecture derrière un port.** Le core est « timer-free » : la
  position de lecture *streame* depuis l'adapter via
  `PlaybackEngine.onPositionChange`
  ([ports.ts](../../packages/core/src/application/ports.ts)) — le core ne
  consulte jamais une horloge, il reçoit des instants.

Vérifié à la rédaction : **zéro** occurrence de `Date.now`, `Math.random`,
`performance.now` ou `crypto.*` dans `packages/core/src` hors specs.

L'application est outillée en couches, comme dans le template :

| Couche | Attrape |
|---|---|
| Sheriff | le graphe de modules (adapters → core seulement) |
| Biome `noRestrictedGlobals` / `noRestrictedImports` | les globaux et imports interdits dans `packages/core` |
| Spec de pureté (lexicale) — **arrive au lot TS.2** | les expressions membres que les deux autres ne voient pas (`Math.random()`, `Date.now()`) |

## Conséquences

- Les tests épinglent le temps en passant des valeurs (`stamp.now`), au lieu
  d'espérer que la CI tourne le bon jour.
- Chaque nouvelle source d'état ambiant (timers, env, locale) demande le même
  geste : la résoudre dans l'adapter, la passer en valeur ou derrière un port.
  La liste des règles suivra toujours légèrement la réalité.
- Tant que TS.2 n'a pas posé la spec de pureté, la troisième couche manque :
  un `Date.now()` glissé dans le core passerait Biome si `Date` n'est pas
  listé. La pratique tient aujourd'hui aux deux premières couches et à la
  revue.
- Passer `now` en valeur (plutôt qu'un port `Clock`) est le choix le plus
  simple qui marche pour des use-cases ponctuels ; si un besoin de temps
  *continu* apparaissait côté core, il prendrait la forme d'un port, comme la
  position de lecture.

## Alternatives envisagées

- **Biome seul.** Ne peut pas exprimer `Math.random()` (expression membre d'un
  global légitime). Insuffisant.
- **Un port `Clock` systématique.** Plus de cérémonie que de bénéfice quand
  tous les besoins actuels sont ponctuels : une valeur en entrée est plus
  simple à tester qu'un port à injecter. Le port reste la forme prescrite pour
  du temps continu.
- **Faire confiance à la revue.** C'est la classe d'erreur que la revue rate,
  parce que `Date.now()` a l'air anodin sur son site d'appel.
