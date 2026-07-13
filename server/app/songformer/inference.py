"""SongFormer inference orchestration, vendored from the project's app.py.

Kept close to the upstream reference (ASLP-lab/SongFormer, CC-BY-4.0) so its
tricky embedding-windowing + logit-accumulation math stays proven: the two SSL
backbones (MuQ, MusicFM) are run over the audio, their hidden states fed to the
SongFormer MSA head, and the frame logits post-processed into functional
sections. Removed from the reference: the Gradio UI, matplotlib visualisation,
the `os.chdir`, and the `msaf` eval import (inference never calls it). Device
and checkpoint paths are parameters, not globals hardcoded to CUDA.

`structure.py` (the torch shell) drives this: it pins the weights, calls
`load_models` once, then `analyse_array` per chunk (see `structure_chunks`).
"""

from __future__ import annotations

import importlib
import math
import os
from dataclasses import dataclass

import numpy as np
import torch
from ema_pytorch import EMA
from omegaconf import OmegaConf

from muq import MuQ
from musicfm.model.musicfm_25hz import MusicFM25Hz

from dataset.label2id import DATASET_ID_ALLOWED_LABEL_IDS, DATASET_LABEL_TO_DATASET_ID
from postprocessing.functional import postprocess_functional_structure

BEFORE_DOWNSAMPLING_FRAME_RATES = 25
AFTER_DOWNSAMPLING_FRAME_RATES = 8.333
DATASET_LABEL = "SongForm-HX-8Class"
DATASET_IDS = [5]
TIME_DUR = 420
INPUT_SAMPLING_RATE = 24000


@dataclass
class Models:
    muq: MuQ
    musicfm: MusicFM25Hz
    msa: torch.nn.Module
    hp: object
    device: torch.device


def _load_checkpoint(path: str, device: str) -> dict:
    if path.endswith(".safetensors"):
        from safetensors.torch import load_file

        return {"model_ema": load_file(path, device=device)}
    return torch.load(path, map_location=device)


def load_models(
    *,
    songformer_ckpt: str,
    songformer_config: str,
    musicfm_ckpt: str,
    musicfm_stats: str,
    muq_name: str,
    muq_revision: str | None,
    device: torch.device,
) -> Models:
    """Load the two SSL backbones + the MSA head onto `device`, once."""
    muq = MuQ.from_pretrained(muq_name, revision=muq_revision).to(device).eval()
    musicfm = (
        MusicFM25Hz(is_flash=False, stat_path=musicfm_stats, model_path=musicfm_ckpt)
        .to(device)
        .eval()
    )
    module = importlib.import_module("models.SongFormer")
    hp = OmegaConf.load(songformer_config)
    msa = module.Model(hp)
    ckpt = _load_checkpoint(songformer_ckpt, "cpu")
    if ckpt.get("model_ema") is not None:
        ema = EMA(msa, include_online_model=False)
        ema.load_state_dict(ckpt["model_ema"])
        msa.load_state_dict(ema.ema_model.state_dict())
    else:
        msa.load_state_dict(ckpt["model"])
    msa.to(device).eval()
    return Models(muq=muq, musicfm=musicfm, msa=msa, hp=hp, device=device)


def _embed_30s(models: Models, audio: torch.Tensor, start: int, end: int) -> tuple:
    muq = models.muq(audio[start:end].unsqueeze(0), output_hidden_states=True)[
        "hidden_states"
    ][10]
    fm = models.musicfm.get_predictions(audio[start:end].unsqueeze(0))[1][10]
    return muq, fm


