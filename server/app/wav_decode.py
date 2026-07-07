"""Pure 16-bit PCM WAV decoding — shared by the ML shells, torch-free.

The `/separate` and `/tempo` endpoints both receive the exact WAV bytes the
web `encodeWav` produces and decode them with the stdlib (no audio I/O backend
needed). That decoding is decidable logic, so per the humble-object convention
(see `server/README.md`) it lives here — tested and pyright-checked — while the
torch shells keep only the model calls.
"""

from __future__ import annotations

import io
import wave

import numpy as np


def decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    """Decode 16-bit PCM WAV bytes into float32 [frames, channels] + sample rate.

    Samples are scaled to [-1, 1) (int16 / 32768), every channel kept apart.
    Anything but 16-bit samples is refused — read as int16 they would be silent
    garbage (wrong values, right-looking shape), not an error.
    """
    with wave.open(io.BytesIO(data)) as reader:
        if reader.getsampwidth() != 2:
            raise ValueError("expected 16-bit PCM WAV")
        sample_rate = reader.getframerate()
        channel_count = reader.getnchannels()
        raw = reader.readframes(reader.getnframes())
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32)
    samples /= 32768.0  # in place — the astype copy is already ours
    return samples.reshape(-1, channel_count), sample_rate


def decode_wav_mono(data: bytes) -> tuple[np.ndarray, int]:
    """Decode WAV bytes into a mono float signal + its sample rate.

    Multi-channel audio folds to one channel by averaging — the shape the
    beat tracker consumes.
    """
    samples, sample_rate = decode_wav(data)
    if samples.shape[1] > 1:
        return samples.mean(axis=1), sample_rate
    return samples[:, 0], sample_rate
