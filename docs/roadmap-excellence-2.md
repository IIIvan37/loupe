# Feuille de route — excellence, 2ᵉ passe

> **But.** Issue de l'évaluation notée du **2026-07-06** (six axes : fonctionnalités,
> accessibilité, UX/UI, design, qualité de code, sécurité), menée après clôture de
> la [première feuille de route](roadmap-excellence.md) (Lots A–E ✅) et du Lot B
> tempo (PR #67/#68). Note globale : **15,3 / 20** — le fossé n'est plus structurel,
> c'est une liste finie de finitions identifiables.
>
> **Séquencement.** ⚠️ **Ces lots démarrent après la clôture de la fonctionnalité
> en cours** : le plan de détection de tempo
> ([tempo-detection-plan.md](tempo-detection-plan.md)) doit d'abord se terminer par
> son **Lot C (tempo-map — tempo variable)**. On ne laisse pas un plan ouvert pour
> en commencer un autre. Ensuite : chaque slice = une branche = une PR +
> `/session-report`, gate verte, mutation si le cœur est touché, browser-verify
> pour toute slice UI.

## Notes par axe (2026-07-06)

| Axe | Note | Tendance vs 2026-07-05 |
|---|---|---|
| Qualité de code | **17,5** | ↑ (serveur discipliné, use-player splitté) |
| Design | **16** | ↑↑ (C.3–C.5 : tokens, boutons, motion) |
| Accessibilité | **15** | ↑ (nouveau critère, base très saine) |
| UX/UI | **15** | ↑↑ (C.1/C.2, D.2/D.3 : DnD, feedbacks, health) |
| Sécurité | **14,5** | ↑↑ (Lot A tient — 1 trou critique restant) |
| Fonctionnalités | **14** | ↑ (tempo downbeats/mesure/octave, métronome) |

---

## Lot F — Hygiène immédiate *(~1 session, à faire en premier)*

> Quatre dettes dont trois créées ou ratées par nos propres lots récents.
> Serveur + docs, aucun risque produit.

### F.1 — Cap du body `/download` *(🔴 critique sécu)*
- **Constat.** [download.py:185](../server/app/download.py#L185) :
  `await request.json()` bufferise le corps entier — le **seul** endpoint à body
  qui a échappé aux caps du Lot A (2026-07). Une page tierce peut poster des Go →
  DoS mémoire.
- **Faire.** Lire via `read_capped_body(request, MAX_MANIFEST_BYTES)` puis
  `json.loads` ; test pytest body > cap → 413.

### F.2 — Semaphore d'inférence sur `/tempo` *(🟠 haute sécu)*
- **Constat.** [tempo.py:105](../server/app/tempo.py#L105) : `run_in_threadpool`
  sans borne → jusqu'à ~40 inférences beat_this parallèles, là où `/separate` est
  sérialisé ([separation.py:95](../server/app/separation.py#L95)).
- **Faire.** Même `BoundedSemaphore` que `/separate` (env-tunable) ; test.

### F.3 — Resynchroniser les deux README menteurs
- **Constat.** [server/README.md](../server/README.md) (l. 4, 71) documente encore
  **librosa** et le contrat plat `beats: [seconds]` — faux depuis PR #67/#68
  (beat_this, contrat enrichi `[{time, position}]`).
  [packages/core/src/application/README.md](../packages/core/src/application/README.md)
  décrit `detectTempo` avec l'ancien comptage 4/4 ; `foldTempoOctave` absent.
- **Faire.** Mettre les deux à jour avec le contrat/les exports réels.

### F.4 — Extraire `_load_mono` du fichier omis
- **Constat.** [tempo.py:74-84](../server/app/tempo.py#L74-L84) : décodage WAV
  16-bit + fold mono en numpy pur — logique décidable planquée dans le module
  exclu de coverage + pyright, contraire à la convention humble-object du
  [server/README.md](../server/README.md). (`separation.py` a le même `_load`…
  à traiter si le partage est naturel.)
- **Faire.** Module torch-free (p. ex. `wav_decode.py`), testé, pyright-checké ;
  `tempo.py` l'importe.

---

## Lot G — Confiance utilisateur *(~1 session)*

> Les trois frictions UX à plus fort impact, toutes web-only.

### G.1 — Confirmation sur suppression repère/boucle *(la brèche « pas d'undo »)*
- **Constat.** [analysis-panel.tsx:213-219](../packages/web/src/app/analysis/analysis-panel.tsx#L213-L219) :
  `onClick={onRemove}` direct sur les lignes repères **et** boucles — destructif,
  irréversible, incohérent avec la suppression de projet (two-step,
  [projects-dialog.tsx:205-223](../packages/web/src/projects/projects-dialog.tsx#L205-L223)).
  Seule vraie brèche dans la décision documentée « pas d'undo/redo ».
- **Faire.** Réutiliser `useTwoStepConfirm` sur les `EntryRow` (même pattern
  relabel-le-même-bouton, focus préservé).

### G.2 — Sortir des culs-de-sac d'erreur (import, tempo)
- **Constat.** Échec d'import : message brut non traduit
  ([use-player.ts:199-202](../packages/web/src/app/waveform/use-player.ts#L199-L202)),
  l'empty-state disparaît, aucun « Réessayer ». Échec tempo : erreur affichée sans
  bouton ([tempo-panel.tsx:90-94](../packages/web/src/app/tempo/tempo-panel.tsx#L90-L94)),
  détection non re-déclenchable sans réimport — contrairement à la séparation qui
  offre « Réessayer ».
- **Faire.** Message d'import traduit + CTA réimport dans le stage d'erreur ;
  bouton « Réessayer » sur l'échec tempo (re-lance `detect`).

### G.3 — Feedback sur drop non supporté
- **Constat.** [use-file-drop.ts:60-71](../packages/web/src/app/workstation-shell/use-file-drop.ts#L60-L71) →
  `pickAudioFile` renvoie `undefined` → rien. Déposer un `.pdf` ne produit aucun
  signal.
- **Faire.** Bannière/toast « Format non supporté » quand le drop ne contient
  aucun fichier audio.

---

## Lot H — A11y des opérations longues *(~½ session)*

### H.1 — Annoncer séparation et détection tempo aux lecteurs d'écran
- **Constat.** Le bloc de progression séparation
  ([separation-panel.tsx:99-109](../packages/web/src/app/separation/separation-panel.tsx#L99-L109))
  et l'état « Analyse… » tempo ne sont dans **aucune région live** — l'opération la
  plus longue de l'app est invisible pour NVDA/VoiceOver. Le plus gros gain
  lecteur d'écran du projet pour quelques lignes.
- **Faire.** `role="status"` (annonces d'étape, pas le pourcentage en continu —
  éviter le spam) sur les deux blocs ; annoncer aussi l'arrivée du BPM détecté.

---

## Lot I — Le manque produit n° 1 : pratique du tempo *(~2–3 sessions)*

> L'axe le moins noté (fonctionnalités 14/20). Ces trois-là sont ce qu'un musicien
> attend d'un outil de *pratique* (Moises, Transcribe!, AnyTune les ont tous).
> S'articule naturellement après le Lot C tempo-map du plan en cours.

### I.1 — Speed trainer (rampe de tempo par boucle)
- **Constat.** Aucun mécanisme d'incrément automatique ; plancher tempo à 50 %
  ([playback-rate.ts:6](../packages/core/src/domain/playback-rate.ts#L6)) trop haut
  pour le repiquage fin.
- **Faire.** Slice hexagonale : politique pure de rampe (départ %, incrément %,
  toutes les N répétitions de la loupe, plafond) dans `core` — la détection de
  wrap existe déjà ([use-transport-engines.ts:75-90](../packages/web/src/app/waveform/use-transport-engines.ts#L75-L90)) ;
  UI dans les contrôles de boucle. Évaluer l'abaissement du plancher (SoundTouch
  descend sous 50 % — vérifier la qualité).

### I.2 — Tempo manuel : tap-tempo + saisie BPM + calage de phase
- **Constat.** BPM 100 % detection-only : ni tap, ni saisie, ni décalage de la
  grille ; l'octave ±2 ([use-tempo.ts:13](../packages/web/src/app/tempo/use-tempo.ts#L13))
  est le seul recours si la détection se trompe autrement.
- **Faire.** `setBpm`/`nudgePhase` purs (reconstruisent la grille), tap-tempo
  (médiane des intervalles de frappe — le domaine a déjà la primitive côté
  serveur), champ BPM éditable dans le TempoPanel. L'override devient signé dans
  `sessionSignature` (c'est un réglage utilisateur, contrairement au dérivé).

### I.3 — Count-in du métronome
- **Constat.** [metronome.ts](../packages/core/src/domain/metronome.ts) synthétise
  un clic continu aligné ; aucun décompte avant le point de lecture / la boucle.
- **Faire.** Pré-roll d'une mesure (clics + départ différé) au lancement de la
  lecture quand le métronome est actif — pur dans `core` (une grille prépendée),
  seating dans l'adaptateur.

---

## Lot J — Fond de panier *(à intercaler, chacun ≤ ½ session)*

- **J.1 — Token `--danger`** : le rouge d'erreur est littéralement
  `--stem-vocals`, et les pastilles santé serveur détournent `--stem-guitar` en
  vert « OK » ([header.module.css:96-104](../packages/web/src/app/header/header.module.css#L96-L104)).
  Introduire `--danger`/`--ok` sémantiques ; au passage tokeniser le scrim
  (0.55 vs 0.6 incohérents) et `--disabled-opacity`.
- **J.2 — États `:active`** : zéro `:active` dans tout le CSS — retour
  d'enfoncement sur les boutons du transport/header au minimum.
- **J.3 — Quota disque blobs** (🟠 sécu) : le GC ne réclame que les orphelins,
  jamais le total ([projects.py:171](../server/app/projects.py#L171)) — plafond
  configurable (taille totale de `~/.loupe/audio`), refus au-delà.
- **J.4 — Dédupliquer les moteurs Web Audio** : 32 lignes clonées entre
  [web-audio-playback.ts](../packages/web/src/audio/web-audio-playback.ts) et
  [web-audio-stem-playback.ts](../packages/web/src/audio/web-audio-stem-playback.ts),
  hors de tout filet de test, alors que `web-audio-shared.ts` existe.
- **J.5 — Annulation des opérations longues** : aucun « Annuler » (séparation,
  download, export) — `AbortController` à threader dans les adaptateurs HTTP.

---

## Veille (décisions, pas des oublis)

- **Boucle échantillon-exacte / crossfade** — le wrap actuel est un seek-arrière
  (micro-gap possible). Coûteux (toucher aux moteurs) ; à faire si l'usage le
  réclame.
- **Locale EN** — l'infra Lingui est prête, seul `fr` existe. À faire si le
  produit sort du cercle francophone.
- **Chemin clavier pour créer une boucle A/B** — le drag n'a pas d'équivalent
  clavier ([waveform-view.tsx:218-227](../packages/web/src/app/waveform/waveform-view.tsx#L218-L227)) ;
  design non trivial (mode « sélection » au clavier ?), à concevoir avant de coder.
- **Thème clair** — sombre unique aujourd'hui ; décision produit à prendre, la
  tokenisation rendrait la migration mécanique mais volumineuse.
- **Détection de tonalité (key), export MIDI, spectrogramme** — le trio
  « transcription » (Jalon 4) ; l'onglet « Spectre »/« Notes » placeholders les
  attendent. Gros chantiers, hors de cette passe.
- **Undo/redo** — reste en veille (décision 2026-07-06, cf. roadmap 1 § D.1) ;
  G.1 ferme la seule vraie brèche.

---

## Ordre recommandé

0. **Clore le plan tempo en cours** — Lot C tempo-map
   ([tempo-detection-plan.md](tempo-detection-plan.md)). *Prérequis à tout.*
1. **F** — hygiène (cap `/download`, semaphore `/tempo`, README ×2, `_load_mono`).
2. **G** — confiance (two-step suppression, culs-de-sac d'erreur, drop muet).
3. **H** — a11y des opérations longues.
4. **I** — pratique du tempo (speed trainer, tap/BPM manuel, count-in).
5. **J** — fond de panier, à intercaler.

### Suivi

- [ ] Lot C tempo-map (plan précédent — prérequis)
- [ ] F.1 · [ ] F.2 · [ ] F.3 · [ ] F.4
- [ ] G.1 · [ ] G.2 · [ ] G.3
- [ ] H.1
- [ ] I.1 · [ ] I.2 · [ ] I.3
- [ ] J.1 · [ ] J.2 · [ ] J.3 · [ ] J.4 · [ ] J.5
