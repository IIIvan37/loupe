# Loupe — Plan produit

*Poste de travail de transcription musicale avec séparation de pistes par IA.*
*Document de travail — v1, à itérer.*

---

## 1. Vision & positionnement

**Loupe** est un poste de travail dans le navigateur pour les musiciens qui apprennent et transcrivent la musique **à l'oreille**. On part du meilleur de *Transcribe!* (un lecteur spécialisé : ralentir sans changer la hauteur, marqueurs au temps près, boucles, analyse spectrale) et on y ajoute **la seule brique que Transcribe! n'a pas** : la séparation des voix et instruments par IA.

La distinction stratégique avec Moises tient en une phrase : **chez Moises, la séparation est le produit ; chez Loupe, c'est un outil au service de l'étude.** Moises vise le grand public mobile (karaoké, covers, pratique légère). Loupe vise le transcripteur sérieux — le jazzman qui relève un solo, l'étudiant en conservatoire, l'arrangeur — pour qui la séparation sert à *isoler ce qu'on veut entendre*, pas à faire une face B karaoké.

Trois paris de différenciation :

1. **Séparation adaptative** — on n'affiche que les instruments réellement présents dans le morceau (détection en amont), pas « toujours 6 pistes ».
2. **Local-first quand c'est possible** — tout le temps réel (lecture, ralenti, marqueurs, spectre) tourne dans le navigateur ; l'audio ne part sur un serveur que pour la séparation. Argument de confidentialité *et* de coût.
3. **Le pont qui manque partout : stem → notation.** Isoler la guitare puis la convertir en MIDI/tablature. Ni Transcribe! ni Moises ne le font. C'est la frontière, donc le fossé défendable.

---

## 2. Fonctionnalités voulues × état de la maquette

Légende : ✅ présent dans la maquette · 🟡 conçu partiellement / à finaliser · ⬜ non commencé

### Lecture & navigation *(cœur Transcribe!)*

| Fonctionnalité | État | Note |
|---|---|---|
| Forme d'onde scrollable du morceau | ✅ | Master + waveform par piste |
| Tête de lecture, lecture/pause, raccourci Espace | ✅ | |
| Marqueurs section / mesure / temps, nommés | 🟡 | Sections nommées présentes ; subdivision mesure/temps à ajouter |
| Boucle (loupe) sur une zone | ✅ | Boucle fixe ; **sélection A/B au glisser manquante** |
| Zoom dans la waveform | ✅ | Jusqu'à 6×, vue défilable |
| Bibliothèque de boucles nommées (rappel) | ⬜ | |
| Raccourcis clavier configurables | 🟡 | Espace seulement |
| Support pédales (mains libres) | ⬜ | Web HID / MIDI |
| Synchro vidéo | ⬜ | |

### Manipulation audio temps réel *(cœur Transcribe!)*

| Fonctionnalité | État | Note |
|---|---|---|
| Ralenti/accélération **sans changer la hauteur** | 🟡 | UI présente (slider + presets ½ ¾ 1×) ; moteur à brancher |
| Changement de hauteur (demi-tons) | 🟡 | UI présente ; moteur à brancher |
| Transposition (instruments transpositeurs) | ⬜ | |
| EQ | ⬜ | |
| Mono / karaoké (annulation de phase) | ⬜ | Remplacé par la vraie séparation |

### Séparation IA *(la brique Moises)*

| Fonctionnalité | État | Note |
|---|---|---|
| Séparation voix / instruments | 🟡 | Pistes affichées (5) ; **moteur non branché** |
| **Détection d'instruments → pistes adaptatives** | ✅ | Confiance par piste + ligne « non détectés » |
| Découpe **N pistes adaptatives** (= ce qui est détecté) | ⬜ | Pas de profil fixe ; on sépare ce qui est présent |
| **Regroupement de pistes par l'utilisateur** | ⬜ | Ex. guitare+claviers → « Harmonie » ; bus avec fader + solo/mute ; sert aussi au bucketing d'export |
| Mixer par piste (solo / mute / volume) | ✅ | Fader + valeur ; waveform qui pâlit selon le niveau |
| Écran d'import → séparation → traitement | ⬜ | **Manque le moment-clé de la fonctionnalité** |

### Analyse musicale

