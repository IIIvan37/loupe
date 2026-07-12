# Session — 2026-07-12 — pitch-chart-divergence (N.3)

## Done

- **Core (TDD)** : `ProjectChordChart.transposedBy?` — l'offset de tonalité de
  la grille vs sa tonalité d'écriture/détection, **absent ⇔ 0** (vieux
  manifests inchangés, byte-stables). Quatre fonctions pures nouvelles :
  - `chartTransposedBy(chart?)` — lecture normalisée (absent, champ manquant
    **ou offset non entier** → 0 ; un manifest corrompu ne sème pas de flag
    NaN inextinguible) ;
  - `projectChordChart(source, transposedBy)` — le pendant **écriture** (vide
    ⇔ absent, 0 ⇔ omis) pour que la règle du manifest vive en un seul endroit ;
  - `transposeChart(chart, delta)` — transposition **appariée** texte+offset
    (désync irreprésentable) ; no-op sur grille vide (pas d'offset invisible)
    et sur delta non entier ; l'octave garde le texte mais compte ;
  - `chartMatchesPitch(transposedBy, pitchSemitones)` — divergence **modulo
    12** : ±12 nomme les mêmes accords, pas de faux positif à l'octave.
- **Hook `useChordChart`** : un seul état `{source, transposedBy}` ;
  `transpose` délègue à `transposeChart` ; `setSource` garde l'offset (éditer
  n'est pas changer de tonalité) **sauf passage par vide** — l'échappatoire du
  select-all + réécriture ; `seatDraft` (détection → offset 0), `restore`
  (manifest), `reset`.
- **Panneau** : hint « Audio transposé de {pitch} demi-tons, grille de {grid} »
  \+ bouton « Transposer la grille pour suivre » quand la grille (non vide)
  diverge du pitch entendu ; **confirmation deux temps** (« Réécrire la
  grille ? », même idiome que la détection) ; annonce `LiveStatus` « Grille
  transposée » via **l'unique** région live du panneau (fusionnée — deux
  `role="status"` cassaient les queries) ; les boutons ±½ passent par
  `onTranspose` et alimentent le même offset.
- **Shell/persistance** : `pitchSemitones` thréadé jusqu'au panneau ;
  `restoreChordChart` reçoit le `ProjectChordChart` entier ; sauvegarde via
  `projectChordChart` ; signature de session signe l'offset (un +12
  texte-identique signe sale) ; round-trip shell complet (suivre +2 →
  save → reopen → offset restauré, indicateur éteint, « Enregistré »).
- **Dédup** : `signedSemitones` partagé transport ↔ panneau (glyphes enfin
  identiques) ; `.pitchDrift`/`.followButton` composent `.detectRow`/
  `.detectButton`.
- **/code-review 8 angles + vérif adversariale (1 vérificateur/constat
  correctness)** : 4 CONFIRMED + 1 PLAUSIBLE corrigés (offset fantôme sur
  grille vide, offset hérité au retype, réécriture un-clic sans confirmation,
  faux flag à l'octave, offset non entier d'un manifest corrompu) + 5 cleanups
  appliqués ; 1 noté sans correctif (couplage nominal `onDraft:
  chart.seatDraft` — le commentaire tient l'invariant, le type ne peut pas).

## Not done / remaining

- Vieux manifests dont le texte avait déjà été transposé à la main : lus
  offset 0 par construction (inhérent à « absent ⇔ 0 ») — la confirmation
  deux temps borne le risque de double transposition, on ne peut pas deviner.
- Couplage nominal `onDraft: chart.seatDraft` (deux callbacks type-identiques)
  — noté, mitigé par commentaire ; typer la capacité si un second point
  d'entrée de détection apparaît.

## Decisions

- **Delta persisté au manifest** (choix utilisateur explicite au checkpoint) :
  `transposedBy` sur `ProjectChordChart`, les ±½ manuels alimentent le même
  offset, la détection le remet à 0 — plutôt que message sans état ou état
  session-seulement.
- Divergence affichée **modulo 12** ; l'offset, lui, reste le compte exact —
  l'équivalence d'octave est une affaire d'affichage (noms d'accords), pas de
  signature.
- Grille vide = pas de compte de tonalité (no-op) ; vider la grille remet
  l'offset à 0.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ **1013 tests** (+38), statements 96,46 %,
  branches 90,54 %
- mutation (Stryker, local) : ✅ **95,12 %** (seuil 80) — `project.ts` 100 %
- biome / sheriff / knip / jscpd / react-doctor : ✅ (WorkstationShell repassé
  sous les 300 lignes en passant le state du hook tel quel à `ShellMain`)

## State to resume from

- **Single next action** : ouvrir la PR N.3 depuis
  `feat/pitch-chart-divergence`, puis attaquer **N.4** (micro-frictions du
  panneau accords : `aria-invalid` sur « mes. / ligne », préférence
  localStorage, remonter la ligne « Détecter les accords »).
- Gotchas : PR **#98** (N.1) toujours ouverte, verte et mergeable — merge
  refusé au classifieur de permissions, à merger à la main. Le retrofit
  `/tempo` sur `classifyTransportError` reste noté. `doctor.config.json` et
  `your-song-elton-john-chart.pdf` traînent non trackés à la racine (à l'user
  de décider).
