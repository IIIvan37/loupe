# Releasing loupe (route 2 — binaire)

Le pipeline (D5) tient en un tag : `release.yml` construit le binaire sur
3 OS, publie la GitHub Release (archives + `SHA256SUMS` + formule Homebrew)
et pousse la formule au tap quand le secret est configuré.

## Publier une version

1. **Bump** `version` dans `crates/loupe-server/Cargo.toml` (c'est LA
   version : le workflow refuse un tag qui ne lui correspond pas, et
   `loupe --version` l'affiche). Passer par une PR normale.
2. **Tagger le main mergé et vert** (la release ne rejoue pas les tests —
   c'est la CI de main qui fait foi) :

   ```sh
   git tag v0.1.0 && git push origin v0.1.0
   ```

3. Le workflow produit : `loupe-vX.Y.Z-aarch64-apple-darwin.tar.gz`,
   `…-x86_64-unknown-linux-gnu.tar.gz` (buildé sur ubuntu-22.04 pour une
   glibc large), `…-x86_64-pc-windows-msvc.zip`, `SHA256SUMS`, `loupe.rb`.

## Canaux d'installation

- **brew (macOS arm64 / Linux x64)** — une fois le tap en place :
  `brew tap iiivan37/loupe && brew install loupe`.
- **Archive brute** (Windows d'abord) : télécharger depuis la Release,
  extraire, lancer `loupe`. SmartScreen : « Informations complémentaires →
  Exécuter quand même » (documenté pour la beta ; winget si demande).

## Mise en place du tap (une fois)

1. Créer le dépôt public `IIIvan37/homebrew-loupe` (vide suffit).
2. Créer un fine-grained PAT limité à ce dépôt (permission Contents:
   read/write) et l'ajouter comme secret **`HOMEBREW_TAP_TOKEN`** du dépôt
   loupe. Sans le secret, l'étape tap est sautée et la formule reste
   disponible en asset de Release (installable via
   `brew install --formula <fichier>`)

## Notification de version

Au démarrage, le binaire interroge (best-effort, thread séparé)
`api.github.com/…/releases/latest` et affiche une ligne si une version
strictement plus récente existe — pas d'auto-update : re-télécharger le
fichier EST la mise à jour en beta. Opt-out : `LOUPE_NO_VERSION_CHECK=1`.
