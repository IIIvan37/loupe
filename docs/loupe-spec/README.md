# Loupe — dossier de spec

Spec de passation pour construire **Loupe** : un poste de travail web de transcription musicale (apprendre/relever de la musique à l'oreille) avec **séparation des voix et instruments par IA**. Combine l'ergonomie de *Transcribe!* (ralenti sans changer la hauteur, marqueurs, boucles, spectre) avec la séparation de stems façon *Moises*, mais ciblée sur le transcripteur sérieux.

## Contenu
| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | **Brief de l'agent** — à lire en premier. Décisions verrouillées, ce qui est simulé dans la maquette, tokens de design, premières tâches. |
| `plan-produit.md` | Plan produit complet : vision, fonctionnalités, analyse technique, jalons de MVP. La source de vérité. |
| `prototype/loupe-prototype.html` | Maquette interactive — référence **visuelle et d'interaction**. Ouvrir dans un navigateur. **C'est un mock : les moteurs audio/IA sont simulés.** |
| `prototype/loupe-maquette.png` | Capture de la maquette (si le HTML n'est pas exécutable). |

## Démarrage rapide pour un agent
1. Lire `CLAUDE.md` puis `plan-produit.md`.
2. Ouvrir le prototype pour comprendre l'UX cible.
3. Commencer par le **Jalon 1** (lecteur de transcription, 100 % client, sans backend — voir plan §4).
4. Remonter les décisions ouvertes (licence du moteur de ralenti, choix de l'API de séparation) avant de coder les parties concernées.

*Document de travail v1 — à faire évoluer.*
