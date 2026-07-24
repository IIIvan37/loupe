# Session — 2026-07-18 — stem-ids-french-fix

Browser-verify réel du flux stems→accords→slash chords (l'item pré-beta des
rapports 4a/4b) — qui a trouvé un bug bloquant les DEUX features, fixé en TDD
et mergé (**PR #209**).

## Done

- **Browser-verify du flux implicite complet sur Modal réel** (compte beta,
  serveur local allumé mais analyse offloadée) : import → tempo auto (mint
  unique) → « Détecter les accords » → séparation implicite (~70 s, 6 stems) →
  grille pré-remplie. Fait sur *The Logical Song* puis *Somebody To Love*.
  Astuce d'accès : session Supabase installée sans boîte mail via
  `POST /auth/v1/admin/generate_link` (service_role par
  `supabase projects api-keys`) → ouvrir l'`action_link` dans le navigateur.
- **Bug trouvé — zéro slash sur 116 + 85 mesures** : le manifest serveur mappe
  les stems Demucs vers des ids **français** (`bass`→`basse`,
  `drums`→`batterie`, stem_manifest.py) ; le hook cherchait `'bass'`/`'drums'`.
  Conséquence : 4a (mix sans batterie) **et** 4b (slash chords) no-opaient
  silencieusement sur toute vraie séparation — les specs étaient vertes contre
  des fakes aux ids anglais. Diagnostic en trois temps : rejeu offline de
  `bassNotePerMeasure` sur le stem réel + grille du projet sauvegardé
  (≥ 3 slashes attendus), instrumentation temporaire du hook
  (`bassStem false`), lecture de stem_manifest.py.
- **Fix TDD (PR #209, mergée)** : specs du hook passées aux ids réels français
  (rouges), nouveau cas bout-en-bout « stem `basse` en mi grave sous un C
  détecté → brouillon `C/E` », `stem-ids.ts` (`DRUMS_STEM_ID`/`BASS_STEM_ID`
  épinglés sur stem_manifest.py).
- **Re-verify navigateur après fix** : la même détection imprime `Fm/Ab` sur
  *Somebody To Love* (1 slash — l'impression conservative par design : le
  doute n'imprime rien).

## Not done / remaining

- Les slashes restent rares (dominance ×2 + veto multi-accords) — à réévaluer
  à l'usage si l'utilisateur en veut davantage (assouplir DOMINANCE ou slasher
  la 1re moitié des mesures deux-accords, v2).
- Suite du plan de la session : revue excellence multi-agents (dont le point
  utilisateur « headers et footers trop gros par rapport au reste »), fixes de
  revue, puis garde-fous beta (plafond de dépense Modal, SMTP custom).

## Decisions

- Les ids de stems côté analyse vivent dans `app/stems/stem-ids.ts`, source de
  vérité = le manifest serveur (français). Tout fake de spec qui alimente ce
  chemin DOIT porter ces ids-là.
- Leçon de test durable : un fake dont l'identifiant ne vient pas du contrat
  réel (ici le manifest) peut rendre verte une feature qui ne s'exécute
  jamais — préférer les ids/valeurs du contrat dans les fakes.

## Gate status

- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor :
  verts (`pnpm gate` exit 0).
- tests (with coverage) : vert — **1913 tests** (+3).
- mutation (Stryker) : **skippé — zéro ligne de `@app/core` touchée** (adapter
  web + specs seulement).

## State to resume from

- **Single next action** : lancer la revue excellence multi-agents (nouvelle
  évaluation notée, roadmap v6) — inclure l'irritant utilisateur « headers et
  footers pas esthétiques (gros par rapport au reste du design) ».
- Gotchas : un magic link admin frais invalide le précédent ; le projet de
  test « Queen - Somebody To Love (Official Video) » sauvegardé pendant le
  diagnostic reste dans les projets locaux (supprimable) ; `03_Basse.wav`
  téléchargé dans ~/Downloads pendant le diagnostic.
