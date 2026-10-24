"""
Build unaccented-to-accented Vietnamese mapping (unaccented_map.json)
Enables effortless search whether the user types with or without accents:
e.g. 'ca phe' -> 'cà phê', 'bien' -> 'biển', 'mat troi' -> 'mặt trời'
"""
import os
import sys
import json
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")
GRAPH_PATH = os.path.join(PUBLIC_DATA_DIR, "graph.json")
VOCAB_PATH = os.path.join(PUBLIC_DATA_DIR, "vocab.json")
OUTPUT_MAP = os.path.join(PUBLIC_DATA_DIR, "unaccented_map.json")

def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str.strip().lower())
    clean = ''.join([c for c in nfkd_form if not unicodedata.combining(c)])
    return clean.replace('đ', 'd').replace('Đ', 'D')

def build_unaccented_map():
    with open(GRAPH_PATH, "r", encoding="utf-8") as f:
        graph = json.load(f)

    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    # Score words by whether they have rich associations in graph, and their frequency
    word_priority = {}
    for item in vocab:
        w = item["w"]
        freq = item.get("freq", 1)
        assoc_count = len(graph.get(w, {}))
        # priority formula: assoc_count is paramount, then freq
        score = assoc_count * 100 + freq
        word_priority[w] = score

    unaccented_dict = {} # unaccented -> {accented: score}

    for w, score in word_priority.items():
        unacc = remove_accents(w)
        if unacc not in unaccented_dict:
            unaccented_dict[unacc] = []
        unaccented_dict[unacc].append((w, score))

    # Also make sure all graph keys are present
    for w in graph.keys():
        unacc = remove_accents(w)
        if unacc not in unaccented_dict:
            unaccented_dict[unacc] = []
        if not any(item[0] == w for item in unaccented_dict[unacc]):
            unaccented_dict[unacc].append((w, len(graph[w]) * 100))

    # For each unaccented key, sort candidates by priority and keep top 5
    final_map = {}
    for unacc, cands in unaccented_dict.items():
        cands.sort(key=lambda x: x[1], reverse=True)
        final_map[unacc] = [c[0] for c in cands[:5]]

    with open(OUTPUT_MAP, "w", encoding="utf-8") as f:
        json.dump(final_map, f, ensure_ascii=False, indent=None)

    print(f"Built unaccented map with {len(final_map):,} entries.")
    print(f"Saved to: {OUTPUT_MAP} ({os.path.getsize(OUTPUT_MAP)/1024/1024:.2f} MB)")

if __name__ == "__main__":
    build_unaccented_map()
