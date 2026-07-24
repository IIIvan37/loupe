# Session — 2026-07-18 — AI.2 (solde) : passe mutants dédiée form-encoder

## Done

- **`form-encoder.ts` : 71,2 % → 89,34 %** de score de mutation (48 mutants
  tués, plus aucun NoCoverage), **global core 92,75 %** (était 91,27). Le
  reliquat AI.2 tracé au Suivi de la roadmap v6 est soldé — objectif ≥ 85 %
  atteint. Tests only : **aucune ligne de `form-encoder.ts` touchée**.
- Méthode : run Stryker **`--force`** scopé (l'incrémental ment — piège
  consigné en AF-AI), classement des 92 survivants par famille, puis chaque
  scénario **sondé d'abord** (spec jetable → sortie réelle de l'encodeur
  vérifiée à l'œil, musicalement) avant d'être promu en test — la spec passe
  de 16 à 31 tests (2 `toContain` D.C. promus en pins exacts + 13 nouveaux),
  tous des pins exacts ou des oracles `playedLabels`.
- Familles couvertes par les nouveaux tests :
  - **Rollout × mètres** : changement de mètre revenant (barre courte isolée
    `{time: 2/4}`) qui suit le rollout, `meters[0]` inconnu qui entre au
    mètre courant, mètre non-revenant qui refuse le rollout.
  - **Volta × mètres** : mètres steady (et trous `undefined`) qui gardent la
    volta ; changement in-block qui la refuse → fold du couple propre + passe
    variante imprimée fidèlement ; **le fold vote sur SES passes seulement**
    (pas sur le vote du type entier — 2 G7 vs 3 E7).
  - **D.C.** : rendu exact tête-queue (`{fine}` sur le préfixe rejoué,
    headers, `{d.c.}` final), **rejeu entier sans `{fine}`** (ABAB),
    alignement par paires (ABCABC — un parcours inversé accepterait le
    mauvais), `x4` préféré au D.C. sur les copies traînantes, la passe
    médiane bruitée d'un D.C. imprime **le vote du type** (pas son bruit).
  - **Rendu du plan** : l'égalité de coût volta/écriture garde l'écriture
    plate (tie-break navigation), lead `{time:}` au-dessus du header de
    section, pas de lead fantôme sans mètre courant, restatement `{time:}`
    entre copies écrites d'une section non-revenante (un seul bloc de run,
    jamais au-delà de sa plage).
- Commentaire mensonger corrigé : le test « one-bar pair » prétendait épingler
  le signe du coût DP — `['C','C']` ne structure jamais (fallback plat).

## Not done / remaining

- **34 survivants restants — analysés (quasi-)équivalents**, par famille :
  1. Gardes du rollout (l. 80/85) : doublées en aval (`matchesTolerantly`
     refuse les chunks inégaux) ; tuer l. 85 demanderait autocorrélation
     ≥ 0,8 avec une paire de passes < 0,75 — hors espace atteignable.
  2. Ties de coût D.C. (l. 154/156/180) : sections au grain 4 mesures,
     surcoût D.C. 10/11 → égalités et flips ±2 inatteignables modulo 4.
  3. `?.` (l. 203/242) : indices bornés par les gardes amont.
  4. Clé memo (l. 235) : la sentinelle ne vaut que pour `running=undefined` ;
     deux mètres définis différents n'interrogent jamais la même plage.
  5. Lecture memo (l. 237) : perf-only.
  6. Scan de run (l. 241) : au-delà de la plage, la frontière de type ou le
     coût arrête toujours le sur-run.
  7. Tie-accounting (l. 259/262) : l'ordre des moves est déjà l'ordre de coût
     dans l'espace atteignable (un write ne bat strictement une volta que si
     split < 3, impossible avec TAIL_LENGTH=2 et sections ≥ 4).
  8. Recalcul vs cache d'`endingVariants` plein-span (l. 307/311) : valeurs
     identiques. Move fantôme (l. 308) : mangé par la garde
     `move.block === undefined`.
  9. Nav repeat/count ±1 (l. 317), run-write dupliqué (l. 327) : écarts de
     coût ≥ 3 / bloc identique au tie.
  10. Fold `startsWith('|')` (l. 401) : l'extraction du lead garantit le
      démarrage sur une barre. Volta body vide (l. 432) : split ≥ len−2 ≥ 2.
      `{fine}` NaN (l. 467) : comparaison fausse des deux côtés.
  11. `encodeBody` non structuré (l. 111) : `encodeInstances` sur une
      instance unique ≡ rendu plat octet pour octet.
- Les deux autres restes v6 : **chemin natif export desktop** (plugin-dialog)
  et **garde-fous beta côté utilisateur** (plafond Modal dashboard + SMTP —
  piste en cours : Resend sur `iiivan.org`, domaine déjà à l'utilisateur ;
  câblage Supabase possible dès que la clé API est posée localement hors
  chat/repo).

## Decisions

- Un survivant Stryker ne se tue qu'après **sonde** : chaque scénario est
  d'abord exécuté en spec jetable et sa sortie validée à l'œil avant de
  devenir un pin exact — pas de pin d'un rendu non vérifié.
- Les 34 restants sont **documentés, pas poursuivis** : chaque famille a un
  argument d'équivalence (ci-dessus) ; le ROI d'aller au-delà est nul tant
  que l'encodeur ne bouge pas.

## Gate status

- typecheck : ✅ (via `pnpm gate`)
- tests (with coverage) : ✅ **1944 tests** (+14, était 1930)
- mutation (Stryker, local, `--force` scopé) : **form-encoder 89,34 %**
  (280 Killed + 5 Timeout / 319), **global 92,75 %** (3645/3930), break 90 ✅
- biome / sheriff / knip / jscpd : ✅ (un passage `check:fix` sur le format
  de la spec)

## State to resume from

- **Single next action** : chemin natif d'export desktop (plugin-dialog
  save + fs, lever le hint AH.1) — ou câbler le SMTP Resend si la clé est
  fournie d'abord.
- Gotchas : toujours `stryker run --force --mutate <file>` pour re-tester un
  fichier (l'incrémental garde des Survived périmés) ; le score global du
  rapport JSON se recalcule depuis `reports/mutation/mutation.json` (le
  clear-text ne re-liste que le scope muté).
