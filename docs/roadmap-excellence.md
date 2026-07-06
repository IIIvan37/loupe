# Feuille de route — durcissement & excellence

> **But.** Faire passer loupe de « prototype d'ingénierie exemplaire » à
> **produit exceptionnel**, sans rien lâcher de la discipline (hexagone pur, TDD
> strict, gate bloquante). Ce document est le **guide des prochaines sessions** :
> chaque slice = une branche = une PR + un `/session-report`. On coche au fur et
> à mesure ; on ferme chaque slice avant d'ouvrir la suivante.
>
> Issu de l'évaluation du 2026-07-05 (fonctionnalité / qualité / UX-UI / sécurité).
> État de départ : gate **verte**, 542 tests, couverture web 94,8 %, cœur 100 %,
> mutation cœur ~94 %. Zéro `any` côté web. Le point faible unique et net est le
> **serveur** : hors gate, hors CI, quasi non testé, deux failles sérieuses.

## Principe de séquencement

L'ordre suit le **levier × risque**, pas l'envie :

1. **Lot A — Sécurité serveur** : failles exploitables, à fermer d'abord.
2. **Lot B — Discipline serveur** : étendre le standard JS/TS au Python (sinon A régresse).
3. **Lot C — Fossé produit** : ce que l'utilisateur voit en premier (DnD, empty-state, responsive, design system).
4. **Lot D — Fonctionnalités qui haussent la barre** : undo/redo, feedbacks, icônes.
5. **Lot E — Dette de complexité** : petits refactors ciblés, à intercaler quand utile.

Règle : **A puis B avant tout le reste.** C/D/E peuvent ensuite s'entrelacer.

---

## Lot A — Sécurité serveur *(priorité absolue)*

> Le serveur est un démon localhost **non authentifié** qui shell-out vers des
> outils puissants. Objectif du lot : qu'aucune page web tierce ouverte dans le
> navigateur ne puisse le piloter, et qu'aucune requête ne puisse installer du
> code ni épuiser la machine.

### A.1 — Supprimer le `pip install` runtime *(🔴 critique)* — ✅ **fait** (PR #48)
- **But.** `download.py` lance `pip install -U yt-dlp` + `importlib.reload` sur
  **tout** échec de download (trivial à provoquer) → code arbitraire tiré de PyPI
  et exécuté en process. À retirer entièrement.
