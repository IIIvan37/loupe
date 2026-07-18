# Session — 2026-07-18 — chords-on-stems-4a

Point 4/6 du lot pré-beta, slice **4a** (cadrage validé : « les deux » —
mix sans batterie pour BTC **et** basse → slash chords —, séparation
**implicite**). Cette slice livre le mix sans batterie ; **4b** (slash
chords depuis le stem de basse) reste à faire.

## Done

- **Choix d'implémentation clé** : tout côté client — les stems décodés
  existent déjà après séparation, le mix sans batterie se construit en core
  pur et part vers `/chords` par le pipeline d'upload existant (mono 24 kHz
  V.1). **Zéro changement serveur, zéro redéploiement Modal.**
- **Core TDD** : `monoMixWithout(stems, excludedId)`
  (`domain/analysis-mix.ts`) — downmix mono par stem, somme, padding au plus
  long, `undefined` quand rien ne reste. Type structurel local (le domaine
  n'importe pas `DecodedAudio` de l'application — dépendance interdite).
- **Hook** : `useChordDetection` gagne `stems` (session déjà séparée) et
  `ensureStems` (séparation implicite) ; l'audio d'analyse devient le mix
  moins `'drums'` quand des stems existent, sinon le mix complet. Garde de
  ticket pendant l'attente de séparation (cancel/nouveau run/swap de piste).
  Échec/annulation de la séparation → repli mix complet, jamais bloquant.
- **Shell** : `useSeparateAndLoad` résout désormais les `sources` isolées
  (le mixer reste câblé au passage) ; `useChartWithStructure` reçoit
  `separation` + `separateAndLoad` et construit stems/ensureStems —
  déclarations `metronome`/`separateAndLoad` remontées avant le bloc chart
  (budget react-doctor no-giant-component : le calcul vit dans le hook, pas
  dans le composant à 300 lignes pile).
- Specs : 3 cas hook (stems → le détecteur entend le mix sans batterie ;
  sans stems → `ensureStems` appelé puis son mix entendu ; séparation vide →
  repli mix complet) ; la spec structure shell épingle `failingSeparator`
  (sinon la séparation implicite réussit sur les stems FAKES du kit et la
  clé détectée lit leur signal, pas la piste).

## Not done / remaining

- **4b — slash chords depuis le stem de basse** (dernier morceau du lot
  pré-beta) : extraire la note de basse par mesure du stem `bass` décodé
  (chroma bas de bande par fenêtres, core pur — pas de nouvel endpoint),
  puis réécrire les cellules `C` → `C/E` quand la basse stable diffère de la
  fondamentale. Checkpoint d'approche à faire avant de coder.
- Browser-verify réel du flux implicite (Modal, ~70 s) non fait cette
  session — à faire avant la beta (le flux opportuniste est couvert par les
  specs shell, l'implicite par les specs hook).

## Decisions

- Mix d'analyse construit côté client (stems déjà là) — pas de nouveau
  contrat serveur.
- La séparation implicite est best-effort : son échec ne bloque jamais la
  détection (repli mix complet), sa narration reste celle de l'item
  Séparer de l'AnalyserRow.

## Gate status

- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor :
  verts (`pnpm gate` exit 0) — react-doctor avait flaggé no-giant-component
  sur le shell, résolu par déplacement du calcul dans le hook.
- tests (with coverage) : vert — **1877 tests** (+6), seuils core tenus.
- mutation (Stryker, core touché) : `analysis-mix.ts` **95,83 %** (1
  survivant équivalent : borne de boucle `<=`, lecture hors-borne absorbée
  par `?? 0` — ajout de 0) — global **91,73 %** (break 90).

## State to resume from

- **Single next action** : ouvrir la PR de `feat/chords-on-stems`, puis 4b
  (checkpoint d'approche : fenêtres du stem bass par mesure → classe
  dominante < ~250 Hz → slash si ≠ fondamentale et stable sur la mesure).
- Gotchas : le kit shell a un separator par défaut qui RÉUSSIT (2 stems
  fakes) — toute spec shell qui détecte des accords et épingle la clé doit
  passer `failingSeparator` ou assumer le mix des fakes. `useSeparateAndLoad`
  retourne maintenant une promesse de sources (les anciens appels void
  marchent tels quels).
