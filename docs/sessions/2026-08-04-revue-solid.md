# Session — 2026-08-04 — revue SOLID

Revue du **respect des principes SOLID** après le solde des chantiers « revue
justesse » (PRs #359–#363) et « texte-comme-modèle » (PRs #364–#366) — la
question posée : les corrections ont-elles laissé le projet dans un état
structurellement sain ?

**Méthode** : cinq enquêteurs indépendants et parallèles, un par principe
(S, O, L, I, D), calibrés pour du TypeScript fonctionnel idiomatique (un
switch exhaustif unique sur une union discriminée n'est PAS une violation
OCP ; SRP se juge au module/fonction ; LSP aux implémentations de ports et
aux fakes ; ISP aux ports et props ; DIP à l'intérieur de chaque package,
la frontière core/web étant machinale). Chaque constat est ensuite passé à
un **sceptique adversarial** chargé de le réfuter (lecture du code cité, des
ADR voisins, des consommateurs). 20 constats bruts → **14 réfutés,
6 confirmés** (2 medium, 4 low).

## Verdict d'ensemble

**Aucun constat SRP ni DIP n'a survécu.** Les 14 réfutations sont tombées
presque toutes sur le même motif : la « violation » était une décision
documentée à l'endroit de la tension — ADR 0012 pour tempo→mixer, le
docstring de `chord-chart.ts` sur les atomes privés partagés anti-drift,
le commentaire de trust-boundary du serveur co-embarqué (rust-embed) pour
le cast wire, les `Pick<ProjectSession, …>` déjà en place. Le système
« décision → ADR/commentaire au point de friction » fait exactement son
travail de défense en revue.

Ce qui reste est périphérique : des unions recopiées à la main (OCP), une
promesse de contrat non tenue (LSP), un sac non découpé (ISP).

## Backlog — 6 constats confirmés, solde en 3 PRs

### PR 1 — OCP : les unions recopiées

1. **[medium] Le jeu de codes d'échec transport est recopié sur ~10 sites.**
   `'engine-unavailable' | 'network' | 'timeout' | 'too-large'` est épelé
   dans les 4 unions d'erreur du core (`separation/domain/separation.ts:18`,
   `rhythm/application/detect-tempo.ts:37`, `application/detect-chords.ts:62`,
   `structure/application/detect-structure.ts:29`), re-épelé inline dans
   `ChordDetectionError`/`StructureDetectionError` (seul `detect-tempo`
   dérive via `Exclude`), redéclaré côté web (`post-wav-json.ts:32`) et
   répété dans les 4 Records de copy de `detection-copy.ts`. Le code
   auth/quota que le chantier offload-auth va introduire (anticipé par
   `post-wav-json.ts:75`) toucherait ~10 sites dans 6 fichiers.
   **Fix** : une union `AnalysisTransportErrorCode` dans le core, composée
   partout ; `Exclude<>` pour les classes ; alias côté web ; table de copy
   transport partagée, étalée dans chaque Record par flux.

2. **[low] `SeparationPhase` ré-énuméré à 3 endroits web**, dont
   `analyser-row.tsx:174` (`running` en disjonction positive) qui échouerait
   *en silence* sur une 4e phase — face idle pendant un run live.
   **Fix** : `Record<SeparationPhase, …>` importé du core (l'idiome des
   tables sœurs du même fichier) + `running` dérivé de la table.

3. **[low] `dispatch()` des raccourcis n'est pas vérifié en exhaustivité**
   (`use-keyboard-shortcuts.ts:71`, retour `void`) : un case oublié compile
   et le raccourci ne fait rien tout en figurant dans le dialogue d'aide
   (le switch jumeau `describeCommand` retourne `string`, donc lui est
   forcé). **Fix** : `command satisfies never` en default — la
   table-descripteur a été rejetée par le sceptique (indirection spéculative
   couplant les hints i18n aux actions).

### PR 2 — LSP : le contrat et les fakes

