# Feuille de route excellence 7 — cap « UI/UX exceptionnelle »

> Évaluation UX/UI du 2026-07-19, après la roadmap v6 (Lots AC→AI) et les
> garde-fous beta (SMTP Resend, DMARC, Modal free plan). **Change de nature** :
> les v1–v6 notaient six axes d'ingénierie ; celle-ci vise l'**expérience** et
> se compare aux meilleurs (Logic, Ableton, Moises, Transcribe+). Cap acté par
> le propriétaire : rendre l'UI/UX *exceptionnelle*, pas seulement correcte.
> Voir [[cap-ux-exceptionnelle]].

## Méthode

Revue multi-agents (**Opus 4.8**, run du 2026-07-19) : 8 reviewers d'axe UX
(premier contact, boucle de pratique, attente d'analyse, grille d'accords,
mixer/stems, langage visuel, copy FR, nativité desktop) + 1 enquêteur sur les
reliquats de la dualité serveur-local/offload. Chaque constat cité par ses
fichiers réels, puis passé à une **réfutation adversariale**. **47 constats,
42 confirmés, 5 déjà-tranchés** (0 réfuté ; **57 agents, 0 erreur**). La vérif
a rétrogradé beaucoup de « high » vers moyenne/basse — les axes sont moins
« cassés » que le brut ne le suggérait — mais la barre « exceptionnel »
maintient les notes basses : un axe où « rien ne ment mais tout est
générique » plafonne à 14,5. Les deux axes restés « plausibles » à la première
passe (boucle de pratique, reliquats offload) sont désormais **confirmés par
le code**.

## Notes par axe /20 — cible « exceptionnel »

