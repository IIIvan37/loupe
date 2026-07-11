# Feuille de route — excellence, 3ᵉ passe

> **But.** Issue de l'évaluation notée du **2026-07-11** (six axes : fonctionnalités,
> ergonomie, esthétique, qualité de code, sécurité, **performance** — nouvel axe),
> menée après clôture du plan chord-charts (Lots A–C, PRs #77–#88) et de la
> [deuxième feuille de route](roadmap-excellence-2.md) (Lots F–J ✅). Revue
> multi-agents : 6 reviewers d'axe + 2 enquêtes ciblées sur les problèmes
> rapportés à l'usage, chaque constat vérifié adversarialement dans le code
> (35 confirmés, 4 réfutés car déjà assumés/différés). Note globale : **16,0 / 20**
> (15,3 le 2026-07-06) — la discipline tient sous la croissance ; les deux
> priorités sont les **irritants rapportés à l'usage** (Lot K) et l'écart net
> entre la rigueur du serveur et la **boucle de rendu web** (Lot L).
>
> **Séquencement.** K d'abord (bugs vécus par l'utilisateur), puis L.1 (le
> goulot structurel), puis M/N/O au fil des sessions. Chaque slice = une branche
> = une PR + `/session-report`, gate verte, mutation si le cœur est touché,
> browser-verify pour toute slice UI.

## Notes par axe (2026-07-11)

