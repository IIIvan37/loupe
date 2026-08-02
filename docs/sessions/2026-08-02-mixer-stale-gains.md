# Session — 2026-08-02 — le métronome muet du terrain (gains gelés du mixer)

## Done

- **Signal terrain « on n'entend pas le métronome, muet/solo ou pas »
  instruit jusqu'au bug, PR #355.** Démarche : lecture du chemin du click
  (synthèse core saine, canal muet par défaut = choix documenté), puis
  vérification navigateur INSTRUMENTÉE (prototypes Web Audio patchés :
  sources, RMS des buffers, gains, connexions, AnalyserNode de sortie) sur
  le dev server ET le binaire v0.2.0 livré.
- **Le bug** ([use-mixer.ts:237](../../packages/web/src/app/mixer/use-mixer.ts)) :
  `apply()` recalculait les gains moteur depuis le `state` du RENDU
  (`mixerReducer(state, action)`). Deux actions mixer dans la même fenêtre
  de rendu (mute puis solo enchaînés, K en rafale) : la seconde lisait le
  mixer périmé, écrivait des gains faux dans le moteur (métronome soloé lu
  « encore muet » → 0 partout), React committait ensuite les DEUX actions
  — UI juste, moteur faux, **aucune réconciliation ensuite**. Preuve : UI
  « démuté + soloé », `GainNode` 0/0, silence total persistant.
- **Le fix** : `apply()` lit l'état committé du store
  (`store.get(mixerStateAtom)` — `atomWithReducer` committe en synchrone),
  plus aucune re-dérivation du snapshot de rendu. Spec rouge d'abord
  (« lands two same-tick toggles on the committed gains ») ; re-vérifié au
  navigateur sur le geste fautif exact : piste 0 / métronome 1.
- Mesures de sortie qui bornent le reste : click soloé audible (pic 0,98)
  sur `enable`, `reseat` en lecture, et dans le binaire livré — le moteur
  audio est hors de cause.

## Not done / remaining

- **Découvrabilité** (l'autre moitié du signal) : le click naît muet
  (choix produit, `metronome-stem.ts`) et rien ne le dit — seuls le mute
  de la lane et la touche K le révèlent. Proposition en attente : bouton
  click dans le panneau Tempo (état visible, même action que K).
- La v0.2.0 en circulation porte le bug — candidat v0.2.1 avec la slice
  version (#354).

## Decisions

- **Pont impératif vers un système externe (moteur audio) ⇒ lire l'état
  COMMITTÉ du store après dispatch, jamais le snapshot de rendu.** Pas
  d'effet de réconciliation ajouté (le store Jotai est synchrone, la
  lecture post-dispatch suffit) — cohérent avec « pas de hook à effet de
  montage » (ADR 0011) et l'idiome useLatest (même famille de pièges).

## Gate status

- `pnpm gate` : ✅ complet (tampon `8911ea76`).
- tests mixer : 50 ✅ (dont le nouveau same-tick).
- mutation (Stryker local) : **sans objet** — `use-mixer` est un adaptateur
  web, aucune source core touchée.
- Sonar : à lire sur la PR #355 (~5 min après le push).

## State to resume from

- **Single next action** : décider la slice découvrabilité du click
  (bouton Tempo ? hint ?) — puis v0.2.1 (ce fix + #354) pour les testeurs ;
  sinon reprendre le lot « retour au labo » starter.
- Gotchas : la vérification navigateur instrumentée (patch des prototypes
  Web Audio AVANT toute interaction) est le bon outil pour « ça ne
  s'entend pas » — l'AnalyserNode de sortie donne une mesure objective ;
  attention aux toggles synthétiques même-tick, c'est EUX qui déclenchent
  le bug (un clic humain lent ne le voit presque jamais).
