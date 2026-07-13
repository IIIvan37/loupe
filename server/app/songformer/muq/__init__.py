from .muq import MuQ, MuQConfig

# muq_mulan (text-audio contrastive model) is not vendored — loupe only uses
# MuQ audio embeddings for structure detection.
__all__ = ["MuQ", "MuQConfig"]