| Axe | Note | Tendance vs 2026-07-06 |
|---|---|---|
| Qualité de code | **18** | ↑ (17,5 — lots chord-charts exemplaires, dette J.4 soldée) |
| Sécurité | **16,5** | ↑↑ (14,5 — F.1 bouché, `/chords` dépasse même la norme avec ses poids sha256-pinnés) |
| Esthétique | **16,5** | ↑ (16 — tokens sémantiques J.1, lead-sheet 100 % dans le système) |
| Fonctionnalités | **16** | ↑↑ (14 — Lot I pratique du tempo complet + verticale accords entière) |
| Ergonomie | **15,5** | ↑ (15 — G/H/I/J livrés, mais le layout de la lead-sheet plafonne l'axe) |
| Performance | **13,5** | → (nouvel axe — serveur rigoureux, boucle de rendu React à la traîne) |

Constats réfutés à la vérification (déjà tranchés/tracés, pas de dette nouvelle) :
regroupement de pistes (abandon daté dans [jalon-2-plan.md](jalon-2-plan.md)),
onglet Notes (veille explicite de la passe 2), auto-scroll de la mesure jouée
(tracé dans le rapport PR #80 — repris ici car il devient **indispensable** avec
K.1), export zip synchrone (veille STATUS.md — inchangé).

---

## Lot K — Les deux irritants rapportés à l'usage *(à faire en premier)*

### K.1 — Grille d'accords : scrollport borné + suivi du playhead *(🟠 haute, UI)*
- **Constat (cause racine tracée).** La hauteur de la grille n'est bornée nulle
  part : `.sheet`/`.measure` sans `max-block-size` ni `overflow`
  ([lead-sheet.module.css](../packages/web/src/app/lead-sheet/lead-sheet.module.css)),
  panneau hôte simple colonne flex, et le shell n'est pas une frontière de
  scroll — `.shell { min-height: 100dvh }` (jamais `height`) rend l'`overflow:
  auto` de `.main` **inerte**
  ([workstation-shell.module.css:4, 27](../packages/web/src/app/workstation-shell/workstation-shell.module.css#L4)).
  « Détecter les accords » amplifie : une mesure par downbeat sur tout le
  morceau → ~105 mesures ≈ 1 100 px de grille à 4 mes./ligne (≈ 4 300 px à
  1 mes./ligne, autorisé). Waveform et transport sortent du viewport dès qu'on
  consulte la grille — le symptôme rapporté.
- **Faire.** Correction locale, pas de refonte du modèle de scroll du shell :
  1. wrapper `.sheetViewport { max-block-size: clamp(14rem, 45dvh, 26rem);
     overflow-y: auto; overscroll-behavior: contain }` autour du `<LeadSheet>`
     dans [chord-chart-panel.tsx:162](../packages/web/src/app/lead-sheet/chord-chart-panel.tsx#L162)
     — intrinsèque (clamp + dvh, zéro media query), motif déjà présent
     (ZoomStage) ;
  2. **indispensable en complément** : suivi du playhead — callback ref sur la
     mesure `aria-current` → `scrollIntoView({ block: 'nearest' })` (no-op hors
     scrollport, le composant reste print-first) ;
  3. acceptance test avec une source de ~120 mesures (présence du scrollport +
     spy `scrollIntoView` au changement de mesure) ; browser-verify le ressenti ;
  4. au passage : documenter ou retirer l'`overflow: auto` inerte de `.main`.
- **Horizon.** Correctif tactique : la refonte visuelle de la lead-sheet
  (Lot P — chart avec sections/reprises, édition repliée) redéfinira le
  panneau ; K.1 doit rester minimal.

### K.2 — Tempo 750 BPM : beat parasite non filtré, ni clamp ni repli local *(🟠 haute, core + serveur)*
- **Constat (cause racine tracée).** Le garde-fou de `buildTempoMap`
  ([tempo.ts:102-119](../packages/core/src/domain/tempo.ts#L102)) protège d'un
  beat **manqué** mais pas d'un beat **inséré** : un double-déclenchement 80 ms
  après un vrai beat (0,8 s à ~75 BPM) « confirme » deux ruptures successives et
  pousse un segment à `60/0.08 = 750 BPM` — aucun clamp de plage plausible,
  `foldTempoOctave` n'existe qu'en correction manuelle **globale**. En amont, le
  serveur tourne beat_this en post-traitement minimal (`dbn=False`,
  [tempo.py:76](../server/app/tempo.py#L76)) et
  [beat_positions.py](../server/app/beat_positions.py) ne filtre aucun
  intervalle invraisemblable — sur un feel ternaire très subdivisé
  (« Somebody to Love », 12/8), le modèle tire sur des subdivisions. Le BPM
  global reste juste (médiane) ; seul le map local explose, et le read-out
  affiche la valeur brute plus une plage « 75–750 »
  ([tempo-panel.tsx:98-126](../packages/web/src/app/tempo/tempo-panel.tsx#L98)).
  Effet secondaire : les beats parasites sont aussi dans la grille waveform et
  le **stem de clic du métronome**.
- **Faire.** Défense en profondeur, deux couches :
  1. **core `buildTempoMap`** : pré-fusionner les beats aberrants (gap < ~0,4×
     la médiane glissante) puis replier chaque segment fermé par octave vers la
     médiane globale du map, clamp [40, 220] en dernier recours. Le map étant
     « derived, never stored », les projets déjà sauvés se réparent seuls.
     Property test fast-check : grille à tempo de base + beats parasites insérés
     → tous les segments restent dans [40, 220] ; cas nominal 75 BPM + parasite
     à +80 ms → un seul segment ~75.
  2. **serveur `beat_positions.py`** (pur, testable sans torch) : écarter avant
     `tempo_payload` tout beat dont le gap est < 0,4× la médiane des gaps —
     corrige aussi la grille dessinée et le clic surnuméraire du métronome.
     Test : `[0, 0.08, 0.8, 1.6, …]` → le 0,08 écarté, bpm ≈ 75.
  3. **Pas de clamp cosmétique** dans le panneau (il masquerait le bug de
     données) ; non-régression au spec du panneau.

---

## Lot L — Performance web *(l'axe le plus bas, 13,5)*

> Le serveur est exemplaire (sémaphores, inférence hors event-loop, NDJSON
> streamé) ; le retard est concentré dans la boucle de rendu React.

### L.1 — Sortir la tête de lecture de l'état racine *(🟠 haute)*
- **Constat.** La boucle rAF émet la position à 60–120 Hz
  ([web-audio-shared.ts:132](../packages/web/src/audio/web-audio-shared.ts#L132)),
  dispatchée en `tick` dans un reducer qui vit dans `WorkstationShell` : **tout
  l'atelier se réconcilie à chaque frame** pendant la lecture (header, panneaux,
  lead-sheet, stem-lanes, + un `<span>` par beat recréé —
  [waveform-view.tsx:265](../packages/web/src/app/waveform/waveform-view.tsx#L265)).
  Un seul `React.memo` dans toute la base, inopérant (props littérales recréées).
- **Faire.** Exposer la position via `useSyncExternalStore` (ou atome Jotai)
  branché sur `onPositionChange`, consommée uniquement par playhead / timecode /
  `currentMeasureIndex` (ce dernier throttlé au changement de mesure). Première
  étape à faible coût possible : throttler le `tick` à ~10-15 Hz (le wrap de
  boucle est déjà traité dans le listener, avant le dispatch).

### L.2 — ZoomStage : suivi du playhead par pages, pas par frame *(moyenne)*
- **Constat.** [zoom-stage.tsx:28](../packages/web/src/app/waveform/zoom-stage.tsx#L28) :
  lecture `scrollWidth`/`clientWidth` (layout forcé) + écriture `scrollLeft` à
  chaque frame en zoom — et le scroll manuel est confisqué pendant la lecture.
- **Faire.** Ne recadrer que quand le playhead sort de la fenêtre visible
  (pattern DAW) ; suspendre le suivi quelques secondes après un scroll manuel.

### L.3 — Mémoire stems : PCM retenu en double (~1 Go / 6 stems) *(moyenne)*
- **Constat.** `sources` (Float32Array,
  [use-separation.ts:97](../packages/web/src/app/separation/use-separation.ts#L97))
  + les mêmes données recopiées en `AudioBuffer` pour le moteur ≈ 2 × 500 MB ;
  plus `Float32Array.from(...)` copie transitoirement des canaux déjà
  `Float32Array` ([web-audio-shared.ts:28](../packages/web/src/audio/web-audio-shared.ts#L28)).
- **Faire.** Ne retenir qu'une forme : libérer `sources` après chargement moteur
  et re-dériver à l'export via `AudioBuffer.getChannelData` (zéro copie). Au
  minimum : éviter la copie transitoire (test `instanceof`, trois lignes).

### L.4 — Mémoïser le WAV encodé pour les appels serveur *(moyenne)*
- **Constat.** `encodeWav` synchrone sur le main thread (~100-300 ms, ~42 MB)
  avant chaque appel `/tempo`, `/chords`, `/separate` — le même WAV recalculé
  jusqu'à trois fois par piste
  ([post-wav-json.ts:15](../packages/web/src/audio/post-wav-json.ts#L15),
  [http-separator.ts:53](../packages/web/src/audio/http-separator.ts#L53)).
- **Faire.** `WeakMap<DecodedAudio, Uint8Array>` partagée par les trois
  adaptateurs — supprime deux encodages sur trois.

*(Bundle 563 kB/180 kB gzip : théorique pour un outil local — consigné en
veille, pas de `manualChunks` prématuré.)*

---

## Lot M — Sécurité, durcissement de second rang

### M.1 — Garde Origin sur les POST à effets (CSRF « simple request ») *(moyenne)*
- **Constat.** CORS empêche de **lire**, pas d'**envoyer** : une page tierce
  peut poster en `text/plain` vers `127.0.0.1:8000` (TrustedHost passe,
  `read_capped_json` ignore le Content-Type) et déclencher `/download`,
  `/audio`, les inférences ou `/gc`. Impact borné par caps/quotas/sémaphores,
  mais c'est la seule brèche du modèle « seule l'app loupe parle à ce serveur ».
- **Faire.** Middleware à côté de `LoopbackOnlyMiddleware` : 403 si un en-tête
  `Origin` présent est hors `LOUPE_ALLOWED_ORIGINS` — ou en-tête custom
  `X-Loupe-Client` côté adapters (force le préflight). Tests : POST `/gc` et
  `/download` avec `Origin: https://evil.example` → 403.

### M.2 — `/download` : le endpoint le moins durci *(moyenne)*
- **Constat.** Ni sémaphore (N téléchargements yt-dlp parallèles), ni
  `max_filesize` (le tmp se remplit **avant** le quota du store), ni timeout sur
  `events.get()` (thread suspendu si yt-dlp se fige) ;
  `files[0].read_bytes()` charge le fichier entier en mémoire
  ([download.py:82-175](../server/app/download.py#L82)).
- **Faire.** (1) `concurrency_slots('LOUPE_MAX_CONCURRENT_DOWNLOADS')`,
  (2) `max_filesize` aligné sur `MAX_UPLOAD_BYTES`, (3) timeout sur
  `events.get()` (~15 min) → ligne NDJSON d'erreur. Testable sans réseau
  (pattern queue/worker déjà testé).

### M.3 — Basses groupées *(1 micro-slice)*
- `asyncio.wait_for` (plafond généreux, ex. 10 min) autour des trois
  `run_in_threadpool` d'inférence — sinon une inférence figée gèle l'endpoint
  (slot = 1) en silence.
- `GET /audio/{ref}` : `Response(path.read_bytes())` →
  `FileResponse` ([projects.py:117](../server/app/projects.py#L117)), comme
  `/stems`.
- Documenter dans [server/README.md](../server/README.md) l'asymétrie
  d'épinglage des poids (BTC sha256-pinné et re-hashé, Demucs/beat_this délégués
  à l'upstream) ; router beat_this par `pinned_weights()` si une passe s'y prête.

---

## Lot N — Ergonomie & coutures accords

### N.1 — Erreurs de détection d'accords : codes discriminés + Lingui *(basse mais visible)*
- **Constat.** Le panneau affiche `{failed} — {detection.error}` : préfixe
  traduit + détail anglais brut (« no chords detected », « HTTP 503 »,
  « Failed to fetch »). Recul vs le standard Lot G ; « HTTP 503 » signifie en
  réalité « moteur d'accords non installé côté serveur ».
- **Faire.** `detectChords` porte un code discriminé
  (`'no-chords' | 'no-downbeat' | 'engine-unavailable' | 'network' | 'unknown'`)
  mappé sur le catalogue Lingui ; détail brut en console pour le diagnostic.

### N.2 — Raccourcis : toggles de pratique + carte à jour *(moyenne)*
- **Constat.** `defaultKeyBindings` n'a pas bougé depuis le Jalon 1 (6 commandes)
  alors que la surface a triplé : boucle A/B on/off, métronome, tap-tempo —
  les gestes « mains sur l'instrument » — sont souris-seulement. (La *création*
  de boucle au clavier reste en veille, design non trivial — décidé.)
- **Faire.** Étendre `Command`/`defaultKeyBindings` avec 2-3 toggles (`L`
  boucle, `K` métronome, `T` tap) ; les actions existent déjà dans le shell ;
  carte de raccourcis et empty-state suivent via `describeKeyBindings`.

### N.3 — Pitch-shift ↔ grille d'accords : signaler la divergence *(moyenne)*
- **Constat.** Monter l'audio de +2 pour son instrument laisse la grille dans la
  tonalité d'origine, surlignée en rythme mais fausse d'un ton — le scénario
  « instruments transpositeurs » du plan produit. Rien ne relie les deux.
- **Faire.** Indicateur sur le panneau quand `pitchSemitones ≠ 0` (« Audio
  transposé de +2 — la grille affiche la tonalité d'origine ») + action
  « Transposer la grille pour suivre » (`transposeChartSource` du delta).

### N.4 — Micro-frictions du panneau accords *(basse, 1 slice)*
- Champ « mes. / ligne » : `aria-invalid` + bordure `--danger` quand le
  brouillon est hors bornes (aujourd'hui rejet silencieux) ; mémoriser la
  préférence en localStorage (paramètre de **rendu**, hors manifest projet).
- Remonter la ligne « Détecter les accords » sous le header du panneau (l'action
  principale dérive vers le bas avec la grille) ; K.1 réduit déjà l'essentiel du
  problème d'édition à l'aveugle.

---

## Lot O — Finitions design & code *(fond de panier, à intercaler)*

### O.1 — Token mort `var(--accent)` *(moyenne — bug visuel réel)*
- [tempo-panel.module.css:57](../packages/web/src/app/tempo/tempo-panel.module.css#L57) :
  `--accent` n'existe nulle part → le texte d'erreur du tempo perd sa couleur de
  danger. Remplacer par `composes: errorLine` (comme chord-chart-panel) ; au
  passage `margin-left` → `margin-inline-start`. Ajouter au gate un diff
  var() utilisées vs définies (5 lignes de shell) pour verrouiller.

### O.2 — Micro-dérives design *(basse, 1 slice)*
- 2 transitions hors tokens motion
  ([analysis-panel](../packages/web/src/app/analysis-panel/analysis-panel.module.css#L28),
  [stem-lanes](../packages/web/src/app/mixer/stem-lanes.module.css#L22)) →
  `var(--motion-fast) var(--motion-ease)`.
- Focus ring teal isolé du bouton de fermeture des toasts
  ([toast-region.module.css:67](../packages/web/src/app/ui/toast-region.module.css#L67)) :
  supprimer (baseline amber) ou documenter.
- Espacements 5px du marker-rail → échelle ; hauteurs du ruler dérivées de
  `--timeline-height` ; token `--tracking-label: 0.08em` pour les ~10 labels
  uppercase.

### O.3 — Découper `workstation-shell.spec.tsx` *(moyenne — 2 279 lignes, 124 tests)*
- Par parcours : `.import.spec.tsx`, `.projects.spec.tsx`, `.chords.spec.tsx`…,
  fixtures communes dans un `shell-test-kit.ts` colocalisé. Aucun test à
  réécrire, juste à déplacer — garder le niveau d'intégration (stratégie
  assumée).

### O.4 — Extraire le fenêtrage de `chords.py` *(moyenne — même trou que F.4)*
- Le calcul de padding/fenêtres TIMESTEP
  ([chords.py:150-160](../server/app/chords.py#L150)) est décidable mais vit
  dans le module exclu de coverage + pyright : un off-by-one décalerait tous les
  accords d'une fenêtre sans qu'aucun test ne le voie. Extraire un
  `btc_windows.py` pur testé, sur le modèle de `chord_spans.py`.

### O.5 — Basses code groupées *(1 micro-slice)*
- `postWavForJson` : paramètre `signal?: AbortSignal` propagé depuis les hooks
  (aligne `/tempo`/`/chords` sur ce que J.5 a fait pour la séparation — le
  sémaphore serveur reste occupé après un changement de piste sinon).
- `create-chord-detector.ts` : l'exclure de la couverture avec ses jumeaux (ou
  micro-spec) — l'asymétrie rend la convention illisible.
- jscpd : factoriser le boilerplate Popover partagé
  (speed-trainer ↔ name-editor), la recette CSS commune, puis abaisser le seuil
  2,5 → 1,5 %.

---

## Lot P — Lead-sheet façon « chart » *(chantier produit, direction fixée le 2026-07-11)*

> **Cible visuelle (demande utilisateur) :** la lead-sheet doit ressembler à une
> chart professionnelle type chordsheet.com/iReal — référence : le PDF « Your
> Song » (Elton John) fourni localement (non versionné, document sous droits).
> Ce lot est un chantier à part entière : il mérite **son propre plan**
> (comme chord-charts-plan) et le checkpoint d'approche UI avant chaque slice.
> K.1 reste le correctif immédiat du bug de hauteur ; P le remplace à terme.

Ce que la référence montre, et ce que ça implique :

### P.1 — Décrire la **structure** du morceau (domaine)
- La chart de référence n'est pas une timeline linéaire : elle décrit la
  **forme** — sections nommées et encadrées (Intro, Verse, Chorus, Coda,
  Outro), reprises `|:  :|`, voltas 1./2., D.C., signe Coda, point d'orgue.
  Une trentaine de mesures écrites suffisent à décrire un morceau de 100+
  mesures jouées.
- Le modèle actuel est linéaire (mesure i ↔ i-ème downbeat) ; il faut un
  modèle de forme dans le domaine : sections + reprises/voltas, et une
  fonction pure de **déroulement** (unroll) forme → suite de mesures jouées,
  pour que la sync lecture (`measureIndexAt`) et le surlignage continuent de
  fonctionner. Étendre la grammaire du format texte (les labels `[Section]`
  existent déjà ; ajouter reprises/voltas est l'étape suivante).
- Ce déroulement résout au passage la hauteur (une forme compacte remplace
  105 mesures dépliées) et ouvre la voie à une future **détection de
  structure** (segmentation audio) — à ne pas coder spéculativement.

### P.2 — Rendu « chart » (UI)
- Typographie de chart : accords en grande taille, exposants pour les
  qualités (maj7, 7), slash chords empilés (F/C) ; barres de mesure dessinées,
  double barre d'ouverture/fermeture, barres de reprise, cadres de section,
  entête (titre, artiste, tonalité, tempo, style) ; 4 mesures par ligne par
  défaut. Rester CSS Grid/zéro lib comme l'actuel LeadSheet, tokens du design
  system.

### P.3 — Édition repliée
- **Demande utilisateur :** l'édition des accords n'a pas besoin d'être
  perpétuellement visible. Sortir la textarea du flux permanent du panneau —
  mode édition explicite (toggle « Modifier », dialog, ou édition en place
  d'une mesure/section) ; la vue par défaut est la chart en lecture seule,
  synchronisée à la lecture. La ligne « Détecter les accords » reste, elle,
  accessible en tête de panneau (cf. N.4).

---

## Veille (décisions, pas des oublis)

- **Édition locale du tempo** (constat K.2, 2026-07-11) : quand le détecteur
  suit une modulation métrique avant le pouls ressenti (« Don't Stop Me Now » :
  piano à 156 dès 30 s, batterie à 38 s — `dbn=True` testé, n'aide pas), seule
  une correction manuelle par plage (« forcer 104 BPM de 28 s à 38 s ») rend le
  bon clic. Étendrait `ManualTempo` (global aujourd'hui) à des plages.
- Subdivisions du métronome (croches/triolets) — promesse du plan produit §3.6,
  quelques lignes pures sur `synthesizeClickTrack` + sélecteur ; à inscrire ou
  à faire au fil de l'eau.
- Offset de départ de la sync lead-sheet — l'idiome `N.C.` couvre déjà le cas
  (section `[Intro]`) ; un champ « commence à la mesure N » reste possible si
  l'usage le réclame.
- Bundle web (code-splitting applicatif) — pertinent seulement si le produit
  sort du cadre local.
- Et les entrées existantes de STATUS.md (export off-thread, locale EN, thème
  clair, boucle clavier, Jalon 4…).

---

## Suivi

- [ ] **K.1** grille d'accords : scrollport borné + scrollIntoView
- [ ] **K.2** tempo 750 BPM : buildTempoMap + filtre beat_positions
- [ ] **L.1** tête de lecture hors état racine
- [ ] **L.2** ZoomStage suivi par pages
- [ ] **L.3** mémoire stems (double rétention + copie transitoire)
- [ ] **L.4** mémoïsation WAV encodé
- [ ] **M.1** garde Origin (CSRF)
- [ ] **M.2** durcir /download
- [ ] **M.3** basses sécurité groupées
- [ ] **N.1** erreurs accords discriminées + Lingui
- [ ] **N.2** raccourcis toggles + carte
- [ ] **N.3** indicateur pitch ↔ grille
- [ ] **N.4** micro-frictions panneau accords
- [ ] **O.1** token mort --accent (+ lint tokens)
- [ ] **O.2** micro-dérives design
- [ ] **O.3** split workstation-shell.spec
- [ ] **O.4** btc_windows.py pur
- [ ] **O.5** basses code groupées
- [ ] **P** lead-sheet façon chart — à planifier (plan dédié : structure,
      rendu, édition repliée)
