# Vendored structure-detection models

Third-party model code, vendored verbatim (kept out of ruff/pyright/coverage) so
loupe's `app/structure.py` can run SongFormer offline and reproducibly.

- **SongFormer** (`models/`, `postprocessing/`, `dataset/`, `configs/`) —
  ASLP-lab/SongFormer, **CC-BY-4.0** (see `LICENSE.SongFormer`). Only the
  inference closure is vendored; training/eval/dataset-adapter modules and the
  `msaf` eval dependency are dropped (guarded import in `models/SongFormer.py`).
- **MuQ** (`muq/`) — tencent-ailab/MuQ SSL backbone, **CC-BY-4.0** code /
  **CC-BY-NC-4.0** weights (see `muq/LICENSE*`). The `muq_mulan` text-audio
  subpackage is pruned (unused).
- **MusicFM** (`musicfm/`) — minzwon/MusicFM SSL backbone (see `musicfm/LICENSE`).

`inference.py` is loupe's own orchestration (adapted from SongFormer's `app.py`,
minus the Gradio UI / matplotlib / `os.chdir`), device- and path-parameterised.
Weights are sha256-pinned (SongFormer head, MusicFM checkpoint + stats) or HF
revision-pinned (MuQ-large) in `app/structure.py`.
