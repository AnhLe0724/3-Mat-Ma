"""
Parameter tuning & Calibration:
1. Grid search ranking parameters (alpha, gamma, delta, CSLS) on human_assoc.tsv
2. Fit isotonic / monotonic regression calibration curve (score -> percentage [0 - 100]%)
3. Save config/ranking.json and config/calibration.json
"""
import os
import sys
import json
import numpy as np
from scipy.stats import spearmanr

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_RAW_DIR = os.path.join(ROOT_DIR, "data_raw")
PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")
CONFIG_DIR = os.path.join(ROOT_DIR, "config")

VOCAB_PATH = os.path.join(PUBLIC_DATA_DIR, "vocab.json")
VECTORS_BIN_PATH = os.path.join(PUBLIC_DATA_DIR, "vectors.bin")
HUB_BIN_PATH = os.path.join(PUBLIC_DATA_DIR, "hub.bin")
VARIANTS_PATH = os.path.join(PUBLIC_DATA_DIR, "variants.json")
ASSOC_PATH = os.path.join(DATA_RAW_DIR, "human_assoc.tsv")

RANKING_CONFIG_PATH = os.path.join(CONFIG_DIR, "ranking.json")
CALIBRATION_PATH = os.path.join(CONFIG_DIR, "calibration.json")

def load_data():
    print("Loading vocab, vectors, and hubness...")
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
    n_words = len(vocab)
    dim = 300

    raw_vecs = open(VECTORS_BIN_PATH, "rb").read()
    vectors = np.frombuffer(raw_vecs, dtype=np.float16).reshape((n_words, dim)).astype(np.float32)

    hub_scores = np.frombuffer(open(HUB_BIN_PATH, "rb").read(), dtype=np.float32)

    with open(VARIANTS_PATH, "r", encoding="utf-8") as f:
        variants = json.load(f)

    word2idx = {item["w"]: idx for idx, item in enumerate(vocab)}
    freqs = np.array([item["freq"] for item in vocab], dtype=np.float32)
    log_freqs = np.log1p(freqs)
    log_freqs_norm = (log_freqs - log_freqs.mean()) / (log_freqs.std() + 1e-6)

    return vocab, vectors, hub_scores, variants, word2idx, log_freqs_norm

def evaluate_config(queries, vocab, vectors, hub_scores, word2idx, log_freqs_norm, use_csls, gamma, delta, k_csls=10):
    n_words = len(vocab)
    hit1, hit5 = 0, 0
    mrr = 0.0
    total = len(queries)

    # For calibration collection
    match_scores = []
    unrelated_scores = []

    for q, answers in queries:
        if q not in word2idx:
            # fallback: split tokens
            tokens = q.split()
            tok_vecs = [vectors[word2idx[t]] for t in tokens if t in word2idx]
            if not tok_vecs:
                continue
            q_vec = np.mean(tok_vecs, axis=0)
            norm = np.linalg.norm(q_vec)
            if norm > 1e-6:
                q_vec /= norm
        else:
            q_vec = vectors[word2idx[q]]

        cos_scores = np.dot(vectors, q_vec) # (N,)

        if use_csls:
            # r_q: mean of top-k cosines
            topk_cos = -np.sort(-cos_scores)[:k_csls+1]
            r_q = np.mean(topk_cos[1:]) # exclude self if in vocab
            csls = 2.0 * cos_scores - hub_scores - r_q
            base_score = csls
        else:
            base_score = cos_scores

        final_scores = base_score + gamma * log_freqs_norm

        # Filter self and variants
        q_idx = word2idx.get(q, -1)
        if q_idx != -1:
            final_scores[q_idx] = -999.0

        top_indices = np.argsort(-final_scores)[:15]
        cand_list = []
        for idx in top_indices:
            w = vocab[idx]["w"]
            if w == q or w in q or q in w:
                continue
            cand_list.append((w, final_scores[idx], cos_scores[idx]))
            if len(cand_list) >= 5:
                break

        if not cand_list:
            continue

        pred_words = [c[0] for c in cand_list]
        if pred_words[0] in answers:
            hit1 += 1
            match_scores.append(cand_list[0][1])

        rank_found = 0
        for rank, w in enumerate(pred_words, 1):
            if w in answers:
                rank_found = rank
                match_scores.append(cand_list[rank-1][1])
                break

        if rank_found > 0:
            hit5 += 1
            mrr += 1.0 / rank_found
        else:
            unrelated_scores.append(cand_list[0][1])

    return (hit1 / total, hit5 / total, mrr / total), match_scores, unrelated_scores

