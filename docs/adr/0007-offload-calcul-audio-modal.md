# ADR 0007 — Le calcul audio lourd part sur Modal ; le cloud calcule et oublie

- **Statut** : accepté
- **Date** : 2026-07-16 (cap acté dans la
  [roadmap v5 § Cap](../roadmap-excellence-5.md) et le
  [plan client léger](../client-leger-plan.md) ; rédigé a posteriori le
  2026-07-24, lot TS.3)

## Contexte

Loupe doit tourner sur des machines peu puissantes — c'est la direction
produit actée le 2026-07-16. Or le calcul audio lourd (séparation de stems
Demucs, détections tempo/accords/structure) exigeait un serveur Python local,
GPU de préférence : la première tentative de séparation **dans le navigateur**
(WASM : demucs.cpp GGML, onnxruntime-web) avait heurté un mur qualité + vitesse
— modèles quantisés, plafond mémoire wasm32, pas de GPU natif — et avait été
retirée ([2026-06-30](../sessions/2026-06-30-remove-wasm-separators.md),
[STATUS](../STATUS.md)). Le serveur local qui l'a remplacée fait porter à la
machine de l'utilisateur exactement la charge que le produit promet d'éviter.

## Décision

**Client léger : tout le calcul qui peut migrer vers Modal migre** ; le
serveur local sort du chemin nominal. Les décisions structurantes, actées avec
le cap :

1. **Le cloud calcule et oublie.** Modal reçoit de l'audio transitoire,
   renvoie un résultat, ne persiste rien ; **les projets restent locaux**.
   Supabase ne voit qu'auth et quotas (beta codes → JWT court, 20 mints/mois ;
   quota unique pour toutes les analyses, séparation comprise — décision M1.2,
   la complexité d'un quota pondéré rejetée contre un coût mesuré sub-cent).
2. **Le core ne bouge pas.** La migration est un jeu d'adapters derrière les
   ports existants (`TempoDetector`, `ChordDetector`, `StructureDetector`,
   `StemSeparator`, `ProjectStore`, `ProjectAudioStore`) ; devoir toucher un
   port est un signal d'alarme à instruire, pas un détail d'implémentation.
3. **Ordre : Modal d'abord, Tauri ensuite.** Le stockage ne quitte le serveur
   local qu'avec le shell Tauri (stores filesystem, sidecar yt-dlp pour
   l'import URL — l'audio importé ne transite jamais par le cloud).
4. **L'app reste utilisable à chaque étape** : pas de branche longue, chaque
   slice merge sur un produit qui marche.

## Conséquences

- Le produit tourne sur des machines modestes ; la charge GPU dominante
  (htdemucs) est mutualisée sur un conteneur L4 Modal à la demande.
- La vie privée est un invariant vérifiable : aucun manifest, stem ou audio
  persisté hors de la machine de l'utilisateur — l'argument tient en une
  phrase (« le cloud calcule et oublie ») parce que l'architecture le rend
  vrai.
- Le hors-ligne devient un état de premier ordre à narrer dans l'UI (santé de
  l'endpoint effectif, quotas épuisés) — un coût d'UX que le serveur local
  n'avait pas.
- Coût d'exploitation réel mais borné : plafond de dépense Modal + alerte de
  facturation comme garde-fou beta.
- La substituabilité des adapters devient portante — d'où
  l'[ADR-0002](0002-contrats-de-ports-en-subpath-testing.md) (contrats de
  ports).

## Alternatives envisagées

- **Tout dans le navigateur (WASM).** Tentée en premier, retirée : mur
  qualité + vitesse (modèles quantisés, mémoire wasm32, pas de GPU). Les
  traces sont dans STATUS et les sessions du 2026-06-30.
- **Garder le serveur local comme chemin nominal.** C'est l'état
  intermédiaire, pas la cible : il exige la machine puissante que le produit
  promet de ne pas exiger, et une installation Python que la beta ne peut pas
  demander.
- **Stocker les projets dans le cloud.** Rejeté d'emblée : la valeur du cloud
  ici est le calcul, pas la garde des données ; le stockage distant ajouterait
  coût, latence et une promesse de confidentialité impossible à tenir en une
  phrase.
- **Quota pondéré / quota séparé pour la séparation.** Rejeté (M1.2) : de la
  complexité de schéma contre un coût GPU mesuré sub-cent par séparation.
