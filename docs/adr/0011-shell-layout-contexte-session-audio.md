# ADR 0011 — Le shell est un layout ; le moteur audio et les ports vivent dans un contexte de session, pas dans le shell

- **Statut** : accepté — **cap ; implémenté en feuilles Mikado après [ADR 0010](0010-etat-de-vue-atomes-par-feature.md)**
- **Date** : 2026-07-29

## Contexte

L'[ADR 0010](0010-etat-de-vue-atomes-par-feature.md) a posé que l'état de vue
appartient à sa feature (atomes Jotai décentralisés), le shell composant sans
détenir. Il laisse une question ouverte, décisive pour savoir *quand la
migration est finie* : **si chaque feature possède son état, que reste-t-il
légitimement au shell ?** Sans réponse, chaque feuille risque de pousser du code
vers le shell « en attendant », ou d'y buter sans le voir.

Mesuré sur `packages/web/src/app/workstation-shell/workstation-shell.tsx` (à la
feuille 2 de 0010) : le composant appelle **~26 hooks** et thread **35 props** à
`ShellMain`. En triant ces hooks par nature, ils tombent en **trois seaux**, et
le seau décide de la destination :

1. **État de vue d'une feature** — `useMarkers`, `useMixer` (via `useStemStack`),
   `useTempo`, `useLoops`, `useLoopEditing`, `useViewport`, `useMetronome`,
   `useAnalysisFold`, la paire chart↔structure. C'est ce que 0010 évacue vers des
   atomes ; la région qui l'affiche le lira elle-même.

2. **Singletons partagés** — `stemPlayback` (le moteur de lecture des stems) est
   créé **une seule fois** et partagé par `usePlayer` (transport), le mixer et la
   séparation. Et `player` est consommé par **deux régions** : `ShellMain`
   (waveform) *et* `ShellFooter` (barre transport). Les ports (`decoder`,
   `engine`, `separator`, les détecteurs tempo/accords/structure, `projectStores`)
   arrivent en **props** — injectés en test, réels par défaut.

3. **Orchestrateurs transverses** — `useProjectSession` dérive de *tout* (save/
   restore sur tempo, mixer, loops, markers, viewport, chart…), `useShellShortcuts`
   est un dispatcher clavier sur *toutes* les features, `useShellDrop` + `QuitGuard`
   sont le cycle de vie de l'appli.

L'intuition « le shell = un layout, chaque composant smart à son propre niveau »
est **juste pour le seau 1** — et c'est le terminus de 0010. Mais elle bute sur
le **seau 2** : si `ShellMain` et `ShellFooter` appelaient chacun `usePlayer`,
on obtiendrait **deux players pilotant deux moteurs**. Un singleton ne peut pas
être « possédé » par une région — il n'a qu'un exemplaire, et deux consommateurs.

0010 a écarté le contexte **pour l'état de vue** : pas de sélecteur, donc toute
écriture re-rend tous les consommateurs (le projet a refusé ce compromis en
écrivant `ExternalValue`). Cet argument **ne s'applique pas** au moteur ni aux
ports : ce sont des **références stables**, posées une fois au montage, jamais
réécrites. Un contexte qui ne change jamais ne re-rend personne — c'est un
conteneur d'injection, pas de l'état réactif.

## Décision

**Trois seaux, trois destinations, tri explicite.**

1. **État de vue → atome de feature** (ADR 0010), lu par la région qui l'affiche.

2. **Moteur audio + ports → un contexte de session audio** (`AudioSessionProvider`),
   posé au sommet, de référence stable. Une région lit `useAudioSession()` pour
   **atteindre** le player/moteur/ports — jamais pour en **créer** un. Les tests
   montent `<AudioSessionProvider value={fakes}>` au lieu de threader dix ports
   positionnels : le point d'injection devient uniforme.

3. **Orchestrateurs transverses → restent au sommet** (ils voient toutes les
   features), mais lisent des **atomes** au lieu de recevoir des sacs de hooks.
   Les cinq hooks de coordination de 0010 deviennent des atomes dérivés dans leur
   feature ; ceux qui sont vraiment app-level (session, raccourcis, drop) restent
   des hooks du shell.

