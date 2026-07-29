# Session — 2026-07-29 — abort au démontage de useSeparation (revue, correctif 2)

## Done

- **Correctif 2 de la revue d'architecture** (branche
  `fix/separation-abort-on-unmount`, PR #294) : `useSeparation` aborte son
  `AbortController` en vol au démontage — un shell fermé en pleine séparation
  laissait le transfert (42 MB) et le calcul serveur tourner sans consommateur.
  Même cleanup d'effet que `useTempo` (le modèle que la revue pointait) ;
  `cancel()`/`reset()` couvraient déjà les autres chemins.
- Test d'unmount ajouté (rouge d'abord) dans `use-separation.spec.tsx` : le
  signal du port doit être `aborted` après `unmount()`.

## Not done / remaining

- Rien sur ce périmètre. Les correctifs courts de la revue (1 : mint
  single-flight, PR #293 ; 2 : celui-ci) sont soldés — retour au séquencement :
  clé de voûte [ADR 0011](../adr/0011-shell-layout-contexte-session-audio.md).

## Decisions

- Aucune nouvelle — application du modèle de cleanup existant (`use-tempo.ts`).

## Gate status

- typecheck : ✅ · biome/`check` : ✅ · sheriff : ✅ · design : ✅ ·
  react-doctor : ✅ · knip : ✅ · jscpd : ✅ · tests : ✅ suite complète avec
  coverage via le hook pre-commit (`use-separation.spec.tsx` 24/24 dont le
  nouveau test d'unmount).
- mutation : **sans objet** — aucune source core touchée.

## State to resume from

- **Single next action** : la clé de voûte de l'ADR 0011 —
  `AudioSessionProvider` (moteur + ports en contexte de session, références
  stables uniquement). Question de découpage ouverte (posée à Ivan, restée
  sans réponse) : ports seuls sans cliquet, ports + player en référence
  (2 cliquets), ou player d'abord puis Provider.
- Gotchas : le contexte ne doit porter que des références stables (garde-fou
  0011, revue seule) ; les ~13 specs shell changeront de forme de montage.