| Axe | Note /20 | Justification (constats confirmés) |
|---|---|---|
| **Premier contact** | **12,5** | Le hero ne vend rien (table de raccourcis inertes au lieu de la proposition de valeur), le bouton primaire cache l'import URL (source n°1 face à Moises), le magic-link est un cul-de-sac (ni renvoi, ni correction d'email, ni spam) et le gate beta n'offre aucune issue quand le code manque. L'embuscade de quota à l'import est déjà corrigée (AG.1), mais le funnel perd encore l'enthousiaste. |
| **Boucle de pratique** | **13** | Le geste répété 100×/session se fait à l'aveugle : aucun read-out temps pendant drag/nudge, poignées 12 px sans hover ni retour de snap, Vitesse/Hauteur en sliders drag-only quand le fine-tune (le plus rare) est le seul typable, speed-trainer indécouvrable (boucle ON requise) et sans aperçu. Atténué par le snapping et le read-out transport. |
| **Attente d'analyse** | **13,5** | Replier la zone pendant un run avale l'opération (a11y muet, Annuler injoignable), la narration cold-start est statique et devient fausse, pas d'état agrégé « n/4 » ni « Tout annuler », rien ne dit qu'on peut continuer à travailler. Sauvé par des libellés primaires exacts et une vraie barre % sur la séparation. |
| **Grille d'accords** | **14** | Lecture soignée (seek-au-clic, follow playhead, Petaluma) mais l'écriture est en dessous : transposition tout-dièse (l'orthographe par tonalité perdue au premier ±½), aucune tonalité de destination/reset, glyphes ASCII (`b`/`maj7`/`m7b5` au lieu de ♭/△/ø), édition = textarea qui échoue en silence, aucune synchro locus chart↔source. |
| **Mixer / stems** | **13** | L'axe le plus faible : la plus grande surface (les lanes) est morte au clic, faders courts sur 66 dB sans double-clic 0 dB ni saisie fine, confiance en tooltip seul (invisible au trackpad/toucher desktop), EQ aveugle (pas de Hz/reset), aucune métrique de niveau par stem, chroma enharmoniquement incohérent. |
| **Langage visuel** | **14,5** | Le mieux noté mais générique : waveform aplat monochrome (l'objet vu 90 % du temps), un seul @keyframes (app clinique en lecture), élévation par un pas de fond de 5 % + trait 1 px, marque concentrée dans deux polices, icônes hétérogènes (SVG + Unicode + CSS content). « Propre mais quelconque » sur capture. |
| **Copy & wording** | **13,5** | « Piste » = le morceau ET un stem (ambigu au cœur du produit) avec « stem » anglais en parallèle pour le même objet, « key of C » en dur dans une UI FR, erreurs renvoyant à « server/README » / « console du navigateur », impératif vouvoyé sur l'écran vide en rupture avec l'infinitif partout. |
| **Nativité desktop** | **12,5** | Menus natifs macOS livrés cette session (AP.1). Restent : garde travail-non-sauvegardé inopérante en WKWebView (fermeture = perte silencieuse), fenêtre jamais mémorisée, titre figé « loupe » sans morceau ni dirty dot, métadonnées bundle placeholder. |

**Note UX globale : ~13,5/20 — « propre, pas encore exceptionnel ».**
L'ingénierie (17,2 en v5) ne se traduit pas en expérience : surfaces mortes
(lanes, réglages à l'aveugle), un funnel qui perd l'utilisateur, un
vocabulaire ambigu, et des reliquats du serveur local retiré qui **mentent à
l'écran**.

## Séquencement en Lots — par impact/effort

Ordre : ce qui **ment** (AJ) → ce qui **perd l'utilisateur** (AK) → le **geste
cœur** (AL, AM) → la **lecture/écriture musicale** (AN) → l'**âme visuelle**
(AO) → la **finition native** (AP) → le **vocabulaire** (AQ). Checkpoint UI de
2–3 lignes avant chaque slice. **Impression desktop exclue (hors roadmap).**

### Lot AJ — offload-only : l'app arrête de mentir 🔴 (prérequis, en premier)

*Confirmé par le code + le signal terrain du propriétaire. Clarté immédiate,
efface une classe entière de code mort.*

- **AJ.1** — Retirer la sonde `localhost:8000/health` et le chip « Serveur
  hors ligne » (rouge permanent sur une app 100 % fonctionnelle) ; coordonner
  avec le fallback navigateur avant suppression totale.
- **AJ.2** — Réécrire les `*_ERROR_COPY` en libellés neutres « service
  d'analyse » ; bannir « server/README », « console du navigateur », « serveur
  local », « moteur ». (Solde aussi le constat « erreurs pour développeur » de
  l'axe copy — inutile d'attendre AQ.)
- **AJ.3** — Trancher le mode navigateur (Tauri-only **ou** backend distant) :
  projets / import URL / track source ne visent plus `localhost:8000` mort ;
  endpoint obligatoire, `VITE_STRUCTURE_URL → VITE_ANALYSIS_URL`, supprimer le
  fallback silencieux + commentaires périmés (Demucs local).

### Lot AK — premier contact : le funnel ne perd personne 🔴

- **AK.1** — Magic-link : état « envoyé » enrichi (adresse affichée,
  « Renvoyer » + cooldown, « Changer d'adresse », mention spam) + reprise
  automatique de l'action gatée après connexion.
- **AK.2** — Empty state qui vend : remplacer la table de raccourcis prématurée
  par 3–4 accroches de valeur (séparer les pistes, détecter accords/tempo,
  boucler et ralentir) ; garder les raccourcis pour le dialogue « ? ».
- **AK.3** — Import URL au même niveau que le fichier : le bouton hero ouvre
  File/URL (ou champ « Coller un lien » + paste `isSupportedSourceUrl`).
- **AK.4** — Divulgation beta amont + issue quand le code manque : état
  « connectez-vous pour débloquer » sur les boutons Détecter + lien
  waitlist/mailto dans le formulaire de code.

### Lot AL — la boucle de pratique au niveau d'un vrai outil 🟠

- **AL.1** — Feedback de calage : read-out début·fin·longueur vivant dans
  LoopControls (tabular-nums) + étiquette temps flottante sur poignée/bord
  pendant **drag ET nudge** ; repère + timecode au survol de la waveform.
- **AL.2** — Poignées A/B dignes : hotzone invisible 16–20 px (trait visible
  2 px inchangé), `:hover`/`:active`, flash de la beat-line au snap.
- **AL.3** — Vitesse/Hauteur précises : valeur cliquable-éditable
  (CommitNumberField) + boutons ± (idiome pilule zoom) + double-clic retour
  neutre ; raccourcis clavier tempo/pitch (`[` `]`) ; le fader dB gagne le
  double-clic 0 dB. *(idiome « retour neutre » partagé avec AM.2 — traiter
  ensemble.)*
- **AL.4** — Speed-trainer découvrable : déclencheur désactivé-avec-tooltip
  hors boucle + ligne d'aperçu dérivée des 4 champs (« 70→100 % en 7 paliers,
  +5 % ») avant « Démarrer ».

### Lot AM — le mixer devient vivant 🟠

- **AM.1** — Lanes cliquables : `onSeekRatio` partagé au conteneur ZoomStage →
  tout point de toute couche cale la lecture ; hover-line cohérente.
- **AM.2** — Fader console : double-clic 0 dB (`UNITY_GAIN_DB`), Shift/molette
  pas fin 0,5 dB, lecture dB éditable ; fader vertical plus long si le mixer
  gagne son panneau.
- **AM.3** — Confiance visible : chip/pastille % (ou état « détection faible »)
  à côté du label, title en complément.
- **AM.4** — EQ lisible + niveaux vivants : Hz affichés par slider + reset
  neutre + mention « aide d'écoute non sauvegardée » (arbitrage T.8
  session-only respecté, **pas** de persistance) ; mini-mètre par stem alimenté
  par le tap analyser, distinct du fader statique.

### Lot AN — la partition à hauteur de sa lecture 🟠

- **AN.1** — Édition structurée + synchro locus : édition mesure-par-mesure
  au-dessus du textarea ; clic mesure → curseur sur le token source, ligne
  active surlignée.
- **AN.2** — Grammaire qui ne ment plus : retour de parse (nb mesures/ligne,
  surlignage de la rangée inatteignable), tokens non ré-imprimables signalés au
  lieu d'être avalés ; aide rapprochée (snippets insérables).
- **AN.3** — Transposition juste et lisible : re-épeler via
  `respellChartSource` selon la tonalité cible (déjà testé côté core, 0 import
  web) ; afficher tonalité courante/cible (ou offset signé « +3 ») + bouton
  « revenir à la tonalité écrite » + sélecteur de cible + bascule ♯/♭.
- **AN.4** — Gravure Real Book : couche de formatage pure `b→♭`/`#→♯`
  (fondamentale **et** exposant), `maj7→△`/`dim→°`/`m7b5→ø`/`aug→+`, fallback
  `--font-ui` si Petaluma Script ne porte pas les glyphes SMuFL ; + crochets de
  volta, points de reprise.

### Lot AO — une âme visuelle mémorable 🟢🟢

- **AO.1** — Waveform pièce maîtresse : enveloppe deux tons crête+RMS (ajouter
  `rms` à `WaveformPeak` en TDD core) + split couleur au playhead (lu/à venir).
  Geste au plus fort ROI visuel.
- **AO.2** — Vie et profondeur : motion tokens sur tous les hovers,
  halo/pulsation ambre sur Play pendant la lecture (sous
  `prefers-reduced-motion` déjà en place) ; élévation de repos
  (`inset 0 1px 0 rgba(255,255,255,.04)`) au lieu de l'ombre seule.
- **AO.3** — Signature de marque : métaphore loupe/amber-teal en élément
  récurrent (le wash « loupe » traité en motif héros) ; vocabulaire d'icônes
  unifié (étendre `icon.tsx` à download / chevron / ×2÷2, garder M/S).

### Lot AP — nativité desktop 🟠 (impression exclue)

- **AP.1** — Menus natifs macOS FR — **FAIT** (Loupe / Fichier ⌘O·⌘S / Fenêtre
  / Aide ; pas de menu Édition — macOS y injecterait AutoFill/Writing Tools,
  et WKWebView gère le presse-papiers seul).
- **AP.2** — Garde travail-non-sauvegardé native :
  `on_window_event(CloseRequested)` → `prevent_close()` → réutiliser le
  dialogue de confirmation existant ; `beforeunload` en repli web.
- **AP.3** — Fenêtre native : `tauri-plugin-window-state` (taille/position/
  maximisé) ; titre = « <morceau> — loupe » + dirty dot (`setTitle` +
  `document.title`).
- **AP.4** 🟢 — Métadonnées : `tauri.conf.json`
  `bundle.copyright`/`category`(Music)/`publisher` + les 4 champs `Cargo.toml`.

### Lot AQ — vocabulaire et copy irréprochables 🟠

- **AQ.1** — Désambiguïser « Piste » : lexique 3 niveaux appliqué partout
  (morceau = audio importé ; piste = un stem ; supprimer « stem » anglais du
  catalogue) ; corriger « Piste trop volumineuse » → « Morceau trop
  volumineux », `waveform.track-image`, `header.export-*`.
- **AQ.2** — Éradiquer l'anglais brut + uniformiser le ton : `chart.key-of` →
  « Tonalité : {key} », « chart » → « grille », trancher Mix/Tap ;
  `empty.headline`/`drop.overlay` à l'infinitif ; garde-fou lint
  anti-liste-noire. Après chaque changement :
  `pnpm --filter @app/web i18n:extract`.

## Suivi

- [x] AP.1
- [ ] AJ.1 · [ ] AJ.2 · [ ] AJ.3
- [x] AK.1 · [x] AK.2 · [x] AK.3 · [x] AK.4
- [x] AL.1 · [x] AL.2 · [x] AL.3 · [x] AL.4
- [x] AM.1 · [ ] AM.2 · [ ] AM.3 · [ ] AM.4
- [ ] AN.1 · [ ] AN.2 · [ ] AN.3 · [ ] AN.4
- [ ] AO.1 · [ ] AO.2 · [ ] AO.3
- [ ] AP.2 · [ ] AP.3 · [ ] AP.4
- [ ] AQ.1 · [ ] AQ.2

**Déjà-tranchés (5, écartés)** : l'EQ session-only (T.8/T.8b — AM.4 le
respecte), l'embuscade de quota à l'import (AG.1 mergé), le cold-start narré
(R.3 — mais l'absence de modèle temporel agrégé reste neuve, cf. attente),
et deux recoupements mineurs de copies déjà couvertes.
