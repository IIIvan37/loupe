# Session — 2026-07-29 — clé de voûte ADR 0011 : AudioSessionProvider (ports seuls)

## Done

- **La clé de voûte de l'[ADR 0011](../adr/0011-shell-layout-contexte-session-audio.md)**
  (branche `feat/audio-session-provider`), découpage « ports seuls » choisi par
  Ivan : `app/audio-session/audio-session.tsx` — le bag `AudioSession`
  (11 ports, références stables posées au montage), `AudioSessionProvider`,
  `useAudioSession()`. Défaut `{}` : la prod n'a besoin d'aucun Provider, les
  adaptateurs réels restent créés au point de consommation, comme avant.
- **7 hooks consommateurs migrés** en `arg ?? session.x ?? défaut réel` :
  `useStemStack`, `usePlayer`, `useTempo`, `useCountIn`,
  `useChartWithStructure`, `useProjectSession`, `useImportFromUrl`.
  L'argument direct (tests unitaires) garde priorité ; le contexte injecte à
  l'échelle de l'appli ; le défaut réel ne bouge pas.
- **`WorkstationShellProps` fond de 12 champs à 1** (`desktop`) — le shell ne
  touche plus aux ports. Il passe encore `stemPlayback` (le singleton partagé
  stack↔player) positionnellement à `usePlayer` : c'est le versant « player »
  de 0011, feuille suivante.
- **`CountInPlayer` déplacé** de `tempo/use-count-in` vers `audio-session`
  (sinon cycle `tempo ↔ audio-session` — la revue du 2026-07-29 en pointe déjà
  trois, on n'en crée pas un quatrième).
- **Test-kit** : `renderShell` monte `<AudioSessionProvider value={fakes}>` —
  le point d'injection uniforme de l'ADR. L'API des specs est inchangée
  (`renderShell({ tempoDetector: … })`), les ~13 specs shell passent telles
  quelles.

## Not done / remaining

- **Aucun cliquet ne descend** : feuille d'infrastructure, exemptée du contrat
  (aucun des trois cliquets ne compte les props de ports). Documenté ici ; le
  harvest vient aux feuilles suivantes.
- Le player reste threadé (`ShellFooter` reçoit `player` + `countIn` en
  `ReturnType`) — sa mise en référence stable est la prochaine feuille 0011
  (2 cliquets à récolter).
- La création des adaptateurs réels reste au point de consommation (le
  Provider n'injecte que les fakes) — hisser la création au sommet est une
  feuille ultérieure, si un besoin la tire.

## Decisions

- **Les hooks lisent le contexte, pas le shell** : le shell est tight à 25 sur
  `MAX_HOOKS_PER_COMPONENT` — un `useAudioSession()` dans le shell aurait
  fait déborder le cliquet. La lecture dans chaque hook consommateur est aussi
  plus proche du terminus 0011 (une région appellera son hook sans que le
  shell fournisse quoi que ce soit).
- **Trois sources, priorité fixe** : `arg (test unitaire) ?? session (appli)
  ?? défaut réel`. L'arg direct est conservé comme seam des specs de hooks —
  les supprimer aurait réécrit des dizaines de specs sans gain.

## Gate status

- typecheck : ✅ · biome/`check` : ✅ (1 info préexistant) · sheriff : ✅ ·
  design : ✅ · react-doctor : ✅ · knip : ✅ · jscpd : ✅ (via hook pre-commit)
- tests : ✅ **2408/2408** (`npx vitest run --coverage --maxWorkers=5`),
  dont `audio-session.spec.tsx` (2, rouge d'abord).
- mutation : **sans objet** — aucune source core touchée
  (`test:mutation:diff` le confirme).

## State to resume from

- **Single next action** : feuille 0011 suivante — le **player en référence
  stable** atteignable via le contexte, pour que `ShellFooter` se serve seul
  et lâche ses props `player` + `countIn` (cliquet `ReturnType` 23 → 21).
  Attention au cas limite de l'ADR : les valeurs frame-rate restent des
  `ExternalValue`, seule la référence entre au contexte.
- Gotchas :
  - Le contexte ne porte **que** des références stables (garde-fou 0011) —
    tout champ réactif est un atome de feature.
  - `renderShell` sépare `desktop` (prop) des ports (session) ; un override
    de port va dans le même objet, l'API n'a pas changé.
  - Le shell passe toujours `stemPlayback` à `usePlayer` (4e arg) : singleton
    partagé — ne pas le laisser se créer deux fois.