def analyse_array(
    models: Models, wav: np.ndarray, win_size: int, num_classes: int = 128
) -> list[tuple[float, str]]:
    """Run the model over a mono 24 kHz array; return (time, label) boundaries.

    `win_size` is the SSL forward window in seconds (the caller chunks the track
    so this stays within memory). Mirrors the reference `process_audio`, reading
    an array instead of a file and taking the models explicitly.
    """
    device = models.device
    hop_size = win_size
    audio = torch.tensor(wav).to(device)
    total_len = (audio.shape[0] // INPUT_SAMPLING_RATE) // TIME_DUR * TIME_DUR + TIME_DUR
    total_frames = math.ceil(total_len * AFTER_DOWNSAMPLING_FRAME_RATES)

    logits = {
        "function_logits": np.zeros([total_frames, num_classes]),
        "boundary_logits": np.zeros([total_frames]),
    }
    logits_num = {
        "function_logits": np.zeros([total_frames, num_classes]),
        "boundary_logits": np.zeros([total_frames]),
    }
    id2mask = {}
    for key, allowed in DATASET_ID_ALLOWED_LABEL_IDS.items():
        id2mask[key] = np.ones(num_classes, dtype=bool)
        id2mask[key][allowed] = False

    lens = 0
    i = 0
    with torch.no_grad():
        while True:
            start_idx = i * INPUT_SAMPLING_RATE
            end_idx = min((i + win_size) * INPUT_SAMPLING_RATE, audio.shape[-1])
            if start_idx >= audio.shape[-1]:
                break
            if end_idx - start_idx <= 1024:
                break

            muq_420, fm_420 = _embed_30s(models, audio, start_idx, end_idx)

            muq_30s, fm_30s = [], []
            for idx in range(i, i + hop_size, 30):
                s = idx * INPUT_SAMPLING_RATE
                e = min((idx + 30) * INPUT_SAMPLING_RATE, audio.shape[-1], (i + hop_size) * INPUT_SAMPLING_RATE)
                if s >= audio.shape[-1] or e - s <= 1024:
                    break
                m, f = _embed_30s(models, audio, s, e)
                muq_30s.append(m)
                fm_30s.append(f)

            if not muq_30s:
                break
            muq_30s = torch.concatenate(muq_30s, dim=1)
            fm_30s = torch.concatenate(fm_30s, dim=1)
            embds = [fm_30s, muq_30s, fm_420, muq_420]
            min_len = min(x.shape[1] for x in embds)
            embd = torch.concatenate([x[:, :min_len, :] for x in embds], axis=-1)

            dataset_ids = torch.Tensor(DATASET_IDS).to(device, dtype=torch.long)
            mask = (
                torch.Tensor(id2mask[DATASET_LABEL_TO_DATASET_ID[DATASET_LABEL]])
                .to(device, dtype=bool)
                .unsqueeze(0)
                .unsqueeze(0)
            )
            _, chunk_logits = models.msa.infer(
                input_embeddings=embd,
                dataset_ids=dataset_ids,
                label_id_masks=mask,
                with_logits=True,
            )
            start_frame = int(i * AFTER_DOWNSAMPLING_FRAME_RATES)
            end_frame = start_frame + min(
                math.ceil(hop_size * AFTER_DOWNSAMPLING_FRAME_RATES),
                chunk_logits["boundary_logits"][0].shape[0],
            )
            logits["function_logits"][start_frame:end_frame, :] += (
                chunk_logits["function_logits"][0].detach().cpu().numpy()
            )
            logits["boundary_logits"][start_frame:end_frame] = (
                chunk_logits["boundary_logits"][0].detach().cpu().numpy()
            )
            logits_num["function_logits"][start_frame:end_frame, :] += 1
            logits_num["boundary_logits"][start_frame:end_frame] += 1
            lens += end_frame - start_frame
            i += hop_size

    logits["function_logits"] /= np.maximum(logits_num["function_logits"], 1)
    logits["boundary_logits"] /= np.maximum(logits_num["boundary_logits"], 1)
    logits["function_logits"] = torch.from_numpy(logits["function_logits"][:lens]).unsqueeze(0)
    logits["boundary_logits"] = torch.from_numpy(logits["boundary_logits"][:lens]).unsqueeze(0)
    return postprocess_functional_structure(logits, models.hp)
