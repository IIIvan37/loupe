# CLAUDE.md — Brief pour l'agent

Tu vas construire **Loupe**, un poste de travail web de transcription musicale avec séparation de pistes par IA. Ce dossier est une **spec**, pas un dépôt de code à compléter.

## Lis dans cet ordre
1. **`plan-produit.md`** — la source de vérité : vision, inventaire des fonctionnalités, analyse technique, jalons. Tout découle de là.
2. **`prototype/loupe-prototype.html`** — la référence **visuelle et d'interaction** (ouvre-le dans un navigateur).
3. **`prototype/loupe-maquette.png`** — capture du même écran si tu ne peux pas exécuter le HTML.

## ⚠️ Le prototype est un mock — ne copie pas sa logique
Le HTML reproduit l'UI et les interactions, mais **tous les traitements lourds sont simulés**. À réimplémenter pour de vrai :
- **Time-stretch / pitch** : les sliders ne font rien (pas de DSP). À brancher sur un vrai moteur (worklet).
- **Séparation** : les 5 pistes sont codées en dur. Aucun moteur n'est appelé.
- **Waveforms** : générées par bruit pseudo-aléatoire seedé, pas issues de l'audio réel.
- **Spectre** : animation aléatoire, pas une vraie FFT du signal.
- **Tonalité / BPM / accords** : texte statique, pas calculés.

Réutilise du prototype : le **layout**, les **tokens de design**, les **micro-interactions** (solo/mute, loupe de boucle, zoom, presets de tempo, onglets). Réimplémente tout le reste.

## Par où commencer : Jalon 1 (voir plan §4)
**But : un « Transcribe! dans le navigateur », 100 % client, sans backend.** C'est livrable seul et utile sans aucune IA. Ne commence PAS par la séparation.

Backlog ordonné suggéré :
1. Scaffolder le projet (**Vite + React + TypeScript** recommandé) et porter les tokens de design ci-dessous.
2. **Moteur audio** : import d'un fichier local → graphe Web Audio → rendu de la forme d'onde (wavesurfer.js v7 *ou* canvas maison).
3. **Transport** : lecture/pause/seek, raccourci Espace, tête de lecture.
4. **Time-stretch sans pitch + pitch-shift** via `AudioWorklet`. ⚠️ *décision de licence à remonter avant de coder* (voir décisions ouvertes).
5. **Marqueurs** (section/mesure/temps) + **sélection A/B de boucle au glisser** sur la waveform + boucles nommées rappelables.
6. **Zoom** de la waveform (vue défilable).

Les jalons 2 (séparation + regroupement + export), 3 (analyse + métronome intelligent) et 4 (stem→MIDI, `.band`, pédales, vidéo) viennent ensuite — détaillés dans le plan.

## Décisions déjà verrouillées
- **Architecture hybride** : tout le temps réel dans le navigateur ; seule la séparation part en cloud (API d'abord) ou tourne en WASM local. L'audio ne touche le serveur que pour la séparation.
- **Découpe en N pistes adaptatives** : on n'affiche que les instruments détectés (pas de profil 2/4/6 fixe). Détection d'instruments en amont → masquage des pistes vides.
- **Regroupement** non destructif : l'utilisateur fusionne des pistes en bus (fader/solo/mute) ; sert aussi au bucketing d'export. On garde toujours les stems individuels.
- **Export GarageBand = palier A** : dossier de stems AIFF/WAV alignés à t=0, même durée, nommés, zippés. PAS de bundle `.band` au MVP (fragile, jalon 4).
- **Analyse** via **essentia.js** (WASM, côté client) ; **stem→MIDI** via **basic-pitch** (jalon 4).
- **Partition / lecteur type Songsterr** (jalon 5) : chaîne MIDI → quantification → **notation standard** (tout instrument) puis **tablature** (assignation corde/case, guitare/basse) → MusicXML ou Guitar Pro → rendu **AlphaTab** (MPL-2.0, portée + tab affichées ensemble, synchronisé à l'audio). Sortie éditable. Ordre de livraison : MIDI → notation → tab. Commencer par basse + lignes monophoniques.
- **Séparation** : commencer par une **API tierce** (acheter), pas auto-héberger Demucs au départ.

## Décisions OUVERTES — remonte-les, ne tranche pas seul
- **Moteur de time-stretch** : Rubber Band donne la qualité « Transcribe! » mais impose **GPL ou licence commerciale** → impacte la licence du produit. Alternatives permissives : `soundtouchjs`, `signalsmith-stretch`. **À arbitrer avant le jalon 1.**
- **Quelle API de séparation** (LALAL.ai / Moises GraphQL / AudioShake). Note : l'API Moises exige une URL publique (pas d'upload direct).
- **Modèle économique** (freemium local gratuit + séparation cloud payante ?).

## Tokens de design (repris du prototype)
**Couleurs**
```
--bg:#13151C  --panel:#1A1D27  --panel-2:#21242F  --panel-3:#262A37
--line:#2C3040  --text:#E9E7E1  --dim:#8B90A3  --faint:#5A5F72
--amber:#E5A53D   /* ce qui joue / est actif / la boucle-loupe (chaleur VU) */
--teal:#56B8C9    /* ce que l'IA a DÉTECTÉ : tonalité, BPM, accords, confiance */
/* stems */ voix:#E2897A  batterie:#7C86A6  basse:#A481C9  guitare:#8DB585  claviers:#6FA8D4
```
**Règle sémantique à respecter** : **ambre = tes réglages / ce qui joue** ; **cyan = ce que la machine a détecté**. Cette distinction est centrale, ne la dilue pas.

**Typographie**
- UI / corps : **Inter**
- Toutes les données chiffrées (timecodes, BPM, tempo %, demi-tons, confiance) : **IBM Plex Mono** (chasse fixe = instrument de mesure)
- Logo uniquement : **Space Grotesk**

**Signature** : la zone de boucle est une « loupe » qui éclaire la section étudiée pendant que le reste s'assombrit. C'est l'élément à préserver (il porte le nom du produit).

## Qualité attendue
Responsive jusqu'au mobile, focus clavier visible, `prefers-reduced-motion` respecté, pas de dépendance superflue. Densité d'outil pro assumée (validée).
