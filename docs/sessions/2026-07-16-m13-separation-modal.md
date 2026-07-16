# Session — 2026-07-16 — M1.3 : séparation sur Modal

## Done
- **Côté Modal** (`server/modal_app.py`) : router `separation` monté à côté
  des trois détections — poids htdemucs_6s bakés dans l'image (`DEMUCS_MODEL`
  pinné dans l'env de l'image, une seule source pour le bake et le runtime),
  Demucs chargé + chauffé dans `@modal.enter`, timeout **900 → 1800 s**
  (aligné sur `LOUPE_SEPARATION_TIMEOUT_SECONDS`), CORS étendu à `GET`
  (les téléchargements de stems portent l'Authorization → préflightés),
  **`max_containers=1` + `@modal.concurrent(max_inputs=8)`** — les WAVs de
  stems vivent sur le disque du conteneur entre le `done` et les GET `/stems`,
  un scale-out les 404-erait ; le plafond à un conteneur double comme
  garde-fou de dépense M1.2. Déployé (v6).
- **Côté web** : `createHttpSeparator` prend un `tokenProvider` — le bearer
  couvre le POST `/separate` ET chaque GET de stem ; `create-separator`
  pointe sur `ANALYSIS_URL` (offload quand `VITE_STRUCTURE_URL` est posé,
  serveur local sinon) ; `useSeparation` passe le gate `ensureAnalysisToken`
  avant une run live (jamais `restore`), expose `gateReason` (menu compte,
  moule M1.1) ; la séparation dé-gatée de la santé locale en mode offload
  (X.1 étendu : `offloaded` sur `SeparationControl`).
- **Gate pytest** : le miroir de composition dans `test_analyze_gate.py`
  passe à `["GET","POST","OPTIONS"]` + pin « le gate couvre les GET aussi ».
- Budget react-doctor tenu : `gateReasonsOf` extrait vers
  `app/account/gate-reasons.ts` (Fast Refresh + WorkstationShell ≤ 300 l.).
- **Vérif réelle** (Modal v6, serveur local ÉTEINT, compte beta, app 5173) :
  - séparation complète depuis l'app : un mint → `/separate` 200 → **six
    stems téléchargés en HTTPS sur le même job** (l'affinité conteneur
    tient), Batterie+Autres dans le mixer, stems muets masqués ;
  - **wall clic → stems dans le mixer : ~65 s** (upload 37 MB plein débit +
    inférence + download 6 stems ≈ 222 MB décodés) — MAIS piste synthétique
    très compressible et Modal sert en `content-encoding: zstd`, donc le
    transfert réel était bien moindre ; sur de la vraie musique le download
    sera plus long (zstd sur PCM ≪ flac) — l'option compression du plan
    reste ouverte si ça mord ;
  - **abort bout-en-bout (O.5) confirmé** : sous réseau ralenti (Fast 3G),
    Annuler en plein upload → `/separate` finit `net::ERR_ABORTED`, retour
    idle, zéro erreur. Les premiers essais « ratés » étaient une illusion de
    timing (run chaude finie avant le clic) — diagnostiqué par
    instrumentation temporaire, retirée.
- Nouvelle spec d'intégration `use-separation-abort.spec.tsx` : le VRAI
  `createHttpSeparator` câblé dans `useSeparation` — cancel pendant le mint
  (jamais de transfert) et cancel en plein transfert (signal aborté).

## Not done / remaining
- La narration cold-start sur la face busy de la séparation (segment
  « démarrage » sur la barre réelle) : volontairement laissée à **M1.4**,
  comme le plan le prévoit.
- Copy d'erreur réseau spécifique offload pour la séparation (le message
  brut du transport s'affiche) : à ranger dans M1.4 avec la santé par
  endpoint effectif.
- Plafond de dépense / alerte de facturation Modal : à poser dans le
  dashboard avant d'exposer la séparation aux beta-testeurs.

## Decisions
- **Affinité conteneur par plafond** : `max_containers=1` (+ concurrence
  intra-conteneur 8) plutôt qu'un stockage partagé des stems — les WAVs
  restent éphémères sur le disque du conteneur (cloud sans état), et le
  plafond sert de garde-fou de dépense (M1.2). À re-peser si multi-conteneur
  devient nécessaire (alors : volume partagé ou stems inline).
- Un seul token couvre la run entière (POST + 6 GET) — lu une fois par run
  dans l'adapter ; les tokens durent 5 min, une run chaude en prend ~1.

## Gate status
- typecheck: ✅ (`pnpm gate` exit 0)
- tests (with coverage): ✅ **1640 tests** (+11), 97,27 % statements
- mutation (Stryker, local, if core touched): skipped — `@app/core`
  intouché (le use-case `separateTrack` existait déjà ; adapters/hooks web
  + `server/` seulement)
- biome / sheriff / knip / jscpd / react-doctor: ✅ (gate exit 0), pytest
  **233** (+1)

## State to resume from
- **Single next action** : ouvrir la PR de M1.3 (branche à créer depuis ce
  working tree), puis **M1.4** — santé par endpoint effectif + UX hors-ligne
  + narration cold start étendue aux quatre opérations offloadées.
- Gotchas :
  - le serveur Modal sert les stems avec `content-encoding: zstd`
    automatiquement — toute mesure de transport doit se faire sur de la
    VRAIE musique, le synthétique ment (~40:1) ;
  - les URLs de stems renvoyées par Modal sont absolues et en `https`
    (base_url correcte derrière le proxy) — pas besoin du fallback pathname
    envisagé ;
  - `modal deploy` reconstruit l'image (~15 min) quand `app/` change — le
    layer pip est cache tant que `requirements.txt` ne bouge pas.
