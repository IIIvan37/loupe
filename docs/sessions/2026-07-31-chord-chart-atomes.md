# Session — 2026-07-31 — le chart devient atome de feature (ADR 0010, cliquet 2 → 0)

## Done

- **Dernière feuille Mikado ADR 0010, cliquet `ReturnType` à zéro** (branche
  `refactor/chord-chart-atoms-derive`, PR #322 ouverte) : le sac chord-chart
  était le dernier
  état de session en `useState` d'instance — lu par lead-sheet (panel), markers
  (relabel S.3b) et project-session (save/fingerprint/restore/reset), donc
  étage 2 de l'ADR. `chord-chart-atoms.ts` (dans la feature qui possède),
  `useChordChart` garde son interface `ChordChartState` mais toute instance
  dérivée voit le même chart — **spec rouge d'abord** (deux instances, un édit
  dans l'une visible dans l'autre).
- **`use-project-session` dérive `useChordChart()` lui-même** : ses deps
  `chordChart` + `restoreChordChart` tombent du shell ; il fournit le `restore`
  non-wrappé à `restoreSession` (les restores restent silencieux — pas de sync
  markers).
- **Cliquet `MAX_RETURN_TYPE_PROPS` 2 → 0 baissé AVANT le refactor** (rouge,
  puis vert) : les deux annotations restantes deviennent le contrat nommé
  `ChordChartState` (`use-chord-chart-session.chart`,
  `use-chart-with-structure.chordChart`). **L'état final de l'ADR est atteint.**
- **Isolation des specs** : le chart en atome impose un store Jotai frais par
  mount — `renderChart()` dans `use-chord-chart.spec.tsx` (renommé `.tsx`),
  wrapper `JotaiProvider` + `I18nTestingProvider` dans
  `chord-chart-panel.spec.tsx` (13 tests fuyaient sinon).

## Not done / remaining

- Le seam `mixer: Mixer` reste un prop partout (idiome `MetronomeDeps`,
  inchangé depuis #320) — c'est un seam voulu, pas un offender du cliquet.
- Le retour `chart: ChordChartState` de `use-chord-chart-session` reste un sac
  nommé que le shell rétrécit (`Pick<…>` dans `ShellMainProps`) — aller plus
  loin (ShellMain dérivant l'édition wrappée) déplacerait la sync markers,
  hors de cette feuille.

## Decisions

- **Le chart est de l'état de session en atomes** (réponse à la question
  ouverte du rapport précédent) : le critère de l'ADR 0010 étage 2 (une
  seconde feature lit l'état) était rempli trois fois. Le wrap
  `onSourceEdited` (édit utilisateur → sync structure markers) reste dans
  `use-chord-chart-session` — seuls `setSource`/`seatDraft` sont wrappés,
  `restore`/`reset`/`transpose` restent silencieux, comportement inchangé.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `391ff6f6`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (1156, +1 spec état-de-session partagé), couverture
  97,01 % statements / 92,64 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement),
  confirmé par `pnpm test:mutation:diff`.
- sonar : analyse de la PR en cours au moment du rapport — à relire avant
  merge (`pnpm sonar`).

## State to resume from

- **Single next action** : le chantier ReturnType est **soldé** (cliquet à 0,
  état final de l'ADR 0010) — reprendre les garde-fous beta restants
  ([beta-checklist.md](../beta-checklist.md)) ou la 1re release taguée
  ([distribution-plan.md](../distribution-plan.md)).
- Gotchas :
  - Tout spec qui monte `useChordChart` (directement ou via le panel) DOIT
    monter sous un `Provider` Jotai frais, sinon l'état fuit entre tests via
    le store par défaut.
  - Le cliquet à 0 interdit toute nouvelle prop `ReturnType<typeof useX>` —
    le contrat nommé de la feature (ou des valeurs) est la seule voie.
