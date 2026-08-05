# Session — 2026-08-04 — revue SOLID, lot LSP (contrat et fakes)

Deuxième lot de solde du backlog revue SOLID (rapport
`2026-08-04-revue-solid.md`) : les deux constats LSP — la substituabilité
promise par contrat mais plus prouvée, et un fake hors du domaine de valeurs.

## Done

- **Replay du contrat `ProjectStore` contre l'adaptateur réel** (constat
  n° 4, medium) : `http-project-store.spec.ts` rejoue `projectStoreContract`
  (exporté de `@app/core/testing`) contre `createHttpProjectStore` sur un
  stub fetch mini-serveur honorant le protocole wire (GET/PUT/DELETE
  `/projects…`, delete idempotent comme le store Rust) — la preuve de
  substituabilité de l'ADR 0002, perdue au pivot Tauri → HTTP, est de
  nouveau exécutable (8 cas ×2 implémentations).
- **L'obligation « delete d'un id inconnu = no-op » appartient à
  l'adaptateur** (TDD rouge → vert) : `delete` traite désormais un 404
  comme le no-op promis (miroir du `load`), au lieu de ne tenir que par
  l'idempotence accidentelle du serveur Rust — `ensureOk` ne jette plus
  sur un variant de serveur répondant 404.
- **Fakes de `shell-test-kit` convergés** (constat n° 5, low) : le store de
  manifestes est `createInMemoryProjectStore` (la référence validée par le
  contrat, enfin consommée dans web) ; le fake audio mint des refs
  content-addressées via le `sha256Hex` réel (« same bytes → same ref », le
  domaine de valeurs documenté) au lieu de `ref-${n++}` — la classe de bug
  PR #209 ne peut plus se rejouer ici.

## Not done / remaining

- Lot ISP (seams consommateurs du `Mixer`) puis lot 4 outillage
  (§ « Backlog outillage » du rapport revue-solid) — notamment le cliquet
  « contrat ×2 » qui empêchera ce replay de se reperdre en silence.

## Decisions

- Les obligations du port se prouvent **chez l'adaptateur**, pas chez le
  serveur : un comportement du serveur (delete idempotent) ne dispense pas
  l'adaptateur d'honorer lui-même le contrat sur les réponses voisines
  (404). Le stub de contrat encode le protocole wire, pas les cas d'un
  test unitaire.

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,41 % lines / 89,47 % branches
  (http-project-store : 24 cas dont 8 du contrat)
- mutation (Stryker) : **sans objet** — la branche ne touche aucun module
  core (web uniquement) ; le run complet post-merge de CI reste la référence
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `f6986b78`)
- SonarCloud (PR #368) : ✅ quality gate OK, 0 issue, 0 hotspot

## State to resume from

- **Single next action** : ouvrir la PR de ce lot, puis enchaîner le lot ISP
  (brancher depuis `main` à jour après squash-merge).
- Gotchas : `shell-test-kit` importe désormais `web:projects`
  (`sha256Hex`) — autorisé par le DAG Sheriff (`workstation-shell` voit
  `web:projects`) ; les refs des fakes shell sont des sha-256 hex, plus
  jamais `ref-0`.
