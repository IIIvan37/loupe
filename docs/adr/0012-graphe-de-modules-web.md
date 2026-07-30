# ADR 0012 — Le web déclare son graphe de modules ; chaque arête est une décision

- **Statut** : accepté
- **Date** : 2026-07-30

## Contexte

Pour Sheriff, `packages/web/src` était **un seul module** (`web`), avec une
unique règle : `web → core:api`. Toute la structure interne — 18 dossiers de
feature sous `app/`, les adaptateurs `audio/`, `auth/`, `projects/`, le kit
`ui/layout/lib/i18n` — vivait sans frontière vérifiée, alors que le core, lui,
a son DAG déclaré depuis l'[ADR 0005](0005-modules-emergents.md).

La revue d'architecture (2026-07-29) a mesuré le coût : **trois cycles de
features**, nés exactement comme ceux du core avant lui — un savoir mal placé
par arête :

- `mixer ↔ tempo` : le métronome pilote le mixer (`use-metronome` charge des
  stems), mais `mixer/synthetic-stem.ts` importait `METRONOME_ID` depuis tempo.
- `mixer ↔ waveform` : le transport lit l'état du moteur stems
  (`stemsActiveAtom`), mais `stem-lanes` importait `WaveformCanvas` depuis
  waveform.
- `audio ↔ auth` : les adaptateurs consomment la crédential (`analysis-token`
  importait `appAuth`), mais `use-auth` importait `clearAnalysisToken` et
  `onAnalysisUsage` depuis audio — et `tauri-env.ts`, un discriminant
  d'environnement, vivait dans `auth/`.

Le chantier ADR [0010](0010-etat-de-vue-atomes-par-feature.md)/[0011](0011-shell-layout-contexte-session-audio.md)
aggrave la pression : chaque feature possède désormais ses atomes, **lus par
d'autres features sans prop threading** — précisément le genre d'arête qui,
sans direction déclarée, devient un cycle. La revue a acté : ne pas casser les
cycles au fil de l'eau, la direction de chaque arête est une décision d'ADR.

## Décision

**Le web adopte le mécanisme du core** : le graphe de modules est un DAG
déclaré dans `sheriff.config.ts`, une arête inter-features = une ligne
explicite de `depRules`, visible en revue. Placeholder dormant
`packages/web/src/app/<feature>` → tag `web:feature:<feature>` : un nouveau
dossier de feature est taggé dès qu'il existe, sans édition de config.

### Les strates (de haut en bas)

```
web (main.tsx, composition)
  └─ workstation-shell (racine de composition : voit toutes les features)
       └─ features (mixer, tempo, waveform, …) + projects
            └─ audio-session (le seam de session, ADR 0011 — ne dépend de rien)
                 └─ audio (adaptateurs) → auth (identité) → …
                      └─ kit : ui → layout → lib · i18n → locales
```

Toute strate voit le kit (`ui`, `layout`, `lib`, `i18n`) et `core:api` ; rien
ne remonte.

### Les trois arbitrages (un par cycle)

1. **`tempo → mixer`** — le métronome et le count-in sont des *clients* du
   mixer : ils y chargent des stems. Le mixer, lui, possède **l'identité de
   ses lanes synthétiques** : `METRONOME_ID` rejoint `TRACK_STEM_ID` dans
   `mixer/synthetic-stem.ts` (la source de vérité « quels canaux ne sont pas
   de vrais stems »). Le mixer n'importe jamais tempo.
2. **`waveform → mixer`** — le transport lit l'état du moteur stems
   (`stemsActiveAtom`) pour choisir son moteur : c'est la lecture d'atome que
   l'ADR 0010 institue. Le canvas que les lanes du mixer réutilisent
   (`WaveformCanvas`, un composant dumb : un type du core + un canvas) n'est
   pas un savoir de la feature waveform — il rejoint le kit (`app/ui`). Le
   mixer n'importe jamais waveform.
3. **`audio → auth`** — les adaptateurs consomment la crédential, jamais
   l'inverse. Le jeton d'analyse est un **artefact de compte** : minté par
   l'Edge Function du compte, gaté beta, métré au quota, mort au sign-out —
   `analysis-token.ts` vit donc dans `auth/`, et `use-auth` le consomme en
   voisin de module. `tauri-env.ts`, discriminant d'environnement sans rapport
   avec l'identité, descend dans `lib/`. Auth ne dépend de rien au-dessus de
   `lib`.

### Arêtes sanctifiées (chacune une ligne de config)

`tempo → mixer` (le click pilote le mix) · `waveform → mixer` (lecture 0010)
· `waveform → loops` (speed trainer) · `mixer → stems` (couleurs) ·
`markers → lead-sheet` · `lead-sheet → stems, desktop` · `projects → tempo`
(`DEFAULT_METRONOME_CHANNEL`, un défaut produit du métronome) ·
`audio → audio-session` (l'adaptateur importe le **type** de port que le seam
déclare — DIP, interface définie côté consommateur ; la feuille « interface
étroite de session » la formalisera).

## Conséquences

- Un cycle de features web est désormais une **erreur de gate**
  (`check:arch`), plus une trouvaille de revue d'architecture. La liste de
  violations redevient l'instrument de découverte (ADR 0005) : un savoir mal
  placé coûte deux minutes le jour où il naît.
- Chaque nouvelle arête inter-features exige une ligne de `depRules` — un
  choix visible en revue, plus un import silencieux.
- Coût : une liste de règles verbeuse à tenir (≈25 lignes), et le déménagement
  de trois fichiers (`analysis-token`, `tauri-env`, `waveform-canvas`) qui
  churne ~25 imports. Accepté : c'est le prix d'un graphe honnête.
- `projects → tempo` reste une arête étrange (un store qui lit un défaut de
  feature) — déclarée plutôt que cachée ; candidate à disparaître si le défaut
  descend un jour dans le core.
- Le shell (`workstation-shell`) garde le droit de tout voir : c'est la racine
  de composition, son privilège est le pendant du devoir des feuilles 0010
  (posséder leur état).

## Alternatives envisagées

- **Garder `analysis-token` dans `audio/` et casser `auth → audio` par un
  événement** (`onSignOut` exposé par le port, souscrit côté audio ; usage
  quota remonté par callback injecté). Rejeté : deux indirections pour éviter
  un déménagement, et l'affichage du quota est de toute façon un concern de
  compte — le fichier était simplement né du mauvais côté.
- **Injecter `stemsActive` dans `use-player` en argument** pour garder
  `waveform` sans dépendance sur `mixer`. Rejeté : c'est réintroduire le prop
  threading que l'ADR 0010 vient de supprimer ; la lecture d'atome inter-
  feature est légitime, seule sa direction devait être décidée.
- **Statu quo (un seul module `web`) + revue humaine.** Rejeté par les faits :
  le DAG implicite était réel, écrit nulle part, et trois cycles sont nés
  quand même — la préhistoire exacte de l'ADR 0005 côté core.
- **Un outil dédié (dependency-cruiser, nx graph).** Sheriff est déjà la
  source de vérité des frontières du dépôt ; un second outil = une seconde
  config qui dérive. Rejeté.
