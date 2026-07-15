# Feuille de route — excellence, 4ᵉ passe

> **But.** Issue de l'évaluation notée du **2026-07-14** (six axes, mêmes que la
> passe 3), menée après clôture de la [troisième feuille de
> route](roadmap-excellence-3.md) (Lots K–P ✅), de la phase structure (S.0–S.3b),
> de l'offload Modal + auth Supabase (J1/J2) et du lot pré-démo. Revue
> multi-agents : 6 reviewers d'axe + **2 enquêtes ciblées sur les irritants
> rapportés à l'usage** (« l'interface est brouillonne » ; « les opérations
> longues n'ont qu'un changement de label »), chaque constat vérifié
> adversarialement dans le code (55 constats, **45 confirmés**, 10
> réfutés/déjà-tranchés). Note globale : **16,1 / 20** (16,0 le 2026-07-11) —
> les verticales se sont approfondies (fonctionnalités ↑, performance ↑) mais
> la croissance a ouvert des dettes de *composition* : l'UI est une
> accumulation de slices jamais re-composée, et la gate n'a pas suivi le
> périmètre cloud.
>
> **Séquencement.** Q puis R d'abord (les deux irritants rapportés), W.1–W.2
> s'intercalent (micro-slices qui nourrissent aussi l'impression
> « brouillonne »), puis U.1/U.3 (la surface cloud publique), T.1–T.3 (les
> ponts analyse → pratique), V.1, et le reste au fil des sessions. Chaque
> slice = une branche = une PR + `/session-report`, gate verte, mutation si le
> cœur est touché, browser-verify pour toute slice UI — et **checkpoint
> d'approche 2-3 lignes avant chaque slice UI** (tout le Lot Q est concerné).

## Notes par axe (2026-07-14)

