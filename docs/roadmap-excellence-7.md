# Feuille de route excellence 7 — cap « UI/UX exceptionnelle »

> Évaluation UX/UI du 2026-07-19, après la roadmap v6 (Lots AC→AI) et les
> garde-fous beta (SMTP Resend, DMARC, plafond Modal free plan). **Change de
> nature** : les v1–v6 notaient six axes d'ingénierie ; celle-ci vise
> l'**expérience** et se compare aux meilleurs (Logic, Ableton, Moises,
> Transcribe+). Cap acté par le propriétaire : rendre l'UI/UX *exceptionnelle*,
> pas seulement correcte. Voir [[cap-ux-exceptionnelle]].

## Méthode

Revue multi-agents : 8 reviewers d'axe UX (premier contact, boucle de
pratique, attente d'analyse, grille d'accords, mixer/stems, langage visuel,
copy FR, nativité desktop) + 1 enquêteur sur les reliquats de la dualité
serveur-local/offload. Chaque constat cité par ses fichiers réels, puis passé
à une réfutation adversariale. **53 constats, 42 confirmés, 1 réfuté,
1 déjà-tranché** ; la vérification de deux axes (boucle de pratique, reliquats
offload) a été interrompue par la limite de tokens — leurs constats sont
gardés comme **plausibles** (corroborés par le code cité et, pour l'offload,
par l'usage réel : le « Serveur hors ligne » signalé par le propriétaire).

## Notes par axe (2026-07-19)

| Axe | Note /20 | En une ligne |
|---|---|---|
| Premier contact | **13** | Le funnel beta a un cul-de-sac (« lien envoyé » sans issue, pas de reprise auto après connexion) ; l'empty state cache l'import URL (source n°1) et affiche « Serveur hors ligne » en rouge. |
| Boucle de pratique | **13** | Le geste répété manque de clavier (pas de boucle depuis la tête, pas de raccourci vitesse/pitch), de feedback de position pendant le drag, de zoom ancré ; waveform figée à 1200 buckets / 6×. |
| Attente d'analyse | **13,5** | Pas de modèle temporel (narration cold-start souvent fausse), pas de « Tout analyser », la zone repliée avale l'opération en cours ; copy d'erreur pour développeur. |
| Grille d'accords | **14** | Lecture soignée (Petaluma) mais édition = textarea brut, la grammaire échoue en silence, transposition tout-dièse, pas de mode lecture. |
| Mixer / stems | **13** | La plus grande surface (les lanes) est morte (aucun seek) ; fader sans double-clic 0 dB, confiance en tooltip seul, cibles 18 px, EQ aveugle, pas de master. |
| Langage visuel | **14,5** | Propre mais générique : waveform aplat monochrome, motion tokens ignorés, élévation par l'ombre seule, moment de marque sur un glyphe brut, app statique en lecture. |
| Copy & wording | **13,5** | « Piste » = morceau ET stem (ambigu au cœur), anglais brut (« chart », « key of »), deux « tempo », erreurs offload qui parlent de « serveur local ». |
| Nativité desktop | **12** | Garde travail-non-sauvegardé inopérante en Tauri (beforeunload), menus par défaut (⇐ **en cours**), fenêtre non persistée, titre figé, pas d'association de fichiers, métadonnées placeholder. |

**Note UX globale : ~13,5/20** — « propre mais pas encore exceptionnel ». La
qualité d'ingénierie (17,2 en v5) ne se traduit pas en expérience : trop de
surfaces mortes, un funnel qui perd l'utilisateur, un vocabulaire ambigu, et
des reliquats d'infrastructure (le serveur local retiré) qui mentent à l'écran.

## Séquencement (par impact décroissant)

Ordre : d'abord ce qui **ment** ou **perd l'utilisateur** (AJ, AK), puis le
**geste cœur** (AL, AM), puis la **lecture/écriture musicale** (AN), puis
l'**âme visuelle** (AO), enfin la **finition** (AP, AQ). Chaque slice garde le
checkpoint UI de 2–3 lignes avant code (convention [[autonomy-per-lot-convention]]).
Impression desktop = déprioritisée (hors roadmap).

### Lot AJ — offload-only : l'app arrête de mentir 🔴 (prérequis)

Le serveur Python local a été retiré (T2.5), mais son fantôme hante l'UI. Le
supprimer clarifie *immédiatement* et efface une classe entière de code mort.

- **AJ.1** — chip santé du header : retirer/masquer en mode offload (il sonde
  un serveur inexistant et affiche « Serveur hors ligne » en permanence).
- **AJ.2** — copies d'erreur grand public : plus de « Lancer le serveur
  local », « voir server/README », « console du navigateur » — messages
  actionnables pour un musicien.
- **AJ.3** — supprimer le gating « serveur local » mort (traverse 4 couches
  de composants) et la config double-chemin (le mode fantôme est le fallback
  silencieux d'un `.env` manquant).
- 🟢 mode navigateur : projets + import URL pointent vers `localhost:8000`
  mort → Modal, ou état honnête.

### Lot AK — premier contact : le funnel ne perd plus personne 🔴

- **AK.1** — reprise automatique de l'action gatée après connexion
  (aujourd'hui : sign-in → rien, il faut re-cliquer, retomber sur
  `not-a-beta-member`, re-cliquer) ; sortir le cul-de-sac « lien envoyé »
  (« Renvoyer le lien », « Changer d'adresse » — une faute de frappe bloque
  définitivement le formulaire).
- **AK.2** — empty state : import URL (YouTube) au même niveau que le fichier
  + coller un lien (paste `isSupportedSourceUrl`) ; vendre le produit ;
  proposer les projets récents à l'utilisateur qui revient.
- **AK.3** — « Analyser le morceau » : un geste enchaîne tempo → structure →
  accords (+ séparation) sous **un seul mint** et une seule narration (résout
  aussi l'attente en série ci-dessous).

### Lot AL — la boucle de pratique au niveau d'un vrai outil 🟠

- **AL.1** — boucle depuis la tête au clavier (I/O), corps de boucle
  déplaçable, poignées A/B avec états hover/actif.
- **AL.2** — raccourcis clavier vitesse/pitch + paliers + double-clic « retour
  neutre » (et le fader dB gagne le double-clic 0 dB — idiome console).
- **AL.3** — zoom ancré sur la tête / sous le curseur + molette/pincement ;
  résolution waveform au-delà de 1200 buckets / 6× ; timecode sous le curseur
  et lecture mesure:temps pendant les gestes.

### Lot AM — le mixer devient vivant 🟠

- **AM.1** — lanes cliquables (seek dans la forme d'onde du stem) : réveiller
  la plus grande surface de l'écran.
- **AM.2** — fader double-clic 0 dB, confiance de détection visible (plus
  seulement en tooltip), cibles M/S/EQ ≥ 24 px sur desktop.
- **AM.3** — EQ lisible (Hz affichés + reset, l'état « off » explicite),
  voie master / sortie de solo.

### Lot AN — la partition à hauteur de sa lecture 🟠

- **AN.1** — édition mesure par mesure au-dessus du textarea brut.
- **AN.2** — la grammaire ne échoue plus en silence : fautes et directives
  cassées signalées (aujourd'hui rendues verbatim en Petaluma).
- **AN.3** — transposition en bémols (plus seulement tout-dièse) ; mode
  lecture/performance (chart plein écran).
- 🟢 gravure Real Book (crochets de volta fermants, points de reprise).

### Lot AO — une âme visuelle mémorable 🟢🟢

- **AO.1** — waveform avec profondeur et progression (pièce maîtresse, pas un
  aplat monochrome).
- **AO.2** — motion tokens sur tous les hovers (aujourd'hui ils claquent) ;
  élévation qui ne repose pas que sur l'ombre.
- **AO.3** — moment de marque (logo / empty state ≠ glyphe Unicode brut, l'anti-
  pattern que `icon.tsx` documente) ; signes de vie discrets en lecture.

### Lot AP — nativité desktop 🟠

- **AP.1** — menus natifs macOS français (**FAIT cette session** : Loupe /
  Fichier ⌘O·⌘S / Édition presse-papiers / Fenêtre / Aide).
- **AP.2** — garde « travail non sauvegardé » native (le `beforeunload`
  navigateur est inopérant en Tauri — fermeture = perte silencieuse).
- **AP.3** — taille/position de fenêtre persistées ; titre = morceau + état
  dirty.
- 🟢 association de fichiers / dépôt sur le Dock ; métadonnées d'app (plus
  « A Tauri App » / authors « you »).

### Lot AQ — vocabulaire et copy irréprochables 🟠

- **AQ.1** — désambiguïser « Piste » (le morceau entier vs un stem) — le
  terme le plus central du produit.
- **AQ.2** — traduire l'anglais brut (« chart », « key of {key} »,
  « Timeline »), clarifier les deux « tempo » (musical vs vitesse de lecture)
  et « pitch »/« Hauteur », uniformiser le ton infinitif (l'empty state et
  l'overlay de drop passent à l'impératif vouvoyé).
- 🟢 micro-polish typographique (apostrophes, « Code beta », « Email »).

## Suivi

- [x] AP.1 · [ ] AP.2 · [ ] AP.3 (+ 🟢)
- [ ] AJ.1 · [ ] AJ.2 · [ ] AJ.3 (+ 🟢)
- [ ] AK.1 · [ ] AK.2 · [ ] AK.3
- [ ] AL.1 · [ ] AL.2 · [ ] AL.3
- [ ] AM.1 · [ ] AM.2 · [ ] AM.3
- [ ] AN.1 · [ ] AN.2 · [ ] AN.3 (+ 🟢)
- [ ] AO.1 · [ ] AO.2 · [ ] AO.3
- [ ] AQ.1 · [ ] AQ.2 (+ 🟢)

Réfuté (1) : « pas de sortie de secours du solo » — partiellement inexact au
regard du code. Déjà-tranché (1) : le cold-start narré recoupe R.3 (mais le
constat « modèle temporel absent » d'AK.3 reste neuf). Non re-vérifiés
(limite de tokens) : les constats des axes *boucle de pratique* et *reliquats
offload* — gardés comme plausibles, à confirmer au moment de leur lot.
