# Feuille de route — excellence, 6ᵉ passe

> **But.** Issue de l'évaluation notée du **2026-07-18** (six axes, mêmes que
> les passes 3–5), menée après clôture de la [cinquième feuille de
> route](roadmap-excellence-5.md) (les cinq 🟠 v5 + Phase 1 Modal M1.1–M1.4 +
> Phase 2 Tauri T2.1–T2.5 + lot pré-beta UI, PRs #170→#209). Revue
> multi-agents : 6 reviewers d'axe **+ un enquêteur dédié à l'irritant
> utilisateur « headers et footers trop gros »**, chaque constat vérifié
> adversarialement dans le code (33 constats, **31 confirmés**, 2 réfutés).
> Note globale : **16,75 / 20** (**↓** de 17,2 le 2026-07-16) — première
> baisse depuis le début des passes, et elle est **honnête** : fonctionnalités
> et ergonomie montent (les bornes v5 ont réellement sauté), mais le shell
> desktop Tauri a été livré sans la modélisation de menace appliquée au
> backend (−1,5 sur sécurité), et les slices 4a/4b ont posé un bloc DSP
> synchrone non mesuré sur le parcours chaud (−1 sur performance). Les
> remèdes sont tous bornés et connus.
>
> **Séquencement.** AC (sécurité desktop — pré-beta bloquant) → AE
> (headers/footers — l'irritant utilisateur) → AD (le parcours accords dit
> vrai et ne gèle pas) → AF (cohérence forme/slash) → AG/AH (ergonomie
> restante) → AI (qualité) ; les 🟢 au fil de l'eau. Chaque slice = une
> branche = une PR + `/session-report`, gate verte, mutation si le cœur est
> touché, browser-verify pour toute slice UI, **checkpoint d'approche avant
> chaque slice UI de design**.

## Notes par axe (2026-07-18)

| Axe | Note | Tendance vs 2026-07-16 |
|---|---|---|
| Qualité de code | **17,5** | ↓ (18 — la discipline tient, fix #209 exemplaire ; mais form-encoder = 91 mutants survivants dont des comportementaux (71,5 % fichier, global 93,7→91,5), et le Rust desktop — frontière de confiance — est hors de tout gate CI : la classe « périmètre hors gate » fermée en v5 se rouvre sur un nouveau langage) |
| Fonctionnalités | **18** | ↑ (17,5 — les trois bornes v5 ont sauté : Spectre pause+harmoniques, Notes tranché par retrait, et deux verticales profondes livrées : forme/déroulé {form: Nx} + accords sur stems 4a/4b browser-vérifiés ; retenu sous 18,5 par deux incohérences ENTRE features neuves et l'axe audio→notation toujours en veille) |
| Esthétique | **16,5** | ↓ (17 — le système a tenu (31 lignes CSS depuis v5, toutes sur tokens), mais l'irritant utilisateur est réel et systémique : les actions du header sont les SEULS contrôles de l'app sans font-size explicite — elles héritent du 1rem body dans une échelle à 0.8rem, sous le radar du verrou qui ne voit que les littéraux) |
| Sécurité | **15,5** | ↓↓ (17 — le socle serveur/JWT/origins tient toujours ; mais trois 🟠 corrélés sur le shell Tauri : binaire yt-dlp fetché-puis-exécuté sans intégrité, capability fs couvrant ce binaire depuis un webview en CSP null, deep link auth en flux implicite sans state/PKCE — des chaînes vers de l'exécution native, remèdes tous bornés) |
| Ergonomie | **17,5** | ↑ (17 — X.1/X.2 réellement soldés, annulation 4 flux, hors-ligne honnête, erreurs typées partout ; retenu par trois 🟠 neufs : la séparation implicite ment et s'annule en deux gestes, le desktop « nominal » confirme des exports qui n'ont pas eu lieu, l'import dépense le quota sans geste) |
| Performance | **15,5** | ↓ (16,5 — le socle V.1–V.5 tient ; mais 4a/4b ont ajouté un crunch synchrone main-thread non mesuré sur le parcours dominant et neutralisé le memo V.1 — l'audio d'analyse est recréé à chaque run, la WeakMap ne touche jamais) |

Constats réfutés à la vérification (2) :

- **Parité cross-frontière des ids par commentaires seuls** :
  `test_stem_manifest.py` épingle déjà littéralement la liste française côté
  serveur ; après #209, `stem-ids.ts` + les specs du hook la tiennent côté
  web. Le pont est testé des deux côtés.
- **« Un token = analyses illimitées pendant 5 min »** : exact au code mais
  déjà tranché en v4 (fenêtre courte assumée, jti/nonce = périmètre J3) —
  redite, pas de fait nouveau.

## Lot AC — sécurité du shell desktop (pré-beta bloquant) 🟠🟠🟠

- **AC.1 — yt-dlp pinné + sha256.** `releases/latest` est une cible mouvante
  exécutée sans vérification (download.rs:135). Pinner la version dans l'URL,
  embarquer le sha256 attendu (yt-dlp publie SHA2-256SUMS), vérifier avant
  chmod/rename ; la fraîcheur reste au `-U` quotidien (l'updater interne
  vérifie ses propres hashes). Bump = PR d'une constante (décision A.1).
- **AC.2 — capability fs resserrée + CSP réelle.**
  `fs:allow-appdata-write-recursive` couvre `bin/yt-dlp` que Rust exécute,
  avec `"csp": null` (capabilities/default.json:10, tauri.conf.json:29) —
  compromission webview ⇒ exécution native. Scopes explicites
  (`$APPDATA/projects/**`, `$APPDATA/audio/**`, `$APPDATA/downloads/**`) ou
  `fs:deny` sur `$APPDATA/bin/**` ; poser une CSP `default-src 'self'`.
  Config pure, zéro code.
- **AC.3 — deep link auth en PKCE.** Le callback implicite
  `loupe://auth-callback#access_token=…` est hijackable (schéma non exclusif
  Win/Linux) et fixable (login CSRF — `setSession` sans state), et
  `parseAuthCallback` ne vérifie pas l'URL (deep-link.ts:14). Passer le
  client Supabase en `flowType: 'pkce'` (le `code` est inutilisable sans le
  verifier local), vérifier `loupe://auth-callback` explicitement, signal UI
  au changement de session.

## Lot AD — le parcours accords dit vrai et ne gèle pas 🟠🟠🟠

- **AD.1 — narration + annulation de la séparation implicite.** Pendant les
  ~70 s d'`ensureStems`, l'item accords narre « Détection des accords… » +
  cold-start (faux) et son Annuler n'arrête pas la séparation qu'il a
  déclenchée (use-chord-detection.ts:184). Exposer la phase
  (`'separating' | 'detecting'`), copy « Séparation des pistes avant les
  accords… », et faire suivre au cancel() l'annulation de la séparation
  initiée.
- **AD.2 — mesurer puis sortir le DSP du main thread.** monoMixWithout +
  downmixToMono (redondant — le mono basse est déjà calculé) +
  bassNotePerMeasure s'exécutent en un bloc synchrone (~0,5-1 s plausible)
  entre deux awaits (use-chord-detection.ts:198-211). `performance.mark`
  d'abord sur 6 stems réels ; puis Worker (fonctions pures, transférables) ou
  a minima `nextPaint()` (R.4) + réutilisation du mono déjà sommé.
- **AD.3 — restaurer le memo V.1.** L'audio d'analyse est un objet neuf à
  chaque `detect()` : la WeakMap d'encodeAnalysisWavMemo ne hit jamais
  (toute re-détection repaie mix+resample+encode). Mémoïser le mix d'analyse
  par identité des stems (motif audio-buffer-memo), bassNotes avec.
- 🟢 associés : dernière mesure jamais slashée (off-by-one de convention
  bass-line.ts:52 vs chordLabelPerMeasure) ; churn d'allocations FFT
  (Hann + scratch buffers réutilisables) ; pic mémoire ×5 de monoMixWithout
  (accumulation fusionnée) ; commentaire « summed » vs code « max » de
  dominantBassClass (+ fixture bi-fenêtre qui tuerait la famille de
  survivants 4b).

## Lot AE — headers/footers (l'irritant utilisateur) 🟠🟠🟠

Diagnostic de l'enquête : pas une hauteur aberrante mais un **double
décrochage** — (1) les actions du header héritent du **1rem body** (seuls
contrôles de l'app sans font-size, ~25 % au-dessus de l'échelle 0.8rem que
tout l'atelier parle) ; (2) le footer fait **~78 px contre le contrat 48 px**
des stem lanes (champs à 3 étages + padding bloc 12 px) ; aggravé par le
label « VITESSE (SANS TOUCHER AU PITCH) » (~210 px d'uppercase).

- **AE.1 — peau `.chromeBar` partagée + taille par défaut des skins.**
  Promouvoir la peau de barre dupliquée header↔footer (le clone jscpd connu)
  en skin unique, PUIS poser `font-size: var(--font-size-s)` par défaut dans
  les peaux interactives de controls.module.css (l'omission devient sûre —
  ferme aussi le trou du verrou par construction). Header ~52 px, boutons
  ~26 px ; aligner `.iconAction` (28 px) au passage.
- **AE.2 — densité du footer.** Padding bloc `--space-s`→`--space-2xs` et,
  si l'utilisateur confirme après AE.1, champs en 2 étages (label+valeur sur
  une ligne, pattern stem-headers) : ~78→~56 px. **Checkpoint d'approche
  avant la partie restructuration** — c'est l'écran phare.
- **AE.3 — label Vitesse dégonflé.** « Vitesse » seul ; la précision « sans
  toucher au pitch » fusionne dans le title/tooltip existant
  (transport.tempo-reset). `i18n:extract` ensuite. ~140 px de large rendus.

## Lot AF — cohérence forme / slash / relabel 🟠🟠

- **AF.1 — le relabel de structure préserve les directives et le fold.**
  « Détecter la structure » sur un chart existant efface {key}/{time}/{form}
  et déroule ×N en N copies écrites (chart-structure.ts:255). Recopier la
  zone de tête verbatim, re-plier via la déduction d'instances plutôt
  qu'imprimer à plat.
- **AF.2 — les slashs 4b ne cassent pas le matching de forme.** 'C/E' vs 'C'
  compte comme désaccord dans sequenceAgreement (section-matching.ts:103) :
  le jitter de basse entre passes défait le {form: Nx} livré le même jour.
  Normaliser l'évidence sur racine+qualité (strip du /bass) — le slash est
  une observation de basse, pas un changement harmonique.

## Lot AG — quota et premier contact 🟠

- **AG.1 — l'import ne dépense pas le quota.** En offload, l'auto-détection
  du tempo à l'import minte (1/20 analyses/mois sans geste) et ouvre le
  popover compte à un non-connecté (use-tempo-detection.ts:85). Auto-détecter
  seulement sur token frais en cache ; sinon face idle « Détecter le tempo »
  (X.2 existe) — dépense et interpellation au premier geste explicite.
- 🟢 : notice quota épuisé actionnable (« — se réinitialise le 1ᵉʳ du
  mois. »).

## Lot AH — le desktop dit vrai 🟠

- **AH.1 — exports/impression natifs sous Tauri.** `download-blob.ts` (ancre
  `download`) et window.print() no-opent dans WKWebView, le toast « Stems
  exportés » se lève quand même. Variante `isTauriShell()` sur plugin-dialog
  (save) + plugin-fs ; traiter Imprimer ; en attendant, désactiver avec hint
  plutôt que confirmer un export fantôme. Browser-verify en bundle.
- 🟢 : bootstrap yt-dlp discriminé (« binaire injoignable » vs « download
  échoué », copy N.1) ; copy française sortie du Rust (`Sans titre`,
  erreurs anglaises brutes → codes discriminés, Lingui côté web).

## Lot AI — qualité 🟠🟠

- **AI.1 — job CI cargo.** fmt --check + clippy -D warnings + cargo test sur
  packages/desktop/src-tauri, déclenché sur paths src-tauri/** (modèle du job
  server torch-free). Ferme la réouverture « périmètre hors gate ».
- **AI.2 — passe mutants form-encoder.** 91 survivants dont clé de memo,
  signe du coût et somme D.C. — comportementaux, pas équivalents. Passe type
  4b (pin du choix reprise-vs-copies, non-collision du memo, tie-breaks) ;
  viser ≥ 85 % fichier, sinon documenter par famille.
- 🟢 : `bake_weights()`/`warm()` publics sur les modules d'analyse
  (modal_app.py consomme 8 membres privés — contrat innommé) ; aria-label
  des mesures (accords/×N/voltas invisibles à l'AT) ; EQ : `data-filtered`
  et Hz annoncés à l'AT.

## Suivi

- [ ] AC.1 · [ ] AC.2 · [ ] AC.3
- [ ] AD.1 · [ ] AD.2 · [ ] AD.3 (+ 🟢 DSP)
- [ ] AE.1 · [ ] AE.2 · [ ] AE.3
- [ ] AF.1 · [ ] AF.2
- [ ] AG.1 (+ 🟢 quota copy)
- [ ] AH.1 (+ 🟢 bootstrap/copy Rust)
- [ ] AI.1 · [ ] AI.2 (+ 🟢 qualité)
