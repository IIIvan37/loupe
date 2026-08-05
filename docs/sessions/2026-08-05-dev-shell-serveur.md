# Session — 2026-08-05 — dev local du shell serveur

Signal utilisateur : « on n'est pas capable d'avoir une version locale de dev
pour loupe ». Exact pour le produit complet : `pnpm dev` ne servait que le
shell navigateur (pas de projets, pas d'import URL), et le shell serveur —
celui des testeurs — résout son backend par `window.location.origin`, donc ne
fonctionnait que servi PAR le binaire (UI embarquée figée, `vite build` par
itération, zéro HMR).

## Done

- **Proxy vite conditionnel** (`packages/web/vite.config.ts`) : quand
  `VITE_SHELL=server`, les routes du binaire (`/projects`, `/audio`,
  `/download`, `/heartbeat`, `/health`, `/version`, `/gc`) sont proxifiées
  vers `http://127.0.0.1:6173` — l'origine reste la page vite, le backend
  répond derrière (spread conditionnel : `exactOptionalPropertyTypes`
  refuse un `proxy: undefined`).
- **Scripts racine** : `dev:server` (`cargo run -p loupe-server --
  --no-browser --no-auto-exit` — le `--no-auto-exit` neutralise le watchdog
  pendant l'itération), `dev:web:server` (vite en `VITE_SHELL=server`),
  `dev:full` (`pnpm -w run --parallel` sur les deux — la forme `-w` est
  nécessaire : sans elle, `--parallel` bascule pnpm en mode récursif
  workspace et ne trouve pas les scripts racine).
- **Vérifié bout en bout** : `pnpm dev:full` lancé, puis à travers l'origine
  5173 — `/health` OK, `/version` → 0.2.2, `/projects` → un vrai projet du
  store local, heartbeat → 204, page vite servie. L'expérience testeur
  complète itère désormais en HMR.
- `CLAUDE.md` : la ligne « Run the app » documente les deux modes.

## Not done / remaining

- `dev:analysis` reste le harnais Python legacy (venv fragile) — les
  analyses en dev passent par `VITE_ANALYSIS_URL` (Modal) ou ce harnais ;
  hors périmètre ici.
- Verdict Sonar de cette PR : à lire après le CI.

## Decisions

- Le mode dev n'introduit AUCUNE logique nouvelle côté web : le shell
  serveur continue de parler à `window.location.origin`, c'est vite qui
  déplace l'origine — zéro divergence dev/prod dans le code applicatif.

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,41 % lines
- mutation (Stryker) : **sans objet** — ni module core ni hook web touché
  (config vite, scripts, docs)
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `d663375e`)
- SonarCloud : en attente du CI de la PR

## State to resume from

- **Single next action** : après le merge, plus rien d'ouvert sur ce front —
  reprendre les Restes du STATUS (affordance throttle redeem,
  découvrabilité du click, session outillage).
- Gotchas : lancer `dev:full` exige un cargo buildable ; le serveur écoute
  en 6173 par défaut (changer le port = changer aussi le proxy).
