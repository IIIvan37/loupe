# ADR 0001 — Livrer les sources TypeScript, sans étape de build pour le core

- **Statut** : accepté
- **Date** : 2026-07-24 (adapté de l'ADR-0001 du template `hexagonal-tdd-starter`)

## Contexte

`@app/core` n'a pas d'étape de build : son `package.json` exporte directement
`./src/index.ts`, et les consommateurs (Vite pour `@app/web`, vitest pour les
specs, de futurs scripts Node) transpilent ou *strippent* les sources
eux-mêmes. Il n'y a ni `dist/`, ni artefact à garder synchronisé avec ce qui
est testé.

Ce montage ne tient que si les sources restent dans le **sous-ensemble
strip-only** de TypeScript — celui où retirer les annotations suffit à obtenir
du JavaScript valide. Les constructions qui *émettent du code* (parameter
properties, `enum`, `namespace`, décorateurs) le cassent : le template en a
fait l'expérience — une parameter property a rendu son binaire inutilisable
sous le type stripping de Node pendant que tous les checks restaient verts.

Chez loupe rien ne verrouillait ce sous-ensemble : les sources s'y conforment
(vérifié — aucun `enum`, `namespace`, parameter property ni décorateur dans
`packages/core` ni `packages/web`), mais par discipline, pas par contrainte.

## Décision

Garder le montage sans build et traiter le **sous-ensemble strip-only comme un
invariant** : pas de parameter properties, d'`enum`, de `namespace` ni de
décorateurs dans les sources livrées.

Le verrou mécanique est le flag compilateur `erasableSyntaxOnly`, qui arrive
par le lot TS.1 du [plan de resynchronisation](../template-sync-plan.md) : une
construction non effaçable devient une erreur `tsc`, donc un échec de
`pnpm gate` dès le typecheck.

## Conséquences

- Pas de build, pas de `dist/`, aucun écart possible entre ce qui est testé et
  ce qui tourne.
- Les sources du core restent exécutables par tout consommateur strip-only :
  le type stripping de Node pour un script, `tsx`, un futur sidecar — sans
  chaîne de build supplémentaire.
- La contrainte coûte peu : le sous-ensemble interdit recouvre des
  constructions déjà évitées en TypeScript moderne (les unions taguées et
  `as const` remplacent `enum` ; les champs explicites remplacent les
  parameter properties).
- Tant que TS.1 n'a pas posé le flag, l'invariant ne tient que par revue — le
  poser est la première brique du lot, pas une option.

## Alternatives envisagées

- **Une vraie étape de build** (`tsc` → `dist/`, exports pointant sur la
  sortie). Lève entièrement la contrainte de syntaxe — et ajoute un build à la
  gate, un artefact à synchroniser, et la classe de bugs « marche en dev,
  cassé en dist ». Rejeté : loupe ne publie pas `@app/core` sur npm ; à
  revisiter si ça change.
- **S'appuyer sur la discipline et la revue.** C'est l'état d'avant : la
  conformité était vraie mais invérifiée. Une contrainte invisible dans le
  système de types finit toujours par être violée par accident. Rejeté au
  profit du flag compilateur.
