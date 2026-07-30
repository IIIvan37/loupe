# Session — 2026-07-30 — ADR 0012 : le web déclare son graphe de modules (3 cycles cassés)

## Done

- **ADR 0012 rédigé et accepté**
  ([0012-graphe-de-modules-web.md](../adr/0012-graphe-de-modules-web.md),
  branche `refactor/web-module-graph`, PR #299) : le web adopte le mécanisme
  du core (ADR 0005) — placeholder Sheriff dormant
  `packages/web/src/app/<feature>` → tag `web:feature:<feature>`, une arête
  inter-features = une ligne explicite de `depRules`. Strates : main → shell →
  features/projects → audio-session → audio → auth → kit (ui/layout/lib/i18n).
- **Méthode red-green appliquée à l'architecture** : les tags + règles du
  graphe **cible** posés d'abord — `check:arch` rouge sur exactement les
  5 fichiers fautifs — puis les déplacements, jusqu'au vert.
- **Les 3 cycles de la revue (2026-07-29) cassés**, un arbitrage chacun :
  - `mixer↔tempo` → sens gardé `tempo → mixer` ; `METRONOME_ID` déménage de
    `tempo/metronome-stem.ts` vers `mixer/synthetic-stem.ts` (le mixer possède
    l'identité de ses lanes synthétiques).
  - `mixer↔waveform` → sens gardé `waveform → mixer` (lecture d'atome 0010) ;
    `WaveformCanvas` (+ css) déménage vers le kit `app/ui/`.
  - `audio↔auth` → sens gardé `audio → auth` ; `analysis-token.ts` (+ spec)
    déménage vers `auth/` (artefact de compte : minté par l'Edge Function,
    quota, mort au sign-out) ; `tauri-env.ts` descend dans `lib/`.
- Vérifié par extraction du graphe réel : **zéro cycle** ; en bonus les arêtes
  `projects → auth` et `desktop → auth` ont disparu (elles ne portaient que
  `tauri-env`).

## Not done / remaining

- Le player en référence stable (0011, régions de `ShellMain`) — inchangé,
  toujours le prochain gros morceau du chantier.
- L'interface étroite de session (DIP) reste une feuille à venir ; l'arête
  type-only `audio → audio-session` (le port `CountInPlayer`) est déclarée
  dans la config et l'ADR en attendant.
- `projects → tempo` (`DEFAULT_METRONOME_CHANNEL`) : arête étrange assumée et
  déclarée — candidate à disparaître si le défaut descend dans le core.

## Decisions

- Le pourquoi des trois directions d'arête et du mécanisme : une seule
  explication canonique, dans l'[ADR 0012](../adr/0012-graphe-de-modules-web.md)
  (rien à répéter ici).
- Module watch : aucun nouveau signal côté core (aucune source core touchée).

## Gate status

- typecheck : ✅ · biome/`check` : ✅ (1 info préexistant) · sheriff
  `check:arch` : ✅ (web désormais 25+ règles) · design : ✅ · react-doctor :
  ✅ · tokens : ✅ · knip : ✅ · jscpd : ✅ (5 clones préexistants, sous seuil)
- tests : ✅ suite complète avec coverage (`--maxWorkers=4`), 96,8 %
  statements / 92,3 % branches.
- mutation : **sans objet** — aucune source core touchée (déplacements web
  uniquement).

## State to resume from

- **Single next action** : la feuille « **player en référence stable** »
  (ADR 0011) — le player devient une référence stable pour que les régions de
  `ShellMain` lisent leurs hooks elles-mêmes ; c'est elle qui fera descendre
  les 21 props `ReturnType` restantes (`ShellMainProps`, `shell-stage`,
  `shell-analyser-row`, hooks de coordination).
- Gotchas :
  - Toute nouvelle arête inter-features web est désormais une **erreur de
    gate** : l'autoriser = une ligne de `depRules` dans `sheriff.config.ts`,
    à justifier en revue (ne pas « déboguer » la violation en déplaçant du
    code sans lire l'ADR 0012).
  - Un nouveau dossier `app/<feature>` est taggé automatiquement (placeholder
    dormant) et n'a droit qu'au kit tant qu'aucune règle ne lui ouvre d'arête.
  - Runs lourds : un seul à la fois, workers bridés (4–5) — les timeouts en
    rafale sont de la famine CPU, pas des régressions.
