# Session — 2026-07-18 — af-ai-review-fixes

Lots **AF + AG + AH.1 + AI.2** de la [roadmap v6](../roadmap-excellence-6.md)
en une PR (branche `feat/af-form-slash-coherence`), + la
**checklist beta** (`docs/beta-checklist.md`).

## Done

- **AF.1** : `relabelChartBySections` recopie la zone de tête — `{key}`
  (épellation tonale + offset de transposition) et les directives
  utilisateur survivent à « Détecter la structure » ; `{time}` reste
  re-dérivé de la grille, `{form}` est légitimement droppé (son déroulé est
  écrit en toutes lettres — le refold via la déduction d'instances = v2).
- **AF.2** : `headChord` coupe aussi au `/` — le slash est une observation
  de basse, le jitter inter-passes (dominant/contesté sous le seuil ×2) ne
  défait plus le matching de forme livré le même jour.
- **AG.1** : en offload, **l'import ne minte plus** — sans jeton frais en
  cache, l'auto-détection du tempo se **diffère** (`deferDetection`, la
  face on-offer X.2 « Détecter le tempo ») ; le premier geste d'analyse (et
  l'unité de quota, et l'éventuel popover compte) reste à l'utilisateur.
  « Réessayer »/boutons = gestes explicites, inchangés. Spec shell M1.1
  adaptée au nouveau parcours ; 3 specs unitaires du seam
  `autoDetectSpendsNothing`.
- **AH.1 (v1)** : sous le shell Tauri, Exporter / WAV par stem / Imprimer
  sont **désactivés avec hint** (« bientôt disponible sur l'app de
  bureau ») — WKWebView no-opait l'ancre `download` et `window.print()`
  pendant que le toast de succès partait. Chemin natif plugin-dialog =
  follow-up (vérif en bundle requise). Spec : `__TAURI_INTERNALS__` stub →
  bouton WAV disabled.
- **AI.2 (partiel)** : le **vrai mutant de collision du memo DP est tué**
  (clé template → constante : 5 tests le voient, dont le nouveau cas
  multi-sections) + pin du tie-break via la paire d'une mesure qui ne se
  replie pas. 🟢 : copy quota épuisé actionnable (« — il se réinitialise le
  1ᵉʳ du mois. Lecture, boucles et grille restent utilisables. »).
- **Checklist beta** : `docs/beta-checklist.md` — dépense Modal mesurée
  (**3,67 $** le mois courant, plafond dashboard suggéré ~25 $), SMTP
  custom à créer (choix utilisateur), PKCE-en-bundle et re-seed legacy
  listés.

## Not done / remaining

- **AI.2 complet** : form-encoder reste à **71,2 %** (92 survivants) — les
  restants sont des gardes de `movesAt`/tie-breaks qui ne flippent pas sous
  les moves réellement offerts, et des replis quasi-équivalents (le `''` de
  `running ?? ''` garde une clé unique par plage). Le ≥ 85 % visé demande
  une passe dédiée type 4b (grosse) — reporté, tracé au Suivi de la
  roadmap v6.
- **Piège outillage découvert** : `"incremental": true` de Stryker peut
  garder des `Survived` périmés malgré de nouveaux tests — le run **CI
  post-merge** (cache froid) fait foi ; localement, `stryker run --force`
  pour re-tester un fichier. À garder en tête en lisant les scores locaux.

## Decisions

- Un slash n'est jamais une évidence harmonique pour le matching de forme.
- La première dépense de quota est toujours un geste explicite.
- Sur le desktop, jamais un toast de succès sur un export qui n'a pas eu
  lieu — disabled+hint tant que le chemin natif n'est pas vérifié en
  bundle.

## Gate status

- `pnpm gate` : **vert** (exit 0) — **1930 tests** (+8).
- mutation (Stryker) : global **91,27 %** (break 90) ; form-encoder 71,2 %
  (voir remaining), section-matching 88,5 %, chart-structure 88,0 %.

## State to resume from

- **Single next action** : garde-fous beta côté utilisateur (plafond Modal
  dashboard + SMTP) — voir `docs/beta-checklist.md` ; côté code, la passe
  mutants form-encoder dédiée et le chemin natif d'export desktop
  (plugin-dialog) sont les deux gros restes v6.
- Gotchas : `stryker --force` pour invalider l'incrémental ; les hints
  desktop AH.1 sont keyés sur `isTauriShell()` (stub
  `window.__TAURI_INTERNALS__` en spec).
