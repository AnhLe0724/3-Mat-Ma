"""
Benchmark script:
1. ViSim-400 Spearman correlation (similarity & relatedness)
2. Human Association Hit@1, Hit@5, MRR on human_assoc.tsv
"""
import os
import sys
import unicodedata
import numpy as np
from scipy.stats import spearmanr

sys.stdout.reconfigure(encoding='utf-8')

DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data_raw")
VISIM_PATH = os.path.join(DATA_RAW_DIR, "visim400.txt")
ASSOC_PATH = os.path.join(DATA_RAW_DIR, "human_assoc.tsv")

def normalize_text(text):
    text = unicodedata.normalize('NFC', text.strip().lower())
    text = " ".join(text.split())
    return text

class VectorIndex:
    def __init__(self):
        self.words = []
        self.word2idx = {}
        self.vectors = None

    def load_vec_file(self, path, limit=50000):
        print(f"Loading vectors from {path}...")
        words = []
        vecs = []
        with open(path, "r", encoding="utf-8") as f:
            first_line = f.readline().strip().split()
            dim = int(first_line[1])
            for i, line in enumerate(f):
                if i >= limit:
                    break
                parts = line.strip().split()
                if len(parts) < dim + 1:
                    continue
                w = normalize_text(parts[0])
                if not w or w in self.word2idx:
                    continue
                try:
                    v = np.array([float(x) for x in parts[1:dim+1]], dtype=np.float32)
                except ValueError:
                    continue
                # normalize L2
                norm = np.linalg.norm(v)
                if norm > 1e-6:
                    v = v / norm
                words.append(w)
                self.word2idx[w] = len(words) - 1
                vecs.append(v)

        self.words = words
        self.vectors = np.array(vecs, dtype=np.float32)
        print(f"Loaded {len(self.words)} words, shape {self.vectors.shape}")

    def get_vector(self, word):
        w = normalize_text(word)
        if w in self.word2idx:
            return self.vectors[self.word2idx[w]]
        # Fallback for compound words (e.g., "trường học" -> avg("trường", "học"))
        tokens = w.split()
        if len(tokens) > 1:
            tok_vecs = [self.get_vector(t) for t in tokens if self.get_vector(t) is not None]
            if tok_vecs:
                avg_v = np.mean(tok_vecs, axis=0)
                norm = np.linalg.norm(avg_v)
                if norm > 1e-6:
                    return avg_v / norm
        return None

    def query(self, word, top_k=5, exclude_query=True):
        v = self.get_vector(word)
        if v is None:
            return []
        scores = np.dot(self.vectors, v)
        # Sort descending
        top_indices = np.argsort(-scores)[:top_k + 10]
        results = []
        q_norm = normalize_text(word)
        for idx in top_indices:
            cand = self.words[idx]
            if exclude_query and (cand == q_norm or cand in q_norm or q_norm in cand):
                continue
            results.append((cand, float(scores[idx])))
            if len(results) >= top_k:
                break
        return results

def benchmark_visim400(idx):
    if not os.path.exists(VISIM_PATH):
        print(f"ViSim-400 not found at {VISIM_PATH}")
        return None

    sim1_true = []
    sim2_true = []
    pred_sim = []
    skipped = 0

    with open(VISIM_PATH, "r", encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 5:
                continue
            w1 = normalize_text(parts[0])
            w2 = normalize_text(parts[1])
            s1 = float(parts[3])
            s2 = float(parts[4])

            v1 = idx.get_vector(w1)
            v2 = idx.get_vector(w2)
            if v1 is not None and v2 is not None:
                cos = float(np.dot(v1, v2))
                sim1_true.append(s1)
                sim2_true.append(s2)
                pred_sim.append(cos)
            else:
                skipped += 1

    if not pred_sim:
        print("No valid pairs evaluated in ViSim-400.")
        return None

    rho_sim1, p1 = spearmanr(pred_sim, sim1_true)
    rho_sim2, p2 = spearmanr(pred_sim, sim2_true)
    total = len(pred_sim) + skipped
    print("\n=== ViSim-400 Benchmark Results ===")
    print(f"Evaluated pairs: {len(pred_sim)} / {total} (Coverage: {len(pred_sim)/total*100:.1f}%)")
    print(f"Spearman ρ (Similarity Sim1):   {rho_sim1:.4f} (p={p1:.2e})")
    print(f"Spearman ρ (Relatedness Sim2):  {rho_sim2:.4f} (p={p2:.2e})")
    return rho_sim1, rho_sim2

def benchmark_human_assoc(idx):
    if not os.path.exists(ASSOC_PATH):
        print(f"Human association dataset not found at {ASSOC_PATH}")
        return None

    total_queries = 0
    hit1_count = 0
    hit5_count = 0
    mrr_sum = 0.0
    skipped_queries = 0

    with open(ASSOC_PATH, "r", encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            parts = [normalize_text(p) for p in line.strip().split("\t") if p.strip()]
            if len(parts) < 2:
                continue
            q = parts[0]
            answers = set(parts[1:])
            
            top5 = idx.query(q, top_k=5)
            if not top5:
                skipped_queries += 1
                continue

            total_queries += 1
            pred_words = [r[0] for r in top5]

            # Hit@1
            if pred_words[0] in answers:
                hit1_count += 1

            # Hit@5 & MRR
            found_rank = 0
            for rank, w in enumerate(pred_words, 1):
                if w in answers:
                    found_rank = rank
                    break
            
            if found_rank > 0:
                hit5_count += 1
                mrr_sum += 1.0 / found_rank

    if total_queries == 0:
        print("No association queries could be evaluated.")
        return None

    hit1 = hit1_count / total_queries
    hit5 = hit5_count / total_queries
    mrr = mrr_sum / total_queries

    print("\n=== Human Association Benchmark Results ===")
    print(f"Evaluated queries: {total_queries} (Skipped: {skipped_queries})")
    print(f"Hit@1:  {hit1*100:.2f}% ({hit1_count}/{total_queries})")
    print(f"Hit@5:  {hit5*100:.2f}% ({hit5_count}/{total_queries})")
    print(f"MRR:    {mrr:.4f}")
    return hit1, hit5, mrr

if __name__ == "__main__":
    vec_path = os.path.join(DATA_RAW_DIR, "fasttext_vi_top50k.vec")
    if not os.path.exists(vec_path):
        print(f"Please run download_fasttext.py first.")
        sys.exit(1)

    idx = VectorIndex()
    idx.load_vec_file(vec_path, limit=50000)

    # Test sample queries
    print("\nSample queries:")
    for w in ["chó", "mặt trời", "biển", "học sinh", "cà phê"]:
        res = idx.query(w, top_k=5)
        print(f"  {w} -> {[r[0] for r in res]}")

    benchmark_visim400(idx)
    benchmark_human_assoc(idx)
