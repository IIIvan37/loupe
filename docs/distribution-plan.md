# Plan — distribution « serveur local + navigateur »

Décision 2026-07-26 (conversation, re-instruite depuis la re-confirmation du
matin) : loupe se distribue en **serveur local + navigateur**, pas en bundle
Tauri signé. Motifs : cible multi-OS (pas que Mac) → la voie Tauri cumule
signature Apple 99 $/an + SmartScreen/certificat Windows + **trois** moteurs
webview à valider pour une app Web Audio ; le serveur local n'exige aucune
signature (brew/scoop/uvx ne posent pas de quarantaine) et fait du navigateur
de l'utilisateur — à jour, identique partout — l'unique moteur. L'import
YouTube reste central et local (IP résidentielle). Le shell **Tauri passe en
sommeil** : canal grand public signé réactivable plus tard, sa CI est
conservée ; le replay bundle AP devient sans objet pour la beta.

Séquence actée : **route 1 (spike Python, le `server/` existant) puis
route 2 (binaire Rust statique, l'artefact distribué)**. La route 1 répond en
jours à « le montage donne-t-il une bonne expérience de bout en bout ? » ; la
route 2 l'industrialise (un fichier, zéro runtime, web dist embarquée, une
seule implémentation yt-dlp partagée avec un éventuel retour Tauri).

## Contraintes

- Un lot = une branche + PR + session report ; gate verte à chaque étape.
- Le calcul reste sur Modal (bearer) — le serveur local ne fait que : servir
  l'UI, télécharger (yt-dlp), stocker les projets.
- Spike sur le port **5173** (déjà dans les 3 allowlists env-driven — zéro
  reconfiguration) ; le port définitif de distribution est tranché en D3 et
  ajouté aux allowlists à ce moment-là. Gotcha : 5173 = aussi le port de Vite
  dev, ne pas faire tourner les deux en même temps.
- Un serveur sur localhost se défend : garde Origin/Host (DNS rebinding) +
  token de session pour les routes mutantes (D2) — parité avec la discipline
  `origins.py` existante.

## Lots

### D1 — Spike bout-en-bout (route 1, timeboxé)

- `server/` sert la web dist buildée (`StaticFiles`), config prod
  (`VITE_ANALYSIS_URL`, Supabase) injectée au build.
- Ressusciter les adaptateurs HTTP supprimés par AJ.3b (#227, dans l'historique
  git) : `packages/web/src/projects/http-project-store.ts` et
  `packages/web/src/audio/http-track-source.ts` (+ specs), re-brancher
  `createProjectStores`/`createTrackSource` sur un mode « serveur » ; le
  gating capability d'AJ.3c (test-injectable) expose Enregistrer / Projets /
  Import URL quand le serveur répond.
- Parcours réel complet : magic link (PKCE web J2, redirect localhost) →
  import YouTube (download.py) → séparation Modal → projets (projects.py) →
  fermeture/relance. **Verdict GO/NO-GO sur l'expérience**, consigné au
  session report.

### D2 — Durcissement localhost

- Garde Origin/Host stricte + token de session (query au démarrage → header)
  sur les routes mutantes ; refuser les requêtes cross-site.
- Port occupé : message clair (+ retry port suivant ou `--port`).
- Sémantique de sortie : Ctrl-C propre, sweep temp yt-dlp au démarrage
  (parité T2.3).
- Stockage : chemin standard par OS (XDG / Application Support / AppData),
  parité manifeste avec les stores FS Tauri (un projet créé par l'un se
  rouvre dans l'autre — même format `projects/{id}.json` + `audio/{sha256}`).

### D3 — Packaging route 1 (beta amis techniques)

- Entry point `loupe` (pyproject) : démarre le serveur, ouvre le navigateur.
- Distribution `uvx` (PyPI ou `git+https`) ; doc d'installation testeur
  (3 lignes) ; port définitif tranché + ajouté aux 3 allowlists.
- **Première beta possible ici** — testeurs techniques, 3 OS.

### D4 — Route 2 : binaire Rust (l'artefact cible)

- D4.a — extraire le pilotage yt-dlp de `src-tauri` en crate partagé
  (`download.rs` : allowlist, annulation `Notify`, bootstrap, sweep) —
  consommé par le shell Tauri (dormant) ET le serveur.
- D4.b — serveur axum + `rust-embed` de la web dist (cohérence UI/serveur
  garantie), gardes D2 portées.
- D4.c — stores projets (parité manifeste D2), migration transparente du
  stockage route 1 (même chemin, même format → pas de code).
- `download.py`/`projects.py` retombent dev/CI-only (retour à leur rôle
  post-T2.5) ; la duplication yt-dlp Python/Rust cesse d'être distribuée.

### D5 — Pipeline de release

- Workflow GitHub Releases : build 3 OS (macOS arm64 — Intel si demande —,
  Linux x64, Windows x64) sur tag, versioning unique (tag → binaire →
  `--version`).
- Canal : brew tap (macOS/Linux), archive brute en Release (Windows d'abord ;
  scoop/winget si demande). Auto-update : simple **notification de version**
  au démarrage (self-replace différé — un fichier à re-télécharger suffit en
  beta).

### D6 — Validation plateformes

- Linux (cible confirmée 2026-07-17) : parcours complet réel — le risque
  webview a disparu (navigateur), restent yt-dlp/chemins/ports.
- Windows : bootstrap yt-dlp, chemins AppData, prompt pare-feu localhost,
  SmartScreen sur l'archive (documenter ou winget).

## Ordre et dépendances

D1 → verdict → D2 → D3 (beta possible) → D4.a → D4.b → D4.c → D5 → D6.
D6 peut s'intercaler dès D3 (la route 1 tourne partout où uv tourne).

## Suivi

| Lot | Contenu | État |
| --- | --- | --- |
| D1 | Spike bout-en-bout route 1 (adaptateurs HTTP ressuscités, verdict **GO**) | ✅ #275 |
| D2 | Durcissement localhost (Origin/token, port, sortie, stockage standard) | ⬜ |
| D3 | Packaging `uvx loupe` + port définitif + allowlists — beta technique | ⬜ |
| D4 | Binaire Rust (crate yt-dlp partagé, axum + embed, stores) | ⬜ |
| D5 | Pipeline GitHub Releases + brew tap + notification de version | ⬜ |
| D6 | Validation Linux + Windows | ⬜ |