4. **[medium] Le contrat `ProjectStore` n'est plus rejoué contre
   l'adaptateur réel.** Le doc du contrat promet un replay « contre chaque
   implémentation » (ADR 0002) mais `projectStoreContract` ne tourne que
   contre le fake in-memory. Régression silencieuse : le replay existait
   contre l'adaptateur fs (session TS.4, « contrat ×2 ») et s'est perdu au
   pivot Tauri → HTTP (PR #275). Concrètement, « delete d'un id inconnu =
   no-op » ne tient que par idempotence accidentelle du serveur Rust —
   `ensureOk` jetterait sur un 404. **Fix** : rejouer le contrat dans
   `http-project-store.spec.ts` sur un stub fetch honorant le protocole.

5. **[low] `shell-test-kit` réécrit un `ProjectStore` à la main**
   (`shell-test-kit.tsx:141`) au lieu du `createInMemoryProjectStore`
   validé par contrat (jamais importé dans web), et son fake audio mint un
   ref *nouveau à chaque put* là où le contrat documente du
   content-addressing (« same bytes → same ref ») — la classe de bug
   PR #209 que l'ADR 0002 fence explicitement. **Fix** : importer le fake
   de référence ; ref stable par contenu pour le fake audio.

### PR 3 — ISP : le sac Mixer

6. **[low] Le sac `Mixer` (12 membres) traverse 6 hooks qui en consomment
   0 à 5** (`use-mixer.ts:36`). Trois hooks (`use-tempo-detection`,
   `use-run-tempo-detection`, `use-resume-gated-analysis`) le déclarent
   sans appeler *aucun* membre (pur forwarding) ; quatre specs fabriquent
   le fake 12 membres complet avec des stubs jamais appelés. Le pattern
   maison existe un cran plus bas : les 3 seams consommateurs découpés de
   `StemPlaybackEngine` dans `audio-session.ts`. **Fix** : le même
   découpage — des slices déclarées côté consommateur (métronome,
   separate-and-load, session projet), le `Mixer` concret les satisfait
   structurellement, les hooks de forwarding ne déclarent que la slice
   transmise.

## Backlog outillage — gardes-fous génériques (lot 4, après le solde)

Ce que la revue rend mécanisable, dans l'idiome maison (fitness function en
spec + cliquet, jamais de big-bang). Priorité aux n° 1 et n° 4 : chacun
aurait attrapé un constat **medium** de cette revue, et les deux sont des
specs d'une trentaine de lignes.

1. **[OCP] Spec « vocabulaire fermé »** : liste versionnée
   `{ jeu de littéraux → module propriétaire }`, grep des ré-épellations
   ailleurs — la généralisation du grep-ban `% 12` et de la liste fermée de
   la grammaire de ligne. Aurait attrapé le constat n° 1 (union transport).
2. **[OCP] Biome `useExhaustiveSwitchCases`** (nursery) : vérifier la
   disponibilité sur notre version et l'activer — le `satisfies never`
   devient mécanique au lieu de conventionnel (constat n° 3).
3. **[OCP] Cliquet disjonctions** : compte épinglé des
   `x === 'lit' || x === 'lit' || …` (≥ 3 littéraux d'une union) dans
   `packages/web` — le motif exact du `running` silencieux (constat n° 2).
4. **[LSP] Cliquet « contrat ×2 »** : pour chaque `*Contract` exporté d'un
   `*/testing/`, exiger ≥ 2 sites d'appel (fake de référence + au moins un
   adaptateur réel) — l'esprit de `public-surface.spec.ts` appliqué aux
   contrats ; la promesse de l'ADR 0002 devient exécutable. Aurait attrapé
   le constat n° 4 (replay perdu au pivot Tauri → HTTP, sans bruit).
5. **[LSP] Grep-spec « fakes convergés »** : interdire l'implémentation
   littérale d'un port qui possède un fake de référence hors de
   `*/testing/` (exemptions triées, style `sonar-project.properties`).
   Aurait attrapé le constat n° 5 (`fakeProjectStores`).
6. **[ISP] Spec « pas de méthode optionnelle dans un port » + cliquet sur
   le nombre de membres par interface de deps** — déjà proposé par la revue
   justesse, toujours pas posé.
7. **[ISP/altitude] `mutation:diff` étendu aux hooks `use-*.ts` de web** —
   le détecteur général du pass-through : un paramètre jamais déréférencé
   est une zone où tous les mutants survivent (constat n° 6) ; déjà au
   backlog revue justesse, re-confirmé ici.
8. **[SRP/DIP] Convention « pointeur ADR au point de friction », vérifiée**
   : chaque arbitrage structurel porte un commentaire `ADR NNNN`, et le
   link-checker des living docs vérifie que la cible existe. Ne PAS
   mécaniser le jugement lui-même — les 14 réfutations montrent que la
   décision consignée est la défense ; son absence, le prédicteur d'écart.
9. **[altitude, hérité revue justesse] Spec « actions câblées »** : chaque
   variante d'action d'un reducer exporté du core exige un site de dispatch
   dans `packages/web` (le `tick` mort échouerait) — repris ici pour que le
   lot 4 solde TOUT l'outillage en attente.
10. **[méta] Geler la revue en workflow nommé** (`.claude/workflows/` ou
   skill `/revue-solid`) : 5 enquêteurs calibrés FP + sceptiques
   adversariaux, rendement mesuré 70 % de réfutation — rejouable à chaque
   fin de chantier, pièce la plus portable vers le template starter.

## Leçon labo

La passe adversariale a un rendement de 70 % de réfutation — et chaque
réfutation cite la *décision consignée* qui neutralise l'accusation. La
leçon extractible : **un ADR ou un commentaire au point de friction est une
défense en revue au même titre qu'un test** ; son absence (les 6 confirmés
n'en avaient aucun) est le signal qui distingue la dette réelle du
faux positif.
