# Session — 2026-07-11 — wav-encode-memo (L.4)

## Done
- **L.4 — mémoïsation du WAV encodé** (roadmap-excellence-3) :
  `encodeWavMemo` ([encode-wav-memo.ts](../../packages/web/src/audio/encode-wav-memo.ts)),
  un `WeakMap<DecodedAudio, Uint8Array>` au niveau module — le mix chargé est
  encodé **une seule fois** au lieu de jusqu'à trois (~100–300 ms main-thread
  et ~40 MB d'allocation par appel évités sur les 2ᵉ/3ᵉ appels).
- Branché sur les trois uploads serveur : `postWavForJson` (`/tempo`,
  `/chords`) et `createHttpSeparator` (`/separate`).
- **/code-review (8 angles + vérification)** → 2 constats corrigés :
  - `use-stem-export.ts` : le téléchargement « piste » ré-encodait le même mix
    en direct (`encodeWav`) → bascule sur `encodeWavMemo` (évite un pic
    ~84 MB : buffer frais + buffer caché coexistants).
  - reflow d'un commentaire trop long dans `post-wav-json.ts`.
- Le trace inter-fichiers a **confirmé l'efficacité du memo** : le
  `DecodedAudio` du mix garde une identité unique de `usePlayer` jusqu'aux
  trois adaptateurs ; rien ne mute `channels` après décodage ; `fetch` ne
  détache pas le buffer partagé.

## Not done / remaining
- Les encodages **par stem** (`use-separation.downloadStem`,
  `project-session.mixedStems`, click-track de `use-stem-export`) restent en
  `encodeWav` direct — **volontaire** : les mettre en cache épinglerait le WAV
  de chaque stem tant que son PCM vit.
- L'encodage reste sur le main thread (1ᵉʳ appel) — L.4 ne visait que les
  ré-encodages redondants ; un éventuel offload worker serait un lot séparé.

## Decisions
- **Trade-off accepté** : le WAV du mix (~40 MB) reste résident tant que le
  `DecodedAudio` du mix vit (état `usePlayer`, libéré au prochain import) —
  même si un seul appel serveur a eu lieu. C'est le design WeakMap de la
  roadmap ; prix borné à un buffer par mix chargé.
- Cache **réservé au mix** : la doc du module l'écrit noir sur blanc pour que
  personne ne l'applique aux blobs par-stem.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 969 tests (87 fichiers), +3 specs
  `encode-wav-memo.spec.ts` ; couverture core au-dessus des seuils
- mutation (Stryker, local, if core touched): **skippée — aucun fichier
  `@app/core` touché** (lot 100 % `packages/web`), score inchangé vs L.3
  (94,91 %)
- biome / sheriff / knip / jscpd: ✅ (gate complète verte via le hook
  pre-commit, jscpd 6 clones préexistants sous budget)

## State to resume from
- **Single next action**: merger la PR L.4, puis attaquer le **Lot M** (M.1
  garde Origin CSRF sur les POST serveur — voir roadmap-excellence-3).
- Gotchas / half-done edits: aucun ; `doctor.config.json` et un PDF traînent
  non suivis à la racine (hors périmètre, ne pas committer).