| Axe | Note | Tendance vs 2026-07-11 |
|---|---|---|
| Qualité de code | **17,5** | ↓ (18 — le cœur tient sous +40 % de tests, mais modal_app.py et supabase/ vivent hors de toute gate et les cliquets ne pincent plus) |
| Fonctionnalités | **17** | ↑ (16 — Lot P complet, structure bout-en-bout, tonalité + signatures + multi-accords ; le plafond est aux ponts analyse→pratique) |
| Esthétique | **16** | ↓ (16,5 — le système tient, mais les surfaces post-O.2 — chart, AccountMenu, dialogs — ont réintroduit la classe de dérives que check:tokens ne voit pas) |
| Sécurité | **15,5** | ↓ (16,5 — le serveur local reste exemplaire ; la note baisse avec l'ouverture de la surface cloud : brute-force des codes beta, entropie du secret non exigée) |
| Ergonomie | **15,5** | → (15,5 — finitions réelles partout, mais les deux irritants rapportés + le geste de boucle au pixel plafonnent l'axe) |
| Performance | **15** | ↑↑ (13,5 — Lot L vérifié réel ; restes ciblés : upload d'analyse plein débit, mix retenu en double) |

Constats réfutés ou déjà tranchés à la vérification (10) — décisions tracées,
pas de dette nouvelle :

- **Jeton d'analyse rejouable 5 min** : known-by-design du rapport J2 (le quota
  compte les *mints*, le plafond de dépense Modal est le garde-fou dur —
  « tighten in J3 if needed ») ; les pistes jti/TTL courte restent notées pour J3.
- **Duplication useChordDetection ↔ useStructureDetection** : arbitrée le
  2026-07-13 (« consistent-by-design, a useDetectionRun helper would
  over-fit ») — à re-juger si une 4ᵉ détection clone la machinerie.
- **Écrasement des marqueurs corrigés à la main à l'édition de la grille** :
  décision produit « la grille fait autorité » (rapport marker-kinds) ;
  l'adoucissement (ne re-pousser que si l'ensemble dérivé a changé) reste une
  ré-ouverture possible, pas un bug.
- **Frontières memo / tick de mesure qui réconcilie la colonne** : design
  délibéré et mesuré de L.1 (~1,6 commit React/s en lecture) ; seul point
  réutilisable si un lot perf rouvre le sujet : mémoïser `deriveChartHeader`.
- **Onglets Spectre/Notes placeholders** : décision « honest placeholders »
  re-jugée à chaque passe ; recroise la décision produit T.8 ci-dessous.
- **Signature dérivée « N/4 »** : « modèle {beats, unit} différé » acté au
  rapport PR #129 ; le pipeline DBN détecte les métriques composées au temps
  composé (12/8 → « 4/4 », convention chart), la directive `{time:}` prime.
- **Header 9 contrôles au même rang** : réfuté — la hiérarchie existe
  (primaryAction ambre, ghost « ? », filet du statut serveur) ; seule la
  version étroite (gaps de sous-groupes) survit dans Q.4.
- **CORS Modal codé en dur** : le runbook J2 prescrit l'édition au déploiement ;
  l'env-drive reste repris en U.5 au titre de la *duplication* trois-langages.
- **Export zipSync qui gèle l'UI** : veille STATUS.md inchangée ; R.4 n'ajoute
  qu'un palliatif (peindre le statut avant le gel).
- **Micro-dérives O.2 partielles** : les propriétés physiques hors lead-sheet
  et le `text-align` physique sont assumés (aucune locale RTL) ; le reliquat
  réel est dans W.5.

---

## Lot Q — Clarifier l'atelier *(irritant #1, à faire en premier — enquête dédiée)*

> **Cause racine confirmée.** Le shell est une accumulation additive de
> vertical slices : les 6 régions (Séparation, Repères, Stage, Tempo, Boucles,
> Grille) sont enfants directs d'un unique `<Stack gap="var(--space-m)">`
> ([shell-main.tsx:145-257](../packages/web/src/app/workstation-shell/shell-main.tsx#L145))
> — gap uniforme, aucun conteneur intermédiaire, en-têtes incohérents (h2 /
> micro-label uppercase / rien). Aucune passe de re-composition depuis la « UI
> clarity pass » du 2026-07-04, **antérieure à toutes les analyses**. Résultat :
> ~60 contrôles interactifs au même rang pour un usage séquentiel
> (importer → analyser → pratiquer), 4 actions d'analyse éclatées en 4 endroits
> avec 4 patterns d'état, deux « Tempo » simultanés qui ne mesurent pas la même
> grandeur. Toutes les slices sont compatibles Every Layout (zéro media query)
> et indépendantes du passage au modèle DAW à scroll interne (veille
> roadmap-3, inchangée). La densité « outil pro » reste assumée
> (docs/loupe-spec/CLAUDE.md) : on regroupe et on replie, on ne dé-densifie pas.

### Q.1 — Zonage de la colonne : Timeline / Analyse / Partition *(🟠 haute, UI — fondation)*
- Composer la colonne en 3 zones nommées via un composant de section partagé
  (titre + skin uniforme) : **Timeline** (Repères + Stage + Boucles collée au
  stage), **Analyse** (Tempo + Accords + Séparation/Structure rapatriées — cf.
  Q.2), **Partition** (LeadSheet). Stacks imbriqués à gaps différenciés
  (`--space-l` entre zones, `--space-xs` dedans) + `Box` bordure/`--panel` par
  zone.
- Au passage, régler l'incohérence des têtes de rangée (constat esthétique
  confirmé) : une classe partagée `.sectionLabel` (micro-label uppercase, le
  vocabulaire dominant — 3 occurrences sur 5) appliquée partout, h2 sémantique
  conservé pour l'outline ; la rangée séparation reçoit enfin son label.

### Q.2 — Rangée « Analyser » unifiée + composant `DetectionAction` *(🟠 haute, UI)*
- Les 4 actions d'analyse dupliquent chacune le quatuor bouton + hint bloquant
  + ligne d'erreur + LiveStatus (3 maps `ERROR_COPY` quasi identiques,
  duplication assumée par commentaire dans tempo-panel). Extraire un composant
  partagé `DetectionAction` (même consolidation que PopoverForm en O.5), puis
  regrouper les 4 actions dans la zone Analyse : une rangée « Analyser :
  Séparer · Tempo · Structure · Accords » où chaque item porte son état
  (fait / en cours / bloqué). Le bouton structure devient voisin de la grille
  qu'il réécrit ; les marqueurs gardent seulement « + Repère / + Section ».
- **Attention** : ce regroupement révise deux décisions récentes documentées
  (N.4/PR #105 « Détecter les accords » en tête de son panneau ; SeparationPanel
  près de l'import) — à réviser explicitement au checkpoint d'approche, pas à
  traiter comme des oublis.

### Q.3 — Zone Analyse repliable + read-out « détecté » du header *(🟠 haute, UI)*
- Réutiliser exactement le motif P.3 (disclosure `aria-expanded`/`aria-controls`
  + préférence localStorage comme bars-per-row) : zone Analyse **repliée par
  défaut** quand un projet rouvert a déjà bpm + grille + structure, dépliée sur
  piste vierge. L'en-tête replié résume l'acquis (« 104 BPM · 4/4 ·
  12 sections · grille 96 mes. ») — c'est le mode « pratique » sans routing.
- Au passage, solder le constat ergonomie : `detected` du header est un tableau
  vide constant depuis le Jalon 1 sous un commentaire devenu faux
  ([shell-header.tsx:14](../packages/web/src/app/workstation-shell/shell-header.tsx#L14))
  — câbler tonalité + BPM (le BPM est dans `tempo.analysis` ; la tonalité vit
  dans la directive `{key:}` du source, à exposer hors texte), ou supprimer la
  prop. L'un ou l'autre, pas un emplacement réservé menteur.

### Q.4 — Header : gaps de sous-groupes *(🟢 basse, micro)*
- La version large du constat a été réfutée (la hiérarchie existe déjà :
  Importer en primaryAction ambre, « ? » en ghost, filet du statut serveur).
  Reste la version étroite : Exporter/Enregistrer/Projets partagent le même gap
  uniforme que le reste du Cluster droit — des gaps distincts entre
  sous-groupes (document | E/S | utilitaires) suffisent.

### Q.5 — Doubles emplois : « Vitesse » vs « Tempo », boucles voisines du stage *(🟡 moyenne, copy + réordonnancement)*
- Renommer le slider du footer « Vitesse » (id `transport.tempo-label` +
  `i18n:extract`) — « Tempo » est réservé au BPM musical ; aujourd'hui deux
  read-outs « Tempo » simultanés ne mesurent pas la même grandeur.
- Déplacer LoopControls immédiatement sous le stage (simple réordonnancement du
  Stack) : la rangée boucle devient voisine de la région qu'elle contrôle, et
  son apparition (elle rend `null` sans région) cesse d'être un saut de layout
  au milieu de la colonne — le constat « sauts de layout » est absorbé par
  Q.1 + Q.5 (l'item Séparation de la rangée Analyser garde une hauteur stable
  au lieu de disparaître à `ready`).

---

## Lot R — Feedback unifié des opérations longues *(irritant #2 — enquête dédiée)*

> **Inventaire confirmé : 10 opérations longues, 4 patterns divergents.**
> Barre + % + Annuler (séparation seule), chip header `<output>` (URL/save/
> open), **label de bouton swappé** (les trois détections — les opérations les
> plus fréquentes, exactement le symptôme rapporté), et rien du tout (export
> zip, décodage sans annonce a11y). Paradoxe clé : l'AbortSignal est câblé
> bout-en-bout depuis O.5 pour /tempo /chords /structure mais **aucune
> annulation n'est offerte à l'utilisateur** ; le cold start Modal (~50 s) et
> le mint de token sont totalement muets.

### R.1 — Primitive `OperationStatus` *(🟠 haute, UI + refactor minimal)*
- Nouveau composant dumb `packages/web/src/app/ui/operation-status.tsx` : une
  ligne compacte (Cluster) in situ sous chaque déclencheur — `<progress>`
  déterminé (0–1 réel) ou indéterminé, label Lingui résolu par l'appelant,
  « Annuler » rendu seulement si `onCancel` fourni, `detail` secondaire différé
  (`detailAfterMs`), **LiveStatus intégré** (le canal a11y vient gratuitement).
  Toutes les briques existent : LiveStatus, peau `<progress>` de la séparation,
  `.busyCancel` du header, tokens teal/motion (teal = travail machine),
  `prefers-reduced-motion` global.
- Généralise le gabarit déjà validé de la séparation ; remplacement de 5 blocs
  d'affichage, hooks et core inchangés. Brancher aussi la branche « Décodage… »
  de la waveform (aujourd'hui un `<p>` nu sans annonce, 1–5 s à chaque import
  ET chaque ouverture de projet — sans cancel, `decodeAudioData` n'est pas
  abortable).

### R.2 — Exposer l'annulation des trois détections *(🟠 haute)*
- Les trois hooks tiennent déjà un AbortController abouti (abort → libération
  du sémaphore serveur, éprouvé O.5). Exposer `cancel()` (~4 lignes chacun :
  abort + bump du run-id + `setDetecting(false)`) et le passer au `onCancel`
  d'OperationStatus. Aucun changement core/serveur.

### R.3 — Offload : busy dès le clic, cold start narré *(🟠 haute)*
- `setDetecting(true)` n'arrive qu'**après** `await gate()`
  ([use-structure-detection.ts:117-128](../packages/web/src/app/markers/use-structure-detection.ts#L117)) :
  le round-trip de mint (Edge Function) se déroule bouton actif, rien annoncé.
  Monter le busy avant la gate (redescendre sur échec).
- Le cache de token étant en mémoire de module (vide à chaque chargement de
  page), le warm-on-import est un no-op au premier import de chaque session :
  la première analyse peut payer le cold start ~50 s avec pour seul feedback un
  label figé. Passer `mayColdStart = isAnalysisOffloaded()` à la primitive →
  après ~4 s, ligne `detail` « Démarrage du moteur d'analyse (jusqu'à
  ~1 min)… » (id `structure.cold-start`).

### R.4 — Export/sauvegarde : peindre le statut avant le gel *(🟡 moyenne, palliatif)*
- `zipSync` et le ré-encodage WAV de `mixedStems` gèlent le main thread AVANT
  que le busy ne soit posé (le chip « Enregistrement… » apparaît après le gel).
  Court terme : poser l'état busy puis céder un frame
  (`await new Promise(requestAnimationFrame)`) avant le travail synchrone. Le
  vrai fix (fflate `zip()` async + encode off-thread) reste la veille STATUS,
  inchangée — la primitive R.1 y branchera une vraie progression le jour venu.

---

## Lot T — Les ponts analyse → pratique *(fonctionnalités + ergonomie)*

> Le produit calcule sections, downbeats et mesures, mais le geste central —
> boucler un passage — reste un drag main levée au pixel ; la chart surligne
> sans être navigable. C'est le plafond des deux axes.

### T.1 — Boucles musicales : « Boucler la section » + snap au beat *(🟠 haute)*
- `regionFromRatios` convertit des ratios écran en secondes brutes, aucun
  producteur de `setLoopRegion` ne lit le `BeatGrid` (grep vide sur
  beat/grid/quantize dans app/loops/). Deux incréments : (1) core pur
  `snapLoopRegionToGrid(region, grid, unit: 'beat' | 'bar')` (property tests),
  appliqué en fin de drag quand une grille existe (échappable avec Alt, pattern
  DAW) ; (2) action « Boucler la section » par marqueur de structure (région =
  downbeat du repère → repère suivant / fin), réutilisant `markerSections`
  mémoïsé au shell — une ligne de wiring par rangée du panneau Repères.

### T.2 — Nudge clavier en unités musicales *(🟠 haute)*
- `NUDGE_RATIO = 0.01` du ratio pleine piste : une frappe ←/→ déplace une
  poignée de boucle ou un repère de **2,4 s sur un morceau de 4 min** — le seul
  chemin clavier existant est inutilisable pour l'ajustement fin. Nudger d'un
  beat quand une grille existe, sinon 0,1 s (×10 avec Shift) ; changement local
  aux deux constantes (waveform-view, marker-rail) + le `beatGrid` déjà
  disponible chez les deux parents.

### T.3 — Chart navigable : clic-mesure → seek *(🟠 haute, UI slice)*
- Sync strictement unidirectionnelle aujourd'hui (mesures en `<div>` inertes),
  alors que les repères sont click-to-seek — et que tap-sur-mesure est un
  standard iReal/Chordify. Prop `onSelectMeasure(writtenIndex)`, mesures en
  `<button>` (a11y gratuite) ; mapping inverse pur en core : mesure écrite →
  occurrences jouées via `unrollChart`, choisir la prochaine occurrence ≥ tête
  de lecture, seek au downbeat correspondant (TDD, fast-check round-trip
  écrit↔joué).

### T.4 — Cmd/Ctrl+S = Enregistrer *(🟡 moyenne)*
- Le produit pousse à sauver souvent (chip « ● Non enregistré », guard
  beforeunload) mais Cmd+S déclenche « Enregistrer la page » du navigateur.
  Étendre `Command` avec `{ type: 'saveProject' }` bindé `{ key: 's',
  meta: true }` (+ ctrl) — `commandModifiersMatch` supporte déjà les
  modificateurs, la carte suit via `describeKeyBindings`. Standard accepté des
  ateliers web (Figma, Docs).

### T.5 — Champs BPM/mètre : le standard N.4 *(🟡 moyenne)*
- Un BPM hors bornes est clampé en silence (500 → 400), un mètre invalide
  rejeté en silence (le champ revient à l'ancienne valeur) — en retrait du
  standard posé par N.4 sur « mes. / ligne ». Aligner `CommitNumberField` sur
  le motif BarsPerRowField : draft + `aria-invalid` quand
  `normalizeManualBpm`/la validation mètre rejetterait ou clamperait. Couche
  présentation seule, contrats des hooks inchangés.

### T.6 — Découvrabilité : grammaire du format, gestes, boutons AT honnêtes *(🟡 moyenne, 1-2 slices)*
- La grammaire P.2+ (reprises `|: :|`, voltas, `{d.c.}`/`{coda}`/`{fine}`,
  directives `{k: v}`, `{time:}`) n'est enseignée nulle part — le seul guide
  est le placeholder `'[Couplet]\n| C | Am | F | G |'`. Popover « Aide du
  format » (10 lignes Lingui statiques, mécanique ShortcutsDialog).
- L'aide « ? » ne documente que le clavier : ajouter une section « Gestes »
  statique (drag-to-loop, déplacement des tags, double-clic reset des sliders
  — aujourd'hui cachés dans des `title` survol-seulement, inexistants au
  tactile).
- Deux affordances mentent à l'AT : la surface waveform est un `<button>`
  `onPointerDown`-seul (Entrée ne fait rien) et les tags du rail promettent
  « Aller à » sans onClick. Tags : ajouter le `onClick` de seek (vérifier
  l'absence de double-seek avec le pointerup) ; surface : la sortir du tab
  order (`<div>` à handlers pointeur) et documenter le geste dans l'aide.

### T.7 — Fine-tune de hauteur (±50 cents) *(🟡 moyenne)*
- `clampPitchSemitones` arrondit au demi-ton entier : un enregistrement 30
  cents haut (bandes accélérées, vieux enregistrements — le cœur de cible
  Transcribe!/Moises) est intranscriptible proprement. Ajouter `fineTuneCents`
  ∈ [−50, +50] **séparé** (persisté avec tempo/pitch au manifest) — le flag de
  divergence N.3 et `transposedBy` restent en demi-tons, le fine-tune ne
  participe pas au modulo 12. SoundTouch accepte déjà le fractionnaire.

### T.8 — Deux décisions produit à acter *(décision, pas du code)*
- **Spectre** : l'onglet placeholder date du Jalon 1, la veille passe-2 qui le
  différait (« trio transcription ») est à moitié caduque (detectKey livré
  PR #127) et l'entrée a disparu des veilles. Trancher : (a) v1 honnête —
  chroma `AnalyserNode` sur la boucle active (fold FFT→chroma pur en core,
  rendu canvas), le plus petit pas qui tient « pics = notes candidates » ; ou
  (b) ré-acter en veille datée et retirer les onglets vides (révise la décision
  « honest placeholders », re-jugée déjà deux fois — à assumer explicitement).
- **EQ** : promis au plan produit (§ manipulation temps réel), ni livré ni en
  veille. Soit l'acter en veille (« couvert en pratique par la séparation »),
  soit une petite slice `BiquadFilterNode` low/high-cut par stem (le mixer est
  le point d'insertion naturel) — la séparation ne découpe pas deux instruments
  du même type.

---

## Lot U — Refermer la gate sur le périmètre cloud *(qualité de code + sécurité)*

> Le déficit de l'axe qualité n'est pas dans le code écrit mais dans le
> périmètre vérifié : les deux nouveaux livrables d'infrastructure vivent hors
> de toute gate, et les cliquets ne pincent plus rien.

### U.1 — modal_app.py : humble object + ruff *(🟠 haute)*
- Le middleware d'auth de production (`require_token` : parsing bearer, bypass
  OPTIONS, écho CORS manuel sur 401) est hors ruff, hors pyright
  (`include = ["app"]`), hors pytest (`--cov=app`, zéro import dans les tests)
  — exactement la classe de trou que O.4/B.3 ont soldée partout ailleurs.
  Extraire `app/analyze_gate.py` (importable sans torch/modal — `modal` n'est
  pas dans requirements-dev, l'extraction est la condition du test), testé via
  TestClient (token valide/forgé/expiré/absent, OPTIONS, écho CORS
  allowlistée/étrangère) ; modal_app.py redevient composition pure. Ajouter
  `modal_app.py` aux cibles ruff de la CI.

### U.2 — CI deno sur supabase/functions *(🟡 moyenne)*
- L'Edge Function (155 lignes : CORS, 401/403/429/500, mint HS256) a des tests
  mais exécutés à la main contre le stack live ; ci.yml n'a aucun job deno,
  knip ignore l'arbre. Job léger sans stack : `deno check` + `deno lint` +
  `deno fmt --check` (~20 s ; seul réseau : djwt depuis deno.land). Niveau
  supérieur optionnel : injecter les deux fetches et tester `handler`
  hors-ligne.

### U.3 — Brute-force des codes beta + entropie du secret *(🟡 moyenne + 🟢 basse)*
- `redeem_beta_code` est un oracle gratuit : échec non pénalisé, aucun
  rate-limit PostgREST, inscription ouverte (captcha commenté), aucune entropie
  imposée sur `code text primary key`. Imposer/documenter des codes ≥128 bits
  (`gen_random_uuid()`) + friction sur les échecs (compteur + verrou temporaire
  dans la fonction) ; test SQL d'une rafale refusée.
- Le secret HS256 partagé n'a aucun plancher : asserter `len(secret) >= 32` au
  démarrage côté Modal et Edge (échec explicite), documenter la rotation
  double-secret au runbook.

### U.4 — Resserrer les cliquets *(🟡 moyenne — 5 lignes de config)*
- jscpd : seuil 2,5 % pour 0,38 % mesuré (l'abaissement à 1,5 % promis en O.5 a
  été silencieusement abandonné) → **1,0 %** (marge ×2,5). Stryker :
  `break 80` pour 93,4 % réel (marche 95,2 → 93,5 à l'arrivée de
  song-structure, plateau depuis) → **break 90** (low 90, high 95). Les 7
  survivants de song-structure.ts sont déjà documentés équivalents (rapport
  S.2) — au besoin, en laisser trace dans le code.

### U.5 — Basses groupées *(🟢 1 micro-slice)*
- Allowlist d'origines écrite trois fois en trois langages (main.py,
  modal_app.py, index.ts — dont un fichier hors gate) : env-driver **ensemble**
  Modal (`LOUPE_ALLOWED_ORIGINS` via secret) et Edge (`Deno.env`) pour garder
  la symétrie voulue ; croiser les trois emplacements au runbook.
- `_boundaries_to_segments` (fence-post décidable) vit dans structure.py exclu
  de coverage + pyright — le trou O.4, même moule : déplacer dans
  `structure_segments.py` (pur, déjà testé) + 2-3 cas pytest.
- `tempo.ts` : 524 lignes, 26 exports, 4 concepts (grille/mètre/map/manuel) —
  split mécanique `beat-grid.ts` / `tempo-map.ts` / `manual-tempo.ts` sans
  changement d'API publique, **au prochain passage dans le fichier**.

---

## Lot V — Performance résiduelle *(l'axe remonte : 13,5 → 15)*

### V.1 — Upload d'analyse : mono + 24 kHz *(🟠 haute — LA durée dominante de la détection structure offloadée)*
- Les trois détections uploadent le WAV plein débit (stéréo 44,1 kHz, ~42 MB /
  4 min) alors que les trois endpoints replient aussitôt en mono et
  rééchantillonnent (24 kHz structure, 22 050 chords, interne beat_this). Sur
  Modal (inférence chaude ~0,5 s), l'upload domine la latence perçue —
  réductible **3,7×**. Ajouter `encodeAnalysisWavMemo` séparé (le memo
  `/separate` garde le plein débit) : downmix mono pur en core +
  rééchantillonnage `OfflineAudioContext` dans l'adapter (humble object),
  branché dans `postWavForJson` pour /tempo /chords /structure. Étape minimale
  sans risque : mono seul (déjà 2×). Mesurer avant/après sur la détection
  structure offloadée — le levier « durée réelle » complémentaire du Lot R.

### V.2 — Décharger le moteur mono-piste après hand-off *(🟡 moyenne)*
- Résidu consigné de L.3 : après le seat automatique du métronome (chemin par
  défaut de chaque import), l'AudioBuffer du moteur mono-piste (~85 MB
  float32 / 4 min) devient du poids mort jamais libéré (aucun `unload` sur le
  port). Ajouter `unload()` à `PlaybackEngine`, l'appeler au hand-off quand
  `stemsActive` passe à vrai ; recharger paresseusement depuis `loadedAudio` au
  hand-back. TDD sur le hand-off (fakes du shell-test-kit), heap snapshot
  avant/après (motif L.3).

### V.3 — Warm des modèles au démarrage du serveur local *(🟢 basse)*
- Les trois modèles se construisent à la première requête — or la détection de
  tempo se lance automatiquement à l'import : la première détection de chaque
  session paye le chargement (et au premier lancement, ~78 MB de poids
  beat_this). Modal a résolu ce problème (`@modal.enter`) ; le serveur local
  n'a pas d'équivalent. Thread démon best-effort au lifespan (opt-out
  `LOUPE_WARM_MODELS=0`), erreurs avalées — le lazy + 503 reste le fallback.

### V.4 — Playhead en `transform` *(🟢 basse)*
- `playhead.style.left = …%` à chaque frame (layout scoped + paint) →
  `transform: translateX(…px)` compositor-only + `will-change` ; la largeur de
  `.inner` est déjà lue dans `apply()`. Browser-verify l'alignement aux
  extrémités et sous zoom.

---

## Lot W — Finitions design *(nourrit directement l'impression « brouillonne »)*

### W.1 — Deux rangées denses ne wrappent pas *(🟠 haute — rupture Every Layout)*
- `.panel` du tempo (~10 items) et `.header` du panneau accords : `display:
  flex` sans wrap, contrairement à toutes les autres rangées (header,
  transport, Cluster des repères). Remplacer par Cluster ou `flex-wrap: wrap` ;
  acceptance test : rendu en conteneur étroit, `scrollWidth ≤ clientWidth`.

### W.2 — Une seule peau « Confirmer ? » destructive *(🟠 haute)*
- Trois faces pour la même sémantique deuxième-clic-qui-détruit :
  danger-rouge (header, projects, analysis-panel), **ambre** (drop-dialog —
  le même acte « remplacer la session » que le bouton header rouge), et
  quietButton **inchangé** (les confirmations les plus lourdes : « Remplacer
  les repères et la grille ? », « Écraser la grille ? »). Extraire
  `.confirmFace` dans controls.module.css (la recette header/projects) et
  l'appliquer à l'état armé partout ; aligner le drop-dialog (ou corriger le
  commentaire du header si l'ambre est l'intention). Micro-slice type O.2.

### W.3 — Faux-gras synthétisés *(🟡 moyenne)*
- Titres de dialogs/popovers en Space Grotesk **600** alors que seul 500.css
  est chargé ; signature rythmique en Petaluma **600** alors que la fonte n'a
  que 400 (le seul élément de la chart en faux-gras). Charger 600.css ou
  abaisser à 500 ; retirer le 600 du `.timeSignature` (le 400 est le rendu
  authentique de la maquette). Vérif navigateur avant/après.

### W.4 — Typo chart sur l'échelle + verrou font-size *(🟡 moyenne)*
- `.chartTitle` 1.6rem et `.glyph` 1.5rem : littéraux entre les pas xl/2xl de
  l'échelle — la classe de dérive que check:tokens ne voit pas. D'abord tenter
  de rabattre sur l'échelle (`--font-size-xl`), sinon tokens chart dédiés
  commentés (« régime typo chart, Petaluma ») — convention O.2 : pas de token
  hors échelle par défaut. Étendre check-css-tokens.sh d'un grep bloquant
  `font-size: [0-9]` hors tokens.css (2 lignes).

### W.5 — Basses groupées *(🟢 1 micro-slice)*
- `.kbd` : deux peaux pour la même touche (empty-state vs dialog raccourcis,
  vues à quelques secondes d'intervalle) → classe partagée dans
  controls.module.css (variante dialog).
- AccountMenu : `.trigger` recopie `secondaryAction` sans le dip `:active`
  (seul bouton du header sans pressed-feedback) → promouvoir `.secondaryAction`
  dans controls.module.css (3 consommateurs).
- `styles.section` référencé dans lead-sheet.tsx sans classe correspondante
  (className silencieusement undefined) → retirer ou déclarer porteur
  d'intention ; en prévention, un check léger styles.X ↔ classes définies
  (esprit check:tokens).
- 9 re-déclarations du focus ring identiques à la baseline globale (+ le
  `-2px` divergent d'import-menu sans commentaire) → supprimer les copies,
  commenter la divergence voulue.
- Reliquats O.2 : `--tracking-label` sur `.sub` de l'empty-state, `1px` →
  `--space-3xs` sur `.tag` du rail, propriétés logiques dans lead-sheet.

---

## Veille (décisions, pas des oublis)

- **Rejeu du jeton d'analyse (J3)** : quota = rythme de mint, plafond de
  dépense Modal = garde-fou dur (décision J2) ; si J3 s'ouvre : jti + TTL
  60-90 s + purge du cache après analyse, ou métrage léger Modal→Supabase.
- **`useDetectionRun` générique** : over-fit tant que seule la paire
  chords/structure coïncide (décision S.3a) — re-juger à la 4ᵉ détection.
- **Autorité de la grille sur les marqueurs** : l'écrasement à l'édition est
  assumé (décision marker-kinds) ; adoucissement possible sans casser
  l'autorité (ne pousser `setSections` que si l'ensemble dérivé a changé,
  préserver id/temps des sections inchangées) — à ouvrir si l'usage mord.
- **Frontières memo** : L.1 mesuré suffisant ; si un lot perf rouvre le rendu,
  commencer par mémoïser `deriveChartHeader` (inline au shell, casserait tout
  memo sur LeadSheet).
- **Signature `{beats, unit}`** : différé PR #129 ; la directive `{time:}`
  prime, le pipeline DBN rend les métriques composées au temps composé.
- **Modèle DAW à scroll interne** : inchangé (veille roadmap-3) — le Lot Q est
  conçu pour être indépendant de cette décision.
- Et les entrées existantes de STATUS.md (export off-thread — R.4 n'est qu'un
  palliatif —, locale EN, thème clair, boucle clavier, Jalon 4…).

---

## Suivi

- [x] **Q.1** zonage Timeline / Analyse / Partition + `.sectionLabel`
- [x] **Q.2** rangée « Analyser » + composant `DetectionAction`
- [x] **Q.3** zone Analyse repliable + read-out « détecté » du header
- [x] **Q.4** header : gaps de sous-groupes
- [x] **Q.5** « Vitesse » + LoopControls sous le stage
- [x] **R.1** primitive `OperationStatus` (+ branche décodage)
- [x] **R.2** annulation des trois détections
- [x] **R.3** busy avant gate + cold start narré
- [x] **R.4** peindre le statut avant zipSync/mixedStems
- [ ] **T.1** boucles musicales : section + snap au beat
- [ ] **T.2** nudge clavier en unités musicales
- [ ] **T.3** chart cliquable → seek
- [ ] **T.4** Cmd/Ctrl+S
- [ ] **T.5** champs BPM/mètre aria-invalid
- [ ] **T.6** aide format + gestes + boutons AT honnêtes
- [ ] **T.7** fine-tune ±50 cents
- [ ] **T.8** décisions spectre + EQ actées
- [x] **U.1** analyze_gate.py + ruff sur modal_app.py
- [x] **U.2** job CI deno
- [x] **U.3** brute-force codes beta + plancher secret
- [x] **U.4** cliquets jscpd 1,0 / Stryker break 90
- [ ] **U.5** basses groupées (origins env, _boundaries_to_segments, tempo.ts)
- [ ] **V.1** upload d'analyse mono + 24 kHz
- [ ] **V.2** `unload()` du moteur mono-piste
- [ ] **V.3** warm des modèles au démarrage local
- [ ] **V.4** playhead en transform
- [x] **W.1** flex-wrap des rangées tempo/accords
- [x] **W.2** peau `.confirmFace` unifiée
- [ ] **W.3** faux-gras (Space Grotesk 600, Petaluma)
- [ ] **W.4** typo chart sur l'échelle + verrou font-size
- [ ] **W.5** basses design groupées
