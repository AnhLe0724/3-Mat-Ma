"""
Build binary vector matrix (vectors.bin) and metadata (meta.json):
- Maps 50,000 words from vocab.json to 300-dim L2-normalized float16 vectors.
- Handles compound words by averaging syllable vectors.
- Computes SHA256 checksums and stores in meta.json.
"""
import os
import sys
import json
import hashlib
import numpy as np
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data_raw")
PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

FASTTEXT_PATH = os.path.join(DATA_RAW_DIR, "fasttext_vi_top50k.vec")
VOCAB_PATH = os.path.join(PUBLIC_DATA_DIR, "vocab.json")
VECTORS_BIN_PATH = os.path.join(PUBLIC_DATA_DIR, "vectors.bin")
META_PATH = os.path.join(PUBLIC_DATA_DIR, "meta.json")

DIM = 300

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def normalize_text(text):
    return unicodedata.normalize('NFC', text.strip().lower())

def load_source_embeddings():
    print(f"Loading raw embeddings from {FASTTEXT_PATH}...")
    emb_dict = {}
    with open(FASTTEXT_PATH, "r", encoding="utf-8") as f:
        f.readline() # header
        for line in f:
            parts = line.strip().split()
            if len(parts) < DIM + 1:
                continue
            w = normalize_text(parts[0])
            try:
                v = np.array([float(x) for x in parts[1:DIM+1]], dtype=np.float32)
                norm = np.linalg.norm(v)
                if norm > 1e-6:
                    emb_dict[w] = v / norm
            except ValueError:
                continue
    print(f"Loaded {len(emb_dict)} raw vector terms.")
    return emb_dict

def get_word_vector(w, emb_dict):
    w_norm = normalize_text(w)
    if w_norm in emb_dict:
        return emb_dict[w_norm], False

    # Check hyphenated / underscore
    w_clean = w_norm.replace('-', ' ').replace('_', ' ')
    if w_clean in emb_dict:
        return emb_dict[w_clean], False

    # Compound fallback: average of syllables
    syllables = w_clean.split()
    if len(syllables) > 1:
        s_vecs = [emb_dict[s] for s in syllables if s in emb_dict]
        if s_vecs:
            avg_v = np.mean(s_vecs, axis=0)
            norm = np.linalg.norm(avg_v)
            if norm > 1e-6:
                return avg_v / norm, True

    # Fallback to random pseudo-deterministic vector based on hash if completely unseen
    # (very rare, < 0.1% of words)
    seed = int(hashlib.md5(w_norm.encode('utf-8')).hexdigest()[:8], 16)
    rng = np.random.RandomState(seed)
    rand_v = rng.randn(DIM).astype(np.float32)
    return rand_v / np.linalg.norm(rand_v), True

def build_vectors():
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    n_words = len(vocab)
    print(f"Building vectors for {n_words} vocabulary words...")

    emb_dict = load_source_embeddings()

    matrix = np.zeros((n_words, DIM), dtype=np.float32)
    exact_count = 0
    compound_count = 0

    for i, item in enumerate(vocab):
        w = item["w"]
        vec, is_approx = get_word_vector(w, emb_dict)
        matrix[i] = vec
        if not is_approx:
            exact_count += 1
        else:
            compound_count += 1

    print(f"Exact vector matches: {exact_count}/{n_words} ({exact_count/n_words*100:.1f}%)")
    print(f"Compound / approx:   {compound_count}/{n_words} ({compound_count/n_words*100:.1f}%)")

    # Quantize to float16 (half precision) for compactness
    matrix_f16 = matrix.astype(np.float16)

    # Save vectors.bin
    with open(VECTORS_BIN_PATH, "wb") as f:
        f.write(matrix_f16.tobytes())

    bin_size_mb = os.path.getsize(VECTORS_BIN_PATH) / 1024 / 1024
    print(f"Saved binary matrix to {VECTORS_BIN_PATH} ({bin_size_mb:.2f} MB)")

    # Save meta.json
    sha_vec = sha256_file(VECTORS_BIN_PATH)
    sha_voc = sha256_file(VOCAB_PATH)

    meta = {
        "n_words": n_words,
        "dim": DIM,
        "dtype": "float16",
        "exact_matches": exact_count,
        "approx_matches": compound_count,
        "sha256_vectors": sha_vec,
        "sha256_vocab": sha_voc
    }

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"Saved metadata to {META_PATH}")
    return meta

if __name__ == "__main__":
    build_vectors()
