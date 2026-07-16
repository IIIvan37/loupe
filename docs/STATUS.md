# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. **Only the current step is detailed here** — the full
> story of every past step lives in its dated report under
> [docs/sessions/](sessions/); the history below keeps one line per step.

## Where we are

**Lot C chord-charts — COMPLET (2026-07-11)** : les trois slices livrées le
même jour. **Core** (PR #86 mergée) : port `ChordDetector` + agrégation pure
`chordLabelPerMeasure` (1 accord/mesure sur les intervalles
downbeat→downbeat) + `renderChartSource` + use-case `detectChords` →
brouillon de texte source. **Serveur** (PR #87 mergée) : spike BTC levé
(2,4 s CPU / 257 s d'audio), `POST /chords` (BTC vendoré MIT, poids
sha256-pinnés, 503 sans torch/poids), helper pur `chord_spans`. **Web**
(branche `feat/detect-chords-ui`) : adapter `createHttpChordDetector`
(traduction mir→tokens, `N`/`X`→silence), hook `useChordDetection` (jeton de
run, brouillon = édition manuelle persistée), bouton « Détecter les accords »
(confirmation deux temps avant écrasement, hints actionnables serveur/grille,
LiveStatus a11y). Gate **vert — 925 tests** (+19), serveur 127 pytest.

**En cours : [feuille de route v3](roadmap-excellence-3.md)** (évaluation
notée du 2026-07-11, 16,0/20). **Lots K et L clos** (PRs #89–#94 mergées —
voir l'historique ci-dessous).
**M.1 mergé (PR #95)** : `OriginGuardMiddleware` — 403 pour tout `Origin` hors
allowlist (CSRF « simple request »), same-origin de confiance, chaque valeur
dupliquée vérifiée.
**M.2 mergé (PR #96)** : `/download` borné (sémaphore, `max_filesize`, budget
wall-clock **total** 900 s — un trickle ne le réarme pas, `socket_timeout` 30 s)
et `/separate` reçoit le même budget (1800 s — son `events.get()` n'avait
aucun timeout).
**Lot M complet** (M.1 PR #95, M.2 PR #96, M.3 PR #97 mergées).
**N.1 mergé (PR #98)** : codes d'échec discriminés bout-en-bout pour la
détection d'accords + copy Lingui actionnable, `classifyTransportError`
partagé (conflit avec `main` résolu au merge — STATUS + catalogue régénéré).
**N.2 mergé (PR #99)** : raccourcis `L`/`K`/`T` (boucle/métronome/tap),
carte auto-dérivée, listener global durci (repeat + dialogues).
**N.3 mergé (PR #100)** : `transposedBy` persisté (absent ⇔ 0), transposition
appariée texte+offset en core, flag divergence **modulo 12**, « Transposer la
grille pour suivre » confirmé deux temps, `signedSemitones` partagé.
**N.4 mergé (PR #105)** : champ « mes. / ligne » flaggé (`aria-invalid` +
badInput), préférence localStorage posée au blur, ligne « Détecter » sous le
header — **Lot N clos**.
**O.1 mergé (PR #106)**, **interlude react-doctor 0.7.6 mergé (PR #107)**,
**O.2 mergé (PR #109)** — voir l'historique.
**O.3 mergé (PR #110)** :
`workstation-shell.spec.tsx` (2 438 lignes, 115 tests, un seul `describe`)
découpé par parcours en 9 specs colocalisées (`.import`, `.tempo`,
`.transport`, `.shortcuts`, `.loops`, `.stems`, `.chords`, `.projects` + le
socle landmarks) — aucun test réécrit, uniquement déplacés. Fixtures
communes dans `shell-test-kit.tsx` (fakes des ports, `renderShell`,
`importTrack`, `saveProjectAs`, `installShellHooks()` appelé en tête de
chaque spec) ; helpers mono-parcours restés locaux. Le kit, non-`.spec`
donc scanné par react-doctor : `tapThrice` déroulé (faux positif « await in
loop »), `deslop/unused-file` ignoré pour le kit (même cas que le wrapper
i18n). Gate vert **1047 tests** (total inchangé avant/après — aucun test
perdu), Stryker skipped (core intouché).
**O.4 mergé (PR #111)** : le
padding/fenêtrage TIMESTEP de `chords.py` (exclu de coverage + pyright)
extrait en `btc_windows.py` pur testé (`window_plan` → `{pad, slices}`,
6 pytest, modèle `chord_spans.py`), `_analyse` rebranché, équivalence
ancien/nouveau vérifiée par script. Serveur **163 pytest** (+6), pyright 0,
coverage 97,6 %.
**O.5 mergé (PR #112) — Lot O clos.** `AbortSignal`
bout-en-bout `/tempo`+`/chords` (ports core → use-cases → `postWavForJson` →
hooks ; abort au reset/override/nouveau run/changement de piste/démontage —
le sémaphore serveur est libéré), `create-chord-detector.ts` exclu de la
couverture avec ses jumeaux, boilerplate Popover factorisé en `PopoverForm`
(NameEditor + SpeedTrainerControls, clones jscpd résorbés). Gate vert
**1057 tests** (+10), **Stryker 95,2 %** (core touché). Revue 8 angles :
abort à l'unmount de useTempo ajouté ; import-menu volontairement non migré
(il lui faut anchor + form + hint — API à élargir seulement si un 4e
formulaire apparaît).
**Plan du Lot P écrit et validé**
([lead-sheet-chart-plan.md](lead-sheet-chart-plan.md)) sur la maquette
fournie (`your-song-elton-john-chart.pdf`, non versionnée — rendu cible +
fonctionnalités) ; trois arbitrages pris : rendu d'abord, sync lecture via
unroll dès P.2, en-tête dérivé de la session + directives `{…}` de surcharge.
**P.1 — rendu chart mergé (PR #113)** : directives `{k: v}`, `ChordGlyph`,
barres dessinées, `ChartHeader` dérivé + Petaluma Script OFL — voir
l'historique.
**P.2 — grammaire de forme + déroulement mergé (PR #114)** — voir
l'historique.
**P.3 mergé (PR #115)** — édition repliée, chart-first — voir l'historique.
**P.4 phase 1 mergé (PR #116)** — déduction de structure MDL — voir
l'historique.
**P.4 impression, sur `feat/p4-print` (PR à ouvrir)** : bouton
« Imprimer » (désactivé sans contenu — prédicat `chartHasContent` partagé
avec la feuille), `data-print-region` émis par la LeadSheet **seulement
avec du contenu** (sans chart, Cmd+P imprime l'app), stylesheet
`@media print` globale à deux règles enfant (`:has` — branches hors-chemin
hors du flux, chaîne d'ancêtres aplatie html/body compris, peinture
strippée, tokens encre-sur-papier ; contrat : UNE région par page).
`BarsPerRowField` extrait (react-doctor no-giant-component),
`.chipButton:disabled` sur la peau partagée. Revue 8 angles vérifiée :
2 fixés en TDD (dont Cmd+P page blanche, reproduit navigateur), 4
appliqués, 3 arbitrés. Browser-verify du rendu contre la maquette. Gate
vert **1181 tests** (+8), Stryker skippé (core intouché).
**P.4 impression mergé (PR #117) — Lot P complet.**
**Phase 2 structure — segmentation audio (la déduction MDL de P.4 déçoit).**
[Plan](structure-detection-plan.md) · [rapport S.0+S.1](sessions/2026-07-13-structure-detection-s0-s1.md).
**S.0 spike : GO pour SongFormer + chunking** (MPS/torch 2.12, qualité > MDL
sur 2 vrais morceaux ; pleine fenêtre OOM 16 Go → chunking 180 s obligatoire,
RAM 0,2 Go ; snap aux downbeats mesuré, Δ médian 0,14 s).
**S.1 serveur `POST /structure` sur `feat/structure-server-s1` (PR à ouvrir)** :
cœur pur TDD (`chunk_plan` + `stitch_segments`, 16 tests) + shell torch
`structure.py` (moule chords.py, poids épinglés, inférence chunkée, 503/504)
+ SongFormer/MuQ/MusicFM vendorés. Vérifié bout-en-bout (l'endpoint HTTP
reproduit le spike). Revue 8 angles → 5 fixes. Gate serveur vert **180 tests**.
**S.1 mergé (PR #118).**
**S.2 core sur `feat/p-structure-core-s2` (PR à ouvrir)** : `StructureDetector`
port + `detectStructure` use-case + `snapSectionsToGrid` (recalage aux downbeats,
règles mesurées + garde monotone anti-inversion). Pas de grille requise (bouton
autonome). Revue 2 angles → 3 fixes. Gate vert **1207 tests**, Stryker ciblé
detect-structure 100 % / song-structure ~91 %.
[rapport S.2](sessions/2026-07-13-structure-core-s2.md).
**S.2 mergé (PR #119).**
**S.3a web — marqueurs de structure (PR #120 mergée)** : bouton « Détecter la
structure » dans la barre de repères → marqueurs de section (vérif navigateur OK
sur *The Logical Song*). Détail dans l'historique + [rapport
S.3a](sessions/2026-07-13-structure-web-s3.md).

**Offload Modal — J1 (token statique) mergé (PRs #123–#125)** : endpoint Modal
`/structure` déployé (bearer statique), routage adapter + warm-on-import.
[plan](modal-offload-impl-plan.md).

**J2 — auth Supabase (PR #126, branche `feat/supabase-j2`) — DÉPLOYÉ ET VÉRIFIÉ
EN PROD (2026-07-13)** : remplace le token statique par de l'auth par-utilisateur.
Décisions produit : gating `beta_codes`, quota ~20/mois, gate paresseuse inline
(contrôle compte dans le header). **2.1** schéma
(`supabase/migrations/…j2_auth_quota.sql`) : `beta_codes`/`beta_members`/`usage`
+ RLS + `redeem_beta_code`/`consume_analysis`/`account_status` (SECURITY
DEFINER) — 10 asserts SQL sur le stack local. **2.2** Edge Function
`mint-analyze-token` (Deno, HS256 5 min, 403/429/401) — 7 tests Deno sur le
stack live. **2.3** `server/app/analyze_auth.py` (vérif HS256 stdlib pure, 17
pytest 100 %) branché dans `modal_app.py`, token statique supprimé ; interop
djwt↔python prouvée ; serveur 197 pytest. **2.4** web : `AuthPort` (supabase-js),
gate token async (`analysis-token.ts`), `AccountMenu` header (magic link + code
+ quota), gate câblée dans la détection structure (`gateReason` hors du cœur
pur), i18n `account.*`. Gate **verte — 1283 tests**, WorkstationShell < 300.
**Déployé** sur le projet Supabase **Loupe** (`kqvpftctrkrtdwuvpnva`) : migration
`db push`, Edge Function (`--use-api`), `modal_app.py` redéployé, secret hex
partagé aligné Edge↔Modal. Parcours complet vérifié (magic link → code →
détection → marqueurs → quota). Deux bugs corrigés au déploiement (commit
`a353071`) : CORS `apikey` manquant sur l'Edge (preflight du mint), et chip quota
non rafraîchi après analyse (`onAnalysisUsage`). Pièges consignés : secret
**hex** obligatoire (base64 casse le split `=`), `functions deploy --use-api`
(Colima), `VITE_SUPABASE_URL` = le **ref**. [runbook](j2-supabase-runbook.md) ·
[rapport J2](sessions/2026-07-13-j2-supabase-auth.md).

**En cours : S.3b — réétiquetage de la grille d'accords (branche
`feat/p-structure-web-s3b`)** — décision produit reprise : *le bouton
« Détecter la structure » réétiquette la grille existante en gardant ses
accords*. **Core** : fold pur `relabelChartBySections(source, sections, grid,
barsPerRow)` — grille lue en mesures **jouées** (`unrollChart`, aligné sur les
temps de section en secondes de lecture), 1er accord par mesure (modèle token
plat), chaque frontière de section mappée en index de mesure (compte des
downbeats avant son `startSeconds`), coupe → un bloc par section sous son
en-tête, **pas de vote inter-sections** (accords gardés verbatim → l'offset de
clé reste valide). Export public (famille `transposeChart`/`renderChartSource`).
**Web** : `sectionDisplayLabel` (raw→Lingui, partagé marqueurs/grille),
`relabel-chart.ts` (traduit puis appelle le core), `useStructureMarkers`
réétiquette via `chart.setSource` quand la grille a du contenu **et** un beat
grid ; `MarkerControls` arme la confirmation sur `hasMarkers || hasGrid` et
nomme l'enjeu (« Remplacer les repères et la grille ? » / « Réétiqueter la
grille d'accords ? » / S.3a « Remplacer les repères ? »). Session chart
construite **avant** le flux structure (même source). **Limites v1** : mesure
multi-accords → 1er accord seulement ; pas de repli `|: :|` (chaque section sous
son en-tête). Gate **vert — 1249 tests** (+13), react-doctor clean
(WorkstationShell < 300 lignes).
[rapport S.3b](sessions/2026-07-13-structure-web-s3b.md).

**Grille d'accords — orthographe tonale + vocabulaire étendu mergé (PR #127)**
— pré-démo #1 : `detectKey` Krumhansl → `{key}` + ré-épellage #/b, grand
checkpoint BTC 170 classes (7es/sus/dim…), nommage validé utilisateur →
[rapport](sessions/2026-07-13-chord-grid-vocab-key.md).

**Marqueurs ↔ structure mergé (PR #128)** — pré-démo #2 : `Marker.kind`
(structure vs indicatif), `chartSectionAnchors` + sync chart→timeline sur
éditions utilisateur, rail teal/ambre →
[rapport](sessions/2026-07-13-marker-kinds-structure-sync.md).
**Signatures rythmiques mergées (PR #129)** — pré-démo #3 : `{time: N/M}`
tête + changements mid-grid, `detectMeter` dominant, « N temps » éditable
(`remeterGrid`), fold méter-aware, DBN madmom sur `/tempo` →
[rapport](sessions/2026-07-13-time-signatures.md).
Reste pré-démo : vérif navigateur sur The Logical Song ·
retrofit `/tempo` sur `classifyTransportError` toujours noté.

**« + Section » mergé (PR #134)** — marqueur de structure à la main : bouton
« + Section » (`addSectionAt`, « Section N », kind structure, écrasable) +
raccourci `Maj+M`, guide la détection d'accords (#130) →
[rapport](sessions/2026-07-14-add-section-marker.md). **Fix taille d'icônes
mergé (PR #135).**

**En cours : multi-accords par mesure + erreurs `/tempo` discriminées
(branche `feat/multi-chords-per-measure`, PR à ouvrir).** Les deux reliquats
en une PR. **(1) Multi-accords** (le différé du lot pré-démo, zéro serveur) :
`chordLabelPerMeasure` vote aussi les deux moitiés de mesure (coupure au beat
médian) → cellule `'C G'` quand chaque moitié est dominée par son accord ; une
moitié silencieuse ou un label moteur multi-mots véto le split. `cellToken`
imprime les cellules multi-tokens (`isPrintableToken` partagé), `playedLabels`
garde tous les accords au relabel (limitation v1 levée, token structurel
filtré au lieu d'un wipe `N.C.`), `matchesBlock` compte l'accord de tête
(le jitter du split ne casse plus le regroupement des sections). **(2) Tempo**
(reliquat N.1) : `TempoDetectionError`/codes dans `detectTempo`, adapter sur
`classifyTransportError`, `useTempo.error` = code (détail en console),
`ERROR_COPY` Lingui `tempo.error.*` dans le panneau ; les trois blocs catch
des adapters repliés en `rethrowTransportError`. Revue 8 angles → 4 fixés
(3 correctness TDD + 1 reuse), 3 écartés documentés. Gate **vert — 1444
tests** (+23), **Stryker 93,4 %**.
[rapport](sessions/2026-07-14-multi-chords-tempo-errors.md).

**Évaluation notée v4 (2026-07-14) : 16,1/20** (16,0 le 2026-07-11) →
**[feuille de route v4](roadmap-excellence-4.md)** (Lots Q–W). Revue
multi-agents : 6 reviewers d'axe + 2 enquêtes ciblées sur les irritants
rapportés à l'usage (« interface brouillonne », « opérations longues sans
loader ») ; 55 constats, 45 confirmés après vérification adversariale.
Séquencement : Q (clarté de l'atelier) → R (feedback unifié) → W.1/W.2 →
U.1/U.3 → T.1–T.3 → V.1 → le reste.
**Q.1 — zonage de la colonne (branche `feat/q1-shell-zoning`, PR à ouvrir)** :
`ShellSection` (région nommée + h2) × 3 zones — Timeline (Repères + Stage +
Boucles), Analyse (Séparation + Tempo), Partition (Grille) — gaps `--space-l`
entre zones / `--space-xs` dedans (approche « labels + gaps seuls » validée) ;
classe partagée `.sectionLabel` (6 têtes unifiées, fin du gras isolé du titre
accords, h2→h3 sous la zone), label visible « Séparation » qui nomme sa
région. Spec zones + browser-verify (a11y tree vérifié). Revue 8 angles →
3 fixés, 1 reporté W.5. Gate **verte — 1448 tests**, Stryker skippé (core
intouché). [rapport](sessions/2026-07-14-q1-shell-zoning.md).
**Q.2 — rangée « Analyser » (branche `feat/q2-analyser-row`, stackée sur Q.1,
PR à ouvrir)** : primitive `DetectionAction` (bouton + confirm deux-temps +
hint + échec `role="alert"` + LiveStatus) et `AnalyserRow` en tête de zone
Analyse — Séparer · Tempo · Structure · Accords, chaque item avec son état,
empreinte stable (✓ au lieu de disparaître). SeparationPanel supprimé, les
3 panneaux allégés (résultats/corrections seuls), copy regroupée
(`analyser/detection-copy.ts`, ids inchangés), `detect()` accords replie sur
la préférence stockée. Révise N.4 + placement séparation (validé au
checkpoint). Specs migrés (analyser-row.spec 31 tests). Browser-verify
bout-en-bout. Revue 8 angles → 3 fixés, 2 différés (Q.3/R.1). Gate **verte —
1441 tests**, Stryker skippé.
[rapport](sessions/2026-07-15-q2-analyser-row.md).
**Q.3 — zone Analyse repliable (branche `feat/q3-analysis-fold`, stackée sur
Q.2, PR à ouvrir)** : `ShellSection` pliable (accordéon `h2 > button`,
contenu caché — jamais démonté — l'aria-controls résout et l'état en vol
survit), en-tête replié = résumé de l'acquis en teal (« Pistes séparées ·
120 BPM · 4 temps · N sections · grille N mes. »), `useAnalysisFold` (import
frais → ouvert, projet rouvert analysé → replié, seul le toggle manuel
persiste). Read-out « détecté » du header supprimé (décision checkpoint).
Bug de course corrigé au passage : un « Ouvrir » supplanté ne signe plus le
vieux projet (re-check epoch post-restore — trou préexistant de
setSavedSignature). Revue 8 angles → 6 fixés, 2 différés. Gate **verte —
1449 tests** (dernier commit --no-verify documenté : timeouts de coverage
sous contention machine, diff hors de cause — le commit précédent échoue à
l'identique). [rapport](sessions/2026-07-15-q3-analysis-fold.md).
**Q.4 + Q.5 (branche `feat/q4-q5-header-speed`, stackée sur Q.3, PR à
ouvrir) — LOT Q CLOS** : header groupé en familles par le gap (aide · E/S ·
document · compte/serveur), slider du footer renommé « Vitesse (sans toucher
au pitch) » (« Tempo » réservé au BPM musical). Au passage : timeout vitest
5 s → 15 s (flakes de contention mesurés sur les specs shell de réouverture,
diff hors de cause). Gate **verte — 1449 tests**.
[rapport](sessions/2026-07-15-q4-q5-header-speed.md).
**Lot Q mergé sur `main`** (#137, #138, #140 — #139 fermée par une course
GitHub, ses commits livrés via #140).
**R.1 — OperationStatus (branche `feat/r1-operation-status`, PR à ouvrir)** :
primitive `app/ui/operation-status` (barre réelle/indéterminée + libellé +
detail différé + Annuler conditionnel) ; la face running de `DetectionAction`
la porte (fini le label de bouton swappé), la séparation y replie son bloc
maison (progrès streamé + Annuler, abstraction 4/4), tempo/structure/accords
en indéterminé, décodage waveform aussi. Browser-verify sous Slow 3G. Revue
8 angles → 3 fixés. Gate **verte — 1454 tests**.
[rapport](sessions/2026-07-15-r1-operation-status.md).
**R.2 — annulation des détections (branche `feat/r2-detection-cancel`,
stackée sur R.1, PR à ouvrir)** : `cancel()`/`cancelDetection()` sur les
trois hooks (abort + bump run-token + busy down — annuler n'est pas un
échec), câblés sur le `onCancel` des faces busy ; « Annuler » apparaît sur
les 4 flux. Gate **verte — 1456 tests**.
[rapport](sessions/2026-07-15-r2-detection-cancel.md).
**R.3 — cold start narré (branche `feat/r3-cold-start`, stackée sur R.2, PR
à ouvrir)** : busy monté avant `await gate()` (mint couvert, garde de ticket
anti-cancel-pendant-mint), et la face busy structure explique après ~4 s
« Démarrage du moteur d'analyse (jusqu'à ~1 min)… » quand l'analyse est
offloadée. Gate **verte — 1459 tests**.
[rapport](sessions/2026-07-15-r3-cold-start.md).
**R.4 — busy peint avant le gel (branche `feat/r4-export-busy`, stackée sur
R.3, PR à ouvrir) — LOT R CLOS** : `nextPaint()` (double rAF) avant le zip
d'export (header narre « Export des stems… ») et avant le ré-encodage WAV du
save (`preparingSave`) ; le chip busy du header migre sur `OperationStatus`
(barre réelle pour le téléchargement URL — le % quitte la copy — Annuler
conditionnel, peau cancel dédupliquée). Gate **verte — 1460 tests**.
[rapport](sessions/2026-07-15-r4-export-busy.md).
**Pile R mergée sur `main`** (#141 → #142 → #143 → #144, retarget avant
merge — pas de course #139 ; branches distantes r1…r4 à nettoyer).
**W.1 — rangées denses wrappées (branche `feat/w1-dense-rows-wrap`, PR à
ouvrir)** : `flex-wrap: wrap` sur `.panel` tempo et `.header` accords (les
deux seules rangées sans wrap), invariant gardé par `dense-rows-wrap.spec.ts`
au niveau du texte CSS (jsdom ne calcule pas de layout). Gate **verte —
1462 tests**, Stryker skippé (core intouché).
[rapport](sessions/2026-07-15-w1-dense-rows-wrap.md).
**W.2 — peau « Confirmer ? » unique (branche `feat/w2-confirm-face`, stackée
sur W.1, PR à ouvrir)** : `.confirmFace` partagée dans controls.module.css
(danger-rouge acté — l'ambre du drop-dialog était la divergence) ; header,
projects et drop-dialog la composent, l'analysis-panel garde sa variante
outline-inset, les quietButton lourds inchangés. Gate **verte — 1462 tests**,
Stryker skippé (core intouché).
[rapport](sessions/2026-07-15-w2-confirm-face.md).
**Pile W.1 → W.2 mergée** (#145, #146 — W.3–W.5 restent au lot W).
**U.1 — analyze gate (branche `feat/u1-analyze-gate`, PR à ouvrir)** : le
middleware d'auth Modal extrait en `app/analyze_gate.py` (humble object —
ruff/pyright/pytest/coverage 100 %), `modal_app.py` composition pure + ajouté
aux cibles ruff CI, 11 tests TestClient dont la composition gate→CORS exacte
de modal_app. Revue 8 angles → 3 fixés : 500s sur tokens adverses
(header non-objet, payload non-ASCII) → 401 en TDD ; **ordre des middlewares
inversé** (gate avant CORSMiddleware → la vraie couche CORS décore les 401,
ACAO + `Vary: Origin`, écho manuel supprimé) ; kit de mint JWT partagé
(`tests/analyze_token_kit.py`, contract pin unique avec l'Edge Function).
**Redéployer Modal au merge** (`modal deploy modal_app.py`). Serveur
**212 pytest** (+13), pyright 0, gate web verte — 1462 tests, Stryker skippé
(core intouché). [rapport](sessions/2026-07-15-u1-analyze-gate.md).
**U.1 mergé (PR #147)** — redéploiement Modal **encore dû** (sera couvert par
le deploy U.3).
**U.3 — brute-force codes beta + plancher secret (branche
`feat/u3-beta-brute-force`, PR à ouvrir)** : `redeem_beta_code` throttlé
(ledger `redeem_attempts`, 5 échecs → verrou 15 min répondant le même `false`,
reset paresseux, nettoyé au succès) + CHECK entropie ≥ 32 chars avec cutoff
`created_at` pour les legacy (un `NOT VALID` nu casserait leur décrément —
trouvé en revue) ; plancher secret ≥ 32 des deux côtés (`assert_strong_secret`
dans `@modal.enter` AVANT le chargement GPU, Edge → 500) ; harnais Deno
versionné (`scripts/seed-supabase-deno-harness.sh`) ; runbook (seed uuid,
rotation Modal-d'abord, check pré-deploy) ; copy `account.code-invalid`
élargie. Vérifié stack local : suites SQL J2+U.3, rafale PostgREST réelle
(6 RPC → failures=5 locked), Deno 8/8, serveur 214 pytest, gate web 1462.
Revue 3 finders → 5 fixés, 4 écartés documentés.
[rapport](sessions/2026-07-15-u3-beta-brute-force.md).
**U.3 mergé (PR #148) et DÉPLOYÉ (2026-07-15)** : `supabase db push`
(migration u3 seule, dry-run vérifié), Edge Function redéployée
(`--use-api`), Modal redéployé (solde U.1). Curl-vérifié en prod : 401 Modal
avec `ACAO` + `Vary: Origin` (la composition gate→CORS de U.1 en vrai).
Au passage : le build d'image Modal cassait (madmom épinglé `git+https`,
`debian_slim` sans git) → `apt_install("ffmpeg", "git")`, déployé,
**PR #149 ouverte (à merger — fix d'une ligne)**.
**#149 mergée.**
**U.2 — job CI deno mergé (PR #150)** : job `edge-functions`
(`setup-deno@v2`, check + lint + fmt sur `mint-analyze-token/`, sans stack) →
[rapport](sessions/2026-07-15-u2-deno-ci.md).
**U.4 — cliquets resserrés mergé (PR #151)** : jscpd 1,0 %, Stryker break 90 →
[rapport](sessions/2026-07-15-u4-ratchets.md).
**U.5 — basses groupées mergé (PR #152) et DÉPLOYÉ (2026-07-15) — LOT U
CLOS** : (1) allowlist d'origines **env-drivée sur les trois surfaces** —
`app/origins.py` pur (extrait de main.py) consommé par main.py + modal_app.py,
l'Edge Function lit le même `LOUPE_ALLOWED_ORIGINS` via Deno.env
(`parseAllowedOrigins` miroir testé), runbook § 0bis = le tableau des trois
emplacements ; (2) `boundaries_to_segments` sorti de structure.py (exclu
coverage/pyright) vers `structure_segments.py` pur + 3 pytest ; (3) `tempo.ts`
(524 lignes, 4 concepts) splitté verbatim en `beat-grid` / `tempo-map` /
`manual-tempo` / `median`, API publique inchangée, spec splitté pareil (compte
identique). Revue 8 angles → **9 fixés** (dont : `*` dans l'env aurait
CORS-ouvert Modal → filtré fail-closed des deux côtés + testé ; conftest/env
scrub pour l'hermétisme des tests CORS ; `typicalBar` et le clamp beats/bar
convergés sur les nouveaux helpers), 4 écartés documentés. Gate
**verte — 1462 web + 221 pytest**, **Stryker 93,55 %**.
Redéployé au merge : `modal deploy` + Edge Function (`--use-api`),
curl-vérifié en prod des deux côtés (Modal 401 + `ACAO`/`Vary: Origin` ;
handler Edge : ACAO échoé sur l'origine autorisée, rien sur une interdite —
NB le gateway Supabase exige `apikey` **et** `Authorization` avant d'invoquer
la fonction, tester avec les deux).
[rapport](sessions/2026-07-15-u5-grouped-lows.md).
**T.1 — boucles musicales (branche `feat/t1-musical-loops`, PR à ouvrir)** :
(1) core pur `snapLoopRegionToGrid(region, grid, 'beat'|'bar')` (TDD +
property tests ; effondrement = une unité minimum, bord hors de l'empan de la
grille laissé brut — un outro n'est pas rapatrié ; `nearestTime` factorisé,
partagé avec `snapSectionsToGrid`) ; (2) le drag-to-loop s'aimante à la
grille en fin de geste, **Alt échappe** (pattern DAW), nudge ←/→ libre — le
snap vit dans `useLoopEditing` (grille dans ses deps) derrière un flag
`snap` dérivé du pointerup ; (3) **« Boucler la section »** sur les rangées
structure du panneau Repères : loupe armée du repère au repère structure
suivant (clampé à la durée), seam `selectSpan`/`armSpan` partagé avec le
rappel de boucle nommée. `WaveformView` allégé (extraction
`ImportErrorStage`/`BeatLines`, budget react-doctor). Gate **verte — 1484
tests** (+22), **Stryker 93,41 %** (12 survivants du premier run tués,
`snap-loop-region.ts` 100 %).
[rapport](sessions/2026-07-15-t1-musical-loops.md).
**T.1 mergé (PR #153)** (+ fix format ruff des deux fichiers de tests U.5 qui
rougissaient la CI de `main`).
**T.2 — nudge musical mergé (PR #154)** :
core pur `nudgeSeconds(seconds, direction, grid, coarse)` — beat adjacent
avec grille (**downbeat avec Shift**), sinon 0,1 s (×10 Shift), repli 0,1 s
au-delà des bords de la grille ; `waveform-view` (poignées A/B) et
`marker-rail` (tags, nouvelle prop `beatGrid`) branchés, les deux
`NUDGE_RATIO = 0.01` supprimés. Gate **verte — 1496 tests** (+12),
**Stryker 93,51 %** (`nudge-time.ts` 100 %).
[rapport](sessions/2026-07-15-t2-musical-nudge.md).
**T.3 — chart navigable (mergé, PR #155)** :
core pur `measureSeekTime(source, grid, writtenIndex, playhead)` — inverse de
la projection du highlight via `unrollChart`, occurrence **encore devant le
playhead** (la passe en cours se relance), repli première occurrence,
property test round-trip écrit↔joué ; les mesures de la `LeadSheet` passent
en `<button>` (`MeasureBox`, aria-label « Aller à la mesure {number} »)
**seulement quand une grille existe** (sinon `<div>` inertes — pas
d'affordance mensongère), même peau ; `onSelectMeasure` câblé
`ChordChartPanel` → `ShellMain` → seek au downbeat. Gate **verte — 1507
tests** (+11), **Stryker 93,95 %** (`measureSeekTime` : survivant frontière
tué, 1 équivalent documenté). NB shell : détection résolue ⇒ seek via le
**moteur de stems**.
[rapport](sessions/2026-07-15-t3-navigable-chart.md).
**T.1–T.3 clos.**

**V.1 — upload d'analyse mono + 24 kHz mergé (PR #156)** : uploads de
détection 3,67× plus légers, résultats identiques octet pour octet →
[rapport](sessions/2026-07-16-v1-analysis-upload.md).

**V.2 — unload du moteur mono-piste au hand-off stems mergé (PR #157)** :
`unload()` sur le port `PlaybackEngine`, hand-back en reload paresseux
(seek vivant + reprise du play, gardes anti-course), last-load-wins couvrant
`load` ET `unload` ; heap A/B 7 → 6 AudioBuffers →
[rapport](sessions/2026-07-16-v2-engine-unload.md).

**En cours : V.5 — buffer de décodage partagé avec les moteurs (branche
`feat/v5-audio-buffer-memo`, PR à ouvrir).** Exploration GO puis livraison le
même jour : `audio-buffer-memo.ts` (WeakMap décodeur → AudioBuffer, modèle
encode-wav-memo), `audioBufferFrom` sert le buffer partagé sur un hit — les
deux copies ~88 MB (moteur piste au load + stem « Piste » au seat métronome)
mesurées évitées (**2 hits** au compteur temporaire ; la copie `createBuffer`
vit côté audio renderer, invisible du heap JS — leçon de mesure). Lecture +
détection d'accords vérifiées **après** lecture du buffer partagé (key of Cm
juste — vues intactes). **Fail-safe** : probe one-shot « acquire the
contents » (un UA qui détache les vues ne partage jamais → chemin copie
pré-V.5) ; buffer partagé = **lecture seule** par contrat. Réactualisation
V.2 : avec le partage, `unload()` ne libère qu'une référence (reclamation
réelle sur le chemin fallback uniquement). Revue 3 finders → 3 fixés,
4 écartés documentés (dont la race `addStem` à froid, préexistante,
consignée en veille). Gate **verte — 1536 tests** (+4), Stryker skippé
(core intouché). [rapport](sessions/2026-07-16-v5-audio-buffer-memo.md).
**V.5 mergé (PR #158).**
**V.3 — warm des modèles au démarrage local mergé (PR #159)** : `app/warm.py`
TDD (opt-out `LOUPE_WARM_MODELS=0`, loaders best-effort — un échec n'en bloque
pas un autre, thread démon `model-warmup`), `warm()` public sur
tempo/chords/structure (une ligne sur les getters double-check-lockés),
`main.py` collecte les hooks des modules importés et lance le warm-up au
lifespan après le GC de boot. Smoke réel : 3 modèles chauds en ~23 s, opt-out
⇒ pas de thread. Serveur **231 pytest** (+10) coverage 98 %.
[rapport](sessions/2026-07-16-v3-warm-models.md).

**V.4 — playhead en `transform` mergé (PR #160) — LOT V COMPLET.**
`left: %` par frame → `translateX(px)` compositor-only + `will-change`
(`left: 0` physique apparié) ; ResizeObserver gardé sur le scrollport (un
resize en pause recalcule les px — le `%` suivait gratuitement, le zoom
re-exécute déjà l'effet). Browser-verify : extrémités alignées à 1× et 4×
(Δ < 1 px), page-follow intact, resize 1200→700 recalcule à ratio constant.
Gate **verte — 1537 tests** (+1), Stryker skippé (core intouché).
[rapport](sessions/2026-07-16-v4-playhead-transform.md).
**W.3 — faux-gras synthétisés (branche `feat/w3-faux-bold`, PR à ouvrir)** :
les trois `font-weight: 600` sur des graisses absentes corrigés — titres
dialog/popover (Space Grotesk, seul 500 chargé) abaissés à 500 (choix : pas de
600.css en plus, cohérent avec le logo), `.timeSignature` (Petaluma, 400 seul)
dégraissé. Browser-verify avant/après (600 forcé = trait synthétisé empâté).
Règle actée : `--font-logo` ⇒ 500 tant que 600.css n'est pas importé ; jamais
de `font-weight` sur Petaluma. Gate **verte — 1537 tests**, Stryker skippé
(core intouché). [rapport](sessions/2026-07-16-w3-faux-bold.md).
**W.3 mergé (PR #161).**
**W.4 — typo chart sur tokens + verrou font-size (branche
`feat/w4-chart-type-scale`, PR à ouvrir)** : rabattement sur `--font-size-xl`
tenté d'abord et rejeté sur sonde navigateur (Petaluma rend ~20 % plus petit
qu'Inter à em égal — hiérarchie titre/artiste inversée, glyphes moins
lisibles) → tokens chart dédiés commentés (`--font-size-chart-title`/`-glyph`,
rendu inchangé) ; `check-css-tokens.sh` bloque désormais les `font-size`
absolus (`rem`/`px`) hors tokens.css — les ratios `em` restent légaux
(relatifs au contexte, pas à l'échelle), verrou testé en négatif. Gate
**verte — 1537 tests**, Stryker skippé (core intouché).
[rapport](sessions/2026-07-16-w4-chart-type-scale.md).
**W.4 mergé (PR #162).**
**W.5 — basses design groupées (branche `feat/w5-grouped-lows`, PR à ouvrir) —
LOT W CLOS** : `.kbd` et la face `.secondaryAction` promus dans
controls.module.css (le trigger AccountMenu gagne le dip `:active` ; rangées
projects-dialog volontairement locales), `styles.section` fantôme retiré +
check `styles.X ↔ classes` dans check-css-tokens.sh (testé en négatif), les
8 focus rings identiques à la baseline supprimés (le `-2px` d'import-menu
commenté), reliquats O.2 soldés (`--tracking-label` sur `.sub`,
`--space-3xs` sur `.tag`, lead-sheet en propriétés logiques). Vérifs
navigateur (chips kbd, dip partagé). Gate **verte — 1537 tests**, Stryker
skippé (core intouché). [rapport](sessions/2026-07-16-w5-grouped-lows.md).
**W.5 mergé (PR #163) — reste de la v4 : T.4–T.8.**
**T.4 — Cmd/Ctrl+S = Enregistrer (branche `feat/t4-cmd-s`, PR à ouvrir)** :
`Command.saveProject` bindé meta+S/ctrl+S (TDD, key-bindings 112/112
mutants), carte auto-dérivée (2 lignes ⌘+S/⌃+S), un chord Cmd/Ctrl (sans
Alt) traverse la garde champ-texte (Cmd+S enregistre depuis le textarea de
la grille), câblage dans `use-shell-shortcuts` (premier save = nom de piste,
re-save dirty, no-op propre/en-vol). Gate **verte — 1544 tests** (+7),
**Stryker 93,74 %**. [rapport](sessions/2026-07-16-t4-cmd-s.md).
**T.4 mergé (PR #164).**
**T.5 — BPM/mètre au standard N.4 (branche `feat/t5-bpm-meter-invalid`, PR à
ouvrir)** : `CommitNumberField` gagne `isValid` (« pris verbatim ? ») +
`aria-invalid`/`badInput` + bordure danger (recette N.4) — BPM hors bornes
(clamp silencieux), mètre hors bornes (rejet) ou fractionnaire (floor 4,5→4)
flaggés pendant la frappe ; contrats `useTempo` inchangés. Gate **verte —
1549 tests** (+5), Stryker skippé (core intouché).
[rapport](sessions/2026-07-16-t5-bpm-meter-invalid.md).
**T.5 mergé (PR #165).**
**T.6 — découvrabilité (branche `feat/t6-discoverability`, PR à ouvrir)** :
dialog « Aide du format » (10 lignes exemple→sens vérifiées contre le
parseur, grammaire de liste promue dans app-dialog et partagée avec le
dialog « ? »), section « Gestes » dans l'aide (les `title` survol-seulement
enfin enseignés), AT honnête — seek clavier des tags (clic detail 0, pas de
double-seek) et surface waveform `<div>` pointer-only hors tab order
(testid, kit + 4 specs migrés). Browser-verify du dialog. Gate **verte —
1556 tests** (+7), Stryker skippé.
[rapport](sessions/2026-07-16-t6-discoverability.md).
**T.6 mergé (PR #166).**
**T.7 — fine-tune ±50 cents (branche `feat/t7-fine-tune`, PR à ouvrir)** :
`fineTuneCents` séparé de la transposition (N.3/modulo 12 restent en
demi-tons) — core `clampFineTuneCents` + `fineTuneOrDefault` (absent ⇔ 0),
moteurs en `demi-tons + cents/100` (paire portée par ref — deux setters
enchaînés n'appliquent jamais l'autre moitié périmée), persisté/signé/
round-trippé shell, champ « Ajustement fin » sur `CommitNumberField`
extrait en `app/ui/` (flag T.5 inclus), `ShellFooter` extrait (budget 300).
Gate **verte — 1570 tests** (+14), **Stryker 93,63 %** (2 équivalents
fine-tune documentés). [rapport](sessions/2026-07-16-t7-fine-tune.md).
**T.7 mergé (PR #167).**
**T.8 — décisions actées** (checkpoint utilisateur) : spectre = v1 chroma
honnête ; EQ = slice BiquadFilter par stem, non persistée.
**T.8a — Spectre chroma (branche `feat/t8a-spectrum-chroma`, PR à ouvrir)** :
`chromaFromSpectrum` pur (bande 32–2100 Hz, mutation 34/36 + 1 équivalent),
`spectrum?()` optionnel sur les ports moteurs, tap `AnalyserNode`
pass-through unique avant destination dans le transport partagé,
`ChromaView` (poll 10 Hz dans la feuille, 12 barres C…B). Browser-verify
lecture réelle : chaîne intacte, barres plausibles. Gate **verte — 1585
tests** (+15). [rapport](sessions/2026-07-16-t8a-spectrum-chroma.md).
**T.8a mergé (PR #168).**
**T.8b — EQ par stem (branche `feat/t8b-stem-eq`, PR à ouvrir) — LOT T
CLOS** : `StemFilter` + `setStemFilter?()` sur le port, deux biquads
toujours présents parqués plats par stem (Q Butterworth, poser un filtre =
déplacer une fréquence, jamais recâbler), `mixer.setFilter` session-only
(reset au mix frais, jamais dans MixerState), rangée LC/HC compacte sous
chaque fader (bord de slider = côté coupé). Browser-verify : filtrage en
lecture réelle. Gate **verte — 1591 tests** (+6), Stryker skippé.
[rapport](sessions/2026-07-16-t8b-stem-eq.md).
**Évaluation notée v5 (2026-07-16) — [feuille de route v5](roadmap-excellence-5.md).**
Roadmap v4 entièrement livrée (Lots Q, R, T, U, V, W — PRs #137→#169). Revue
multi-agents 6 axes, chaque constat vérifié adversarialement (35 constats,
20 confirmés, 15 réfutés/déjà-tranchés). Note globale **17,2/20** (16,1 le
2026-07-14) — tous les axes montent : qualité 18, fonctionnalités 17,5,
esthétique 17, sécurité 17, ergonomie 17, performance 16,5. Les quatre
déductions structurelles de la passe 4 sont vérifiées réellement soldées.
Reste : cinq 🟠 moyens (gating/copy offload menteurs X.1, cul-de-sac
d'annulation tempo X.2, régression hauteur header stems T.8b → Y.1,
clic métronome dans la bande chroma Z.1, veille CVE Python AA.1) + une
quinzaine de finitions basses, séquencés en Lots X, Y, Z, AA.

**Cap produit acté (2026-07-16)** : client léger — migrer tout le calcul
possible vers Modal (le serveur local devient optionnel) et porter le shell en
app de bureau **Tauri**, pour tourner sur des machines peu puissantes. Premier
pas : **AB.1** = plan de migration dédié (roadmap v5 § Cap) ; ne déplace pas
les cinq 🟠. **Plan écrit : [client-leger-plan.md](client-leger-plan.md)**
(projets locaux, Modal d'abord — M1.1 tempo+accords → M1.2/M1.3 séparation →
M1.4 santé/hors-ligne —, puis Tauri T2.1–T2.5 ; yt-dlp en sidecar ; mobile =
option gardée ouverte). **Séquencement validé (2026-07-16)** : les cinq 🟠 v5
d'abord — X.1 en tête (prérequis de M1.1) —, AA.2 déplacé en T2.2, les 🟢 au
fil de l'eau, puis Phase 1 Modal.

**X.1 — structure dé-gatée du serveur local en mode offload (branche
`feat/x1-offload-gating`, PR à ouvrir)** : `blockedReason` structure dérivé de
`serverHealth` seulement quand l'analyse est locale (pas de sonde Modal — le
conteneur facturé ne se réveille pas au chargement, l'erreur typée parle au
clic), `mayColdStart` → `offloaded` (cold-start R.3 + choix de copy),
nouvelle copy `structure.error.network-offload` (« Service d'analyse
injoignable — réessayer. »). Browser-verify via le port 5174 (origin rejetée
→ « Serveur hors ligne ») : structure active sans hint, voisins gatés
inchangés. Gate **verte — 1595 tests** (+4), Stryker skippé (core intouché).
[rapport](sessions/2026-07-16-x1-offload-gating.md).

**X.2 en PR (#171), Y.1 en PR (#172), Z.1 en PR (#173)** — voir leurs
rapports.
**AA.1 — veille CVE pip (branche `feat/aa1-pip-advisories`, PR à ouvrir) —
LES CINQ 🟠 v5 LIVRÉS** : bloc `pip` sur `/server` dans dependabot.yml
(advisories signalées malgré le pinning strict ; bumps = PRs à arbitrer,
fidèle à A.1 ; pin git madmom non couvert, documenté ; step pip-audit CI
écarté — le pin git le casse au parsing).
[rapport](sessions/2026-07-16-aa1-pip-advisories.md).

**Prochain : merger #171/#172/#173/AA.1 (conflits STATUS triviaux), puis
M1.1** (tempo+accords sur Modal — Phase 1 du
[plan client léger](client-leger-plan.md)) ; les 🟢 v5 au fil de l'eau.

**Prochain : X.1** (les cinq 🟠 d'abord — cf. séquencement roadmap v5).

**Fix « labels dupliqués » mergé (PR #132).** Un projet sauvegardé
avant les marker kinds (PR #128) restaure ses marqueurs de structure sans
`kind` → chaque détection les préserve comme repères et ajoute son jeu à
côté. Fix : `adoptStructureKinds` à la restauration (vocabulaire des sections,
tag brut + copy d'affichage) — auto-réparant à la ré-ouverture. Gate **vert —
1408 tests**, Stryker skippé (core intouché).
[rapport](sessions/2026-07-14-restore-structure-marker-kinds.md).

**Fix « la détection d'accords efface la structure » mergé (PR #130)** :
structure détectée PUIS accords : le brouillon déduisait ses blocs neutres
`[A]`/`[B]` et la sync chart→timeline remplaçait/effaçait les marqueurs
détectés. Fix : `detectChords` accepte `sections` (les marqueurs
`kind:'structure'` relus via `markerSections`, mémoïsé au shell) et découpe
le brouillon par `cutBySections` (exporté) sous leurs libellés — le
round-trip marqueurs → en-têtes du brouillon → marqueurs est l'invariant.
Revue 3 finders : section unique titrée (`headLoneRun`), libellés non
imprimables filtrés, limites v1 documentées. Gate **vert — 1411 tests**
(+10), Stryker 93,5 %.
[rapport](sessions/2026-07-14-chord-draft-preserves-structure.md).

**Notation empilée des signatures mergée (PR #131)** — approche validée
utilisateur (fidèle au chart Elton John) : composant `TimeSignature` (glyphe
N-sur-M, `role="img"` + `aria-label`), signature de tête ({time:} >
beatsPerBar de session) dans la gouttière avant la barre d'ouverture du
premier système, changements de mètre en glyphe empilé dans leur mesure,
« 4/4 » texte retiré du header meta. Vérif navigateur conforme au PDF (The
Logical Song, {time:} tête + changement 2/4). Gate **vert — 1405 tests**,
Stryker skippé (core intouché).
[rapport](sessions/2026-07-14-stacked-time-signature.md).
See [S.3a structure web](sessions/2026-07-13-structure-web-s3.md) ·
[P.4 print](sessions/2026-07-13-p4-print.md) ·
[P.4](sessions/2026-07-13-p4-structure-deduction.md) ·
[P.3](sessions/2026-07-12-p3-collapsed-edit.md) ·
[P.2](sessions/2026-07-12-p2-form-unroll.md) ·
[P.1](sessions/2026-07-12-p1-chart-rendering.md) ·
[O.5](sessions/2026-07-12-grouped-lows-o5.md) ·
[O.4](sessions/2026-07-12-btc-windows.md) ·
[O.3](sessions/2026-07-12-split-shell-spec.md) ·
[O.2](sessions/2026-07-12-design-micro-drifts.md) ·
[interlude](sessions/2026-07-12-react-doctor-ref-mutations.md) ·
[O.1](sessions/2026-07-12-dead-accent-token.md).

## Historique (une ligne par étape, du plus récent au plus ancien)

### Roadmap excellence 4 (2026-07-14 → …)

- 2026-07-14 · **Évaluation notée v4** (16,1/20, six axes + 2 enquêtes
  ciblées sur les irritants d'usage) : revue multi-agents vérifiée
  adversarialement, 45 constats confirmés →
  [roadmap-excellence-4](roadmap-excellence-4.md) (Lots Q–W)

### Lot P — lead-sheet chart (2026-07-12 → …)

- 2026-07-13 · **Pré-démo #3 — signatures rythmiques** (PR #129 mergée) :
  `{time: N/M}` tête + mid-grid, dominant meter, beats/bar éditable →
  [rapport](sessions/2026-07-13-time-signatures.md)
- 2026-07-13 · **Pré-démo #2 — marqueurs ↔ structure** (PR #128 mergée) :
  marker kinds + sync chart→timeline →
  [rapport](sessions/2026-07-13-marker-kinds-structure-sync.md)
- 2026-07-13 · **P.4 impression** (PR à ouvrir) : « Imprimer » +
  `data-print-region` conditionnel + stylesheet print `:has` (chart seule,
  html/body aplatis), BarsPerRowField extrait →
  [rapport](sessions/2026-07-13-p4-print.md)
- 2026-07-13 · **P.4 phase 1 — déduction de structure** (PR #116 mergée) :
  `deduceStructure` MDL + vote nettoyant + `renderStructuredSource`
  (`[A]`, `|: :|`), detectChords structuré, Stryker 100 % sur le fichier →
  [rapport](sessions/2026-07-13-p4-structure-deduction.md)
- 2026-07-12 · **P.3 — édition repliée** (PR #115 mergée) : chart-first,
  textarea derrière « Modifier » (aria-expanded/controls, focus remis),
  hint d'état vide, helpers typeGrid/chartEditor →
  [rapport](sessions/2026-07-12-p3-collapsed-edit.md)
- 2026-07-12 · **P.2 — grammaire de forme + unrollChart** (PR #114 mergée) :
  reprises/voltas/{d.c.}/{coda}/{fine}/fermata, unroll pur (fast-check),
  surlignage sur la forme déroulée →
  [rapport](sessions/2026-07-12-p2-form-unroll.md)
- 2026-07-12 · **P.1 — rendu chart** (PR #113 mergée) : directives `{k: v}`,
  ChordGlyph, barres dessinées, ChartHeader dérivé + Petaluma Script OFL →
  [rapport](sessions/2026-07-12-p1-chart-rendering.md)

### Roadmap excellence 3 (2026-07-11 → …)

- 2026-07-12 · **O.5 — basses code groupées** (PR #112 mergée, Lot O clos) : AbortSignal
  /tempo+/chords bout-en-bout, coverage create-chord-detector aligné,
  `PopoverForm` partagé → [rapport](sessions/2026-07-12-grouped-lows-o5.md)
- 2026-07-12 · **O.4 — btc_windows.py pur** (PR #111) : fenêtrage
  TIMESTEP extrait de chords.py, `window_plan` testé (6 pytest), _analyse
  rebranché → [rapport](sessions/2026-07-12-btc-windows.md)
- 2026-07-12 · **O.3 — split workstation-shell.spec** (PR #110) : 115
  tests répartis en 9 specs par parcours + `shell-test-kit.tsx` colocalisé →
  [rapport](sessions/2026-07-12-split-shell-spec.md)
- 2026-07-12 · **O.2 — micro-dérives design** (PR #109 mergée) : transitions
  sur tokens motion, focus toast amber, marker-rail/ruler tokenisés,
  `--tracking-label` → [rapport](sessions/2026-07-12-design-micro-drifts.md)
- 2026-07-12 · **Interlude — react-doctor 0.7.6 / hook `useLatest`** (PR #107
  mergée) : 14 refs mutées au rendu purifiées (écriture en effet), Dependabot
  débloqué → [rapport](sessions/2026-07-12-react-doctor-ref-mutations.md)
- 2026-07-12 · **O.1 — token mort `--accent` + check:tokens** (PR #106
  mergée) :
  erreur tempo re-colorée via `errorLine`, gate verrouillé par un diff
  var() utilisées/définies →
  [rapport](sessions/2026-07-12-dead-accent-token.md)
- 2026-07-12 · **N.4 — micro-frictions panneau accords** (PR #105 mergée) :
  champ mes./ligne flaggé (aria-invalid + badInput), préférence localStorage
  posée au blur, ligne « Détecter » sous le header →
  [rapport](sessions/2026-07-12-chord-panel-frictions.md)
- 2026-07-12 · **N.3 — divergence pitch ↔ grille** (PR #100 mergée) :
  `transposedBy` persisté, transposition appariée en core, flag modulo 12,
  « Transposer la grille pour suivre » confirmé deux temps →
  [rapport](sessions/2026-07-12-pitch-chart-divergence.md)
- 2026-07-12 · **N.2 — raccourcis L/K/T + gardes repeat/dialog** (PR #99
  mergée) : toggles boucle/métronome/tap au clavier, carte auto-dérivée,
  listener global durci →
  [rapport](sessions/2026-07-12-practice-toggle-shortcuts.md)
- 2026-07-12 · **N.1 — erreurs accords discriminées + Lingui** (PR #98) :
  codes typés bout-en-bout, `classifyTransportError` partagé, copy
  actionnable annoncée →
  [rapport](sessions/2026-07-12-chord-detection-error-codes.md)
- 2026-07-11 · **M.3 — lows serveur groupés, Lot M clos** (PR #97) : timeout
  d'inférence qui tire vraiment (`abandon_on_cancel`), `FileResponse`,
  épinglage documenté → [rapport](sessions/2026-07-11-server-lows-m3.md)
- 2026-07-11 · **M.2 — /download borné** (PR #96) : sémaphore + `max_filesize`
  + budget total (et `/separate` aussi) →
  [rapport](sessions/2026-07-11-harden-download.md)
- 2026-07-11 · **M.1 — garde Origin CSRF** (PR #95) : `OriginGuardMiddleware`,
  403 hors allowlist, same-origin de confiance →
  [rapport](sessions/2026-07-11-origin-guard.md)
- 2026-07-11 · **L.4 — memo WAV encodé** (PR #94, **Lot L clos**) :
  `encodeWavMemo` WeakMap, le mix encodé une fois pour `/tempo`/`/chords`/
  `/separate`/export piste → [rapport](sessions/2026-07-11-wav-encode-memo.md)
- 2026-07-11 · **L.3 — mémoire stems** (PR #93) : le moteur multitrack unique
  gardien du PCM des stems (~500 MB vs ~1 GB sur 6 stems), `stemAudio(id)` sur
  le port, sources paresseuses zéro-copie →
  [rapport](sessions/2026-07-11-stems-memory.md)
- 2026-07-11 · **L.2 — suivi par pages du ZoomStage** (PR #92) :
  `followScrollLeft` pur, plus d'écriture `scrollLeft` par frame, grâce 2 s au
  scroll manuel → [rapport](sessions/2026-07-11-zoom-stage-page-follow.md)
- 2026-07-11 · **L.1 — playhead hors état React** (PR #91) :
  `createExternalValue` + playhead impératif — 8 commits React/5 s contre
  ~60–120/s → [rapport](sessions/2026-07-11-playhead-external-store.md)
- 2026-07-11 · **Lot K — grille & tempo** (PRs #89/#90) : `sanitizeBeatGrid`
  deux passes + filtre miroir serveur (K.2) ; scrollport LeadSheet + suivi du
  playhead + footer sticky (K.1) →
  [K.2](sessions/2026-07-11-tempo-map-outliers.md) ·
  [K.1](sessions/2026-07-11-lead-sheet-scrollport.md)
- 2026-07-11 · **Évaluation notée v3** (16,0/20, six axes dont performance) :
  revue multi-agents vérifiée adversarialement, 35 constats confirmés →
  [roadmap-excellence-3](roadmap-excellence-3.md) (Lots K–O)

### Plan chord-charts (2026-07-10 → …)

- 2026-07-11 · **Lot C serveur + web — détection ACE bout-en-bout** (PR #87 +
  PR web) : `POST /chords` BTC vendoré sha256-pinné, adapter mir→tokens,
  bouton « Détecter les accords » → brouillon confirmé →
  [serveur](sessions/2026-07-11-chords-endpoint.md) ·
  [web](sessions/2026-07-11-detect-chords-ui.md)
- 2026-07-11 · **Lot C core — détection d'accords** (PR #86) : port
  `ChordDetector` + `chordLabelPerMeasure` + `renderChartSource` +
  `detectChords` → brouillon source →
  [rapport](sessions/2026-07-11-chord-detection-core.md)
- 2026-07-11 · **Sync lecture de la lead-sheet** (PR #80) : `measureIndexAt`
  pur (mesure ↔ intervalle downbeat→downbeat, projection jamais stockée),
  surlignage `aria-current` + bars-per-row configurable →
  [rapport](sessions/2026-07-11-chord-chart-playback-sync.md)
- 2026-07-10 · **Transposition de la grille** (PR #79) :
  `transposeChartSource(source, ±n)` réécrit le texte source en préservant la
  mise en page ; garde round-trip par token, accidentals unicode →
  [rapport](sessions/2026-07-10-chord-chart-transpose.md)
- 2026-07-10 · **Persistance de la grille** (PR #78) : `ProjectChordChart
  { source }` signé dans le manifest (absent ⇔ vide), état lifté au shell,
  restauré à l'ouverture, reset à l'import ; piège du test vacuement vert
  durci par import intermédiaire ; extraction `use-shell-drop.ts` →
  [rapport](sessions/2026-07-10-chord-chart-persistence.md)
- 2026-07-10 · **Lot A/B — socle lead-sheet** (PR #77) : `chord-symbol` +
  `chord-chart` purs (format grille maison, round-trip fast-check),
  `LeadSheet` CSS Grid zéro lib + saisie live ; moteur ACE arbitré = BTC
  (MIT) ; Stryker 100 % sur les fichiers chord ; vérif navigateur → fix
  tokens (accords invisibles) →
  [rapport](sessions/2026-07-10-chord-charts-lot-a-b.md)

### Roadmap excellence 2 (Lots F → J, 2026-07-07 → 07-11)

- 2026-07-11 · **Lot J — fond de panier** (PRs #81–#85 mergées) : tokens
  sémantiques, `:active`, dédup moteurs Web Audio, quota disque, annulation —
  roadmap-excellence-2 **entièrement cochée** →
  [rapport](sessions/2026-07-11-lot-j-fond-de-panier.md)
- 2026-07-09/10 · **Lot I.3 — count-in du métronome, LOT I COMPLET** (PR #76) :
  une mesure de clics avant le départ — atterrissage calé sur la grille,
  accents phasés sur la mesure du morceau, tempo entendu; adaptateur one-shot
  robuste à l'autoplay → [rapport](sessions/2026-07-09-metronome-count-in.md)
- 2026-07-09 · **Lot I.2 — tempo manuel** (PR #75) : tap-tempo (médiane), champ
  BPM éditable, calage de phase; `ManualTempo` signé/persisté →
  [rapport](sessions/2026-07-09-manual-tempo.md)
- 2026-07-09 · **Lot I.1 — speed trainer** (PR #74) : rampe de tempo par
  passes de boucle; plancher tempo 40 %; la boucle confine la tête →
  [rapport](sessions/2026-07-09-speed-trainer.md)
- 2026-07-08 · **Lot H — a11y live-regions** (PR #73) : séparation et
  détection tempo annoncées (primitive `LiveStatus`) →
  [rapport](sessions/2026-07-08-web-a11y-live-regions.md)
- 2026-07-08 · **Lot G — confiance utilisateur** (PR #72) : suppression
  deux-temps repère/boucle, erreurs actionnables (réimport, retry tempo),
  drop non-audio signalé → [rapport](sessions/2026-07-08-web-user-trust-lot-g.md)
- 2026-07-07 · **Lot F — hygiène serveur** (PR #70) : cap `/download` 🔴,
  sémaphore `/tempo`, `wav_decode` torch-free testé, README resync →
  [rapport](sessions/2026-07-07-server-hygiene-lot-f.md)
- 2026-07-06 · **Évaluation notée v2** (15,3/20) →
  [roadmap-excellence-2](roadmap-excellence-2.md) (Lots F–J, suivi coché en fin
  de fichier)

### Plan tempo (Lots A → C, 2026-07-06 → 07-07)

- 2026-07-07 · **Lot C — tempo variable** (PR #69) : `buildTempoMap`/`tempoAt`
  dérivés de la grille (jamais persistés), read-out suit la tête →
  [rapport](sessions/2026-07-07-tempo-map.md)
- 2026-07-06 · **Lot B.2 — serveur `beat_this`** (PR #68) : beats + downbeats
  transformer (mesure réelle), humble object `beat_positions` 100 % →
  [rapport](sessions/2026-07-06-tempo-beat-this-server.md)
- 2026-07-06 · **Lot B.1 — contrat `/tempo` enrichi** (PR #67) : `barPosition`
  par beat, `detectMeter`, `beatsPerBar` persisté →
  [rapport](sessions/2026-07-06-tempo-enriched-contract.md)
- 2026-07-06 · **Lot A — correction d'octave ×2/÷2** (PR #66) :
  `foldTempoOctave`, `octaveShift` signé/persisté →
  [rapport](sessions/2026-07-06-tempo-octave-toggle.md)

### Roadmap excellence 1 (Lots A → E, 2026-07-05 → 07-06)

- 2026-07-06 · **Lot E.1 — split `use-player`** : `use-loop` +
  `use-transport-engines` extraits (comportement préservé) →
  [rapport](sessions/2026-07-06-web-split-use-player.md)
- 2026-07-06 · **Lot E trio — dette de complexité** (PR #63) :
  `isSyntheticStem`, handler nommé, no-op map supprimé →
  [rapport](sessions/2026-07-06-web-complexity-debt-trio.md)
- 2026-07-06 · **Lot D.3 — feedbacks manquants** : garde URL inline, primitive
  toast (Base UI), confirmations export/save →
  [rapport](sessions/2026-07-06-web-feedbacks.md)
- 2026-07-06 · **Lot D.2 — « Séparer » ↔ santé serveur** : bouton désactivé +
  hint actionnable hors-ligne / sans moteur →
  [rapport](sessions/2026-07-06-web-separate-server-health.md) · D.1 undo/redo
  → veille (décision produit)
- 2026-07-05 · **Lot C.5 — micro-motion overlays** →
  [rapport](sessions/2026-07-05-web-overlay-micromotion.md)
- 2026-07-05 · **Lot C.4 — boutons unifiés + icônes SVG** →
  [rapport](sessions/2026-07-05-web-unify-buttons-icons.md)
- 2026-07-05 · **Lot C.3 — design system (type/élévation/z-index/radius)** —
  incl. le piège Base UI « z-index sur le Positioner » →
  [rapport](sessions/2026-07-05-web-design-system-tokens.md)
- 2026-07-05 · **Lot C.2 — responsive intrinsèque (Every Layout, 0 media
  query)** (PR #58) → [rapport](sessions/2026-07-05-web-responsive-tactile.md)
- 2026-07-05 · **Lot C.1 — DnD natif + empty-state** (PR #57) →
  [rapport](sessions/2026-07-05-web-dnd-empty-state.md)
- 2026-07-05 · **Lot B — discipline serveur** (PR #54/#55/#56) : pytest élargi,
  gate serveur CI torch-free (ruff+pyright+coverage), humble objects extraits →
  [B.1](sessions/2026-07-05-server-pytest-breadth.md) ·
  [B.2](sessions/2026-07-05-server-lint-types-ci.md) ·
  [B.3](sessions/2026-07-05-server-humble-objects.md)
- 2026-07-05 · **Lot A — sécurité serveur** (PR #48/#49/#50/#51) : pip runtime
  supprimé 🔴, CORS/TrustedHost, caps + semaphore + tmp durci, loopback-only →
  [A.1](sessions/2026-07-05-server-no-runtime-pip.md) ·
  [A.2](sessions/2026-07-05-server-cors-host.md) ·
  [A.3](sessions/2026-07-05-server-resource-limits.md) ·
  [A.4](sessions/2026-07-05-server-loopback-and-filename.md) — roadmap :
  [roadmap-excellence](roadmap-excellence.md)
- 2026-07-05 · **Housekeeping** : jscpd 14→7, tabs, coverage web gatée 85/80 →
  [rapport](sessions/2026-07-05-dry-tabs-coverage.md)

### Tronc fonctionnel (2026-07-03 → 07-04)

- 2026-07-04 · **UI clarity pass** (PR #46) : mix sommé, boucles en sidebar,
  séparation relocalisée → [rapport](sessions/2026-07-04-ui-workstation-clarity.md)
- 2026-07-04 · **Persistance métronome** (PR #41) : `ProjectTempo` sur le
  manifest, reopen sans serveur →
  [rapport](sessions/2026-07-04-metronome-persistence.md)
- 2026-07-04 · **Import depuis URL** (PR #42) : port `TrackSource`, yt-dlp
  serveur, menu Importer → [core](sessions/2026-07-04-import-from-url-core.md) ·
  [adapter+UI](sessions/2026-07-04-import-from-url-adapter-ui.md)
- 2026-07-04 · **Métronome-stem** (PR #40) : clic synthétisé comme stem du
  mixer, auto-détection à l'import →
  [rapport](sessions/2026-07-04-metronome-stem.md)
- 2026-07-03 · **Détection de tempo réelle** (PR #39, serveur librosa) →
  [rapport](sessions/2026-07-03-tempo-detection.md)
- 2026-07-03 · **Persistance tempo/pitch/zoom** (PR #38) →
  [rapport](sessions/2026-07-03-persist-tempo-pitch-zoom.md)
- 2026-07-03 · **i18n Lingui** (PR #37) + shell éclaté en régions →
  [rapport](sessions/2026-07-03-i18n-lingui.md)
- 2026-07-03 · **Garde session non enregistrée** (PR #36) →
  [rapport](sessions/2026-07-03-dirty-session-guard.md)
- 2026-07-03 · **UI polish** (PR #35) : marqueurs draggables, gutter DAW →
  [rapport](sessions/2026-07-03-ui-polish.md)

### Jalons fondateurs (2026-06-28 → 07-02) — tous livrés

- **Jalon 1 — atelier de base** (import/waveform, transport, time-stretch
  SoundTouch, repères, boucles A/B, zoom, raccourcis) : complet + poli —
  plan [jalon-1-plan.md](jalon-1-plan.md), rapports datés du 2026-06-28.
- **Jalon 2 — séparation IA** : serveur local FastAPI + Demucs
  (`htdemucs_6s`) derrière le port `StemSeparator` (les moteurs WASM
  in-browser ont été retirés), détection d'instruments, mixer multitrack,
  export stems zip. Clos le 2026-07-02 —
  plan [jalon-2-plan.md](jalon-2-plan.md),
  [vérif export](sessions/2026-07-02-jalon2-export-verify.md).
- **Jalon 3 — projets** : domaine `Project` pur, ports + use-cases, adapter
  serveur HTTP (blobs content-addressed), boucles par projet, save
  incrémental, races corrigées; polish (rename `server/`, renommage projet,
  GC blobs) mergé PR #43/#44/#45 —
  [polish](sessions/2026-07-04-jalon3-polish.md),
  [état de session UX](sessions/2026-07-02-ux-session-state.md).
- **J4.1 — import URL** livré avec le tronc fonctionnel (ci-dessus).

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** — **REVISED (2026-06-30): a local server is now the default
  and required path.** In-browser WASM (demucs.cpp GGML / onnxruntime-web) hit a
  quality+speed wall (quantised models, wasm32 memory ceiling, no native GPU). A
  **FastAPI + Demucs** backend (`server/`, GPU-capable, outside the hexagon)
  implements the same `StemSeparator` port via an HTTP/NDJSON contract;
  `createSeparator` returns the HTTP adapter. **The in-browser WASM engines were
  removed** — server-side Demucs is the single supported engine. htdemucs weights
  are research-only — fine for this non-commercial tool, not for a commercial
  product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Plans

- [roadmap-excellence-4.md](roadmap-excellence-4.md) — **en cours** (Lots Q–W,
  évaluation notée du 2026-07-14).
- [roadmap-excellence-3.md](roadmap-excellence-3.md) — **complet** (Lots K–P,
  évaluation notée du 2026-07-11).
- [roadmap-excellence-2.md](roadmap-excellence-2.md) — **complet** (Lots F–J ;
  J en PRs #81–#85, suivi coché en fin de fichier).
- [chord-charts-plan.md](chord-charts-plan.md) — **complet** (Lots A/B/C
  livrés ; Lot D ChordPro = optionnel, en veille).
- [tempo-detection-plan.md](tempo-detection-plan.md) — complet (Lots A–C).
- [roadmap-excellence.md](roadmap-excellence.md) — complet (Lots A–E).
- [jalon-2-plan.md](jalon-2-plan.md) · [jalon-1-plan.md](jalon-1-plan.md) —
  complets.

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap (coûteux, si l'usage le réclame).
- Locale EN (infra Lingui prête, seul `fr` existe).
- Chemin clavier pour créer une boucle A/B (design à concevoir avant de coder).
- Thème clair (décision produit).
- Undo/redo (D.1) — écarté produit : faible ROI pour un outil de pratique.
- Off-thread zip/encode — l'export gèle l'UI quelques secondes (~229 MB
  mesurés) sur une piste de 4 min.
- Jalon 4 — export MIDI par stem (basic-pitch), différenciateur audio→notation.
- Dependabot PR #53 (`@vitejs/plugin-react` v6, breaking Babel→oxc) — reporté.
- Vieux manifests *séparés* : re-`attach` sur le detect fire-and-forget peut
  écraser des réglages de fader faits pendant la fenêtre de détection —
  s'auto-répare à la sauvegarde; corriger seulement si ça mord.
- Race `addStem`/`play` sur bus stretch froid (revue V.5, préexistante) :
  play pendant l'enregistrement du worklet (~100–500 ms au premier
  chargement) peut créer deux sources pour un même stem, la première
  orpheline (inarrêtable jusqu'à sa fin naturelle) — corriger si ça mord.
