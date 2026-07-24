# ADR 0002 — Les obligations des ports vivent dans des contrats, servis par `@app/core/testing`

- **Statut** : accepté — en vigueur depuis le lot TS.4 (subpath + contrat
  `ProjectStore`) ; couverture des autres ports au fil des extractions TS.5
- **Date** : 2026-07-24 (adapté de l'ADR-0002 du template `hexagonal-tdd-starter`)

## Contexte

La promesse centrale de l'hexagone est la **substituabilité des adapters** : le
core ne sait pas quel `StructureDetector` ou quel `ProjectStore` il a reçu.
Chez loupe cette promesse n'est pas théorique, elle est le mécanisme même de la
migration client léger : structure, tempo, accords et séparation ont chacun eu
plusieurs implémentations successives (serveur local → Modal), et le
[plan client léger](../client-leger-plan.md) pose en invariant que « le core ne
bouge pas — toute la migration est un jeu d'adapters derrière les ports
existants ».

Or rien ne teste cette promesse. `ports.ts` expose ~24 interfaces ; chaque spec
de use-case fabrique son fake à la main, chaque spec d'adapter affirme ses
attentes ad hoc — la même obligation est réécrite, différemment, à plusieurs
endroits, et deux implémentations d'un même port ne sont jamais tenues à la
même barre. Le coût est documenté :
[PR #209](../sessions/2026-07-18-stem-ids-french-fix.md) — des fakes aux ids de
stems anglais, là où le contrat réel (le manifest serveur) est en français, ont
laissé deux features no-oper silencieusement sur toute vraie séparation, specs
vertes.

Un test unitaire d'un adapter prouve que *cet* adapter se comporte. Il ne peut
pas prouver la substituabilité, qui est une propriété de l'*ensemble* des
implémentations.

## Décision

Écrire les obligations de chaque port **une fois**, comme une suite
réutilisable paramétrée par une factory, et la rejouer contre chaque
implémentation — fakes de test compris. Les valeurs portées par les contrats
sont celles du contrat réel (ids français des stems, formats effectifs), jamais
des placeholders.

Les contrats et les fakes in-memory de référence vivent dans
`packages/core/src/testing`, exposés par le subpath `@app/core/testing` —
délibérément **hors** de `src/index.ts` : un fake ne doit pas pouvoir entrer
dans la surface de production. L'étanchéité est outillée (tag Sheriff
`core:testing` inatteignable depuis les couches de production, override Biome
pour les adapters).

Mise en œuvre incrémentale :

- **Lot TS.4** : le subpath, le câblage (exports, paths, Sheriff, Biome) et un
  **premier** contrat + fake sur un port simple, pour valider la mécanique.
- **Lot TS.5** : chaque extraction de module emporte *ses* ports, *ses*
  contrats et *ses* fakes — les ~24 ports sont couverts progressivement, pas
  en big bang.

## Conséquences

- Ajouter un adapter (le prochain swap Modal, un store Tauri FS) = appeler le
  contrat existant, pas réinventer des tests de port.
- Les fakes hand-rollés des specs convergent vers les fakes de référence — la
  classe de bugs du PR #209 (fake divergent du contrat réel) perd son terrain.
- Ce coin du core dépendra de vitest : une verrue réelle, acceptée comme dans
  le template parce qu'un quatrième package coûterait plus qu'il ne rapporte.
- Les contrats doivent rester minimaux : tout ce qui est spécifique à un
  adapter (parsing HTTP, formats de fichiers) reste dans la spec de cet
  adapter. Un contrat qui grossit d'assertions d'adapter cesse d'être un
  contrat.

## Alternatives envisagées

- **Un package `@app/testing` séparé.** Dépendances plus propres, pas de
  vitest dans le core. Rejeté pour l'instant : de la cérémonie pour quelques
  fakes ; à revisiter si la surface de test grossit.
- **Continuer les fakes ad hoc par spec.** C'est l'état actuel, et le PR #209
  est la démonstration de sa dérive garantie.
- **Exporter les contrats depuis `src/index.ts`.** Câblage plus simple, mais
  met les fakes sur la surface de production — exactement ce que la décision
  empêche.