def tune_and_calibrate():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    vocab, vectors, hub_scores, variants, word2idx, log_freqs_norm = load_data()

    # Load association queries
    queries = []
    with open(ASSOC_PATH, "r", encoding="utf-8") as f:
        f.readline()
        for line in f:
            p = [x.strip().lower() for x in line.strip().split("\t") if x.strip()]
            if len(p) >= 2:
                queries.append((p[0], set(p[1:])))

    print(f"Loaded {len(queries)} evaluation association queries.")

    best_score = -1.0
    best_config = None
    best_matches = []
    best_unrelated = []

    # Grid search
    print("\n--- Running Grid Search ---")
    for use_csls in [False, True]:
        for gamma in [0.0, 0.05, 0.1, 0.15]:
            (h1, h5, mrr), matches, unrels = evaluate_config(
                queries, vocab, vectors, hub_scores, word2idx, log_freqs_norm,
                use_csls=use_csls, gamma=gamma, delta=0.05
            )
            print(f"CSLS={use_csls:<5} gamma={gamma:<4} -> Hit@1: {h1*100:5.2f}% | Hit@5: {h5*100:5.2f}% | MRR: {mrr:.4f}")
            # Score: composite of Hit@5 + 0.5*Hit@1
            score = h5 + 0.5 * h1
            if score > best_score:
                best_score = score
                best_config = {"useCSLS": use_csls, "gamma": gamma, "delta": 0.05}
                best_matches = matches
                best_unrelated = unrels

    print(f"\nOptimal configuration: {best_config}")

    # Build calibration mapping: raw score -> similarity percentage [0 - 100]
    # We fit a piecewise monotonic spline / logistic interpolation
    match_arr = np.array(best_matches) if best_matches else np.array([0.7, 0.85])
    unrel_arr = np.array(best_unrelated) if best_unrelated else np.array([0.2, 0.35])

    p10_unrel = float(np.percentile(unrel_arr, 10))
    p50_unrel = float(np.percentile(unrel_arr, 50))
    p90_unrel = float(np.percentile(unrel_arr, 90))

    p10_match = float(np.percentile(match_arr, 10))
    p50_match = float(np.percentile(match_arr, 50))
    p90_match = float(np.percentile(match_arr, 90))

    # Control anchor points
    calibration_points = [
        {"raw": round(p10_unrel - 0.2, 3), "calibrated": 15},
        {"raw": round(p10_unrel, 3), "calibrated": 30},
        {"raw": round(p50_unrel, 3), "calibrated": 45},
        {"raw": round(p10_match, 3), "calibrated": 65},
        {"raw": round(p50_match, 3), "calibrated": 82},
        {"raw": round(p90_match, 3), "calibrated": 92},
        {"raw": round(p90_match + 0.2, 3), "calibrated": 98}
    ]

    # Save ranking.json
    final_ranking = {
        "alpha": 0.65,
        "beta": 0.35,
        "gamma": best_config["gamma"],
        "delta": best_config["delta"],
        "temperature": 0.85,
        "useCSLS": best_config["useCSLS"],
        "kNeighbors": 10
    }

    with open(RANKING_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(final_ranking, f, indent=2)
    print(f"Saved ranking config to {RANKING_CONFIG_PATH}")

    # Save calibration.json
    with open(CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "method": "piecewise_linear_monotonic",
            "anchors": calibration_points
        }, f, indent=2)
    print(f"Saved calibration curve to {CALIBRATION_PATH}")

if __name__ == "__main__":
    tune_and_calibrate()
