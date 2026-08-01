# Feuille de route excellence 8 — l'ère de la beta

> Évaluation du 2026-08-01, au lendemain de la distribution beta. Retour aux
> **six axes d'ingénierie** des passes 3–6 (la v7, UX, est entièrement soldée),
> sur une architecture qui a changé de nature depuis la v6 : Tauri retiré
> (#327), serveur unique (#328), release v0.1.0 + tap Homebrew, testeurs réels
> depuis hier. Deux caps propriétaire actés le même jour orientent le
> séquencement : **améliorer l'onboarding utilisateur** et le signal terrain
> « vrai spinner au chargement / progressions qui sautent de 0 à 100 % ».

## Méthode

Revue multi-agents (**Fable 5**, run du 2026-08-01) : 6 reviewers d'axe +
1 enquêteur distribution/beta (la surface la plus fraîche) + 1 enquêteur dédié
au signal terrain spinner/progressions + les 5 constats prioritaires d'une
**revue externe (Codex)** intégrés au protocole. Chaque constat cité par ses
fichiers réels puis passé en **réfutation adversariale** (lecture du code +
recherche du déjà-tranché). **44 constats, 33 confirmés, 1 réfuté,
10 déjà-tranchés** (52 agents, 0 erreur). Enseignements de la vérification :
la revue externe lit bien le code mais, sans l'historique des décisions,
re-signale surtout des arbitrages assumés (3/5) ; le signal terrain sort
indemne (5/5 confirmés, périmètres jamais tranchés) ; et un constat
d'esthétique est tombé sur une lecture fausse du code (la scrollbar du
zoom-stage est bel et bien stylée).

## Notes par axe (2026-08-01)