| Fonctionnalité | État | Note |
|---|---|---|
| Détection tonalité / BPM / mesure | ✅ (affichage) | À calculer réellement (essentia.js) |
| Grille d'accords détectée | ✅ (affichage) | Idem |
| Spectre / chroma sur clavier | ✅ | Animé ; pics = notes candidates |
| « Note/chord guessing » assisté | 🟡 | Accord probable affiché |
| **Métronome intelligent** | ⬜ | Calé sur les vrais temps/downbeats du morceau (suit le tempo réel, même variable) ; décompte + subdivisions |

### Annotation & étude

| Fonctionnalité | État | Note |
|---|---|---|
| Notes textuelles | ✅ | Onglet Notes |
| Panneau liste de repères cliquables | ✅ | |
| **Export MIDI par piste** | ⬜ | basic-pitch ; fiable en monophonique (basse, solos, mélodie) — la fondation |
| **Export tablature ET notation standard** (MusicXML / Guitar Pro) | ⬜ | Notation = tout instrument ; tablature = guitare/basse (assignation corde/case en plus) |
| **Lecteur partition + tablature interactif intégré** | ⬜ | AlphaTab (MPL-2.0) : portée + tab affichées ensemble, synchronisé à l'audio — l'expérience Songsterr dans Loupe |
| **Export dossier de stems aligné** (AIFF/WAV, t=0, même durée, nommés) | ⬜ | Le format universel : se cale dans GarageBand, Logic, Ableton, Pro Tools |
| **Export des groupes** comme pistes uniques | ⬜ | Reprend le regroupement utilisateur |
| **Export projet GarageBand `.band`** | ⬜ | Expérimental, fragile, macOS only — pari de jalon 4 (voir 3.7) |
| Export annotations / projet Loupe | ⬜ | |

### Gestion & compte

| Fonctionnalité | État | Note |
|---|---|---|
| Import fichier / URL / cloud | 🟡 | Bouton présent |
| Bibliothèque de morceaux, projets sauvegardés | ⬜ | |
| Comptes, quotas, abonnement | ⬜ | |

**Ce qui manque le plus, par priorité :** (1) l'écran d'import → séparation → traitement, qui est le moment-clé de la fonctionnalité ; (2) le branchement réel du moteur de time-stretch et du moteur de séparation, aujourd'hui simulés ; (3) la sélection A/B de boucle au glisser sur la waveform.

---

## 3. Analyse technique

### 3.1 Architecture d'ensemble : hybride

Le bon découpage n'est pas « tout client » ni « tout serveur », mais **temps réel dans le navigateur / traitements lourds à la demande** :

```
  NAVIGATEUR (gratuit, instantané, privé)        CLOUD ou WASM (lourd, à la demande)
  ┌──────────────────────────────────┐           ┌─────────────────────────────┐
  │  • Lecture & transport            │           │  • Séparation de stems       │
  │  • Time-stretch / pitch (worklet) │  ──audio──▶│    (Demucs / BS-RoFormer)    │
  │  • Waveform, zoom, marqueurs      │  ◀─stems── │  • (option) transcription    │
  │  • Spectre (AnalyserNode)         │           │    paroles (Whisper)         │
  │  • Tonalité/BPM/accords (essentia)│           └─────────────────────────────┘
  │  • Mixer, solo/mute               │
  └──────────────────────────────────┘
```

L'audio ne quitte la machine que pour la séparation. Tout le reste est local : c'est ce qui rend le **jalon 1 livrable sans aucun backend**.

### 3.2 Front-end & temps réel

| Besoin | Techno candidate | Remarque |
|---|---|---|
| Moteur audio | **Web Audio API** + `AudioWorklet` | Le `playbackRate` natif change vitesse *et* hauteur → insuffisant |
| **Time-stretch sans pitch** | `soundtouchjs` (LGPL), `signalsmith-stretch` (perm.), **Rubber Band** en WASM | Rubber Band = qualité « Transcribe! », mais **licence GPL ou commerciale** → à arbitrer tôt |
| Pitch-shift | Même moteur (phase vocoder) | |
| Waveform + régions/boucles | **wavesurfer.js v7** (plugin Regions) ou canvas/WebGL maison | Maison si perf sur longs morceaux |
| Spectre temps réel | `AnalyserNode` (FFT) | Déjà l'affichage de la maquette |
| Tonalité / BPM / chroma / accords | **essentia.js** (WASM) | Tourne 100 % client, coût serveur nul |

**Point d'attention licence :** la qualité du ralenti extrême est un argument produit central. Si on vise le niveau Transcribe!, Rubber Band est le plus crédible — mais sa licence impose soit GPL (donc ouvrir le code) soit une licence commerciale payante. À décider avant le jalon 1.