Le shell résultant est un **layout mince** (`<ShellHeader/> <ShellMain/>
<ShellFooter/>`) plus une poignée de concerns app-level, sous
`<AudioSessionProvider>`. `ShellMainProps` fond, les `ReturnType<typeof useX>`
disparaissent, `MAX_HOOKS_PER_COMPONENT` tombe — les trois cliquets de 0010
encodent déjà ce cap (`ReturnType` → 0).

**Garde-fou, non négociable.** Le contexte de session ne porte **que des
singletons stables** (moteur, ports, éventuellement le player comme référence).
**Jamais d'état de vue.** Dès qu'une valeur change à l'usage, elle est un atome
de feature, pas une entrée du contexte — sinon on recrée le god-file que
[l'ADR 0005](0005-modules-emergents.md) diagnostique et que 0010 soigne, déplacé
dans un Provider, avec le re-rendu global en prime. La frontière est mécanique :
**le contexte est posé une fois et ne se réécrit pas ; un atome se réécrit.**

## Conséquences

Ce que ça achète :

- Les régions deviennent smart **indépendamment** : `ShellMain` appelle
  `useMixer`/`useTempo`/`useMarkers` (atomes) + `useAudioSession` (moteur), sans
  recevoir 35 props. C'est l'intuition « chaque composant smart à son niveau »,
  enfin atteignable.
- Le shell cesse d'être la **couche d'intégration** de l'état inter-features : il
  redevient layout + app-level, rien d'autre.
- Les ports **sortent des props** — un seul point d'injection (le Provider), en
  test comme en prod.

Ce que ça coûte, et il faut l'assumer :

- **Un contexte de plus**, à auditer pour qu'il ne porte que du stable. Le risque
  est la commodité : « juste une valeur qui change » rangée dans le Provider. Le
  garde-fou repose sur la **revue** (comme l'anti-érosion de 0010) — aucun outil
  ne détecte un champ réactif tombé dans un contexte.
- **Le player est un cas limite** : il expose du 60 Hz (`ExternalValue`) *et* une
  API impérative *et* des singletons. Il vit dans le contexte **comme référence**,
  mais ses valeurs frame-rate restent des `ExternalValue`. Deux mécanismes
  cohabitent sur le même objet ; la frontière (référence stable vs valeur
  frame-rate) doit rester explicite.
- **Migration des tests** : le montage du shell passe par le Provider de session ;
  les ~13 specs shell et celles qui injectent des ports changent de forme. Étalé
  sur les feuilles, comme la migration des atomes.
- **La clé de voûte doit venir tôt.** Tant que le moteur + les ports ne sont pas
  dans le contexte, aucune région ne peut appeler `usePlayer` sans dédoubler le
  moteur : les feuilles d'état seules **ne videront jamais** le shell. C'est le
  travail structurant que 0010 ne pouvait pas nommer sans cette mesure.

## Alternatives envisagées

- **Tout en atomes, moteur inclus.** Rejeté : le moteur est un objet impératif
  qui émet du 60 Hz (`ExternalValue`), pas de l'état sérialisable. Le mettre dans
  un atome force à réveiller ses consommateurs à la fréquence d'image —
  exactement ce que `ExternalValue` a été écrit pour éviter (cf. 0010).
- **Garder les ports en props (statu quo).** Rejeté : c'est la source du
  threading. Tant que `ShellMain` reçoit les ports pour les passer à `usePlayer`,
  il ne peut pas appeler `usePlayer` lui-même — le prop-drilling des ports bloque
  l'autonomie des régions.
- **Un god-context unique (moteur + ports + tout l'état).** Rejeté : recrée le
  god-file de l'ADR 0005 dans un Provider, et re-rend tous les consommateurs à
  chaque écriture — la pathologie même que 0010 soigne. Le contexte est réservé
  aux singletons stables ; l'état de vue reste décentralisé en atomes.
- **Laisser le shell tel quel, discipliné par la revue.** Rejeté par l'évidence :
  26 hooks, 35 props, et les trois cliquets ont dû être posés précisément parce
  que la revue seule n'a pas tenu la ligne.