| Axe | Note | Tendance vs v6 (2026-07-18) |
|---|---|---|
| Qualité de code | **17** | ↓ (17,5 — l'intérieur du gate s'approfondit encore : cliquets ADR 0010–0013 à zéro, mutation ~92 %, triage Sonar as-code ; mais la classe « périmètre hors gate » se rouvre une **troisième fois**, cette fois sur le seul livrable : les crates Rust n'ont plus aucun job CI depuis le retrait de desktop.yml, et la v0.1.0 a été taguée sur un main sans vert vérifiable — tier autoritaire aveugle 6 jours) |
| Fonctionnalités | **18** | = (18 — profondeur et cohérence vérifiées : dérive pitch↔grille gérée, restauration qui re-siège tout, AF.1/AF.2 réellement fermés ; retenu par un cul-de-sac entre les deux verticales les plus utilisées — métronome/décompte morts quand le tempo arrive après la séparation — et le piège `--port` vs allowlist distante) |
| Esthétique | **17,5** | ↑ (16,5 — zéro littéral hors tokens sur 54 fichiers CSS, règle amber/teal réellement appliquée, l'irritant v6 corrigé par une garde structurelle, AO.1–AO.3 livrent une vraie signature ; plafonné par l'absence totale de marque graphique : pas de favicon, l'onglet de la beta affiche l'icône par défaut du navigateur) |
| Sécurité | **16,5** | ↑ (15,5 — la nouvelle surface est remarquablement gardée pour un pivot d'une semaine : netguard testé, parité d'allowlists verrouillée tri-runtime, AC.1/AC.3 survivants, RLS sans policy d'écriture, zéro secret commis ; retenu par la moitié « CSP » d'AC.2 morte avec Tauri sans équivalent sur la SPA du binaire, et un PAT exposé à tout le job release avec actions non épinglées) |
| Ergonomie | **17,5** | = (17,5 — les acquis v7 tiennent : erreurs discriminées, annulation partout, gate beta honnête, a11y soignée ; mais le pivot rouvre sur la surface Rust la classe « anglais brut à l'écran » — les erreurs d'import URL atteignent l'écran verbatim — et le cold-start n'est pas narré sur le tempo, précisément la première analyse du parcours) |
| Performance | **16** | ↑ (15,5 — AD.2/AD.3 réellement livrés, chemin à fréquence d'image exemplaire, persistance dédupliquée ; retenu par du churn à fréquence de geste : signature de session recalculée à chaque render du shell, survol de waveform qui re-réconcilie toute la grille de beats) |

**Note globale : ~17,1/20** (↑ de 16,75 en v6, à un cheveu du pic v5 à 17,2).
L'ingénierie a bien absorbé le pivot — mais la **chaîne beta ment au premier
geste** : le déblocage Gatekeeper documenté au guide ne fonctionne plus
(vérifié empiriquement : binaire en quarantaine → SIGKILL silencieux sur macOS
récent, et la validation opérateur était passée par `curl`, qui ne pose pas la
quarantaine), et aucun canal de retour testeur n'existe.

**Constat réfuté (1)** : « color-scheme absent ⇒ scrollbar claire sur le
parcours principal » — la scrollbar du zoom-stage est re-stylée (track
transparente, thumb `var(--line)`), l'exemple central était une lecture fausse ;
reste un micro-point non démontré (scrollports secondaires, rendu Firefox).

## Séquencement en Lots — onboarding d'abord

Ordre : ce qui **tue le testeur au premier lancement** (AR) → la **première
impression en travaillant** (AS, signal terrain) → les **filets CI/release**
(AT — l'expiration du PAT au 2026-08-31 borne le délai) → la **cohérence
produit** (AU) → les **erreurs en français** (AV) → le **blindage de la
nouvelle surface** (AW) → la **marque** (AX). Checkpoint d'approche 2–3 lignes
avant chaque slice UI.

### Lot AR — le premier lancement ne tue personne 🔴 (beta bloquant)

*Enquête distribution : constat vérifié empiriquement sur le binaire publié.*

- **AR.1 — Gatekeeper macOS.** « Clic droit → Ouvrir » (guide + notes de
  release) est retiré par Apple pour le non-notarisé depuis macOS 15 : un
  binaire téléchargé au navigateur (quarantaine) est **tué SIGKILL sans
  message**. Réordonner : `xattr -d com.apple.quarantine` (ou Réglages →
  « Ouvrir quand même » après premier blocage) en voie primaire, **brew en
  canal principal macOS** (pas de quarantaine) ; re-valider une fois avec une
  archive réellement téléchargée par navigateur ; à terme, notarisation.
- **AR.2 — Canal de retour testeur.** Ni guide, ni README, ni notes de
  release, ni app n'indiquent comment signaler un bug — un testeur bloqué est
  invisible. Section « Un problème ? » (GitHub Issues du dépôt public ou
  mail) dans guide + notes, et lien « Signaler un problème » dans le menu
  compte avec la version pré-remplie.
- **AR.3 — Le guide dit ce que le binaire fait.** `http://127.0.0.1:6173`
  (le binaire binde IPv4-only, `localhost` → ::1 refusé sur Windows — cas
  documenté d6-platform-validation) ; ajouter l'étape « vérifier l'archive »
  (`shasum -a 256 -c SHA256SUMS`) avant la quarantaine — la release publie
  déjà le fichier, le guide n'en parle pas.

### Lot AS — le chargement se voit, la progression dit vrai 🟠 (signal terrain)

*Les 5 constats de l'enquête spinner/progressions, 5/5 confirmés. Fil
conducteur : un défaut de contrat unique — `progress: 0` posé d'office au lieu
de `undefined`, alors qu'`OperationStatus` sait déjà rendre l'indéterminé.*

- **AS.1 — Le contrat de progression.** `SeparationState.progress` devient
  optionnel, posé au premier tick `separating` réel (la barre reste
  indéterminée pendant mint + cold start + upload ~42 MB) ; même correctif sur
  l'import URL (`setProgress` sans fraction au submit — jusqu'à ~5 min de
  bootstrap yt-dlp au premier usage).
- **AS.2 — La fin de séparation ne fige plus à 100 %.** Après le dernier tick
  Demucs : encode WAV serveur + ~250 MB de stems + décodage, sous « Séparation
  des pistes… 100 % » figé 30–90 s puis gel main-thread. Progression client
  pendant les fetch (compteur n/6 via le `onProgress` que le port porte déjà)
  + `await nextPaint()` (idiome R.4) avant le bloc de décodage.
- **AS.3 — Overlay de prise en charge au chargement.** Entre le geste (fichier,
  URL, projet ouvert) et l'atelier prêt : une petite ligne ou un chip excentré.
  Promouvoir le pattern `.dropOverlay` (ShellDropLayer, plein viewport, déjà
  là) en overlay busy piloté par les états existants (`importState`,
  `openingId`, `urlImport.progress`) — aucune nouvelle machine d'état.
  **Checkpoint d'approche avant la slice.**
- **AS.4 — L'ouverture de projet ne gèle plus.** `decodeWav` ×6 + restauration
  synchrones sans la garde R.4 que le save possède : appliquer l'idiome avant
  le décodage, céder un frame entre stems et narrer « Piste n/6 » dans le chip
  existant. (AA.6 v5 notait le décodage seul, jamais repris — périmètre élargi.)
- **AS.5 — La zone repliée n'avale plus l'opération.** Replier pendant une
  séparation cache barre, %, Annuler sans trace (sous-arbre `hidden`, muet à
  l'AT). Ajouter au résumé replié un segment « Séparation… 43 % » dérivé des
  mêmes états, cliquable.

### Lot AT — les filets reviennent 🟠 (borné par l'expiration du PAT au 2026-08-31)

- **AT.1 — CI Rust.** Troisième réouverture de la classe « périmètre hors
  gate », cette fois sur le seul livrable : desktop.yml (fmt, clippy `-D
  warnings`, cargo test, leg Windows) supprimé avec Tauri sans remplaçant —
  les 21 tests de la frontière de confiance ne tournent qu'à la main, et
  beta-checklist affiche encore « [x] CI Rust ». Recréer `rust.yml`
  path-filtré sur `crates/**` (le contenu vit dans l'historique :
  `git show 2cd31b9^:.github/workflows/desktop.yml`).
- **AT.2 — La release exige le vert.** v0.1.0 taguée sur un main dont le
  dernier run conclu était un échec (tier autoritaire aveugle du 26/07 au
  01/08, personne n'a vu le rouge) ; le rapport de session affirmait à tort
  « main vert ». Le job verify interroge les check-runs du commit tagué et
  échoue sinon ; notification d'échec sur main pour que le rouge ne soit plus
  silencieux.
- **AT.3 — Release rejouable + rappel PAT.** `gh release create` non
  idempotent + push tap dans le même job : le scénario 403 déjà vécu à la
  v0.1.0 se reproduira à l'expiration du PAT (2026-08-31). Rendre le job
  idempotent (`gh release view … ||`, `--clobber`) ou isoler le push tap ;
  rappel automatisé avant l'expiration.
- **AT.4 — Chaîne release durcie.** `TAP_TOKEN` en env de job (toutes les
  steps le voient, dont les actions tierces) → le descendre au `env:` de la
  seule step « Push formula » ; épingler les actions par SHA (rust-toolchain
  vit sur une branche mouvante) ; attestation de provenance sur les artefacts.
- 🟢 associés : `check:shell` (shellcheck + actionlint — ~430 lignes de bash
  portent gate-stamp, hooks bloquants et release, la seule casse de livraison
  réelle venait de cette couche) ; purge des **8/15 exclusions de couverture
  mortes** de vitest.config.ts (globs cassés par le déplacement #323 — apport
  net de la revue externe) ; en-tête de la formule brew mangé par le sed
  (phrase absurde en tête du fichier publié) ; reporter l'inventaire des
  8 issues Sonar assumées dans la Veille du STATUS (le déclencheur de reprise
  — fin du chantier ADR — est passé).

### Lot AU — le tempo et la séparation se parlent 🟠

- **AU.1 — Le click rejoint les stems.** En offload sans token frais, l'ordre
  « séparer d'abord, tempo ensuite » est courant — et dans cet ordre aucun
  chemin ne siège le click dans le mix séparé (détection, tap et BPM tapé le
  sautent ; un tempo qui atterrit pendant les ~70 s de séparation est perdu
  par closure périmée) : BPM affiché mais **métronome absent, K no-op,
  décompte bypassé** toute la session ; seul save+réouverture répare. Attacher
  le click aux stems courants dans les trois chemins de seating (la recette
  existe : `metronome.attach`, utilisée par la restauration) + `useLatest`
  dans use-separate-and-load.
- **AU.2 — `--port` ne piège plus.** Port occupé → le binaire recommande
  lui-même `--port`, que le guide documente sans réserve ; or l'allowlist des
  surfaces distantes (Edge mint + Modal) ne connaît que 5173/6173 : sur tout
  autre port, atelier fonctionnel mais connexion et analyses refusées par
  Origin — panne opaque conseillée par l'app. Accepter
  `http://localhost:<port>`/`127.0.0.1:<port>` par préfixe côté distant, ou
  borner `--port` et le dire (USAGE + guide).
- **AU.3 — Le cold-start est narré sur le tempo aussi.** Séparation, structure
  et accords passent « Démarrage du service d'analyse (jusqu'à ~1 min)… »
  après 4 s ; le tempo — première analyse du parcours, sans warmup au premier
  clic — reste muet sur barre indéterminée ~50 s. Passer `detail` +
  `detailAfterMs` aux deux faces busy du TempoItem.

### Lot AV — les erreurs parlent français 🟠

- **AV.1 — L'import URL ne parle plus anglais.** La ligne NDJSON `error` du
  serveur s'affiche verbatim (« download timed out », « audio store quota
  exceeded — … LOUPE_MAX_AUDIO_STORE_MB ») — la classe « erreurs anglaises
  brutes » notée en v6 pour le Rust Tauri, rouverte par le pivot sur la
  surface qui a survécu, invisible au garde-fou copy-lexicon (hors catalogue).
  Codes discriminés portés par la ligne NDJSON (timeout, extractor-stale,
  store-quota, unsupported, unknown) + table Lingui modèle
  SEPARATION_ERROR_COPY, détail brut en console.
- **AV.2 — Projets/export alignés.** « Impossible d'enregistrer le projet :
  project server answered 500 » : préfixe français + code court mappé, détail
  en console — même standard que les détections (rename/delete inclus).
- **AV.3 — Hors-ligne, l'import URL est gaté.** `useOnline` n'a qu'un
  consommateur : hors-ligne, les analyses sont gatées mais le champ URL reste
  offert et échoue après coup avec l'erreur brute d'AV.1. Même grammaire
  (champ désactivé + hint), l'import fichier intact.

### Lot AW — la nouvelle surface se blinde 🟠

- **AW.1 — En-têtes de sécurité et de cache sur la SPA du binaire.** La
  réponse statique ne pose que Content-Type : ni CSP (la moitié d'AC.2 morte
  avec Tauri, sans équivalent), ni nosniff, ni Cache-Control (risque de vieil
  index.html contre assets hashés après mise à jour du binaire). Couche axum :
  CSP `default-src 'self'` + connect-src bornée, nosniff, `no-cache` sur
  index / `immutable` sur les assets hashés — pinnés par un test dans
  tests/app.rs.
- **AW.2 — Permissions du store local.** Aligner le store Rust sur l'exigence
  du Python (stems 0700) : dossiers 0700, fichiers 0600 sous `~/.loupe`
  (apport de la revue externe, confirmé — impact rétrogradé mais alignement
  trivial).
- **AW.3 — Templates OTP versionnés.** Le piège des deux templates est au
  runbook mais le texte canonique (sujets + corps) ne vit nulle part : une
  retouche dashboard reperdrait silencieusement le code OTP au signup (le bug
  exact du 31/07). Committer le contenu + la commande curl Management API de
  re-pose.

### Lot AX — la marque jusque dans l'onglet 🟢

- **AX.1 — Pictogramme loupe + favicon.** L'identité amber/teal (AO.3) n'a
  jamais été condensée en marque : aucun `<link rel="icon">`, 404 favicon en
  console depuis juillet, l'onglet beta affiche l'icône par défaut. Marque
  loupe SVG (vocabulaire stroke d'icon.tsx), favicon + devant le logo texte.
  Sert directement le cap onboarding (l'onglet est le premier pixel vu).
- **AX.2 — Les deux glyphes texte rejoignent icon.tsx.** Le ⬓ héros de l'état
  vide (tofu possible selon l'OS) et le ✓ CSS d'analyser-row contredisent le
  contrat AO.3 « jamais de glyphe texte » — le ⬓ devient idéalement la marque
  AX.1 (une pierre deux coups).
- **AX.3 — check:tokens verrouille les quatre classes.** Le verrou ne greppe
  que les font-size : hex/rgba, z-index numérique, durée en dur passeraient
  sans bruit (dérive actuelle nulle — elle tient à la discipline, pas au
  verrou). Trois greps de plus + exemptions commentées (play-breathe,
  snap-flash).

## Suivi

- [x] AR.1 · [x] AR.2 · [x] AR.3 — livré par PR #332
- [x] AS.1 · [x] AS.2 · [x] AS.3 · [x] AS.4 · [x] AS.5 — livré par PR #333
- [ ] AT.1 · [ ] AT.2 · [ ] AT.3 · [ ] AT.4 (+ 🟢 shell/vitest/formule/Sonar)
- [ ] AU.1 · [ ] AU.2 · [ ] AU.3
- [ ] AV.1 · [ ] AV.2 · [ ] AV.3
- [ ] AW.1 · [ ] AW.2 · [ ] AW.3
- [ ] AX.1 · [ ] AX.2 · [ ] AX.3

## Déjà-tranchés (10, écartés)

Wrap de boucle par seek (veille v2, réveil = signal testeur — la beta est
précisément le canal) · 8 issues Sonar (dette assumée 30/07 — seul le report
en Veille est dû, cf. 🟢 AT) · jeton 5 min sans jti (J3, v4) · release
non conditionnée au CI vert *en tant que design D5* (le fait nouveau — le tag
parti d'un main rouge — reste AT.2) · racine du shell à fréquence de geste
(Mikado ADR 0010 en cours, feuilles suivantes) · ré-encode WAV au re-save
(assumé J3.3/2026-07-02) · bundle 888 kB (veille v3 + AA.5) · auto-update
yt-dlp `-U` (design AC.1) · manualChunks (idem AA.5) · scission de
chord-chart.ts (ADR 0005 : les modules se découvrent, harmony/ l'applique
déjà).
