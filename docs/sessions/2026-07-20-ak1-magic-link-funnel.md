# Session — Lot AK.1 : le funnel magic-link ne perd personne

**Date** : 2026-07-20
**Branche** : `feat/ak1-magic-link-funnel` (part de `main`)
**Roadmap** : [feuille de route v7](../roadmap-excellence-7.md) § Lot AK

## Contexte

Premier lot du « premier contact » (AK). AK.1 enrichit l'état « lien envoyé » du
magic-link et **reprend automatiquement l'analyse gatée après connexion** — les
deux dans une PR (checkpoint validé).

## Partie A — état « lien envoyé » enrichi (`AccountMenu`)

Avant : une seule ligne statique (`account.link-sent`). Après :
- **Adresse affichée** : « Lien de connexion envoyé à {sentTo}. » (id
  `account.link-sent-to`, placeholder **nommé** via une variable — un
  `email.trim()` inline s'extrairait en `{0}`).
- **Mention spam** : « Ouvrir l'email pour continuer — penser aux spams. »
- **« Renvoyer » + cooldown 30 s** (`account.resend-in` « Renvoyer dans
  {secondsLeft} s », désactivé pendant le décompte ; Supabase rate-limite déjà
  l'email ~2/h, le cooldown client évite de le cramer). Nouveau hook
  **`useCountdown`** (`app/ui/`, modèle `use-two-step-confirm` : timer en ref,
  nettoyé à zéro et au démontage ; 4 tests).
- **« Changer d'adresse »** (`account.change-email`) → `resetLink()` neuf sur
  `useAuth` (repasse `linkPhase` à `idle`, email préservé pour corriger).
- Un seul chemin `send(address)` (submit **et** resend) → arme toujours le
  cooldown.

## Partie B — reprise auto de l'analyse gatée après connexion

Avant : un `detect()` bloqué au gate posait un `gateReason`, ouvrait le menu, et
l'utilisateur devait **re-cliquer**. Après :
- `AccountMenu` gagne `onSignedIn` — tiré **une fois** à la transition
  signed-out → signed-in (ref `wasSignedIn` écrite dans l'effet, pas au mount).
- `AccountMenuSlot` le relaie en `onResumeAfterSignIn` (prop optionnelle), tissé
  `WorkstationShell → ShellHeader → slot`.
- Côté shell, hook **`useResumeGatedAnalysis`** : rejoue chaque flux encore
  porteur d'un `gateReason` (structure/accords via `detect()`, tempo via
  `retry()`, séparation via `separateAndLoad`) — typiquement celui cliqué. No-op
  si rien n'était bloqué (menu ouvert à la main). Après connexion : si membre →
  l'analyse part ; sinon le gate re-bloque en `not-a-beta-member` et le funnel
  enchaîne sur le code beta.

## Budget react-doctor

`WorkstationShell` repassait > 300 lignes → extraction de **`useStemStack`**
(stemPlayback + separation + mixer + `stemsReady`/`stemsActive`, comportement
inchangé) ; composant à **294 lignes**.

## Tests / gate

Specs `account-menu` étendus (adresse, cooldown+resend, changer d'adresse,
reprise une-seule-fois) — le test cooldown est en **fake timers + `fireEvent` +
`advanceTimersByTimeAsync` dans un try/finally** (un `findBy` async sous fake
timers se bloquerait sur son propre timer de polling, et un timeout fuiterait
les fakes dans les tests suivants). `useCountdown` : 4 tests.
Gate **verte — 1925 tests** (+15), react-doctor clean, typecheck 0. Stryker
skippé (core intouché).

## Vérification

Comportement couvert par unités (transition sign-in tirée une fois ; cooldown
qui décompte et libère ; resend ; changer d'adresse). La reprise bout-en-bout
(clic → connexion → l'analyse repart) est câblée + couverte par morceaux ; le
parcours réel (magic link e-mail + Modal) reste à browser-vérifier à la beta.

## Reste du Lot AK

**AK.2** (empty-state qui vend), **AK.3** (import URL au niveau du fichier dans
le hero — à concilier avec le gating desktop-only d'AJ.3), **AK.4** (divulgation
beta amont + waitlist quand le code manque).
