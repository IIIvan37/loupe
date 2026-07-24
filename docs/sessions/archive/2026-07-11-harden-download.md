# Session — 2026-07-11 — harden-download (M.2)

## Done
- **M.2 — `/download` durci** (roadmap-excellence-3), le endpoint le moins
  gardé rejoint le standard des autres :
  - **sémaphore** `LOUPE_MAX_CONCURRENT_DOWNLOADS` (défaut 1), acquis côté
    worker comme `/separate` — plus de N yt-dlp parallèles ;
  - **`max_filesize`** yt-dlp aligné sur `MAX_UPLOAD_BYTES` — le tmp ne peut
    plus se remplir *avant* que le quota du store ne s'applique ;
  - **budget wall-clock total** `LOUPE_DOWNLOAD_TIMEOUT_SECONDS` (défaut
    900 s) sur la boucle `events.get()` → ligne NDJSON « download timed out ».
- **/code-review → 5 corrections** (constats vérifiés) :
  - le timeout par-événement était **réinitialisé par chaque tick de
    progression** — un download qui « goutte » le survivait indéfiniment →
    deadline totale (`time.monotonic()`), testée avec un worker trickle ;
  - **`socket_timeout: 30`** dans les options yt-dlp : la deadline libère le
    thread du stream mais seul le worker peut libérer son slot — un pipe mort
    doit lever *dans* yt-dlp ;
  - **`/separate` avait le même trou en pire** : `events.get()` sans timeout
    du tout (inférence figée = thread + slot unique bloqués pour toujours) →
    même budget total, `LOUPE_SEPARATION_TIMEOUT_SECONDS` (défaut 1800 s) ;
  - `seconds_env` refuse `0` (chaque stream expirerait instantanément) ;
  - message « no file » explicite le cap de taille (yt-dlp *skippe en
    silence* un fichier au-dessus de `max_filesize`).
- `seconds_env` ajouté à `limits.py` (parsing env mutualisé, testé y compris
  garbage et zéro).

## Not done / remaining
- **Limites actées** (documentées, pas corrigibles proprement en Python) :
  un worker vraiment insensible au `socket_timeout` garde son slot jusqu'au
  restart (on ne tue pas un thread) ; la queue abandonnée après timeout vit
  le temps du worker ; le rmtree du tmp au timeout peut courser une écriture
  du worker (exception avalée + loggée, bénin).
- `files[0].read_bytes()` charge le fichier en mémoire — borné par
  `max_filesize` désormais, pas de streaming vers le store (non requis).

## Decisions
- **Timeout = budget total**, pas par-événement : un flux de progression ne
  doit jamais pouvoir le réarmer (s'applique à `/download` **et**
  `/separate`).
- `/tempo` et `/chords` (`run_in_threadpool`, pas de stream) restent pour
  **M.3** (`asyncio.wait_for`), comme au plan.

## Gate status
- typecheck: n/a TS — **pyright ✅** (separation.py = humble object exclu,
  parse vérifié)
- tests (with coverage): **157 pytest ✅** (+8), couverture serveur 97,5 %
- mutation (Stryker, local, if core touched): **skippée — lot 100 % serveur
  Python**
- biome / sheriff / knip / jscpd: n/a (aucun fichier TS touché) ;
  **ruff check + format ✅**

## State to resume from
- **Single next action**: merger la PR M.2, puis **M.3** (basses groupées :
  `asyncio.wait_for` autour des trois `run_in_threadpool` d'inférence,
  `FileResponse` sur `GET /audio/{ref}`, doc asymétrie d'épinglage des poids).
- Gotchas / half-done edits: aucun.
