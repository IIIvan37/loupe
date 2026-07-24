# Session — 2026-07-11 — detect-chords-ui (Lot C, slice web — FIN DU LOT)

## Done
- **Adapter `createHttpChordDetector`** (`packages/web/src/audio/`, miroir de
  `http-tempo-detector`) : mix → WAV → POST `/chords` → validation de forme →
  **traduction mir→tokens de grille** (`A#:min`→`A#m`, `D:maj`→`D`,
  `G:7`→`G7`, `N`/`X`→`undefined` = silence) — le core ne voit jamais la
  syntaxe moteur, comme promis au contrat du port.
- **Hook `useChordDetection`** (smart, lead-sheet) : exécute le use-case
  `detectChords` (audio chargé + grille tempo + `barsPerRow` du panel), landa
  le brouillon via `onDraft` = `chordChart.setSource` — la détection persiste
  **comme une édition manuelle** (signée à la sauvegarde). Jeton de run
  monotone : un résultat tardif après remplacement de piste est jeté (pattern
  prev-prop inline, exigé par react-doctor — pas d'effet qui synchronise un
  état sur une prop).
- **Hook `useChordChartSession`** : regroupe source de grille + détection en
  une surface pour le shell (cohésion, et garde `WorkstationShell` sous le
  seuil des 300 lignes de react-doctor).
- **Panel** : bouton « Détecter les accords » entre la lead-sheet et
  l'éditeur — **confirmation deux temps** (« Remplacer la grille ? », pattern
  maison `useTwoStepConfirm`) quand la source n'est pas vide ; désactivé avec
  **hint actionnable** (serveur non prêt → « Lancer le serveur local… » ;
  pas de grille → « Détecter d'abord le tempo… ») ; états annoncés en
  `LiveStatus` (détection en cours / grille pré-remplie / erreur), erreur
  visible en ligne. Copy Lingui (ids `chords.detect*`), catalogue extrait.
- **Câblage shell** : bouton bloqué seulement si serveur `offline`/`checking`
  ou grille sans downbeat (`blockedReason`, seule source — le panel en dérive
  le `disabled`). Port `chordDetector` injectable dans les tests du shell.
- **Revue interne (2 finders) appliquée** :
  - 🐛 **gating santé corrigé** — `ready` signifie « moteur de séparation
    présent » or `/chords` tourne en CPU dès que le serveur répond ; l'état
    `no-separation` bloquait à tort une feature fonctionnelle avec un hint
    mensonger ;
  - 🐛 changement de piste : `error`/`succeeded` périmés purgés (sinon fausse
    annonce « Grille pré-remplie » au remount du panel sur la piste suivante) ;
  - erreur affichée/annoncée en **français catalogue** (« Échec de la
    détection des accords — {détail brut} »), le live region ne parle jamais
    l'anglais moteur ;
  - squelette POST-WAV→JSON partagé (`post-wav-json.ts`) entre les adapters
    tempo et chords (le prochain changement de protocole atterrit une fois) ;
  - `.hint`/`.error` promus dans `controls.module.css` (compose) — les 3
    copies existantes migreront au fil des retouches ;
  - traduction des renversements grand-vocabulaire durcie
    (`C:maj/3` → `C/3`, la basse survit au mapping de qualité) ;
  - `canDetect` supprimé (dérivable de `blockedReason` — plus de double
    calcul divergeable dans shell-main).

## Not done / remaining
- Vérif navigateur du parcours complet (import → tempo → détecter → brouillon)
  — réservée aux cas que les tests n'atteignent pas (convention) ; le smoke
  serveur réel + les specs adapter/hook/panel couvrent chaque couture. À faire
  si un doute émerge à l'usage.
- Différés du plan : overlay accords sur la waveform (secondaire), interop
  ChordPro (Lot D), grand vocabulaire (`voca=True`).

## Decisions
- La détection **écrase la source après confirmation deux temps** (pas de
  dialog) — pattern maison, un clic de moins, hésitation auto-annulée.
- Message « préparation du modèle » non implémenté : le premier appel
  télécharge ~33 Mo côté serveur, l'UI reste sur « Détection des accords… »
  (l'état occupé suffit ; à affiner si la latence one-shot gêne).
- `barsPerRow` du brouillon = le réglage courant du panel (le rendu et le
  texte s'alignent).

## Gate status
- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅
  (gate exit 0)
- tests (with coverage) : ✅ **925 tests** (+19 sur la slice web)
- mutation (Stryker) : non applicable — aucun changement `@app/core`.

## State to resume from
- **Single next action** : merger la PR de cette slice — **le Lot C
  chord-charts est alors COMPLET** (A/B socle + persistance + transposition +
  sync lecture + détection ACE bout-en-bout). Ensuite : prochain chantier au
  choix (veille : overlay accords waveform, ChordPro, export MIDI J4…).
- Gotchas : le hint « serveur requis » s'affiche pendant `offline` ET
  `checking` (premier rendu) — voulu (pas de promesse tant que le serveur n'a
  pas répondu) ; l'état `no-separation` n'est PAS bloquant pour les accords. Le premier `/chords` d'un hôte télécharge
  les poids (~33 Mo) : latence one-shot côté serveur.
