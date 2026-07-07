"""Pure WAV decoding — the decidable half of the ML shells' `_load` helpers.

`wav_decode` is torch-free (stdlib `wave` + numpy), so we drive it directly with
WAV bytes built in the test. Run from the server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import io
import wave

import numpy as np
import pytest

from app.wav_decode import decode_wav, decode_wav_mono


def _wav_bytes(frames: np.ndarray, sample_rate: int = 44100) -> bytes:
    """Encode int16 [frames, channels] samples as 16-bit PCM WAV bytes."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(frames.shape[1])
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(frames.astype("<i2").tobytes())
    return buffer.getvalue()


def test_decodes_mono_samples_and_rate():
    data = _wav_bytes(np.array([[0], [16384], [-16384]]), sample_rate=22050)
    samples, rate = decode_wav(data)
    assert rate == 22050
    assert samples.shape == (3, 1)
    assert samples.dtype == np.float32
    np.testing.assert_allclose(samples[:, 0], [0.0, 0.5, -0.5])


def test_decodes_stereo_keeping_channels_apart():
    data = _wav_bytes(np.array([[100, -100], [200, -200]]))
    samples, _ = decode_wav(data)
    assert samples.shape == (2, 2)
    np.testing.assert_allclose(samples[:, 0], [100 / 32768, 200 / 32768], rtol=1e-6)
    np.testing.assert_allclose(samples[:, 1], [-100 / 32768, -200 / 32768], rtol=1e-6)


def test_full_scale_maps_inside_unit_range():
    data = _wav_bytes(np.array([[-32768], [32767]]))
    samples, _ = decode_wav(data)
    assert samples[0, 0] == pytest.approx(-1.0)
    assert samples[1, 0] == pytest.approx(32767 / 32768)


def test_mono_fold_averages_the_channels():
    data = _wav_bytes(np.array([[16384, 0], [0, -16384]]), sample_rate=48000)
    signal, rate = decode_wav_mono(data)
    assert rate == 48000
    assert signal.shape == (2,)
    np.testing.assert_allclose(signal, [0.25, -0.25])


def test_mono_fold_leaves_mono_untouched():
    data = _wav_bytes(np.array([[16384], [-16384]]))
    signal, _ = decode_wav_mono(data)
    assert signal.shape == (2,)
    np.testing.assert_allclose(signal, [0.5, -0.5])


def test_rejects_non_16_bit_wav():
    """8-bit samples decoded as int16 would be silent garbage, not an error."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(1)  # 8-bit PCM
        writer.setframerate(44100)
        writer.writeframes(bytes([128, 255, 0, 64]))
    with pytest.raises(ValueError, match="16-bit"):
        decode_wav(buffer.getvalue())
