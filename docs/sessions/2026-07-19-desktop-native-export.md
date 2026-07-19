# Session — 2026-07-19 — export natif desktop (solde AH.1)

## Done

- **Les exports fichiers marchent sur l'app de bureau** (zip des stems au
  header, WAV par piste/stem/métronome au mixer) — le disable AH.1 est levé
  sur ces boutons ; **l'impression reste désactivée avec hint** (chantier
  distinct, `window.print()` sans délégué WKWebView ;
  `exportsUnavailableOnDesktop` → `printUnavailableOnDesktop`).
- **Flux en DEUX temps, dialogue d'abord** (décision issue de la mesure, cf.
  Learnings) : `pick_export_path(name)` — payload minuscule → le NSSavePanel
  s'ouvre instantanément, **parenté à la fenêtre** (un panel orphelin peut
  s'ouvrir DERRIÈRE — « il ne se passe rien ») ; le chemin choisi reste côté
  Rust derrière un **jeton opaque** ; puis `write_export` (octets + jeton en
  header) — Rust écrit, jeton consommé. Le webview ne nomme jamais un chemin
  et ne gagne **aucun droit fs** (deny scope AC.2 intouché) ;
  `sanitize_file_name` neutralise séparateurs/contrôles du nom suggéré.
- **Web** : seam `deliverFile(name, blob)` — navigateur = ancre `downloadBlob`
  (inchangé), shell = pick/write ; échec → `false` + console.error (jamais un
  toast mensonger, jamais une rejection muette). `useSeparation.downloadStem`
  passe async ; toasts d'export conditionnés à la livraison réelle ; un
  export de zip supplanté (reset pendant le dialogue) ne confirme pas.
- **Tests** : cargo **8/8** (sanitize, corps Raw|Json), web **1950** (+6 :
  deliver-file 4, use-stem-export 2 ; stem-headers inversé — bouton ACTIF
  sous Tauri ; specs separation/project-session mis à l'async).
- **Vérifié en bundle release** (utilisateur) : dialogue immédiat au premier
  plan, Enregistrer → toast + fichier, Annuler → silence, save projet OK.

## Learnings — mesures IPC (self-test temporaire, pattern T2.2)

| Contexte | writeFile 42 MB one-shot | Notes |
|---|---|---|
| `tauri dev` (http 5173) | **46 ms** | chunks FileHandle 4 MB : 13,9 s (300×) |
| bundle **debug** | 11,7 s (~3,6 MB/s) | corps raw d'invoke parfois reçu **Json** |
| bundle **release** | 5,1 s (**~8 MB/s**) | write_export 42 MB : 7,2 s |

- **Le transport IPC du webview bundlé plafonne à ~8 MB/s** (release) — d'où
  le dialogue-d'abord, et pourquoi on n'envoie JAMAIS un gros corps avant un
  feedback. Les chunks FileHandle sont PIRES (overhead par appel) — ne pas
  « optimiser » par là.
- Le corps brut d'un invoke n'est **pas garanti Raw** en bundle :
  `body_bytes` accepte Raw **ou** tableau JSON.
- `tauri dev` ment sur ces coûts (46 ms vs 5 s) — toute mesure de transfert
  se fait **en bundle release**.
- Le gel « Enregistrer le projet » vu en debug = même plafond (WAV ~42 MB
  via plugin-fs) ; en release ~5 s, narré par le chip busy R.4. Le « Load
  failed » initial venait d'un test dans la mauvaise app (single-instance :
  une instance fantôme de `tauri dev` détenait le socket
  `/tmp/dev_iiivan_loupe_si.sock` et faisait s'auto-fermer les lancements
  du bundle — tuer `target/debug/app` avant de tester un bundle).

## Not done / remaining

- **Chip « Serveur hors ligne » mensonger en mode offload** (vu à la vérif) :
  le header sonde toujours la santé du serveur LOCAL retiré en T2.5 alors que
  l'analyse vit sur Modal (jamais sondé — X.1). Petite slice dédiée à cadrer :
  masquer le chip en offload, ou le rebrancher sur `useOnline` — checkpoint
  produit d'abord.
- Impression sous Tauri (print natif webview) — chantier dédié.
- Zip stems ~230 MB ⇒ ~29 s de transfert : la busy line R.4 narre, mais pas
  de % réel — suivi possible (progress par tranches) si ça mord en beta.
- Cold path : `write_export` échoué = console.error sans surface UI (rare :
  disque plein) — à surfacer si ça mord.

## Decisions

- Écriture des exports **côté Rust** (dialogue + fs), jamais d'élargissement
  du scope fs webview — validé checkpoint.
- Dialogue AVANT transfert, jeton opaque pour le chemin.
- Impression exclue de la slice — validé checkpoint.

## Gate status

- typecheck / biome / sheriff / knip / jscpd : ✅ (`pnpm gate` exit 0)
- tests (with coverage) : ✅ **1950 tests** (+6)
- cargo : **8/8**, clippy propre, fmt OK
- mutation (Stryker) : **skippé — core intouché** (adapters web + Rust only)
- i18n : catalogue ré-extrait (2 ids « bientôt disponible » export supprimés,
  `chords.print-desktop-soon` conservé)

## State to resume from

- **Single next action** : ouvrir la PR de cette branche
  (`feat/desktop-native-export`) si pas déjà fait ; ensuite, garde-fous beta
  restants (plafond Modal dashboard, re-seed codes legacy, PKCE en bundle).
- Gotchas : mesurer tout transfert IPC en **bundle release** ; tuer les
  instances `target/debug/app` avant de lancer un bundle (socket
  single-instance) ; le selftest IPC (non commité) se recrée depuis le
  rapport de cette session au besoin.
