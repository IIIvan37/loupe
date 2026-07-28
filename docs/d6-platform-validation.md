# D6 — validation plateformes (Linux + Windows)

Le risque webview a disparu (loupe sert l'UI dans le navigateur système) ;
restent **yt-dlp**, les **chemins**, les **ports** et, sur Windows, le
**pare-feu** et **SmartScreen**. Cette checklist se remplit en lançant le
binaire dans une VM.

## Récupérer les binaires (sans release publique)

Le pipeline sait produire les binaires sans publier de Release :

```sh
gh workflow run release.yml --ref main
gh run watch                       # attendre la fin
gh run download <run-id> --dir loupe-bin   # un binaire brut par cible
```

Un dispatch livre le **binaire brut** (pas d'archive) : `gh run download`
dépose `loupe-<cible>/loupe` (ou `loupe.exe`), directement exécutable — pas
de zip-dans-zip (GitHub emballe déjà tout artefact de run dans un zip au
téléchargement). Les archives de distribution (`.tar.gz`/`.zip`) ne sont
fabriquées que sur un tag, dans le job `release`. Cibles :
`x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`.

**Note d'architecture** : les VMs de test sont en ARM64, la distribution vise
le x64. Windows 11 ARM **émule x64 nativement** — le test y est fidèle.
Ubuntu ARM64 n'exécute un binaire x64 que via `qemu-user-static`
(`sudo apt install qemu-user-static`) ; le sous-process yt-dlp x64 y sera lent
— la cible ARM64 Linux native reste à ajouter si l'on veut un test propre
(différé, cf. plan D6).

## Windows 11 (émulation x64)

- [ ] **SmartScreen** : au premier lancement du `.exe` extrait → « Windows a
      protégé votre ordinateur » → *Informations complémentaires* → *Exécuter
      quand même* (binaire non signé, attendu en beta).
- [ ] **Pas de prompt pare-feu** attendu : loupe bind `127.0.0.1` (loopback),
      Windows ne prompte que pour les binds publics. Consigner si un prompt
      apparaît quand même.
- [ ] **Démarrage** : `loupe.exe` affiche l'URL, ouvre le navigateur par
      défaut, `/health` répond.
- [ ] **Bootstrap yt-dlp** : premier import → `yt-dlp.exe` téléchargé dans
      `%USERPROFILE%\.loupe\bin\` (intégrité sha256 vérifiée), barre de
      progression vivante.
- [ ] **Parcours complet** : import YouTube → séparation Modal → projet
      enregistré → fermeture → relance → projet rouvert.
- [ ] **Chemins** : données sous `%USERPROFILE%\.loupe\`
      (`audio\`, `projects\`, `downloads\`, `bin\`).
- [ ] **Ctrl-C** : arrêt propre.
- [ ] **`loupe.exe --version`** affiche la version.

## Ubuntu (ARM64 via qemu, ou x64 natif)

- [ ] **Démarrage** : `./loupe` affiche l'URL, ouvre le navigateur, `/health`
      répond.
- [ ] **Bootstrap yt-dlp** : `~/.loupe/bin/yt-dlp_linux` téléchargé + `chmod`,
      import fonctionnel.
- [ ] **Parcours complet** : import → séparation Modal → projet → relance.
- [ ] **Chemins** : `~/.loupe/{audio,projects,downloads,bin}`.
- [ ] **Port occupé** : relancer une 2e instance sur le même port → message
      actionnable + exit 1.
- [ ] **Ctrl-C** : arrêt propre.

## Trouvailles & correctifs (la validation en VM les a levés)

- **Zip Windows invalide** (#283) : `tar -a` en `shell: bash` sur le runner
  Windows = GNU tar (git-bash), pas bsdtar → tar déguisé en `.zip`. Fix :
  `Compress-Archive`.
- **Zip-dans-zip au download** (#284) : GitHub emballe tout artefact de run.
  Fix : uploader le **binaire brut**, fabriquer les archives sur Linux.
- **Auth magic link cassée** (#285) : (a) serveur bind IPv4-only mais ouvrait
  `localhost` → `::1` refusé sur Windows → ouvre `127.0.0.1` ; (b) le magic
  link par redirection exige serveur-vivant + même navigateur + même origin +
  ouvre un onglet → **auth par code OTP** (`verifyOtp`, zéro redirection).
  Template email Supabase posé (code + lien), cf. `beta-checklist.md`.
  **Confirmé OK par l'utilisateur sur Windows 11 ARM (2026-07-28).**

## Résultats

| Plateforme | Date | Verdict | Notes |
| --- | --- | --- | --- |
| Windows 11 ARM (x64 ému.) | 2026-07-28 | ✅ | parcours complet OK — démarrage, auth OTP, import YouTube, séparation Modal, projet, relance |
| Ubuntu ARM64 (qemu x64) | | ⬜ | non rejoué en session ; test x64/qemu faible, cible `aarch64-linux` native différée |

> Un bug de portabilité trouvé ici = un correctif + un test de
> non-régression (le job CI `Rust Windows` couvre déjà les chemins/FS des
> crates distribués ; ajouter le cas s'il a échappé).
