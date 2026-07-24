# Session — 2026-07-11 — chords-endpoint (Lot C, slice serveur + spike BTC)

## Done
- **Spike BTC (angle mort #2) — LEVÉ ✅** (exécution autorisée explicitement par
  l'utilisateur) : `jayg996/BTC-ISMIR19`, poids **fournis dans le repo**
  (`btc_model.pt` maj-min ~33 Mo + large-voca), tourne sur le venv serveur
  (Py 3.14, torch 2.12, librosa 0.11) après 2 frictions d'âge triviales
  (loader PyYAML, alias `np.float`). **CPU : 2,4 s pour 257 s d'audio**
  (features CQT 2,1 s + inférence 0,2 s). Sortie cohérente et stable sur
  `example.mp3` (progression F♯/B/A♯m/C♯), syntaxe mir (`A#:min`, `N`).
- **Angle mort #1 (pré-séparation Demucs) — DIFFÉRÉ, décision** : BTC est
  entraîné sur des **mix complets** (son régime nominal) et la sortie full-mix
  est déjà cohérente ; brancher `/chords` derrière une séparation ajouterait
  minutes + couplage pour un gain non quantifié par la littérature. À
  revisiter seulement si la qualité déçoit sur pistes réelles.
- **Endpoint `POST /chords`** (`server/app/chords.py`, shell torch en miroir de
  `tempo.py`) : WAV 16-bit → `decode_wav_mono` → resample 22 050 Hz → log-CQT
  par fenêtres de 10 s → BTC par fenêtres de 108 frames → spans
  `{start, end, label}` mir. Import paresseux dans `main.py`, **503** sans
  torch ; sémaphore `LOUPE_MAX_CONCURRENT_CHORDS` (défaut 1) ; cap upload
  partagé ; erreurs client génériques. Device par défaut **cpu** (mesuré
  suffisant), `LOUPE_CHORDS_DEVICE` pour surcharger.
- **BTC vendoré** (`server/app/btc/`, MIT, en-têtes d'attribution) :
  `btc_model.py` (imports relatifs, bloc training retiré) +
  `transformer_modules.py` (verbatim sauf `np.float`→`float`). Exclu de
  ruff (extend-exclude) / pyright / coverage — le checkpoint publié charge tel
  quel. Config du checkpoint inline (`MODEL_CONFIG`, faits de l'artefact).
- **Poids sha256-pinnés** (`app/weights_cache.py`, torch-free testé) :
  téléchargés une fois vers `~/.cache/loupe/btc/`, **re-hashés à chaque hit**
  (le cache est du disque utilisateur, pas un store de confiance), digest ≠
  pin → suppression + erreur — `torch.load(weights_only=False)` (le
  checkpoint pré-safetensors porte des scalaires numpy que
  `weights_only=True` refuse, alias numpy 2 `core`→`_core` déjouant
  l'allowlist) ne dépickle donc **que l'artefact audité**.
  `LOUPE_CHORDS_CHECKPOINT` pointe une copie locale.
- **Humble object** : `app/chord_spans.py` pur (vocabulaire 25 classes +
  regroupement frames→spans, clamp de toutes les frontières à la longueur
  réelle — le modèle arrondit aux fenêtres entières, index hors vocabulaire →
  `N`), testé exhaustivement. `requirements.txt` : pin `librosa==0.11.0`
  (était dans le venv en **orphelin** de l'ancien serveur tempo librosa —
  import direct désormais).
- **Smoke end-to-end réel** : TestClient + poids du clone → 200 en 0,1 s sur
  30 s d'audio 44,1 kHz (resample vérifié), mêmes accords que le spike, clamp
  de fin exact.
- README serveur : contrat `/chords`, humble objects, caps/concurrence.
- **Revue interne (2 finders) appliquée** : LICENSE MIT vendorée à côté du
  code (clause de rétention de notice) ; download des poids passé de
  `urlretrieve` (sans timeout — un stall réseau sous `_model_lock` aurait
  bloqué `/chords` jusqu'au restart) à `urlopen` streamé avec timeout
  d'inactivité 30 s ; échec poids (fetch/pin) → **503** `WeightsUnavailable`
  au lieu d'un 400 qui accusait l'audio du client ; garde du chunk CQT final
  d'1 sample (`len % 220500 == 1` → `ParameterError` librosa, vérifié par le
  finder → 400 permanent sur une piste valide) ; restes de training retirés
  du vendoré (`use_cuda`, `forward` à labels). Vérif du finder : la
  convention `10/108 s/frame` est exacte par fenêtre, pas de dérive cumulée.

## Not done / remaining
- **Slice web** (dernière du Lot C) : adapter `createHttpChordDetector`
  (POST WAV → spans, traduction mir→tokens de grille `C:min`→`Cm`,
  `N`/`X`→`undefined`) + bouton « Détecter les accords » dans le panel
  lead-sheet (pré-remplit le brouillon via `detectChords`, gating santé
  serveur comme « Séparer »). Dépend du merge de **PR #86** (core) et de
  cette PR serveur.
- Le vote large (`voca=True`, 170 accords) et ISMIR2019 : différés (stretch
  assumé bruité, cf. plan).

## Decisions
- **`/chords` tourne sur le mix complet** (pré-séparation Demucs différée) —
  régime d'entraînement de BTC, latence négligeable, zéro couplage.
- **Vendoring plutôt que dépendance** : BTC n'est pas sur PyPI ; 2 fichiers
  MIT verbatim sous `app/btc/`, exclus du lint/format/typecheck — la
  discipline s'applique à notre code, pas à l'artefact.
- **Pin sha256 comme condition du unpickle** : politique générale posée dans
  `weights_cache.py` (réutilisable) — on ne `torch.load` jamais un fichier
  téléchargé non vérifié.
- **mir syntax sur le fil** : le serveur parle la langue du moteur (comme
  `/tempo` livre des instants bruts) ; la traduction vers les tokens de grille
  est le contrat de l'adapter web (déjà documenté sur le port `ChordDetector`).

## Gate status
- Serveur (miroir CI torch-free) : ruff check ✅ · ruff format ✅ · pyright ✅
  (0 erreur) · **pytest 127** ✅ (+15), coverage 97,74 %.
- Gate web/core : non touché par cette slice (la PR #86, séparée, est verte).
- mutation (Stryker) : non applicable (aucun changement `@app/core`).

## State to resume from
- **Single next action** : merger PR #86 (core) + la PR de cette slice, puis
  slice web : `createHttpChordDetector` dans
  `packages/web/src/audio/` (miroir de `http-tempo-detector.ts`) + bouton dans
  `chord-chart-panel.tsx` appelant `detectChords` avec `grid` + `barsPerRow`
  du panel — confirmer l'approche UI en 2–3 lignes avant de coder
  (convention).
- Gotchas : la traduction mir→token doit couvrir `X` (no-chord « autre ») ;
  le brouillon écrase la source du panel — prévoir confirmation si la grille
  n'est pas vide ; premier appel `/chords` télécharge ~33 Mo (latence
  one-shot) — l'UI doit le dire (état « préparation du modèle »).
