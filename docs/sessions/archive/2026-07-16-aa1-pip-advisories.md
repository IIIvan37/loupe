# Session — 2026-07-16 — aa1-pip-advisories

## Done
- **AA.1 (roadmap v5) — dernier des cinq 🟠** : veille CVE sur la pile Python.
  Bloc `package-ecosystem: pip, directory: /server` ajouté à
  `.github/dependabot.yml` (hebdo, PRs groupées minor/patch limitées à 3,
  préfixe `chore`). Les **security advisories** sont signalées quel que soit
  le grouping — c'est la pièce manquante : requirements.txt strictement pinné
  (torch 2.12.1, transformers 4.51.1, yt-dlp — qui parse du contenu distant
  hostile par construction) ne signalait jamais une CVE, et la même pile
  tourne sur Modal. Compatible avec la décision A.1 (« upgrade = action
  opérateur ») : notification sans auto-installation. Couvre requirements.txt
  ET requirements-dev.txt. YAML validé (yaml-lint).

## Not done / remaining
- **Pin git madmom invisible à Dependabot** — limitation documentée en
  commentaire dans le fichier ; couverture partielle mais réelle.
- **Step `pip-audit` CI (optionnel roadmap) non pris** : le pin git madmom le
  fait échouer au parsing et le job CI n'installe que requirements-dev
  (torch-free) — le rapport bruit/valeur est mauvais tant que Dependabot
  couvre les advisories. À reconsidérer si un audit à la demande manque.

## Decisions
- Advisories Dependabot = le mécanisme de veille ; les bumps de version
  restent des PRs à arbitrer par l'opérateur (jamais d'auto-merge), fidèle à
  A.1.

## Gate status
- typecheck / tests / biome / sheriff / knip / jscpd : ✅ (config CI pure —
  gate relancée par le hook pre-commit, verte, 1595 tests de main).
- mutation (Stryker) : skippé — core intouché.
- La config Dependabot elle-même ne se teste qu'en prod GitHub — à vérifier
  au premier lundi suivant le merge (onglet Security/Dependabot).
  ⚠️ Prérequis : la facturation GitHub Actions est en panne — vérifier au
  passage que Dependabot n'est pas affecté.

## State to resume from
- **Single next action** : ouvrir la PR de `feat/aa1-pip-advisories`. **Les
  cinq 🟠 de la roadmap v5 sont alors tous livrés** (X.1 mergé #170 ; X.2
  #171, Y.1 #172, Z.1 #173, AA.1 en PRs) → prochaine étape : merger les PRs
  ouvertes (conflits STATUS.md triviaux — concaténer les entrées), puis
  **Phase 1 du plan client léger : M1.1** (tempo+accords sur Modal), les 🟢
  v5 au fil de l'eau.
- Gotchas / half-done edits : aucun.