### 3.3 Le moteur de séparation : construire vs acheter

C'est la décision structurante. Les modèles sortent des **catégories fixes** (pas « les instruments réels du morceau ») ; BS-RoFormer est le sommet de qualité actuel, Demucs (htdemucs / 6 stems) le standard open-source. Il reste toujours un peu de fuite entre pistes, et séparer deux instruments du même type (deux guitares) n'est pas fiable.

| Option | Qualité | Coût | Latence | Contrôle | Pour qui |
|---|---|---|---|---|---|
| **API tierce** (LALAL.ai, Moises/GraphQL, AudioShake) | Très bonne | ~0,10 $/min, ou crédits | Quelques s–min | Faible (dépendance) | **MVP** : en marché en quelques jours |
| **Demucs / BS-RoFormer auto-hébergé GPU** | Très bonne | Instance GPU (~0,5–1 $/h) + ops | ~10–30 s / 3 min sur GPU | Total | Quand le volume justifie l'infra |
| **Demucs en WASM côté client** (ex. *freemusicdemixer*) | Bonne, modèle limité | **Zéro serveur** | Lent, gourmand en RAM | Total + privé | Argument local-first / offre gratuite |

**Recommandation :** démarrer en **API** (acheter), garder l'option **WASM client-side** comme offre gratuite/privée, et n'**auto-héberger Demucs** que lorsque le volume rend l'API plus chère que le GPU. Note pratique : l'API Moises exige une URL publiquement accessible (pas d'upload direct) ; LALAL est souvent la plus simple à intégrer.

### 3.4 Pistes adaptatives — comment

L'effet « on sépare exactement ce qui est présent » se construit en deux temps :

1. **Détection d'instruments** en amont (taggage audio type PANNs/YAMNet, ou simple analyse d'énergie par bande) → quels types sont présents, avec quelle confiance.
2. **Séparation** avec le modèle à catégories, puis **on masque les pistes dont l'énergie est négligeable**. L'utilisateur ne voit que les instruments réels, chacun avec son % de confiance (comme dans la maquette).

C'est faisable aujourd'hui et différenciant sans avoir à inventer un modèle « any-source ».

### 3.5 Regroupement de pistes

Deux usages, un seul mécanisme :

- **Au mixage :** l'utilisateur sélectionne plusieurs pistes et les regroupe en un *bus* (ex. guitare + claviers → « Harmonie ») avec son propre fader, solo et mute. Techniquement, c'est une somme de stems alimentant un nœud de gain unique dans le graphe Web Audio.
- **À l'export :** le groupe peut être *bouncé* en une seule piste audio, ce qui réduit le nombre de fichiers et correspond à ce que l'utilisateur veut souvent dans son DAW.

Le regroupement est non destructif : on garde toujours les stems individuels, le groupe n'est qu'une vue. Côté UI, à prévoir dans l'écran post-séparation (glisser une piste sur une autre, ou sélection multiple → « Regrouper »).

### 3.6 Métronome intelligent

« Intelligent » = calé sur les **vrais temps du morceau**, pas sur un BPM fixe — donc il suit les variations de tempo d'un jeu humain. Pipeline :

