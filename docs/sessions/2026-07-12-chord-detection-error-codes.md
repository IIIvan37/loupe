# Session — 2026-07-12 — chord-detection-error-codes (N.1)

## Done

- **N.1 — erreurs de détection d'accords discriminées + Lingui** (branche
  `fix/chord-detection-error-codes`, 3 commits) :
  - **Core** : `DetectChordsResult` porte `{ ok: false, code, detail }` — code
    discriminé `'no-downbeat' | 'no-chords' | 'engine-unavailable' | 'network'
    | 'timeout' | 'too-large' | 'unknown'`, `detail` = message brut réservé au
    diagnostic. Classe `ChordDetectionError(code, detail)` : le contrat typé
    qu'un adapter `ChordDetector` peut lancer ; tout autre throw se replie sur
    `unknown` (détail préservé).
  - **Adapter web** : l'interprétation du contrat transport vit UNE fois dans
    `post-wav-json.ts` (`classifyTransportError` : 503 → engine-unavailable,
    504 → timeout, 413 → too-large ; seul le `TypeError` lancé par `fetch`
    lui-même devient `network` — un TypeError de l'encodeur ne se déguise plus
    en panne réseau). `http-chord-detector` traduit en une ligne vers
    `ChordDetectionError`.
  - **Hook** : `useChordDetection.error` expose le code ; le détail brut part
    en `console.error` (jamais dans l'UI).
  - **Panneau** : `ERROR_COPY` en `Record<code, MessageDescriptor>` au niveau
    module (idiome `msg()` de `SERVER_BLOCK`) ; `network` et `no-downbeat`
    réutilisent les hints existants (`chords.detect-needs-server` /
    `chords.detect-needs-grid`) au lieu de créer des quasi-doublons catalogue ;
    la ligne d'échec complète (préfixe + copy du code) est **annoncée** dans la
    live region, pas seulement affichée.
- **/code-review** (8 angles + vérification adversariale) : 7 constats
  confirmés, tous corrigés dans le 3ᵉ commit — 504/413 typés, TypeError
  circonscrit au fetch, altitude du mapping transport, annonce a11y, map
  `msg()` hoistée, copies dédupliquées ; 1 réfuté (dérive d'union — le
  compilateur l'empêche déjà).

## Not done / remaining

- La PR N.1 est à ouvrir (voir « State to resume from »).
- `/tempo` ne consomme pas encore `classifyTransportError` : le panneau tempo
  affiche toujours la chaîne transport brute (« tempo request failed: HTTP
  503 »). Le helper partagé rend le retrofit à une ligne côté adapter + un
  mini N.1-bis côté panneau — noté comme constat de la review, à caser dans
  Lot N ou O.
- Copie `engine-unavailable` : le serveur répond 503 à la fois pour « deps ML
  absentes » et « échec de chargement des poids » ; la copy dit « non
  installé » — acceptable, à affiner seulement si ça mord.

## Decisions

- **L'interprétation des statuts HTTP du serveur d'analyse vit dans
  `post-wav-json.ts`** (`classifyTransportError`), pas dans chaque adapter —
  un adapter ne fait que traduire `TransportFailure` vers l'erreur typée de
  son port.
- Codes UI **réutilisent** la copy des états bloqués quand la situation
  utilisateur est identique (même situation ⇒ mêmes mots) ; `no-downbeat`
  reste dans le core comme défense en profondeur alors que l'UI ne peut pas
  l'atteindre (le bouton est désactivé par le même prédicat).
- La live region annonce la ligne d'échec complète (préfixe + raison
  actionnable) — parité lecteur d'écran / visuel.

## Gate status

- typecheck : ✅ (via `pnpm gate`, exit 0)
- tests (with coverage) : ✅ 986 tests (+15), web 96,4 % stmts / 90,3 % branches
- mutation (Stryker, local, core touché) : ✅ 94,92 % (seuil 80) —
  `detect-chords.ts` 40/40 mutants tués
- biome / sheriff / knip / jscpd : ✅ (react-doctor inclus ; les exports
  internes de `post-wav-json` dé-exportés suite à son signalement)

## State to resume from

- **Single next action** : pousser la branche et ouvrir la PR N.1
  (`fix/chord-detection-error-codes` → `main`), puis enchaîner sur **N.2**
  (raccourcis : toggles boucle/métronome/tap) de
  [roadmap-excellence-3](../roadmap-excellence-3.md).
- Gotchas :
  - `chords.error.network` / `chords.error.no-downbeat` n'existent plus au
    catalogue (réutilisation des ids `chords.detect-needs-*`) —
    `i18n:extract` déjà relancé, `messages.po` committé.
  - Les specs du panneau utilisent `getAllByText` pour la copy d'erreur : elle
    apparaît légitimement deux fois (ligne visible + live region).
  - Dependabot PR #53 reste reportée (breaking Babel→oxc, gate rouge — décision
    STATUS inchangée).
