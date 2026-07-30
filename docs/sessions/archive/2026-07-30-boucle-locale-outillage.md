# Session — 2026-07-30 — outillage de la boucle locale (règles en prose → cliquets)

Étape d'outillage, née d'une question : le workflow gagnerait-il à des custom
agents ou des hooks ? Diagnostic : le setup est mûr (8 skills, gate à 9
détecteurs, husky, hook de branche), donc pas de liste de courses — seulement
les endroits où **une règle en prose n'était appliquée par rien**, ou où **la
boucle payait deux fois**.

## Done

- **`check:i18n` (nouveau cliquet du gate)** — `scripts/check-i18n.sh` :
  ré-extrait le catalogue Lingui et échoue sur un diff. CLAUDE.md demandait
  `i18n:extract` après un changement de copie ; rien ne le vérifiait, ni le
  gate ni la CI. **La dérive était réelle** : sur `main` propre, l'extraction
  modifiait déjà `messages.po`.
- **Churn de références neutralisée** — `format: formatter({ lineNumbers:
  false })` dans `packages/web/lingui.config.ts` (+ `@lingui/format-po` en
  devDep explicite, entrée knip). Sans ça le check serait rouge à chaque
  édition décalant une ligne : du bruit qui apprend à ignorer le check.
  Normalisation du catalogue en une fois (371/382 lignes, aucun message
  touché).
- **Workers vitest bornés en local** — `maxWorkers = cœurs / 3` hors CI
  (`vitest.config.ts`). Le rapport du 28/07 mesurait `pnpm gate` **rouge sur
  l'arbre propre** (charge ~50 sur 14 cœurs, specs shell en timeout sur
  contention). La CI, petite et déjà verte, garde le défaut.
- **Tampon de fraîcheur du gate** — `scripts/gate-stamp.sh`. `pnpm gate` estampe
  le hash git de l'arbre validé ; le pre-commit saute la rejoue si l'arbre
  hache toujours pareil. Le hash passe par un **index jetable**
  (`GIT_INDEX_FILE`), donc les hunks stagés de l'auteur ne sont jamais touchés.
- **`pnpm sonar`** — `scripts/sonar-issues.ts` : lit les résultats SonarCloud
  déjà calculés par la CI (quality gate + issues + hotspots) pour la PR
  courante, sinon `main`. Projet public → **API anonyme, aucun token**, aucun
  scanner local.
- **Triage Sonar réparé + `check:sonar`** — premier usage de `pnpm sonar` :
  **2 des 15 issues « ouvertes » étaient des faux positifs déjà tranchés**
  (fp12, fp13) dont l'exemption avait cessé de s'appliquer quand l'extraction
  des modules a déplacé `project.ts` et `instrument-detection.ts` hors du
  `domain/` plat. Chemins repointés, et `scripts/check-sonar-triage.sh` ajouté
  au gate : toute entrée de triage doit encore désigner un fichier existant.
- **Hook anti-chevauchement** — `.claude/hooks/block-overlapping-heavy-runs.sh`
  (PreToolUse Bash) : refuse Stryker pendant une suite, et le gate pendant
  Stryker. La règle existait en prose dans CLAUDE.md.
- **Permissions `.claude/settings.json`** : `pnpm sonar`, `modules:hint`,
  `i18n:extract`, `git add` (lecture seule ou trivialement réversible ;
  `gh pr create` reste volontairement en confirmation).
- **Pre-commit passe au même regex que `gate`** : sa liste écrite à la main
  avait déjà perdu `check:tokens`. Le parallélisme vient avec, mais ne vaut que
  ~7 s (voir Decisions).

## Not done / remaining

- **MCP SonarQube écarté pour l'instant** (voir Decisions).
- **Pas de parallélisation du pre-commit** (voir Decisions).
- **13 issues Sonar : dette assumée, à reprendre après le chantier ADR graphe
  de modules.** Décision explicite de ne pas les mêler à une PR d'outillage.
  Le quality gate Sonar (code neuf) est **OK** : ce sont des constats sur
  l'existant, pas une régression. Inventaire, pour reprise sans réanalyse :
  - *Mécaniques (9)* — `S8980` `act()` redondant ×5
    (`use-separation.spec.tsx` 58/87/114/326, `use-chord-detection.spec.ts`
    566) · `S5906` préférer `toHaveLength` ×2 (`spectrum.spec.ts` 32/93) ·
    `S6582` optional chain (`use-chord-detection.ts` 301) · `S7786`
    `TypeError` plutôt que `Error` (`http-project-store.ts` 32).
  - *Python (2)* — `S8997` utiliser la fixture `monkeypatch` au lieu de muter
    l'état global (`server/tests/test_limits.py` 125/129).
  - *À juger (2)* — `S6825` `aria-hidden="true"` sur un élément focusable
    (`waveform-canvas.tsx` 52) : **vrai défaut a11y**, un focusable masqué aux
    lecteurs d'écran est un piège au clavier ; à instruire, pas à taire.
    `S3776` complexité cognitive 16 > 15 (`use-chord-detection.ts` 172), seule
    CRITICAL — refactor de logique, mérite sa propre PR.
  - Rappel : si l'un s'avère être un faux positif, il se tranche dans
    `sonar-project.properties` (et `check:sonar` le maintiendra vivant).