- **Périmètre.** [server/app/download.py:79-89](../server/app/download.py#L79-L89)
  (helper d'auto-upgrade) et son appel [download.py:116-120](../server/app/download.py#L116-L120).
- **Faire.** Supprimer le helper et le retry-sur-upgrade. En cas d'échec yt-dlp,
  renvoyer une erreur NDJSON claire invitant l'opérateur à lancer
  `pip install -U yt-dlp` **manuellement**. La mise à jour de dépendance n'est
  jamais un effet de bord d'une requête.
- **Critères.** Un download qui échoue ne lance aucun sous-process ; message
  d'erreur exploitable renvoyé au client ; test pytest qui simule un
  `DownloadError` et vérifie qu'aucun `pip` n'est invoqué.
- **Effort.** ~½ session.

### A.2 — Fermer l'accès cross-origin *(🟠 haute)* — ✅ **fait** (PR #49)
- **But.** `allow_origins=["*"]` + zéro auth = n'importe quel site ouvert dans le
  navigateur peut lire/écrire/supprimer projets et audio, et déclencher yt-dlp.
- **Périmètre.** [server/app/main.py:47-52](../server/app/main.py#L47-L52).
- **Faire.** (1) Restreindre CORS à l'origine dev réelle (`http://localhost:5173`,
  configurable par env). (2) Middleware de validation du header `Host`
  (`localhost` / `127.0.0.1`) pour bloquer le DNS-rebinding. (3) Optionnel mais
  recommandé : un jeton de session partagé que le web envoie en en-tête, vérifié
  par une dépendance FastAPI.
- **Critères.** Requête d'une origine non listée rejetée (test) ; requête avec
  `Host` étranger rejetée (test) ; le web app fonctionne toujours de bout en bout
  (browser-verify de l'import URL + séparation + sauvegarde).
- **Effort.** ~1 session.

### A.3 — Caps & durcissement des ressources *(🟡 moyenne)* — ✅ **fait** (PR #50)
- **But.** Aucune limite de taille aujourd'hui (`await request.body()` partout) →
  OOM / disque plein ; stems en `/tmp` world-readable sans TTL ; erreurs brutes
  renvoyées.
- **Périmètre.** [projects.py:80](../server/app/projects.py#L80),
  [separation.py](../server/app/separation.py) (dir temp + `/stems`),
  [tempo.py:62](../server/app/tempo.py#L62), messages d'erreur des trois modules.
- **Faire.** (1) Cap `Content-Length`/streaming sur tous les endpoints qui lisent
  un body, refus au-delà de N Mo **avant** de bufferiser. (2) Limite de concurrence
  sur `/separate` (une inférence à la fois). (3) TTL + sweep du dossier
  `loupe-stems`, création en `0700`, validation explicite `job`/`stem` contre un
  motif `[0-9a-f-]`. (4) Messages d'erreur génériques au client, trace complète
  loggée serveur.
- **Critères.** Body > cap → 413 (test) ; dossier stems en 0700 (test) ; deux
  `/separate` concurrents sérialisés ; plus aucune `str(exc)` renvoyée.
- **Effort.** ~1 session.

### A.4 — Documenter/asserter le binding loopback *(🟢 basse)* — ✅ **fait** (PR #51) · **Lot A complet**
- **But.** Le binding `127.0.0.1` n'est qu'un défaut uvicorn implicite ; un
  `--host 0.0.0.0` exposerait un serveur qui écrit des fichiers au LAN.
- **Faire.** Assertion/log de démarrage dans `main.py` si le bind n'est pas
  loopback ; note explicite dans `server/README.md`. Assainir aussi
  `exportBaseName` (retirer `/ \` + contrôles) par défense en profondeur.
- **Effort.** ~¼ session (peut être groupé avec A.3).

---

## Lot B — Étendre la discipline au serveur

> Le serveur (800 LOC, la surface la plus risquée) échappe au standard qui fait
> la fierté du reste. Ce lot rend le projet **cohérent** : sans lui, le Lot A
> régressera silencieusement.
>
> **Cadrage archi (important).** Le serveur n'est **pas** hexagonal, et c'est
> voulu : c'est un **adaptateur**, le côté lointain des ports pilotés du cœur
> (`StemSeparator`, `TempoDetector`, `TrackSource`, `ProjectStore`,
> `ProjectAudioStore`). L'équivalent serveur de la « pureté domaine » n'est donc
> pas l'hexagone mais le **humble object** : la logique *décidable* vit dans des
> modules **sans torch/yt-dlp** (testables + typables), une fine coquille d'I/O
> les entoure. Le Lot A l'a déjà appliqué (`stems_store`, `limits`, `netguard`).
> Ce lot outille cette discipline ; B.3 l'acte.

### B.1 — Suite pytest serveur — ✅ **fait** (PR #54)
- **But.** Aujourd'hui un seul fichier de test (GC). Couvrir la logique sensible.
- **Faire.** Tests pour : allowlist d'hôtes (accept/reject, suffix-match,
  `youtube.com.evil.com`), validation ids/refs, `store_audio` (content-addressing,
  écriture atomique), CRUD projets via `TestClient`, parsing NDJSON download,
  fallback yt-dlp/torch absent. Fakes/monkeypatch pour ne dépendre ni du réseau ni
  de torch. (GC / CORS+Host / caps / stems / netguard : déjà couverts au Lot A —
  garder.)
- **Cible.** Couverture serveur mesurée ≥ 80 % sur `app/download.py`,
  `app/projects.py`, `app/main.py` (pytest-cov).
- **Effort.** ~1–1,5 session.

### B.2 — Gate & CI Python — ✅ **fait** (PR #55)
- **But.** Ramener le serveur dans la boucle qualité bloquante.
- **Faire.** `ruff` (lint+format) + **`pyright`** sur `server/app` ; `pytest` avec
  seuil de couverture. Un **job `server` dans
  [.github/workflows/ci.yml](../.github/workflows/ci.yml)** (setup Python, cache,
  `pip install -r requirements-dev.txt`, ruff + pyright + pytest). Pin des
  dépendances runtime (`requirements.txt`) sur des versions précises + note de
  procédure de mise à jour manuelle (cohérent avec A.1).
- **Critères.** CI rouge si un test/lint/type serveur casse ; couverture serveur
  rapportée.
- **Effort.** ~1 session.

### B.3 — Acter la convention « humble object » *(léger)* — ✅ **fait** (PR #56) · **Lot B complet**
- **But.** Rendre explicite la règle qui a déjà guidé le Lot A, pour que le
  serveur ne redévie pas vers des gros modules logique+I/O entremêlés.
- **Faire.** Note dans `server/README.md` : « la logique décidable (validation,
  policy, parsing, math) vit dans des modules sans torch/yt-dlp, testée au unit ;
  les modules qui importent torch/yt-dlp restent de fines coquilles d'I/O ».
  Repérer les poches de logique testable restées dans `separation.py` /
  `download.py` / `tempo.py` et les extraire si le ROI est là (p. ex. le
  ré-ordonnancement/mapping des stems, le calcul de progression, le
  `_is_supported`/policy déjà en partie isolable).
- **Effort.** ~½ session (peut suivre B.2).

---

## Lot C — Combler le fossé produit *(le plus visible)*

> L'ingénierie est de niveau pro ; la **surface produit** lit encore « prototype
> soigné ». Trois chantiers à fort ROI + un socle design system.

### C.1 — Glisser-déposer & vrai empty-state — ✅ **fait** (PR #57)
- **But.** Aucun DnD aujourd'hui ; app vide = workstation grisée + une ligne de
  texte, ça paraît cassé. Table-stakes pour un outil audio.
- **Faire.** Zone de drop plein écran (dragover/drop/dataTransfer) réutilisant le
  chemin d'import existant (`useImportFromUrl`/`session.importDownloaded`).
  **Empty-state** dédié : drop-zone hero « Glissez un fichier ou importez »,
  raccourcis clés visibles, éventuellement un morceau d'exemple. Garde
  travail-non-sauvé réutilisée.
- **Périmètre.** [shell-header.tsx](../packages/web/src/app/workstation-shell/shell-header.tsx),
  [waveform-view.tsx:180-185](../packages/web/src/app/waveform/waveform-view.tsx#L180-L185),
  nouveau composant `empty-state`.
- **Critères.** Drop d'un fichier audio → import ; drop pendant travail non-sauvé →
  confirmation ; empty-state testé (Testing Library) ; **browser-verify**.
- **Effort.** ~1–1,5 session.

### C.2 — Passe responsive & tactile — ✅ **fait** (PR #58)
- **But.** Une seule media query dans toute l'app ; cibles tactiles < 44px ; sous
  ~700px la barre transport et le mixeur débordent.
- **Faire.** Points de rupture sur transport, gutter (200px), panneau (360px),
  mixeur ; empilement/scroll sur petit écran ; cibles mute/solo ≥ 44px en tactile.
  Tokeniser les largeurs fixes.
- **Critères.** Pas de débordement horizontal de 360px à 1440px (à vérifier au
  navigateur + éventuel snapshot) ; contrôles tactiles atteignables.
- **Effort.** ~1,5 session.

### C.3 — Compléter le design system — ✅ **fait** (PR #59)
- **But.** Sémantique ambre/teal et échelle d'espacement excellentes, mais **pas
  d'échelle typo** (14 tailles rem en dur), pas d'élévation (ombres), pas
  d'échelle z-index, radius sous-tokenisé.
- **Faire.** Ajouter à [tokens.css](../packages/web/src/styles/tokens.css) :
  `--font-size-*` (échelle modulaire) et remplacer les 14 valeurs en dur ;
  `--shadow-1/2` (dialogs, popovers, menus) ; `--z-*` (playhead, overlays,
  dialogs) ; tokeniser `--radius-*`. `impeccable` doit rester vert (règle « pas de
  magic number »).
- **Critères.** Grep : plus de `font-size:` en rem littéral hors token ; dialogs
  et popovers portent une ombre ; `check:design` vert.
- **Effort.** ~1 session.

### C.4 — Unifier les boutons + jeu d'icônes — ✅ **fait** (PR #60)
- **But.** Le header redéfinit un **2ᵉ système de boutons**
  ([header.module.css:96-168](../packages/web/src/app/header/header.module.css#L96-L168))
  au lieu de composer `controls.module.css` ; les icônes sont des glyphes texte
  (`✎ ✕ ⏮ ▶ ⟳`) au rendu fragile.
- **Faire.** Faire composer les skins partagés au header (source unique de
  vérité). Introduire un petit set d'icônes SVG inline (transport, marqueurs,
  fermer, éditer) — pas de dépendance externe lourde, inline pour la CSP.
- **Critères.** `jscpd` ne régresse pas (idéalement baisse) ; un seul endroit
  définit le bouton ambre ; icônes cohérentes cross-OS ; a11y préservée
  (aria-labels).
- **Effort.** ~1 session.

### C.5 — Micro-motion des overlays — ✅ **fait** (PR #61) · **Lot C complet**
- **But.** Quasi aucune animation ; dialogs/popovers/bannières apparaissent
  abruptement (Base UI supporte les transitions ; `prefers-reduced-motion` déjà
  respecté).
- **Faire.** Transitions d'entrée/sortie sur dialogs, popovers, alert-banner via
  les data-attrs Base UI. Discret, sous `prefers-reduced-motion`.
- **Effort.** ~½ session.

---

## Lot D — Fonctionnalités qui haussent la barre

### D.1 — Undo/redo *(reporté → veille, 2026-07-06)*
- **Décision (2026-07-06) : reporté en veille.** « Quasi gratuit
  architecturalement » ≠ « fort levier ». loupe est un outil de **pratique**, pas
  un éditeur de document : l'état éditable (marqueurs, boucles) est petit et
  **trivial à défaire à la main**, et le **mixeur est une surface de contrôle
  live** (faders/mute/solo triturés en continu), pas un historique d'édition — un
  Cmd+Z sur un fader est même contre-intuitif. Le bénéfice utilisateur réel est
  marginal. À réévaluer **si** une édition destructive coûteuse apparaît un jour
  (édition d'arrangement, découpe non réversible).
- **But (si repris).** Aucun undo ; marqueurs/boucles/mixeur committent
  immédiatement. Le domaine à **reducers purs** (`transportReducer`,
  `mixerReducer`, `markerList`, `loopLibrary`) est idéal pour un historique.
- **Faire (si repris).** Slice hexagonale : pile d'historique pure dans `core`
  (timeline unifiée sur un snapshot {marqueurs+boucles+mixeur}), adaptateur web +
  raccourcis `Cmd+Z`/`Cmd+Shift+Z`, property tests (undo∘do = identité).
- **Effort.** ~1,5–2 sessions.

### D.2 — Câbler « Séparer » à la santé serveur ✅ *(2026-07-06)*
- **But.** `canSeparate` ne dépendait que de l'audio chargé ; serveur éteint =
  clic → attente → erreur.
- **Fait.** `serverHealth` (déjà calculé pour le header) threadé jusqu'à
  `SeparationPanel` via `shell-main`. Le bouton « Séparer » est **désactivé** quand
  le serveur est `offline`/`no-separation`, avec un **hint actionnable** à la place
  du silence (« Serveur hors ligne — démarrer le serveur local… » /
  « Ce serveur ne fournit pas de moteur de séparation. »). `checking` reste actif
  (transitoire au boot — pas de flash). Web-only, pas de cœur ; 3 specs (offline,
  no-separation, checking). Gate verte, 576 tests.
- **Effort.** ~½ session.

### D.3 — Feedbacks manquants ✅ *(2026-07-06)*
- **But.** Export WAV/ZIP silencieux ; sauvegarde subtile ; URL d'import sans
  validation inline.
- **Fait.** `isSupportedSourceUrl` exposé sur la surface du core → hint inline
  « hôte non supporté » + submit bloqué sur l'URL avant l'appel serveur ; nouvelle
  primitive toast succès Base UI (`useToaster`/`ToastRegion`, manager par
  instance, glyphe `check`) ; export (zip + WAV) et sauvegarde toastent désormais.
  Web-only (un re-export core). Gate verte, 582 tests, coverage 95.6 % ;
  **browser-verify en attente (Mac)**.
- **Effort.** ~½–1 session.

---

## Lot E — Dette de complexité *(à intercaler)*

- **E.1 — Découper [use-player.ts](../packages/web/src/app/waveform/use-player.ts)** :
  366 lignes, 6 refs anti-stale, 5 responsabilités. Extraire la logique de
  boucle/wrap et le hand-off entre moteurs. *(~1 session.)*
- **E.2 — Prédicat « stem synthétique »** partagé : `METRONOME_ID`/`TRACK_STEM_ID`
  dupliqués entre
  [use-project-session.ts:120](../packages/web/src/app/workstation-shell/use-project-session.ts#L120)
  et
  [workstation-shell.tsx:218](../packages/web/src/app/workstation-shell/workstation-shell.tsx#L218).
  *(~¼ session.)*
- **E.3 — Sortir la logique `onSeparate` du JSX**
  ([workstation-shell.tsx:288-324](../packages/web/src/app/workstation-shell/workstation-shell.tsx#L288-L324))
  vers un handler nommé. *(~¼ session.)*
- **E.4 — Nettoyer le no-op** `.map((channels) => channels)` dans `mixer.spec.ts`.
  *(trivial, à grouper.)*

---

## Reporté / veille

- **`@vitejs/plugin-react` v5 → v6** (Dependabot **PR #53**, tenue ouverte comme
  rappel). v6 est un **major cassant** : le plugin abandonne Babel pour oxc/
  Rolldown et **supprime l'option `babel`** — or notre seul usage est d'injecter le
  **macro Lingui** (`@lingui/babel-plugin-lingui-macro`). La voie v6 impose un pass
  séparé `@rolldown/plugin-babel`, aujourd'hui **v0.2.3, pré-1.0, sans types**
  (que le gate typecheck). **Décision (2026-07-05) : rester sur 5.x**, aucun
  bénéfice fonctionnel, migration à faire en **slice dédiée** quand
  `@rolldown/plugin-babel` sera mûr/typé (ou basculer sur le plugin SWC Lingui),
  **avec browser-verify que l'i18n compile encore**. Ne pas merger #53 tel quel.

---

## Ordre recommandé (les prochaines PR)

1. ~~**A.1** — supprimer le pip runtime~~ ✅ (PR #48)
2. ~~**A.2** — CORS + Host~~ ✅ (PR #49)
3. ~~**A.3** — caps ressources + durcissement temp~~ ✅ (PR #50)
4. ~~**A.4** — loopback-only + noms de fichiers~~ ✅ (PR #51) — **Lot A complet**
5. ~~**B.1** — pytest serveur~~ ✅ (PR #54)
6. ~~**B.2** — gate & CI Python (ruff + pyright)~~ ✅ (PR #55)
7. **B.3** — acter la convention humble object *(léger)*
8. **C.1** — DnD + empty-state *(premier gain produit visible)*
9. **C.3** — design system (typo/élévation/z-index)
10. **C.2** — responsive/tactile
11. ~~**D.1** — undo/redo~~ — **reporté en veille** (ROI faible, cf. § D.1)
12. ~~**D.2** — « Séparer » ↔ santé serveur~~ ✅ (2026-07-06)
13. ~~**D.3** — feedbacks manquants~~ ✅ (2026-07-06, `feat/web-feedbacks`), puis
    le Lot E intercalé.

> Chaque slice se ferme par `/session-report` (met à jour `docs/STATUS.md` + un
> rapport daté sous `docs/sessions/`), gate verte, mutation cœur si le cœur est
> touché, browser-verify pour toute slice UI. On coche ci-dessous.

### Suivi

- [x] A.1 · [x] A.2 · [x] A.3 · [x] A.4 — **Lot A complet**
- [x] B.1 · [x] B.2 · [x] B.3 (PR #56) — **Lot B complet**
- [x] C.1 (#57) · [x] C.2 (#58) · [x] C.3 (#59) · [x] C.4 (#60) · [x] C.5 (#61) —
  **Lot C complet**
- [~] D.1 *(reporté → veille, ROI faible pour un outil de pratique)* · [x] D.2
  *(2026-07-06, `feat/web-separate-server-health`)* · [x] D.3
  *(2026-07-06, `feat/web-feedbacks`)* — `isSupportedSourceUrl` exposed → inline
  unsupported-URL warning + blocked submit; a reusable Base UI success-toast
  primitive (`useToaster`/`ToastRegion`, per-instance manager, `check` icon);
  export (zip + WAV) and save now toast. Gate green, 582 tests, coverage 95.6 %;
  **browser-verify pending (Mac)**
- [ ] E.1 *(next — split `use-player.ts`)* · [x] E.2 · [x] E.3 · [x] E.4
  *(2026-07-06, `refactor/web-complexity-debt`)* — `isSyntheticStem` shared
  predicate; `onSeparate` lifted to a named handler; `mixer.spec` no-op removed.
  Gate green, 587 tests
