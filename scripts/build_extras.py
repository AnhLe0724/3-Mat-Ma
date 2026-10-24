"""
Build extras:
1. Precompute Hubness r_c (CSLS): mean cosine similarity to top-k=10 neighbors -> public/data/hub.bin (Float32Array)
2. Build spelling/diacritic variants dictionary -> public/data/variants.json
"""
import os
import sys
import json
import numpy as np
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
VECTORS_BIN_PATH = os.path.join(PUBLIC_DATA_DIR, "vectors.bin")
VOCAB_PATH = os.path.join(PUBLIC_DATA_DIR, "vocab.json")
HUB_BIN_PATH = os.path.join(PUBLIC_DATA_DIR, "hub.bin")
VARIANTS_JSON_PATH = os.path.join(PUBLIC_DATA_DIR, "variants.json")

def compute_hubness(k=10, batch_size=2000):
    print("Computing hubness scores (k=10) for CSLS...")
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
    n_words = len(vocab)
    dim = 300

    # Load vectors as float32
    raw_bytes = open(VECTORS_BIN_PATH, "rb").read()
    matrix = np.frombuffer(raw_bytes, dtype=np.float16).reshape((n_words, dim)).astype(np.float32)

    # Re-normalize just in case
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix = matrix / np.maximum(norms, 1e-6)

    hub_scores = np.zeros(n_words, dtype=np.float32)

    # Compute in batches
    for start in range(0, n_words, batch_size):
        end = min(start + batch_size, n_words)
        batch = matrix[start:end] # (B, dim)
        sims = np.dot(batch, matrix.T) # (B, N)
        
        # We need top-(k+1) since candidate itself has cosine=1.0 at index i
        # np.partition is O(N)
        top_k_partition = np.partition(-sims, kth=k+1, axis=1)[:, :k+1]
        # Sort top-k
        top_k_sorted = -np.sort(top_k_partition, axis=1) # (B, k+1)
        # Exclude self (first column) and take mean of next k
        mean_top_k = np.mean(top_k_sorted[:, 1:k+1], axis=1)
        hub_scores[start:end] = mean_top_k

        if (start // batch_size) % 5 == 0:
            print(f"  Processed {end}/{n_words} words ({end/n_words*100:.1f}%)...")

    # Save hub.bin as Float32
    with open(HUB_BIN_PATH, "wb") as f:
        f.write(hub_scores.tobytes())

    print(f"Saved hubness scores to {HUB_BIN_PATH} ({os.path.getsize(HUB_BIN_PATH)/1024:.1f} KB)")
    print(f"Hub score range: min={hub_scores.min():.4f}, mean={hub_scores.mean():.4f}, max={hub_scores.max():.4f}")

def build_variants():
    print("Building spelling & diacritic variants mapping...")
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    # Vietnamese old/new style vowel tone mappings
    # e.g., hoà <-> hòa, thuỷ <-> thủy, toạ <-> tọa, oá <-> óa, uý <-> úy, lí <-> lý
    TONE_PAIRS = [
        ("oà", "hòa"), ("oá", "hóa"), ("oả", "hỏa"), ("oã", "hõa"), ("oạ", "họa"),
        ("uỳ", "hủy"), ("uý", "húy"), ("uỷ", "hủy"), ("uỹ", "hũy"), ("uỵ", "hụy"),
        ("uê", "huê"), ("y", "i"), ("lí", "lý"), ("kĩ", "kỹ"), ("mĩ", "mỹ"), ("tỉ", "tỷ")
    ]

    word_set = {item["w"]: idx for idx, item in enumerate(vocab)}
    variants = {} # canonical_word -> [variant1, variant2...]

    for w in word_set:
        w_norm = unicodedata.normalize('NFC', w)
        alt_forms = []

        # 1. Hyphen vs space: 'chào-hỏi' <-> 'chào hỏi'
        if '-' in w:
            alt_forms.append(w.replace('-', ' '))
        if ' ' in w:
            alt_forms.append(w.replace(' ', '-'))

        # 2. i vs y
        if 'i' in w:
            alt_forms.append(w.replace('i', 'y'))
        if 'y' in w:
            alt_forms.append(w.replace('y', 'i'))

        # 3. Old style diacritics
        # oà -> hòa
        for old, new in [("oà", "òa"), ("oá", "óa"), ("oả", "ỏa"), ("oã", "õa"), ("oạ", "ọa"),
                         ("uè", "è"), ("uẻ", "ẻ"), ("uẽ", "ẽ"), ("uẹ", "ẹ"),
                         ("uỳ", "ỳ"), ("uý", "ý"), ("uỷ", "ỷ"), ("uỹ", "ỹ"), ("uỵ", "ỵ")]:
            if old in w:
                alt_forms.append(w.replace(old, new))
            if new in w:
                alt_forms.append(w.replace(new, old))

        valid_alts = [alt for alt in alt_forms if alt in word_set and alt != w]
        if valid_alts:
            variants[w] = list(set(valid_alts))

    with open(VARIANTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(variants, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(variants)} variant entries to {VARIANTS_JSON_PATH}")

if __name__ == "__main__":
    compute_hubness()
    build_variants()