- Aucun custom agent posé. Le seul candidat retenu comme utile — un
  `hexa-reviewer` lisant le diff de branche contre les invariants (outside-in,
  port réutilisé, conformité ADR) — attend un besoin constaté.

## Decisions

- **Ce qui manquait n'était pas un agent, c'était un cliquet.** Le risque
  dominant du repo est la dérive silencieuse d'une règle écrite (le catalogue
  Lingui) et le coût de la boucle, pas la capacité d'analyse. Un hook qui
  échoue bat un agent qui rappelle.
- **Paralléliser le pre-commit ne gagne presque rien — mesuré.** Sur un même
  arbre à chaud : `test:coverage` seule **99 s**, l'ensemble en parallèle
  **106 s**, le même ensemble à la suite **~108 s** (9 checks statiques ≈ 14 s,
  chemin critique `check:react` 5,8 s). La coverage domine, tout se cache
  derrière : **~7 s de gain**. Une lecture intermédiaire à 62 s avait fait
  croire à un facteur 2 — artefact de caches chauds, invalidé par trois mesures
  consécutives. Le pre-commit adopte quand même le regex de `gate`, pour la
  **non-dérive** (sa liste manuelle avait déjà perdu `check:tokens`), pas pour
  la vitesse. **Ce qui supprime réellement le coût, c'est le tampon** : second
  commit sur le même arbre mesuré à **1,4 s** contre ~2 min.
- **MCP SonarQube non adopté.** Il apporte une vraie capacité que le script
  n'aura jamais (`analyze_code_snippet` / `run_advanced_code_analysis` :
  analyser avant le push, sans attendre les ~5 min de CI). Mais il exige Docker
  ou un JAR + **JDK 21+** et un token sur une machine qui n'a besoin ni de Java
  ni de Docker ; il ne sert que l'agent (ni `gate`, ni CI, ni contributeur
  humain) ; et surtout `change_sonar_issue_status` classe les faux positifs
  **côté serveur**, alors que ce repo a délibérément choisi le tri
  config-as-code dans `sonar-project.properties` (14 entrées commentées) pour
  que le raisonnement voyage avec la PR. À reconsidérer si le décalage CI mord
  vraiment, et alors en lecture seule.
- **Le hook de chevauchement vise l'exécutable, pas le mot.** Premier jet en
  `pgrep -f 'stryker'` : faux positif immédiat sur une commande qui *mentionne*
  stryker (un message de commit suffirait à verrouiller le repo hors de sa
  propre suite). Motifs ancrés sur un séparateur (`/[s]tryker`, `/[v]itest`),
  vérifiés contre un vrai run (`node …/vitest/vitest.mjs run`).
- **Garde délibérément étroite** : seul le chevauchement mutation ↔ suite est
  refusé. Un `test:watch` de longue durée est inactif entre deux éditions ; une
  garde qui se déclenche sur le montage normal finit désactivée.
- **`check:i18n` laisse le catalogue ré-extrait en place** au lieu de le
  restaurer : l'extraction a déjà fait le travail, le correctif est de relire
  et stager, pas de relancer une commande.
- **Node derrière un proxy** : `fetch` ignore `https_proxy` (ECONNRESET qui
  ressemble à une API en panne). Le script se ré-exécute une fois avec
  `NODE_USE_ENV_PROXY=1` plutôt que d'imposer une incantation d'environnement
  qui ne survit pas aux shells Windows.

## Gate status

- typecheck : ✅ · biome `check` : ✅ · `check:arch` : ✅ · `check:design` : ✅ ·
  `check:react` : ✅ · `check:tokens` : ✅ · **`check:i18n` : ✅ (nouveau)** ·
  knip : ✅ · jscpd : ✅
- tests (avec coverage) : ✅ — `test:coverage` mesuré à 94 s, vert, workers
  bornés.
- mutation (Stryker, local) : **sans objet** — aucune source `@app/core`
  touchée (outillage, configs, `scripts/`, `.claude/`).
- `check:sonar` : ✅ (nouveau) — a immédiatement rattrapé 2 exemptions
  orphelines.
- Sonar : quality gate **OK**, 15 issues ouvertes dont **2 réparées ici**
  (triage repointé) ; les 13 autres en dette assumée, cf. « Not done ».
  0 hotspot à revoir.

## State to resume from

- **Single next action** : reprendre le chantier prévu — **ADR graphe de
  modules web + tags Sheriff** (3 cycles à casser : mixer↔tempo,
  mixer↔waveform, audio↔auth). Cette étape était une parenthèse d'outillage.
  **Puis** la session de tri des 13 issues Sonar inventoriées ci-dessus.
- Gotchas :
  - Le premier `pnpm gate` après cette PR **ré-écrit `messages.po`** chez qui
    n'a pas encore la normalisation : c'est attendu, une seule fois.
  - Le tampon vit dans `.git/loupe-gate-ok` (hors arbre, donc non partagé) ;
    un clone frais paie le gate au premier commit, normalement.
  - `pnpm sonar` sur une branche sans PR retombe sur `main` : ce n'est pas un
    rapport sur ton travail. Attendre ~5 min après le push que la CI publie.