1. **Détection des temps et des downbeats** (beat tracking). Côté client : les *beat trackers* d'essentia.js. Pour des downbeats plus robustes, un traitement serveur (type madmom) est une option.
2. **Génération du clic** verrouillé sur ces positions, avec accent sur le premier temps, **subdivisions** (croches, triolets) et **décompte** avant lecture.
3. Le clic se re-cale automatiquement quand on ralentit (le métronome suit le time-stretch, puisqu'il est ancré aux positions temporelles, pas à une horloge fixe).

Réutilise directement la détection de tempo/mesure du module d'analyse — coût marginal faible une fois cette brique en place.

### 3.7 Export & interopérabilité — le cas GarageBand

GarageBand n'expose **aucune API ni format d'import de session** : il lit de l'audio (AIFF/WAV) et du MIDI, mais pas de format d'échange de projet (AAF/OMF/dawproject). Son `.band` est un paquet propriétaire non documenté. L'export se pense donc en paliers :

| Palier | Quoi | Faisabilité |
|---|---|---|
| **A — Dossier de stems aligné** | Chaque piste (ou groupe) en AIFF/WAV sec, **calé à t=0, même durée**, nommé (`01_Voix`…), zippé + tempo en métadonnée | **Solide, MVP.** Se cale dans GarageBand, Logic, Ableton, Pro Tools |
| **B — Bundle `.band` généré** | Reconstruire le paquet GarageBand pour qu'il s'ouvre déjà en multipiste | Expérimental, **fragile** (non documenté, casse aux mises à jour), macOS only → jalon 4 |
| **C — Cibles pro alternatives** | `.dawproject` (standard ouvert, Studio One/Bitwig) pour les non-GarageBand | Optionnel, selon la base utilisateurs |

**Décision produit :** promettre le palier A comme « export prêt pour GarageBand » (c'est honnête et ça marche), traiter le palier B comme un bonus de confort, pas comme une promesse du MVP.

### 3.8 La frontière : stem → MIDI → tablature (l'expérience Songsterr)

C'est le fossé défendable : Transcribe! t'aide à *entendre*, Moises te donne les *stems*, mais **personne ne ferme la boucle jusqu'à une tablature lisible, jouable et synchronisée à l'original**. La chaîne complète :

```
stem isolé → audio-vers-MIDI → calage sur la grille de temps → assignation corde/case → MusicXML/Guitar Pro → rendu interactif (AlphaTab)
```

Étape par étape :

1. **Audio → MIDI** : **basic-pitch** (modèle open-source de Spotify, tourne dans le navigateur). Fiable sur le **monophonique** (basse, solos une note, mélodie chantée), faible sur la polyphonie dense / accords plaqués / guitare saturée. La **batterie** passe par un autre modèle (détection d'onsets + classification → drum tab).
2. **Quantification rythmique** : caler les notes sur la grille de temps. **Dépend du module d'analyse + métronome intelligent** (jalon 3) — sans bonne grille, la tab est illisible.
3. **Assignation corde/case** (guitare/basse) : heuristique tenant compte de l'accordage, minimisant les déplacements de main. Plusieurs solutions valides → l'utilisateur peut choisir l'accordage et corriger.
4. **Encodage** en **MusicXML** (porte la tablature) ou **Guitar Pro / AlphaTex**.
5. **Rendu** : **AlphaTab** (MPL-2.0, NPM, web-first). Charge GP 3-8 et MusicXML, **affiche portée standard ET tablature ensemble** (vue Guitar Pro classique), joue via synthé intégré, gère curseur/boucle/tempo/transposition, affiche les pistes individuellement et **se synchronise à l'enregistrement audio réel**. C'est, tel quel, le moteur d'un Songsterr — un clone open-source de Songsterr (*its-mytabs*) l'utilise déjà.

**Notation standard vs tablature — deux portées de pipeline :**

- La **notation standard** marche pour **tout instrument** (piano en portée grand format, voix, cuivres, batterie en drum-notation) et ne nécessite **pas** l'étape d'assignation corde/case → pipeline plus court.
- La **tablature** ne concerne que les instruments frettés (guitare/basse) et ajoute l'étape corde/case.
- Le lecteur choisit la bonne représentation selon l'instrument : portée + tab pour guitare/basse, portée seule pour le reste.

**Ordre de difficulté croissante (= ordre de livraison) :** MIDI brut → notation standard → tablature.

**Deux livrables distincts**, à ne pas confondre :

- **Export MIDI par piste** — la fondation, atteignable, utile seule (à déposer dans n'importe quel DAW / éditeur de partition). C'est le « au moins » réaliste.
- **Partition (notation + tab) + lecteur intégré** — l'expérience Songsterr dans Loupe : la partition défile en suivant l'audio original, par instrument, avec boucle. Bien plus ambitieux, qualité variable, **sortie obligatoirement éditable** (la machine propose, l'oreille corrige).

**Priorisation des instruments** : commencer par la **basse** et les **lignes monophoniques** (meilleur ratio qualité/effort), puis élargir.

### 3.9 Stockage, comptes, coûts

- **Sans compte** au jalon 1 (tout local) → adoption sans friction.
- Comptes + projets sauvegardés dès qu'on stocke des stems côté serveur.
- Coûts dominés par la séparation (API ou GPU) → modèle freemium logique : gratuit en WASM/local, payant pour la séparation cloud haute qualité et l'export.

### 3.10 Juridique (à faire valider par un juriste)

Les utilisateurs importent de la musique sous copyright. L'usage « outil sur les fichiers de l'utilisateur pour son étude perso » est admis (Transcribe! et Moises existent). Deux règles : **ne jamais entraîner de modèle sur l'audio importé** sans droits, et **ne pas conserver les stems** au-delà du nécessaire. L'option local-first/WASM élimine une grande partie du risque puisque l'audio ne touche pas le serveur.

---

## 4. Jalons de MVP

Principe directeur : **chaque jalon est livrable et utile seul.** On ne dépend pas du jalon suivant pour avoir un produit.

### Jalon 0 — Prototype design ✅ *(fait)*
Maquette interactive validée : layout, identité, interactions clés simulées. Sert de référence visuelle.

### Jalon 1 — Le lecteur de transcription *(sans IA)*
**But :** un « Transcribe! dans le navigateur », 100 % client, sans backend.
- Import fichier local, waveform, transport, zoom.
- **Time-stretch sans pitch** + pitch-shift réels (worklet) — *décision licence Rubber Band ici*.
- Marqueurs (section/mesure/temps), **sélection A/B de boucle au glisser**, boucles nommées.
- Raccourcis clavier.

**Livrable :** un outil déjà complet et utile, monétisable ou en acquisition gratuite. Risque faible, valeur immédiate. C'est la fondation.

### Jalon 2 — Séparation *(la tête d'affiche)*
**But :** la brique Moises, en mieux ciblée.
- Écran **import → séparation → traitement → pistes**.
- Branchement d'une **API de séparation** (LALAL ou Moises).
- **Détection d'instruments → N pistes adaptatives** (on sépare ce qui est présent, masquage des pistes vides).
- Mixer solo/mute/volume + **regroupement de pistes** (bus utilisateur).
- **Export — palier A** : dossier de stems aligné (et groupes bouncés) prêt pour GarageBand/Logic/Ableton.

**Livrable :** le produit différencié. Dépendance API assumée au départ.

### Jalon 3 — Analyse musicale
**But :** rendre la transcription assistée vraiment utile.
- Tonalité / BPM / mesure réels (essentia.js).
- Grille d'accords détectée alignée au temps.
- Spectre + « note/chord guessing » sur la sélection.
- **Métronome intelligent** (calé sur les temps détectés, décompte, subdivisions).

**Livrable :** Loupe devient un assistant de relevé, pas seulement un lecteur.

### Jalon 4 — Différenciation profonde *(paris)*
**But :** creuser le fossé.
- **Export MIDI par piste** (basic-pitch) — la fondation audio→notation, à commencer par basse + lignes monophoniques.
- **Export — palier B** : génération expérimentale d'un bundle `.band` GarageBand.
- Support **pédales** (mains libres), synchro **vidéo**.
- **Séparation en WASM local** comme offre gratuite/privée ; éventuel **Demucs auto-hébergé** si le volume le justifie.

**Livrable :** les fonctions que ni Transcribe! ni Moises ne réunissent.

### Jalon 5 — Partition : notation standard + tablature *(l'expérience Songsterr)*
**But :** fermer la boucle jusqu'à la partition lisible et jouable. *Dépend du jalon 3 (grille de temps).*
- MIDI → quantification rythmique → **notation standard** (tout instrument) ; puis **assignation corde/case → tablature** (guitare/basse).
- Encodage MusicXML / Guitar Pro.
- **Lecteur intégré** via **AlphaTab** : portée + tab affichées ensemble, synchronisées à l'audio original, par instrument, avec boucle.
- **Édition des notes** (corriger ce que l'IA propose) + choix de l'accordage.

**Livrable :** audio → stems → partition (notation + tab) jouable et synchronisée. Le truc que personne ne fait de bout en bout.

---

## 5. Risques & décisions à trancher tôt

| Sujet | Décision attendue |
|---|---|
| Qualité du ralenti | Rubber Band (GPL/commercial) vs alternative permissive ? Impacte licence du produit. |
| Séparation | API d'abord (laquelle ?) ; quand basculer sur GPU auto-hébergé ? |
| Découpe | ✅ Tranché : **N pistes adaptatives** + regroupement utilisateur (pas de profil fixe). |
| Export GarageBand | Palier A (dossier de stems) au MVP ; tenter le bundle `.band` (palier B) plus tard ? |
| Tablature + notation / Songsterr | ✅ Rendu via **AlphaTab** (portée + tab ensemble). Ordre : MIDI → notation standard → tablature. Instruments prioritaires : basse + monophonique. |
| Modèle économique | Freemium local gratuit + séparation cloud payante ? |
| Local-first | Jusqu'où pousser le WASM client-side comme argument central ? |

---

*Prochaine étape suggérée : valider la portée du jalon 1, puis concevoir l'écran d'import → séparation (le grand absent de la maquette).*
