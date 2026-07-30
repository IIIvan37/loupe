# Session — 2026-07-29 — mint single-flight + génération (revue d'architecture, correctif 1)

## Done

- **Revue d'architecture externe** (demandée par Ivan) : verdict — la
  trajectoire ADR 0010/0011 est la bonne, pas de redesign ; 5 constats, dont
  2 « élevés » nouveaux, vérifiés sur pièces avant d'agir. Séquencement acté :
  (1) mint single-flight, (2) abort au démontage de `useSeparation`, (3) clé
  de voûte 0011, (4) ADR graphe de modules web + tags Sheriff (après la clé de
  voûte), (5) interface étroite de session (DIP) en feuille du chantier.
- **Correctif 1 livré** (branche `fix/analysis-token-single-flight`, PR #293) :
  `ensureAnalysisToken` protégé contre la concurrence —
  - **single-flight** : un gate arrivant pendant un mint en vol rejoint la
    même promesse au lieu de dépenser une **seconde unité de quota** (scénario
    réel : tempo + accords/structure/séparation gatent au même import) ;
  - **génération** : `clearAnalysisToken()` (sign-out) incrémente une
    génération et oublie l'in-flight ; un mint parti avant le clear résout en
    `{ ok: false, reason: 'sign-in-required' }` et **ne repeuple pas le
    cache** ; un nouvel ensure post-clear repart sur un mint frais.
- 3 tests ajoutés (rouges d'abord) dans `analysis-token.spec.ts` : concurrence
  (1 seul mint), sign-out en vol (refus typé, cache vide), re-mint frais
  post-clear. Helper `deferredAuth` (résout **tous** les mints en attente).

## Not done / remaining

- Correctif 2 (abort au démontage de `useSeparation` + test d'unmount) : PR
  séparée, juste après.
- Constats 3–5 de la revue : portés par le séquencement ci-dessus (clé de
  voûte, ADR graphe web, DIP session) — rien d'autre à faire ici.

## Decisions

- **Un mint superseded par un sign-out répond `sign-in-required`** : le jeton
  appartient à la session fermée ; le run gaté ne doit ni le mettre en cache
  ni continuer avec. (Le quota server-side de ce mint est perdu — inévitable,
  le serveur avait déjà débité.)
- Les cycles de features relevés par la revue (mixer↔tempo, mixer↔waveform,
  audio↔auth) attendent l'ADR « graphe de modules web » — ne pas les casser
  au fil de l'eau, la direction de chaque arête est une décision d'ADR.

## Gate status

- typecheck : ✅ · biome/`check` : ✅ · sheriff `check:arch` : ✅ ·
  `check:design` : ✅ · `check:react` : ✅ · knip : ✅ · jscpd : ✅
- tests : ✅ (suite complète avec coverage via le hook pre-commit ;
  `analysis-token.spec.ts` 11/11 dont 3 nouveaux)
- mutation : **sans objet** — aucune source core touchée.

## State to resume from

- **Single next action** : correctif 2 — `useSeparation` doit aborter son
  contrôleur au démontage (le modèle est dans `use-tempo.ts`, effet de
  cleanup) + un test d'unmount ; PR courte, puis retour au séquencement
  (clé de voûte 0011).
- Gotchas :
  - `clearAnalysisToken()` a maintenant une sémantique élargie (cache +
    in-flight + génération) — tout futur appelant hérite des trois.
  - `deferredAuth` du spec résout tous les mints en attente d'un coup ;
    si un test a besoin de résoudre mint par mint, il faudra le raffiner.
