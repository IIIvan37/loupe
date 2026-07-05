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

### A.1 — Supprimer le `pip install` runtime *(🔴 critique)*
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

### A.2 — Fermer l'accès cross-origin *(🟠 haute)*
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

### A.3 — Caps & durcissement des ressources *(🟡 moyenne)*
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

### A.4 — Documenter/asserter le binding loopback *(🟢 basse)*
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

### B.1 — Suite pytest serveur
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

### B.2 — Gate & CI Python
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

### B.3 — Acter la convention « humble object » *(léger)*
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

### C.1 — Glisser-déposer & vrai empty-state
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

### C.2 — Passe responsive & tactile
- **But.** Une seule media query dans toute l'app ; cibles tactiles < 44px ; sous
  ~700px la barre transport et le mixeur débordent.
- **Faire.** Points de rupture sur transport, gutter (200px), panneau (360px),
  mixeur ; empilement/scroll sur petit écran ; cibles mute/solo ≥ 44px en tactile.
  Tokeniser les largeurs fixes.
- **Critères.** Pas de débordement horizontal de 360px à 1440px (à vérifier au
  navigateur + éventuel snapshot) ; contrôles tactiles atteignables.
- **Effort.** ~1,5 session.

### C.3 — Compléter le design system
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

### C.4 — Unifier les boutons + jeu d'icônes
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

### C.5 — Micro-motion des overlays
- **But.** Quasi aucune animation ; dialogs/popovers/bannières apparaissent
  abruptement (Base UI supporte les transitions ; `prefers-reduced-motion` déjà
  respecté).
- **Faire.** Transitions d'entrée/sortie sur dialogs, popovers, alert-banner via
  les data-attrs Base UI. Discret, sous `prefers-reduced-motion`.
- **Effort.** ~½ session.

---

## Lot D — Fonctionnalités qui haussent la barre

### D.1 — Undo/redo *(fort levier, quasi gratuit architecturalement)*
- **But.** Aucun undo ; marqueurs/boucles/mixeur committent immédiatement. Le
  domaine à **reducers purs** (`transportReducer`, `mixerReducer`,
  `markerList`, `loopLibrary`) est idéal pour un historique.
- **Faire.** Slice hexagonale : une pile d'historique pure dans `core`
  (générique sur un état + action, ou par agrégat), use-case/port si besoin de
  persistance, adaptateur web + raccourcis `Cmd+Z`/`Cmd+Shift+Z`. TDD strict,
  property tests (undo∘do = identité).
- **Critères.** Undo/redo sur marqueurs, boucles, mixeur ; property test
  d'inversibilité ; **browser-verify**.
- **Effort.** ~1,5–2 sessions.

### D.2 — Câbler « Séparer » à la santé serveur
- **But.** `canSeparate` ne dépend que de l'audio chargé
  ([workstation-shell.tsx:287](../packages/web/src/app/workstation-shell/workstation-shell.tsx#L287)) ;
  serveur éteint = clic → attente → erreur.
- **Faire.** Intégrer `serverHealth` (déjà connu du header) dans l'état du bouton :
  désactiver + expliquer quand `no-separation`/offline.
- **Effort.** ~½ session.

### D.3 — Feedbacks manquants
- **But.** Export WAV/ZIP silencieux ; sauvegarde subtile ; URL d'import sans
  validation inline.
- **Faire.** Toast/confirmation sur export réussi ; hint inline « hôte non
  supporté » sur l'URL avant l'appel serveur (réutiliser `isSupportedSourceUrl`
  du core) ; renforcer le signal « Enregistré ».
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

## Ordre recommandé (les prochaines PR)

1. ~~**A.1** — supprimer le pip runtime~~ ✅ (PR #48)
2. ~~**A.2** — CORS + Host~~ ✅ (PR #49)
3. ~~**A.3** — caps ressources + durcissement temp~~ ✅ (PR #50)
4. ~~**A.4** — loopback-only + noms de fichiers~~ ✅ (PR #51) — **Lot A complet**
5. **B.1** — pytest serveur *(en cours)*
6. **B.2** — gate & CI Python (ruff + pyright)
7. **B.3** — acter la convention humble object
8. **C.1** — DnD + empty-state *(premier gain produit visible)*
9. **C.3** — design system (typo/élévation/z-index)
10. **C.2** — responsive/tactile
11. **D.1** — undo/redo
12. …puis C.4, C.5, D.2, D.3 et le Lot E intercalés.

> Chaque slice se ferme par `/session-report` (met à jour `docs/STATUS.md` + un
> rapport daté sous `docs/sessions/`), gate verte, mutation cœur si le cœur est
> touché, browser-verify pour toute slice UI. On coche ci-dessous.

### Suivi

- [x] A.1 · [x] A.2 · [x] A.3 · [x] A.4 — **Lot A complet**
- [ ] B.1 · [ ] B.2 · [ ] B.3
- [ ] C.1 · [ ] C.2 · [ ] C.3 · [ ] C.4 · [ ] C.5
- [ ] D.1 · [ ] D.2 · [ ] D.3
- [ ] E.1 · [ ] E.2 · [ ] E.3 · [ ] E.4
