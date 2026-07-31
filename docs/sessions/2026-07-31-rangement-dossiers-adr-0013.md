# Session — 2026-07-31 — un dossier se lit d'un coup d'œil (ADR 0013, cliquet folder-shape)

## Done

- **[ADR 0013](../adr/0013-un-dossier-se-lit-d-un-coup-d-oeil.md)** (branche
  `refactor/dossiers-par-role`, PR #323 ouverte) : quatre règles — sous-dossiers
  par **rôle local** (jamais par type technique global), **dossier-composant**
  quand un composant a des compagnons (spec + css), specs colocalisées/CSS
  **gratuits**, `composes` inter-dossiers via **l'alias racine `@/`**.
- **Cliquet `folder-shape.spec.ts`** : borne les sources directes (`.ts`/`.tsx`
  hors specs/`.d.ts`) par dossier de `packages/web/src` — démarré à **16** (le
  présent mesuré post-rangement), baissé AVANT le rangement (rouge → vert),
  même mécanique que les cliquets ADR 0010.
- **Rangement des deux offenders (31 sources chacun)** :
  `workstation-shell/{regions,orchestration,lifecycle}` (les trois seaux de
  l'ADR 0011 matérialisés ; racine = `workstation-shell.tsx` + test-kit + les
  14 suites d'acceptance) et `audio/{http,playback,encode,tauri}` (racine =
  factories `create-*` + métadonnées). `regions/empty-state/` inaugure le
  dossier-composant.
- **Codemod sur move-map** (scratchpad) : 51 fichiers réécrits — résolution de
  chaque spécificateur relatif contre l'emplacement PRÉ-move, mappage, puis
  re-relativisation post-move. Typecheck vert du premier coup.
- **Alias `@/` (vite.config.ts) + réécriture des 75 `composes`
  inter-dossiers** — déclenché par une casse réelle : le codemod ne couvrait
  pas les `.module.css`, le dev server a cassé sur
  `empty-state.module.css` (`composes … from '../ui/…'` à profondeur changée).
- Périphérie : 2 exemptions Sonar re-chemisées (`use-unload-guard`,
  `use-drop-import`), catalogue Lingui re-extrait (35 références),
  `distribution-plan.md` re-lié (`audio/http/http-track-source.ts`).

## Not done / remaining

- `ui` (16 sources) et `lead-sheet` (16) sont AU cliquet : chaque rangement
  futur (dossier-composant pour le kit `ui`, notamment) baisse la borne d'un
  cran dans la même PR.
- Le core n'est pas couvert par le cliquet (gouverné par ADR 0005 /
  `modules:hint`).

## Decisions

- **CSS aliasé, TS relatif** — assumé dans l'ADR : un import TS cassé tombe au
  typecheck, un `composes` cassé ne tombe qu'au `vite build` (angle mort du
  gate) ; l'alias retire la dépendance à la profondeur là où l'outillage est
  le plus faible.
- Le rangement est progressif : le cliquet force la suite, pas cette PR.

## Gate status

- `pnpm gate` ✅ complet (replay au commit amendé) : typecheck ✅ · biome ✅ ·
  sheriff ✅ (les sous-dossiers restent dans le module de leur feature) ·
  design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (1157, +1 cliquet folder-shape).
- `pnpm --filter @app/web build` ✅ — la seule vérification qui voit les
  `composes` (faite deux fois : après la casse, après l'alias).
- mutation : **sans objet** — aucune source core touchée, confirmé par
  `pnpm test:mutation:diff`.
- sonar : analyse PR #323 en cours au moment du rapport — à relire avant
  merge (`pnpm sonar`).

## State to resume from

- **Single next action** : inchangée depuis le rapport précédent — garde-fous
  beta ([beta-checklist.md](../beta-checklist.md)) ou 1re release taguée
  ([distribution-plan.md](../distribution-plan.md)). En feuilles de fond :
  descendre le cliquet folder-shape (ranger `ui` puis `lead-sheet`).
- Gotchas :
  - **Après tout déplacement de `.module.css`** : `pnpm --filter @app/web
    build` — le gate ne voit pas un `composes` cassé.
  - Un `composes` inter-dossiers s'écrit `from '@/app/…'` ; seul
    l'intra-dossier reste relatif.
  - Le codemod move-map vit dans le scratchpad de session — le recréer au
    besoin (résoudre pré-move, mapper, re-relativiser post-move).
