# Plan — client léger : le calcul sur Modal, l'app dans Tauri

> **Cap** (acté 2026-07-16, [roadmap v5 § Cap](roadmap-excellence-5.md)) :
> loupe doit tourner sur des machines peu puissantes. Tout ce qui peut migrer
> vers Modal migre ; le shell web devient une app de bureau **Tauri**.
>
> **Décisions déjà actées (2026-07-16, discussion du plan) :**
> 1. **Les projets restent locaux** — le cloud calcule et oublie.
> 2. **Ordre : Modal d'abord, Tauri ensuite** — le stockage ne peut quitter le
>    serveur Python qu'avec Tauri ; on migre le calcul pendant que le serveur
>    garde le stockage, Tauri emporte les stores FS et le retrait du serveur.
> 3. **Import URL : sidecar yt-dlp côté Tauri** (l'audio importé reste local ;
>    pas de transit cloud, pas d'IP datacenter). N'existe qu'à l'arrivée de
>    Tauri — d'ici là, l'import URL reste une capacité du serveur local.
> 4. **Mobile : option gardée ouverte, pas un engagement.** Tauri 2 cible
>    iOS/Android depuis la même base ; on n'engage rien sans le spike M-mob.
>
> 5. **Séquencement validé (2026-07-16)** : les cinq 🟠 de la roadmap v5
>    d'abord (X.1 en tête — prérequis de M1.1), AA.2 déplacé en T2.2, les 🟢
>    au fil de l'eau, puis Phase 1 — voir
>    [Séquencement](#séquencement-vs-roadmap-v5).

## Invariants du plan

- **Cloud sans état.** Modal reçoit de l'audio transitoire, renvoie un
  résultat, ne persiste rien. Supabase ne voit qu'auth + quotas. Aucun
  manifest, aucun stem, aucun audio persisté hors de la machine de
  l'utilisateur.
- **Le core ne bouge pas.** Toute la migration est un jeu d'adapters derrière
  les ports existants (`TempoDetector`, `ChordDetector`, `StructureDetector`,
  `StemSeparator`, `ProjectStore`, `ProjectAudioStore` —
  [ports.ts](../packages/core/src/application/ports.ts)). Si une phase exige de
  toucher un port, c'est un signal d'alarme à instruire au checkpoint.
- **L'app web reste utilisable à chaque étape.** Pas de branche longue : chaque
  slice merge sur un produit qui marche (serveur local encore supporté tant que
  Tauri n'a pas repris ses rôles).
- **Rien qui ferme la porte mobile** : pas de dépendance desktop-only dans le
  chemin nominal hors sidecar (l'import URL est déjà acté desktop-only).

## État des lieux

Rôles du serveur local (`server/app/main.py`) × cible :

| Rôle | Endpoint(s) | Cible | Quand |
|---|---|---|---|
| Détection structure | `/structure` | **Modal — fait** (J1/J2, gate JWT + quota) | ✅ |
| Détections tempo, accords | `/tempo`, `/chords` | Modal | Phase 1 |
| Séparation de stems | `/separate`, `/stems/{job}/{stem}.wav` | Modal | Phase 1 |
| Import URL | `/download` | Sidecar yt-dlp Tauri | Phase 2 |
| Stockage projets + audio | `/projects*`, `/audio*` | Filesystem via adapters Tauri | Phase 2 |
| Santé | `/health` | Sonde de l'endpoint effectif (généralise X.1) | Phase 1 |

Déjà en place et réutilisable tel quel : la chaîne d'auth complète (Supabase
beta codes → Edge Function `mint-analyze-token` → JWT HS256 5 min → gate
`analyze_gate.py`), le pattern lazy-router de `modal_app.py` (composition pure,
L4, `@modal.enter` warm, `scaledown_window=300`), les allowlists d'origines
env-driven trois surfaces (U.5), l'upload d'analyse mono 24 kHz (V.1) pour
tempo/accords/structure, et l'hexagone strict qui rend chaque swap local.

---

## Phase 1 — Modal : tout le calcul

### M1.1 — Tempo + accords sur Modal *(réutilise le chemin structure éprouvé)*
- Côté Modal : monter les routers `tempo` et `chords` dans `modal_app.py`
  (même moule que structure : poids beat_this/BTC pinnés sha256 baked dans
  l'image, warm dans `@modal.enter`). Une seule app / un seul conteneur — les
  trois modèles tiennent ensemble et partagent le warm (le serveur local V.3
  les charge déjà côte à côte).
- Côté client : `create-tempo-detector` / `create-chord-detector` pointent sur
  `ANALYSIS_URL` (aujourd'hui seul structure y va) ; le gate token
  (`ensureAnalyzeToken`) s'applique aux trois. Le quota J2 (20 mints/mois, un
  token couvre les analyses ~5 min) devient de fait le quota des trois
  détections — acceptable tel quel pour la beta, à re-peser en M1.2.
- **Prérequis fonctionnel : X.1** (roadmap v5) — le gating/copy « serveur
  local » doit être indexé sur l'endpoint effectif *avant* que tempo (détection
  auto à l'import !) ne parte sur Modal, sinon chaque import à froid raconte le
  mauvais serveur.
- Vérif : détection réelle des trois types sur Modal depuis l'app, quota
  décrémenté une fois, serveur local éteint.

### M1.2 — Modèle quota/coût de la séparation *(décision produit avant le code)*
- Mesurer d'abord : coût GPU réel d'un htdemucs_6s sur L4 (ou A10G si L4 ne
  tient pas) pour une piste de 3-4 min, temps mur, prix Modal. Le quota J2
  compte des *mints* calibrés pour des inférences ~0,5 s ; une séparation vaut
  plusieurs ordres de grandeur de plus.
- Trancher : unités pondérées (1 séparation = N unités), quota séparé
  (`separations_left` à côté du quota d'analyses), ou plafond de dépense Modal
  seul en garde-fou beta. Toucher au schéma Supabase = migration + tests SQL
  (moule U.3).
- **Mesuré (2026-07-16, `server/modal_separation_spike.py`)** : htdemucs_6s
  sur L4, piste 210 s → **4,7 s à chaud** (0,021 s GPU / s d'audio), 16,2 s à
  froid (load 0,9 + warmup 1,6 + infer 4,8), **0,57 GB de VRAM** (le L4 tient
  très largement, pas d'A10G). Au tarif L4 ($0.000222/s) : **~$0.001 par
  séparation à chaud**, ~$0.004 à froid — soit ~10× une analyse, PAS des
  ordres de grandeur. Le poste dominant est la fenêtre scaledown (300 s ≈
  $0.067), déjà payée par le conteneur M1.1 si la séparation y monte.
- **Décision (2026-07-16)** : **quota unique inchangé** — la séparation passe
  sous le même gate JWT/mint que les trois détections (20 mints/mois), aucun
  schéma Supabase touché ; garde-fou beta = plafond de dépense Modal ($30 de
  crédits Starter + alerte de facturation). Unités pondérées / quota séparé
  rejetés : de la complexité contre un coût mesuré sub-cent.

### M1.3 — Séparation sur Modal *(le morceau dur)*
- Gate : celui de M1.1 tel quel — la séparation consomme le même token
  d'analyse (décision M1.2, quota unique) ; VRAM mesurée 0,57 GB, elle monte
  dans le MÊME conteneur L4 que les trois détections (warm partagé).
- Côté Modal : router `separation` monté (image + poids htdemucs), en
  reproduisant le contrat streaming NDJSON (progress + `done`) que le client
  consomme (`http-separator.ts`) — l'AbortSignal bout-en-bout (O.5) doit
  survivre.
- Transport, l'arbitrage central : **~42 MB d'upload plein débit** (V.1 ne
  s'applique pas — la séparation nourrit le player, fidélité requise) **+
  ~250 MB de download** (6 stems WAV, 4 min). v1 = WAV plein débit, *mesuré*
  (temps réel sur connexion domestique) ; option consignée si ça mord :
  compression au transport (flac lossless ≈ ×1,7, opus lossy à arbitrer) avec
  ré-encodage local — jamais au prix de la fidélité stockée sans décision
  produit.
- Timeout Modal : 900 s actuels vs budget wall-clock 1800 s du serveur local
  pour `/separate` — à aligner.
- Le stockage des stems reste local : le client télécharge puis pousse dans
  `ProjectAudioStore` comme aujourd'hui (rien ne change après la ligne
  `decodeWav`).

### M1.4 — Santé, hors-ligne, narration *(absorbe X.1, généralise R.3)*
- La sonde de santé vise l'endpoint effectif par opération (local ou Modal) ;
  copy déclinée (« Service d'analyse injoignable — réessayer » vs « Lancer le
  serveur local »).
- Écrire l'UX hors-ligne : tout le local marche sans réseau (lecture, boucles,
  grille, projets, stems déjà séparés) ; seules les analyses exigent le réseau
  — les quatre items de la rangée Analyser passent en « bloqué : hors ligne »
  avec le même vocabulaire DetectionAction.
- Narration cold start : déjà en place pour structure (R.3) ; l'étendre aux
  quatre opérations offloadées (la séparation à froid = cold start + upload +
  inférence longue : la barre de progression réelle existe, le segment
  « démarrage » s'y ajoute).

**Sortie de Phase 1** : le serveur local ne sert plus qu'au stockage et à
l'import URL. Une machine faible fait tout le reste.

---

## Phase 2 — Tauri : le shell desktop, les données locales

### T2.1 — Spike coquille Tauri *(GO/NO-GO avant toute slice)*

> **Évaluation pré-spike (2026-07-17)** : l'import URL étant une
> fonctionnalité principale, l'alternative PWA+OPFS (pas de shell du tout) est
> écartée — il faut un sidecar local. Le choix se réduit à Tauri vs Electron :
> Tauri reste le premier candidat (empreinte minimale, sidecar de première
> classe, porte mobile), **Electron est le fallback acté en cas de NO-GO**
> (même plan T2.2–T2.5, moteur Chromium déjà testé ; coût ~150-250 MB de RAM).
> Le risque n°1 est le changement de moteur : loupe n'a été vérifié que sur
> Chromium, et WKWebView (WebKit) a un historique de bugs Web Audio — d'où les
> cas durcis ci-dessous. **Multi-plateforme confirmé (2026-07-17)** : Linux est
> une cible ; l'expérience directe de l'utilisateur (pixsaur sous Tauri tourne
> très bien sous Linux) dérisque le rendu et le packaging WebKitGTK — les cas
> audio durcis restent à rejouer sur Linux (au moins avant la beta, macOS
> première marche).

- Monter le shell web inchangé dans une fenêtre Tauri (macOS d'abord) et
  vérifier sur une piste réelle : décodage, lecture, time-stretch WASM
  (SoundTouch), drag & drop de fichiers, `OfflineAudioContext` (resample V.1),
  localStorage/preferences.
- **Cas durcis WebKit** (tirés des bugs connus) : lecture continue fenêtre
  minimisée / en arrière-plan (bug WebKit 231105 — mortel pour un outil de
  practice), lecture 6 stems + time-stretch prolongée (glitches sous charge),
  changement de périphérique de sortie audio en cours de lecture.
- **Inventaire licences au même spike** : SoundTouch (LGPL) / Rubber Band
  (GPL) — la distribution d'un binaire change les obligations vs un site web ;
  bloquant App Store le jour où mobile s'ouvre. Sortie : liste des
  dépendances × licence × obligation, et décision (garder / remplacer /
  isoler).
- Timebox court ; le résultat (GO, GO-avec-réserves, NO-GO) conditionne le
  reste de la phase.

### T2.2 — Stores filesystem *(le cœur de « les projets restent locaux »)*
- Adapters Tauri pour `ProjectStore` et `ProjectAudioStore` (FS via commandes
  Rust ou plugin fs) à **parité de contrat** avec `projects.py` : dédup sha256
  des refs audio, écritures atomiques, GC conservatif des refs orphelines,
  validation des refs par pattern. Les specs de contrat existantes côté web
  (fakes du shell-test-kit) rejouent telles quelles — c'est le test de
  l'hexagone.
- Au passage, **AA.2** (roadmap v5) trouve sa place naturelle : `parseProject`
  au bord — un store FS lit des fichiers que l'utilisateur peut éditer, la
  validation runtime cesse d'être optionnelle.

### T2.3 — Sidecar yt-dlp *(import URL desktop)*
- Binaire yt-dlp en sidecar Tauri : mêmes gardes que `download.py` (allowlist
  d'hôtes, budget wall-clock total, taille max) réimplémentées côté commande.
  Desktop-only assumé (mobile : sans import URL, ou via Modal le jour venu).

### T2.4 — Migration des données existantes
- Import `~/.loupe` → répertoire de données Tauri à la première ouverture
  (copie + vérification sha256, l'original intact) ; l'app web contre serveur
  local reste lisible pendant la transition.

### T2.5 — Retrait du serveur local du chemin nominal
- Le serveur sort de la doc d'installation ; il reste dans le repo comme
  chemin de dev/CI (les tests pytest continuent de verrouiller la logique
  partagée avec Modal — `app/` est la lib commune des deux déploiements).
- Docs, runbook, STATUS mis à jour ; les trois allowlists d'origines gagnent
  l'origin Tauri (`tauri://localhost` ou équivalent par plateforme).

**Sortie de Phase 2** : loupe = une app de bureau + Modal. Aucun Python local.

---

## Option gardée ouverte — mobile

- **Critère transversal dès maintenant** : aucune slice des phases 1-2 ne doit
  introduire une dépendance qui ferme iOS/Android (hors sidecar, déjà acté
  desktop-only).
- **Spike M-mob** (le jour où le sujet s'ouvre, pas avant) : webview iOS
  réelle — décoder + jouer + time-stretch une piste, mesurer la mémoire (les
  ~88 MB/AudioBuffer et un projet 6 stems ≈ 500 MB de PCM ne passeront
  probablement pas sans mode dégradé : moins de stems résidents, décodage à la
  demande).
- **Bloquants connus** : licences GPL/LGPL vs App Store (cf. T2.1) ; audio en
  arrière-plan ; l'UI atelier dense — un checkpoint produit à part entière,
  pas une recompilation.

---

## Séquencement vs roadmap v5

**Validé par l'utilisateur le 2026-07-16** : la recommandation ci-dessous
s'applique — les cinq 🟠 d'abord, X.1 en tête, puis Phase 1.

Éléments qui ont motivé la décision :

- **X.1 est de toute façon un prérequis de M1.1** (gating/copy sur l'endpoint
  effectif — sinon la détection auto du tempo raconte le mauvais serveur à
  chaque import offloadé). Il est absorbé/généralisé par M1.4.
- **AA.2 (parseProject)** a sa place naturelle en T2.2 (stores FS) — le faire
  avant n'est pas perdu, le faire là est mieux motivé.
- Les trois autres 🟠 (X.2 relance tempo, Y.1 hauteur header stems, Z.1 clic
  métronome/chroma) et **AA.1** (Dependabot pip — une config) sont
  indépendants de la migration : petits, visibles, livrables en quelques
  sessions.
- Les 🟢 (Y.2–Y.6, Z.2–Z.4, AA.3–AA.7) peuvent vivre au fil de l'eau, comme
  les basses des passes précédentes.

**Recommandation** : livrer les cinq 🟠 d'abord (X.1 en premier — il sert
directement la migration), puis ouvrir M1.1 ; les 🟢 au fil des sessions,
AA.2 déplacé en T2.2. Coût : quelques sessions avant la Phase 1 ; bénéfice :
on n'empile pas une migration d'infra sur des régressions connues.

## Suivi

- [x] **M1.1** tempo + accords sur Modal (prérequis : X.1) — livré 2026-07-16,
      vérifié réellement (Modal v5, un mint pour trois détections, serveur local
      éteint) ; voir [rapport](sessions/2026-07-16-m11-tempo-chords-modal.md)
- [x] **M1.2** modèle quota/coût de la séparation — mesuré 2026-07-16
      (~$0.001/séparation à chaud sur L4) ; décision : quota unique inchangé +
      plafond de dépense Modal (voir § M1.2)
- [x] **M1.3** séparation sur Modal — livré 2026-07-16, vérifié réellement
      (serveur local éteint, abort `net::ERR_ABORTED` sous réseau ralenti) ;
      transport à re-mesurer sur vraie musique (zstd ment sur du synthétique) ;
      voir [rapport](sessions/2026-07-16-m13-separation-modal.md)
- [x] **M1.4** santé par endpoint effectif + UX hors-ligne + narration —
      livré 2026-07-16, vérifié réellement (vraie musique 4:09 séparée en
      72 s, hors-ligne live, narration visible) ; **sortie de Phase 1
      atteinte** — voir
      [rapport](sessions/2026-07-16-m14-sante-horsligne-narration.md)
- [ ] **T2.1** spike coquille Tauri + inventaire licences (GO/NO-GO)
- [ ] **T2.2** stores filesystem à parité (dédup, atomicité, GC) + parseProject
- [ ] **T2.3** sidecar yt-dlp (gardes réimplémentées)
- [ ] **T2.4** migration `~/.loupe`
- [ ] **T2.5** retrait du serveur local du chemin nominal + origins Tauri
