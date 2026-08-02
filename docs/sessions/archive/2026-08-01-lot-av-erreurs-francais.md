# Session — 2026-08-01 — lot AV : les erreurs parlent français

## Done
- **AV.1 — l'import URL ne parle plus anglais.** La ligne NDJSON `error` porte
  désormais un `code` (`unsupported` | `timeout` | `extractor-stale` |
  `store-quota` | `unknown`) : `DownloadError { code, message }` typé dans
  `loupe-download` (plus de `Result<_, String>`), classification aux points
  d'émission (unsupported/timeout/extractor-stale côté moteur, timeout
  wall-clock + store-quota côté `download.rs`), + test serveur
  `download_reports_a_full_audio_store_as_the_store_quota_code`. Côté client :
  `ImportUrlErrorCode` + `ImportUrlError` dans le core
  (`import-from-url.ts`, Result en `{ code, detail }`), `streamNdjson` accepte
  un mapper d'erreur (la séparation inchangée), `http-track-source` relève les
  codes connus, `use-import-from-url` expose le code + `console.error` du
  détail brut, table `IMPORT_URL_ERROR_COPY` (`app/header/import-url-copy.ts`)
  rendue par le banner du ShellHeader.
- **AV.2 — projets/export alignés sur le standard des détections.**
  `ProjectErrorCode` (8 codes) + classe `ProjectError` dans
  `core/project/application/ports.ts` ; les 5 Results de `projects.ts` passent
  de `error: string` à `{ code, detail }` (mixer-mismatch, not-found,
  empty-name, missing-audio nommés ; repli `unknown`) ; `http-project-store`
  jette `ProjectError('network' | 'server' | 'unreadable')` (helper `fetched`
  + `ensureOk`), `manifest-decode` aussi ; `use-projects` compose « préfixe
  français : raison mappée » via `PROJECT_ERROR_COPY`
  (`projects/project-error-copy.ts`) et logge `code + detail` en console.
  L'export stems : copy fixe « L'export a échoué — réessayer. » + détail
  console (pas de codes — causes locales non actionnables).
- **AV.3 — hors-ligne, l'import URL est gaté.** `useImportFromUrl` possède le
  gate (`offline: !useOnline()` dans le `UrlImport` retourné) ;
  `UrlImportField` reçoit `offline` → champ + submit désactivés + hint
  `aria-describedby` (`import.url-offline`), même grammaire que les analyses ;
  propagé aux deux surfaces (popover header via le bundle `urlImport` du
  Header, hero de l'état vide) ; le paste-anywhere du hero est aussi gaté ;
  l'import fichier intact. `use-online.ts` déplacé de
  `workstation-shell/lifecycle/` vers `app/ui/` (consommé par header + région
  analyser) pour respecter le sens du DAG.
- **Cliquets ADR 0010 tenus sans dérogation** : le gate a refusé la première
  version (HeaderProps 21 > 20, WorkstationShell 26 hooks > 25) → les trois
  props URL du Header regroupées en un objet `urlImport` (19 champs) et le
  gate offline logé dans `useImportFromUrl` (aucun hook de plus dans le
  shell).

## Not done / remaining
- Le `code` NDJSON n'est émis que par le binaire Rust **local** — pas de
  changement Modal/Edge (l'import URL est local-only, rien à déployer).
- Testeurs sur un vieux binaire : leur serveur n'émet pas de `code` → repli
  `unknown` (copy française générique), dégradation propre voulue.
- Micro-mutant survivant assumé : `this.name = 'ProjectError'` dans
  `ports.ts` (mutant statique de string, sans valeur de test — même profil
  que les autres classes d'erreur).

## Decisions
- La **ligne NDJSON porte le contrat UI** (le `code`), le `message` anglais
  reste du matériau console — même standard que `SeparationFailure` (Lot G),
  étendu à l'import URL et aux projets. Pas d'ADR : extension d'un standard
  existant, pas de nouvelle frontière.
- Codes projet partagés par les 5 opérations (une union, une table de copy),
  composition « préfixe d'opération : raison » plutôt qu'une phrase par
  (opération × code) — 8 entrées au lieu de 40.
- Export stems : **pas** de codes discriminés (zip local, causes non
  actionnables) — copy fixe + console. Résultat négatif documenté ici.

## Gate status
- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ 174 fichiers / 2444 tests — gate stampé
  (41e61f18)
- mutation (Stryker, local, diff) : ✅ **94,92 %** (seuil 90) — survivant
  notable unique : mutant statique `name` de `ProjectError` (assumé)
- biome / sheriff / knip / jscpd / tokens / i18n / react / shell / sonar-triage : ✅
- cargo fmt + clippy `-D warnings` + tests workspace : ✅ (23 tests
  loupe-server dont le nouveau store-quota)
- SonarCloud : à lire une fois l'analyse CI de la PR #338 posée
  (`pnpm sonar 338`) — pas encore disponible au moment du rapport.

## State to resume from
- **Single next action** : merger la PR #338 (lot AV) une fois CI vert, puis
  attaquer le **lot AW** (blindage de la nouvelle surface : en-têtes
  CSP/nosniff/cache sur la SPA du binaire, permissions 0700/0600 du store
  local, templates OTP versionnés).
- Gotchas : la spec `use-import-from-url` stubbe `navigator.onLine` par
  `vi.spyOn(..., 'get')` (idiome de `use-online.spec`) ; le Header expose
  désormais `urlImport` (objet) — tout nouveau consommateur passe par le
  bundle, pas par des props éclatées.
