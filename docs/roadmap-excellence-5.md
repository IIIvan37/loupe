# Feuille de route — excellence, 5ᵉ passe

> **But.** Issue de l'évaluation notée du **2026-07-16** (six axes, mêmes que les
> passes 3 et 4), menée après clôture complète de la [quatrième feuille de
> route](roadmap-excellence-4.md) (Lots Q, R, T, U, V, W ✅ — ~40 PRs,
> #137→#169). Revue multi-agents : 6 reviewers d'axe, chaque constat vérifié
> adversarialement dans le code (35 constats, **20 confirmés**, 15
> réfutés/déjà-tranchés). Note globale : **17,2 / 20** (16,1 le 2026-07-14) —
> les six axes montent : les quatre déductions structurelles de la passe 4
> (périmètre cloud hors gate, irritants UI/feedback, geste de boucle au pixel,
> restes perf) sont **réellement soldées et vérifiées dans le code**, pas
> seulement cochées. Ce qui reste est d'un cran de sévérité inférieur : cinq
> constats moyens (deux mensonges du mode offload, une régression géométrique
> T.8b, une contamination du spectre par le métronome, l'absence de veille CVE
> Python), et une quinzaine de finitions basses.
>
> **Séquencement.** Les cinq 🟠 d'abord — X.1/X.2 (le mode offload dit vrai),
> Z.1 (le spectre dit vrai), Y.1 (la régression visuelle livrée), AA.1 (une
> config) ; le reste au fil des sessions, les micro-slices design (Y.2–Y.6)
> groupables en une passe type W.5. Chaque slice = une branche = une PR +
> `/session-report`, gate verte, mutation si le cœur est touché, browser-verify
> pour toute slice UI — et **checkpoint d'approche 2-3 lignes avant chaque
> slice UI**.

## Notes par axe (2026-07-16)

| Axe | Note | Tendance vs 2026-07-14 |
|---|---|---|
| Qualité de code | **18** | ↑ (17,5 — le trou « hors gate » est réellement fermé : CI ruff+pyright+pytest sur server/ + modal_app.py, deno sur l'Edge, cliquets jscpd 1,0 %/Stryker 90 vérifiés honnêtes ; reste un demi-cran sur les poches de mutants et les bords) |
| Fonctionnalités | **17,5** | ↑ (17 — les ponts analyse→pratique livrés en profondeur ; borné par la largeur v1 du Spectre/EQ, le placeholder Notes, et l'axe audio→notation (jalons 4-5) non entamé) |
| Esthétique | **17** | ↑ (16 — dérives post-O.2 soldées, verrou font-size en gate, les surfaces neuves composent le système ; l'ombre : la régression de hauteur T.8b et deux trous du verrou) |
| Sécurité | **17** | ↑ (15,5 — U.3/U.5 réels et testés : throttle sous FOR UPDATE, entropie ≥ 32, plancher du secret fail-fast des deux côtés ; les résidus sont opérationnels, pas structurels) |
| Ergonomie | **17** | ↑ (15,5 — les deux irritants rapportés et la boucle au pixel corrigés par du code vérifié ; restent la copy/gating offload menteurs et un cul-de-sac d'annulation) |
| Performance | **16,5** | ↑ (15 — V.1–V.5 tous vérifiés réels, chemin de rendu exemplaire (playhead hors React, polls confinés) ; restent le cold start Modal dans le cas dominant (veille) et deux coûts jamais mesurés) |

Constats réfutés ou déjà tranchés à la vérification (15) — décisions tracées,
pas de dette nouvelle :

- **Comportement Edge Function/SQL hors CI** : décision U.2 explicite (« CI =
  statique seulement ; l'intégration reste un rituel local documenté ») —
  le « niveau supérieur optionnel » a été évalué et écarté, aucun fait nouveau.
- **Break Stryker 90 masquant chord-key/metronome** : les survivants SONT
  documentés équivalents (rapports chord-grid-vocab-key, metronome-stem,
  metronome-count-in) ; le break global est le choix U.4, un break par fichier
  n'a jamais été promis.
- **SnapUnit 'bar' jamais consommé** : différé conscient du rapport T.1
  (« disponible pour un futur réglage », repris dans STATUS).
- **Subdivisions du métronome absentes** : en veille depuis la roadmap v3
  (§ Veille, avec le remède exact) — tracé, pas oublié.
- **Reliquats plan produit (pédales, vidéo, raccourcis configurables)** :
  items du Jalon 4 « paris », jalon entier en veille STATUS ; « configurables »
  n'a jamais été engagé. Seule la note « Espace seulement » du plan est périmée
  (fraîcheur doc, cf. veille).
- **Titre de zone / label de rangée même voix (Q.1)** : décision « une seule
  grammaire + hiérarchie par gaps » validée au checkpoint utilisateur du
  2026-07-14 ; re-poser la question relève d'une relance de décision, pas d'un
  constat.
- **Codes beta legacy < 32 chars** : analyse déjà déroulée au rapport U.3
  (entropie = défense primaire, throttle = friction) ; le re-seed prod est dans
  la checklist de déploiement, le runbook impose gen_random_uuid().
- **Auth Edge sans test CI** : même décision U.2 que ci-dessus.
- **CHECK d'entropie = longueur seulement** : connu — l'aléa vient du chemin de
  seed canonique (runbook J2) ; le CHECK garde contre les codes devinables.
- **Tempo muet pour l'AT** : faux — LiveStatus dans TempoPanel annonce
  détection puis BPM (Lot H, testé) ; un canal dans AnalyserRow doublonnerait.
- **Onglet Notes = contrôle permanent vers un placeholder** *(volet
  ergonomie)* : « honest placeholders » re-confirmé à T.8a avec l'utilisateur ;
  le volet **décision produit** reste ouvert, cf. Z.3.
- **Carte des raccourcis figée à l'import** : sans objet tant que la locale EN
  (veille) n'existe pas ; le chantier appartient à cette slice-là.
- **Warm Modal à fenêtre quasi nulle** : constat v4 assumé et tranché en R.3
  (la narration rend le cas supportable) ; toucher au mint = périmètre J3.
  (Étiquetage corrigé : V.3 = warm du serveur local, hors de cause.)
- **Cmd+S ré-encode les stems** : R.4 palliatif livré + vrai fix off-thread en
  veille ; T.4 a explicitement gardé le no-op propre/en-vol (« never a
  redundant stems re-encode »).
- **Encodages WAV memoïsés épinglés (~51 MB)** : trade-off quantifié et acté
  (rapports wav-encode-memo et V.2) — « à re-peser seulement si la pression
  mémoire mord ».

---

## Lot X — Le mode offload dit vrai *(ergonomie — les deux 🟠 de l'axe)*

### X.1 — Structure offloadée : gating et copy indexés sur le bon serveur *(🟠 moyenne)*
- La détection de structure part sur Modal quand `VITE_STRUCTURE_URL` est posé
  ([analysis-endpoint.ts:10](../packages/web/src/audio/analysis-endpoint.ts#L10),
  create-structure-detector.ts:13-16), mais le shell la bloque sur la santé du
  serveur **local** ([shell-main.tsx:328](../packages/web/src/app/workstation-shell/shell-main.tsx#L328) :
  `blockedReason 'server'` dérivé de `serverHealth`, qui sonde
  localhost:8000/health) — et le hint bloqué comme l'erreur `network` disent
  « Lancer le serveur local pour détecter la structure »
  (detection-copy.ts:18-21, 36) alors que le calcul est dans le cloud. Un import
  fichier n'a besoin d'aucun serveur local en mode offload : fausse
  indisponibilité + remède trompeur. Inversement, une panne Modal n'est jamais
  sondée (santé `ready`, échec au clic, même copy fausse). Le shell connaît déjà
  l'offload une ligne plus haut (`mayColdStart: isAnalysisOffloaded()`).
- Micro-slice : en mode offloadé, dériver le blocked/copy de la structure d'une
  sonde de l'endpoint d'analyse (ou ne pas bloquer et laisser l'erreur typée
  parler) ; décliner la copy en variante offload (« Service d'analyse
  injoignable — réessayer »).

### X.2 — Annuler la détection auto du tempo n'est plus un cul-de-sac *(🟠 moyenne)*
- L'item tempo de la rangée Analyser ne se rend que si
  `detecting || error || bpm` ([analyser-row.tsx:224](../packages/web/src/app/workstation-shell/analyser-row.tsx#L224)) ;
  or « Annuler » (R.2) remet `detecting=false` **sans** poser d'erreur
  (use-tempo.ts:296-299, « cancelling is not a failure ») : après annulation de
  la première détection (auto, `analysis` encore undefined), l'item disparaît.
  « Réessayer » n'existe que sur la face erreur, le TempoPanel n'offre aucune
  détection. Issues restantes dans la session : taper le tempo à la main —
  alors que la grille alimente boucles musicales, grille d'accords et
  métronome. Asymétrie avec structure/accords dont le bouton « Détecter »
  reste rendu.
- Micro-slice : après un cancel, garder l'item avec une face idle « Détecter le
  tempo » (réutiliser `onRetry`) — symétrie avec les deux autres détections.

### X.3 — Enseigner le nudge musical des poignées *(🟢 basse, copy)*
- Les poignées A/B acceptent ←/→ (beat adjacent avec grille, mesure avec Shift ;
  0,1 s/×10 sinon — waveform-view.tsx:171-207, T.2) mais rien ne l'enseigne :
  la ligne « Glisser — Créer une boucle A/B… » du dialog d'aide
  (shortcuts-dialog.tsx:33-39) ne dit rien des poignées alors que le repère
  documente son ←/→ (ligne 44), et la carte étant dérivée des bindings
  **globaux** (shortcut-hints.ts:148-153), un raccourci scoped n'y apparaîtra
  jamais de lui-même.
- One-liner : compléter la ligne gestes (« poignées : ←/→ décaler d'un temps,
  ⇧ : d'une mesure ») ; au passage, mentionner les flèches dans les aria-labels
  des poignées (waveform-view.tsx:313-328).

---

## Lot Y — Design : la régression T.8b et les trous du verrou

### Y.1 — Header de piste : la rangée EQ déborde des 48 px *(🟠 moyenne — l'écran phare)*
- T.8b a ajouté une **troisième** ligne `.filters` dans `.header`
  (stem-headers.tsx:146-201) sans toucher le contrat de hauteur :
  `height: var(--stem-lane-height)` figé (stem-headers.module.css:18, 48 px,
  tokens.css:130), commentaire « Two compact lines per track » périmé, pas
  d'`overflow`. Contenu ≈ 54-56 px → le contenu bave de ~3-4 px de chaque côté
  dans le gap de 2 px et les headers voisins. Les boîtes restent à 48 px donc
  l'alignement header/lane tient ; le chevauchement des hit-areas
  touchTargetTall sous `(pointer:coarse)` préexiste. Le browser-verify T.8b n'a
  couvert que la chaîne audio, pas la géométrie.
- Micro-slice : monter `--stem-lane-height` (~64 px) des deux côtés du contrat
  header/lane, **ou** replier la rangée LC/HC derrière un disclosure par
  piste ; mettre à jour le commentaire ; browser-vérifier l'alignement
  gutter/lanes avec 4-6 stems.

### Y.2 — check:tokens : scanner les `var(--…)` passés en TSX *(🟢 basse, config)*
- check-css-tokens.sh:11 construit `used` avec `--include='*.css'` seulement,
  alors que l'espacement du shell recomposé passe massivement par des props TSX
  (`<Stack gap="var(--space-l)">` — LA hiérarchie Q.1, shell-main.tsx:242 ;
  analyser-row, shell-section, header…). Un typo `var(--space-lg)` passerait la
  gate et retomberait silencieusement sur le token par défaut de la primitive
  (`var(--space-m)` pour Stack, `var(--space-s)` pour Cluster —
  stack.module.css:8, cluster.module.css:5), aplatissant la hiérarchie sans
  erreur. L'asymétrie est un oubli : la ligne 14 scanne déjà les *définitions*
  en TS/TSX.
- Config : ajouter `--include='*.tsx' --include='*.ts'` à la ligne 11, en
  gérant le faux positif du docstring de stem-color.ts:25. Optionnel au même
  endroit : pincer les littéraux `#hex`/`rgb(` hors tokens.css (état
  actuellement propre par pure discipline — le geler).

### Y.3 — `.entryActive` écrase l'anneau :focus-visible *(🟢 basse)*
- Les outlines d'état d'analysis-panel écrivent la même propriété que le focus
  global à spécificité égale, modules injectés après global.css → la rangée de
  boucle active focalisée au clavier perd son indicateur de focus
  (analysis-panel.module.css:82-85). Pour `.entryConfirm` le risque réel est
  nul (l'armement n'existe que sous focus, `onBlur` désarme).
- Micro-slice : porter `entryActive`/`entryConfirm` sur
  `box-shadow: inset 0 0 0 1px …` pour laisser `outline` au focus ; vérifier au
  clavier.

### Y.4 — La recette aria-invalid appartient à la peau `numberField` *(🟢 basse)*
- Le même bloc `[aria-invalid='true']`/`:hover`/`:focus-visible` →
  `border-color: var(--danger)` existe en trois exemplaires
  (chord-chart-panel.module.css:34-38, tempo-panel.module.css:47-54,
  transport-bar.module.css:103-107) pour quatre champs qui composent tous
  `numberField` — trop petit pour jscpd, driftera au premier ajustement.
- Micro-slice : déplacer le bloc dans controls.module.css (après le bloc
  `:hover`, l'ordre de source intra-fichier suffit) et supprimer les trois
  copies.

### Y.5 — AccountMenu : rabattre hint/erreur sur la grammaire partagée *(🟢 basse)*
- account-menu.module.css **inverse** la grammaire : `.hint` en `s` (partagé :
  `xs`, controls.module.css:193-197) et `.error` en `xs` (partagé `.errorLine` :
  `s`). Introduites déjà divergentes par J2 (3813ad4), deux jours après la
  création de la paire partagée, puis W.5 a retouché le fichier sans les
  rabattre malgré le contrat « can migrate here as they get touched ».
- Micro-slice : `composes: hint / errorLine from controls.module.css` ;
  contrôle visuel du popover quota/redeem.

### Y.6 — Affordance hover des mesures cliquables *(🟢 basse)*
- `button.measure { cursor: pointer }` est l'unique retour visuel du
  tap-to-seek (lead-sheet.module.css:126-128) — aucun `:hover`, contrairement à
  toutes les autres surfaces cliquables ; l'aide gestes T.6 est un palliatif
  documentaire. Le wash `--amber-glow` passe déjà transparent à l'impression
  (global.css:151) donc un hover resterait print-safe.
- Micro-slice : un wash au survol **atténué** (color-mix ou token dédié — le
  plein `--amber-glow` rendrait le survol quasi identique à `.current`), ou
  assumer la parenté visuelle comme signal « ce que jouerait le clic ».

---

## Lot Z — L'atelier d'analyse dit vrai *(fonctionnalités)*

### Z.1 — Le clic du métronome contamine le Spectre *(🟠 moyenne — 2 constantes core)*
- Le tap analyser écoute tout l'audible (web-audio-shared.ts:146-161), or les
  clics sont des sinus à `BEAT_HZ=1000` / `DOWNBEAT_HZ=2000`
  ([metronome.ts:17](../packages/core/src/domain/metronome.ts#L17)), tous deux
  **dans** la bande chroma 32-2100 Hz (chroma.ts:12-13) et tous deux repliés
  sur la classe **B** (midi 83/95). Métronome + Spectre est la combinaison
  naturelle (relever des notes en jouant en rythme) : une barre B pulse à
  chaque beat sans lien avec le morceau, et la normalisation au max
  (chroma.ts:31-32) rescale les vraies notes vers le bas. Muter le métronome
  supprime l'artefact mais contredit le cas d'usage.
- Micro-slice core : déplacer les clics **hors bande** (ex. 2400/3200 Hz — le
  caractère percussif tient à l'enveloppe, pas à la hauteur) + re-vérif
  navigateur métronome actif.

### Z.2 — Chroma à l'arrêt / sur la boucle *(🟢 basse — ou veille datée)*
- Le Spectre v1 (T.8a, décision actée) est live-only par construction
  (`spectrum()` → undefined dès `!isPlaying`, web-audio-shared.ts:218-221 ;
  hint « Lancer la lecture… »). Or le geste fondateur Transcribe! — se poser
  sur un instant/une boucle **à l'arrêt** et lire les notes candidates — est
  promis au plan produit (loupe-plan-produit.md:255) et n'apparaît nulle part
  en veille.
- Slice : chroma hors-ligne sur la boucle active ou autour de la tête à
  l'arrêt — FFT pure en core sur `loadedAudio` (fenêtre ~1-2 s), réutilise
  `chromaFromSpectrum` tel quel ; `ChromaView` affiche « live » en lecture,
  « sélection » à l'arrêt. **Sinon**, acter la borne de la v1 en veille datée.

### Z.3 — Onglet Notes : le dernier placeholder, à trancher *(🟢 basse — décision + micro-slice)*
- analysis-panel.tsx:194-198 promet toujours « Les annotations textuelles
  arriveront plus tard » ; T.8 n'a arbitré que Spectre et EQ — Notes n'est plus
  couvert par aucune décision datée, et le doc-comment qui le justifiait
  (« spectrum and notes are honest placeholders ») est périmé pour spectrum.
- Trancher : micro-slice au ROI évident (champ notes au manifest projet +
  textarea persisté — Transcribe! l'a), **ou** entrée de veille datée, **ou**
  retrait de l'onglet. Dans les trois cas, cesser d'afficher une promesse sans
  échéance ni trace.

### Z.4 — Exporter le passage travaillé (boucle A/B) *(🟢 basse)*
- L'export couvre stems zip, stem isolé, click et piste entière
  (use-stem-export.ts:63-106) mais rien n'exporte la **région bouclée** — le
  geste « emporter le passage sur son téléphone » des outils de pratique.
  Toutes les briques existent : `encodeWav`, le domaine loop-region,
  `loadedAudio` déjà injecté dans le hook.
- Micro-slice : `sliceDecodedAudio(loadedAudio, region)` pur en core +
  « Exporter la boucle » sur LoopControls — v1 = **piste originale** découpée
  sur [a,b] (le mix audible post-gains/EQ exigerait un rendu
  OfflineAudioContext : variante différable).

---

## Lot AA — Garde-fous : chaîne d'appro, bords, budgets *(sécurité + qualité + perf)*

### AA.1 — Veille CVE sur la pile Python *(🟠 moyenne — config)*
- dependabot.yml ne déclare que npm et github-actions ; server/requirements.txt
  pinne torch 2.12.1, transformers 4.51.1, yt-dlp 2026.6.9 (qui parse du
  contenu distant hostile par construction), madmom sur commit git — le pinning
  strict (voulu, et bon) signifie qu'une CVE ne sera **jamais signalée**, et la
  même pile tourne dans Modal. Compatible avec la décision A.1 (« upgrade =
  action opérateur ») : les advisories notifient sans auto-installer.
- Config : bloc `package-ecosystem: pip, directory: /server` dans
  dependabot.yml (le pin git madmom restera non couvert — couverture partielle
  mais réelle) ; optionnel : step `pip-audit -r requirements.txt` non-bloquant
  en CI (résolution seule — le job n'installe que requirements-dev).

### AA.2 — Décodeur runtime au bord des manifests de projets *(🟢 basse)*
- http-project-store.ts:27,34 caste le JSON `as Project` sans validation, le
  serveur persiste verbatim (« The manifest is opaque »). Le domaine durcit
  **déjà** ponctuellement les champs d'accordage contre la corruption manuelle
  (chartTransposedBy, tuningOrDefault, fineTuneOrDefault —
  project.ts:121,194,207) : le vecteur est reconnu, le trou est l'absence de
  garde pour le reste (loops, markers, refs, id) — au mieux crash à la
  restauration, au pire état incohérent. Robustesse plus qu'exploitation
  (loopback local, zéro sink d'injection).
- Micro-slice : `parseProject` au bord (champs porteurs vérifiés, rejet propre
  « projet illisible » vers l'UI), testé avec des manifests malformés —
  généralise le pattern par-champ existant.

### AA.3 — warm-up-analysis.ts : tester au lieu d'exclure *(🟢 basse)*
- L'exclusion coverage « Web Audio / browser-only » (vitest.config.ts) couvre
  warm-up-analysis.ts — 30 lignes de fetch pur, exactement le moule testé du
  même dossier (http-tempo-detector.spec.ts, analysis-token.spec.ts), et sa
  logique réelle n'est exercée par rien (use-modal-warmup.spec.ts injecte un
  fake). Pour analysis-endpoint.ts l'exclusion est défendable (constante d'une
  ligne) — c'est le commentaire qui la décrit mal.
- Micro-slice : spec fetch-mockée (pas de token → aucun fetch ; token → POST
  /warmup Bearer ; échec avalé) + retrait de l'entrée ; se donner la règle
  « exclu ⇔ touche une API que jsdom n'a pas » et corriger le commentaire pour
  analysis-endpoint.

### AA.4 — `_probe_wav` : le moule humble-object jusqu'au bout *(🟢 basse)*
- modal_app.py n'est plus « composition pure » : `_probe_wav`
  (modal_app.py:81-101, synthèse WAV stdlib-only, pure) est un résidu décidable
  non testé, hors pyright (`include = ["app"]`), **dupliqué** dans
  modal_structure_spike.py:144. Le périmètre ruff-seulement de modal_app.py est
  la décision U.1 livrée — ce résidu-là n'est tranché nulle part.
- Micro-slice : déplacer `_probe_wav` dans app/ (2 cas pytest : en-tête WAV,
  durée/rate), l'importer des deux fichiers modal (déduplique au passage) ;
  ajouter modal_app.py à l'include pyright.

### AA.5 — Budget de taille du bundle *(🟢 basse — le cliquet qui manque)*
- Build frais : un seul chunk initial de **831 kB (≈244 kB gzip)**, aucun
  chunking dans vite.config.ts, un seul import dynamique dans l'app
  (SoundTouch). @supabase/supabase-js est embarqué statiquement même quand
  `VITE_STRUCTURE_URL` est absent (tout le chemin auth est alors un no-op —
  analysis-token.ts:25-27), et les dialogs froids sont dans le chunk initial.
  Aucun budget dans la gate alors que U.4 a précisément installé des cliquets.
  Le garde-fou manque plus que les kilo-octets (outil local chargé une fois).
- Micro-slice : import dynamique du client Supabase derrière
  `isAnalysisOffloaded()` + `React.lazy` des dialogs froids ; cliquet de taille
  dans la gate (size-limit ou script comparant dist au budget, modèle U.4).

### AA.6 — Mesurer le burst `decodeWav` des stems *(🟢 basse — mesure d'abord)*
- Décodage WAV des stems synchrone sur le main thread aux deux extrémités du
  cycle projet : burst de 6 `decodeWav` consécutifs **après** l'événement
  `done` du stream (http-separator.ts:36 — pas pendant la progression) et à
  l'ouverture d'un projet séparé (project-session.ts:207). Int16→Float32 pure
  JS, ~84 MB de PCM par stem de 4 min × 6 stems htdemucs_6s — jamais mesuré,
  non couvert par la veille (qui ne nomme que le zip/encode d'export).
- Mesure d'abord (performance.mark autour des decodeWav, piste 6 stems) ; si
  > 150 ms par burst : passer par `decodeAudioData` (motif déjà en place,
  web-audio-decoder.ts:46-53) et enregistrer dans le memo V.5 — économise
  **aussi** la copie `audioBufferFrom` de web-audio-stem-playback.ts:116.

### AA.7 — Ports moteurs : acter le motif « membre optionnel » *(🟢 basse — décision)*
- T.8a/T.8b ont introduit les premières méthodes optionnelles des ports
  (`spectrum?()` ×2 avec docstring dupliquée, `setStemFilter?()` —
  ports.ts:56,169,171), choisies pour ne pas toucher les fakes, sans que le
  trade-off soit documenté comme décision. Ce n'est pas une érosion du contrat
  (les engines ont toujours été pilotés par les hooks web, et SpectrumFrame
  nourrit bien le domaine via `chromaFromSpectrum`) — mais la pente est posée.
- Décision : documenter le choix d'optionalité (veille datée) avec la règle
  « à la 3ᵉ occurrence, extraire une capacité nommée (SpectrumTap /
  ToneFilterable) » — à rapprocher de la factorisation « sibling » que
  ports.ts:122-129 appelle déjà.

---

## Cap — client léger : le calcul sur Modal, l'app dans Tauri *(direction produit, actée 2026-07-16)*

> **Volonté.** Que loupe tourne sur des machines peu puissantes : **tout ce qui
> peut migrer vers Modal migre** (le serveur local Python devient optionnel,
> puis disparaît du chemin nominal), et le shell web devient une **app de
> bureau Tauri**. Ce cap ne déplace pas les cinq 🟠 de cette passe — il
> commence par un plan dédié, pas par du code.

### AB.1 — Plan de migration client léger, écrit et validé *(doc type jalon — préalable à toute slice)*
- **Plan écrit le 2026-07-16 : [client-leger-plan.md](client-leger-plan.md)**
  (décisions actées : projets locaux, Modal d'abord, yt-dlp en sidecar Tauri,
  mobile = option gardée ouverte). Reste à valider le séquencement vs les 🟠
  de cette roadmap (recommandation : les cinq 🟠 d'abord, X.1 en tête).
- Inventaire des rôles actuels du serveur local × cible : détections
  tempo/accords (→ Modal — l'infra existe : gate JWT, quota, upload mono
  24 kHz V.1), séparation (→ Modal — **la** charge GPU dominante), import URL
  yt-dlp (→ à arbitrer : Modal / sidecar Tauri / abandon), stockage
  projets+stems `~/.loupe` (→ filesystem local via adapter Tauri — les ports
  `ProjectStore`/`StemsStore` rendent le swap propre, core intouché), sonde de
  santé (→ X.1 la généralise déjà : sonder l'endpoint effectif).
- Points durs à instruire dans le plan, pas à découvrir en cours de route :
  - **Séparation offloadée** : exige l'audio plein débit (~42 MB d'upload /
    4 min — V.1 ne s'applique pas) et des minutes GPU réelles ; le modèle
    quota/coût J2 (quota = mints, plafond de dépense Modal) est calibré pour
    des détections ~0,5 s, pas pour htdemucs — à re-dimensionner.
  - **Auth partout** : Supabase/beta codes devient le gate de *toutes* les
    analyses ; définir l'app hors-ligne dégradée mais utilisable (lecture,
    boucles, grille, projets locaux — seules les détections exigent le réseau).
  - **Tauri** : origin `tauri://` (ou équivalent) à ajouter aux trois
    allowlists env-driven (U.5) ; vérifier Web Audio / WASM (SoundTouch) dans
    la webview cible par plateforme ; **licences** — la distribution d'un
    binaire change la donne vs un serveur local (Rubber Band GPL notamment).
  - **Migration des données** : les projets existants de `~/.loupe` doivent
    survivre au passage (import/reprise).
- Déjà en faveur du cap : la structure est offloadée bout-en-bout depuis
  J1/J2 (le chemin Modal est éprouvé), l'hexagone est strict (adapters
  swappables), les allowlists sont env-driven, et U.1 a réduit modal_app.py à
  de la composition.
- Ordre pressenti (à valider dans le plan) : tempo+accords vers Modal (réutilise
  tout le chemin structure), puis séparation (le morceau dur), puis shell Tauri
  avec stores locaux, puis retrait du serveur local du chemin nominal.

---

## Veille (décisions, pas des oublis)

- **TIMELINE / REPÈRES même voix** : décision Q.1 validée au checkpoint
  (une grammaire + hiérarchie par gaps) ; l'assomption était dite transitoire —
  re-poser la question à l'utilisateur seulement si l'usage mord.
- **Note « Espace seulement » périmée** (loupe-plan-produit.md:36, dépassée
  depuis N.2) : corriger au prochain passage dans le plan produit.
- **Chroma à l'arrêt** : si Z.2 est tranché « veille », dater ici la borne
  live-only de la v1 Spectre.
- **Différenciateur audio→notation** (stem→MIDI→partition, jalons 4-5) : le
  plafond assumé de l'axe fonctionnalités — un lot dédié le jour où le socle
  atelier est jugé complet.
- Et les entrées v4 inchangées : rejeu du jeton (J3), `useDetectionRun`
  générique (4ᵉ détection), autorité de la grille, frontières memo
  (`deriveChartHeader`), signature `{beats, unit}`, modèle DAW à scroll
  interne, export off-thread, locale EN, thème clair, subdivisions du
  métronome (roadmap v3), Jalon 4.

---

## Suivi

- [ ] **X.1** gating/copy structure indexés sur l'endpoint d'analyse
- [ ] **X.2** face idle « Détecter le tempo » après annulation
- [ ] **X.3** nudge des poignées enseigné (aide + aria-labels)
- [ ] **Y.1** hauteur du header de piste (contrat 48 px vs rangée EQ)
- [ ] **Y.2** check:tokens sur les var(--…) TSX (+ pinçage couleurs optionnel)
- [ ] **Y.3** états entryActive/entryConfirm en box-shadow inset
- [ ] **Y.4** recette aria-invalid promue dans controls.module.css
- [ ] **Y.5** AccountMenu composes hint/errorLine
- [ ] **Y.6** hover des mesures cliquables
- [ ] **Z.1** clics métronome hors bande chroma
- [ ] **Z.2** chroma à l'arrêt/boucle — ou veille datée
- [ ] **Z.3** onglet Notes tranché (slice, veille ou retrait)
- [ ] **Z.4** export de la boucle A/B
- [ ] **AA.1** Dependabot pip sur server/ (+ pip-audit optionnel)
- [ ] **AA.2** parseProject au bord (manifests malformés)
- [ ] **AA.3** warm-up-analysis testé, exclusion retirée
- [ ] **AA.4** _probe_wav extrait/testé + modal_app.py sous pyright
- [ ] **AA.5** budget bundle + supabase dynamique + dialogs lazy
- [ ] **AA.6** mesure du burst decodeWav (fix si > 150 ms)
- [ ] **AA.7** décision « membre optionnel » des ports actée
- [ ] **AB.1** plan de migration client léger (Modal + Tauri) écrit et validé
