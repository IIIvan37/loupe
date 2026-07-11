# Session — 2026-07-11 — chord-detection-core (Lot C, slice core)

## Done
- **Port `ChordDetector`** (driven, mirroring `TempoDetector`) : PCM décodé →
  `DetectedChordSpan[]` **horodatés** (pas beat-sync), labels dans l'orthographe
  des tokens de grille (`Am`, jamais le mir `A:min` — la traduction est le
  contrat de l'adapter), `undefined` = silence/no-chord ; spans attendus
  ordonnés et non chevauchants (documenté sur le port).
- **Agrégation pure `chordLabelPerMeasure(spans, grid)`**
  (`domain/chord-detection.ts`) : la i-ᵉ mesure = i-ᵉ intervalle
  downbeat→downbeat (même projection que `measureIndexAt`, donc le surlignage
  lecture reste aligné) ; vote par label pondéré par durée tenue dans la barre,
  silence = candidat (une barre majoritairement non couverte reste vide,
  égalité → l'accord gagne, égalité entre accords → le premier rencontré) ;
  dernière barre = une longueur de barre musicale (le gap précédent), la
  détection au-delà de la grille est ignorée (la grille est la vérité
  structurelle) ; pickup avant le premier downbeat ignoré.
- **`renderChartSource(labels, barsPerRow)`** — placé dans `chord-chart.ts`
  **chez le propriétaire de la grammaire** (TOKEN partagé parser/transposer/
  printer) : lignes `| C | Am | F | G |`, mesure vide → `N.C.` (token inconnu
  → survit à la transposition), un label hors-grammaire (vide, espacé, `|`)
  est assaini en `N.C.` — sinon le compte de mesures ne survivrait pas à
  `parseChart` et tout le surlignage se décalerait ; largeur clampée ≥ 1
  (boucle infinie sinon) ; property test round-trip
  `parse(render(labels)).measures.length === labels.length` sur strings
  arbitraires.
- **Use-case `detectChords({audio, grid, barsPerRow}, {detector})`** →
  `{ ok, source }` : le brouillon est du **texte source de grille** (la vérité
  que le panel édite et que le manifest signe), pré-rempli puis corrigé par
  l'utilisateur. Garde applicative AVANT le port : grille sans downbeat
  refusée ; détection vide ou temps non finis (NaN d'un JSON malformé) →
  `Result` erreur, jamais un brouillon vide qui écraserait la grille.
  `barsPerRow` vient de l'appelant (le panel a un réglage 1–12 — pas de
  constante de présentation dans le core).
- Registre application (README) + `index.ts` mis à jour (`detectChords`,
  `ChordDetector`, `DetectedChordSpan`).
- **Revue interne (3 finders parallèles)** appliquée : label hors-grammaire
  assaini (bug réel : cellule vide ⇒ mesure avalée par `parseRow`), garde NaN,
  clamp barsPerRow, `renderChartSource` déplacé chez la grammaire,
  simplification `barEnds` (forme directe sans mutation), `sum()` fusionné
  dans la boucle d'overlap, `barsPerRow` paramètre au lieu de constante.

## Not done / remaining
- **Spike BTC (angle mort #2) — BLOQUÉ permission.** Le repo
  `jayg996/BTC-ISMIR19` est cloné dans le scratchpad, **poids bien fournis**
  (`test/btc_model.pt` maj-min + `btc_model_large_voca.pt`, ~33 Mo,
  `example.mp3` inclus) et le venv serveur (Py 3.14, torch 2.12, librosa 0.11)
  a tout ce qu'il faut ; un script d'inférence minimal sans mir_eval/
  pretty_midi est prêt (`spike_infer.py`). L'exécution a été refusée par le
  classifieur de permissions (code externe + `torch.load` pickle non sûr) —
  **l'utilisateur doit lancer/autoriser le spike** avant la slice serveur.
- Spike Demucs-prétraitement (angle mort #1) : dépend du spike BTC.
- Slice serveur `/chords` (BTC voca=False, fallback 503, tests torch-free) —
  après spike.
- Slice web : adapter `createHttpChordDetector` + bouton « Détecter les
  accords » dans le panel (pré-remplit le brouillon, gating santé serveur
  comme « Séparer »).

## Decisions
- **Le brouillon détecté est du texte source de grille**, pas un `ChordChart` :
  la source est la vérité persistée/éditée ; l'agrégation produit des labels
  par mesure, le rendu les imprime — l'éditeur du Lot A absorbe l'imprécision
  ACE, comme prévu au plan.
- **Le printer vit avec la grammaire** (`chord-chart.ts`) : parser, transposer
  et printer partagent TOKEN et ne peuvent plus dériver ; tout label qui n'est
  pas exactement un token s'imprime `N.C.`.
- **La grille est la vérité structurelle du temps** : dernière mesure = une
  longueur de barre (pas « jusqu'à la fin de la détection ») ; l'harmonie
  détectée au-delà est ignorée.
- Port sans `AbortSignal` ni progress pour l'instant (outside-in : sera ajouté
  quand la slice web le tirera, comme pour la séparation au Lot J.5).

## Gate status
- typecheck : ✅ (gate exit 0)
- tests (with coverage) : ✅ **906 tests** (+26), coverage web 96,3 % st.
- mutation (Stryker, local) : ✅ **95,19** global (seuil 80) ;
  `detect-chords.ts` **100**, `chord-chart.ts` 98,73, `chord-detection.ts`
  92,59 — les 5 survivants analysés un à un : mutants **équivalents**
  (gardes TS-narrowing dont la chute produit déjà `[]`/blanc sur le domaine
  valide ; séparateur de `join` sur tableau à 1 élément).
- biome / sheriff / knip / jscpd : ✅ (gate exit 0)

## State to resume from
- **Single next action** : ouvrir la PR de cette slice, puis **faire lancer le
  spike BTC par l'utilisateur** :
  `cd <scratchpad>/BTC-ISMIR19 && server/.venv/bin/python spike_infer.py`
  (mesurer temps CPU + qualité sur `example.mp3`, puis sur une piste réelle,
  puis mix harmonique Demucs vs mix complet = angle mort #1).
- Gotchas : le scratchpad est par-session — si le clone a disparu, re-cloner
  `jayg996/BTC-ISMIR19` (MIT, poids dans `test/`). Le contrat de labels du
  port (tokens de grille, `undefined` = silence, spans non chevauchants) est
  ce que `createHttpChordDetector` devra garantir en traduisant le mir de BTC
  (`C:min`→`Cm`, `N`/`X`→`undefined`).
