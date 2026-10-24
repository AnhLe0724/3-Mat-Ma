"""
Build Comprehensive Association Knowledge Graph (graph.json):
Inspired by RelatedWords.org, Onelook Thesaurus (Datamuse), and WordHippo:
1. Human Association Norms (data_raw/human_assoc.tsv)
2. Open Multilingual WordNet / Wiktionary Synsets (data_raw/wn-wikt-vie.tab)
3. Dictionary Definitions & Semantic Co-occurrence (data_raw/dictionary.json)
4. Graded Semantic Relations (data_raw/visim400.txt)
5. Graph Spreading Activation & Bidirectional Links
Outputs: public/data/graph.json
"""
import os
import sys
import json
import re
import unicodedata
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_RAW_DIR = os.path.join(ROOT_DIR, "data_raw")
PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")

ASSOC_PATH = os.path.join(DATA_RAW_DIR, "human_assoc.tsv")
WIKT_PATH = os.path.join(DATA_RAW_DIR, "wn-wikt-vie.tab")
DICT_PATH = os.path.join(DATA_RAW_DIR, "dictionary.json")
VISIM_PATH = os.path.join(DATA_RAW_DIR, "visim400.txt")
BLOCKLIST_PATH = os.path.join(DATA_RAW_DIR, "blocklist.txt")
OUTPUT_GRAPH = os.path.join(PUBLIC_DATA_DIR, "graph.json")

# Stopwords to ignore in definition extraction
STOPWORDS = {
    "và", "của", "là", "thì", "mà", "ở", "tại", "cho", "với", "nhưng",
    "bởi", "vì", "do", "nên", "như", "rằng", "để", "tuy", "dù", "nếu",
    "hoặc", "hay", "cũng", "đã", "đang", "sẽ", "được", "bị", "bởi_vì",
    "một", "những", "các", "này", "đó", "kia", "ấy", "nọ", "gì", "nào",
    "ai", "sao", "thế", "nữa", "lại", "rồi", "vào", "ra", "lên", "xuống",
    "có", "không", "chưa", "chẳng", "được", "phải", "rất", "quá", "lắm",
    "vô_cùng", "hết_sức", "thường", "luôn", "mỗi", "từng", "nhiều", "ít"
}

def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text.strip().lower())
    text = text.replace('_', ' ')
    text = re.sub(r'[^\w\s\dàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def load_blocklist():
    blocklist = set()
    if os.path.exists(BLOCKLIST_PATH):
        with open(BLOCKLIST_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    blocklist.add(normalize_text(line))
    return blocklist

def load_valid_lexicon():
    lexicon = set()
    # 1. Viet74K
    viet74k_path = os.path.join(DATA_RAW_DIR, "Viet74K.txt")
    if os.path.exists(viet74k_path):
        with open(viet74k_path, "r", encoding="utf-8") as f:
            for line in f:
                w = normalize_text(line)
                if w:
                    lexicon.add(w)

    # 2. Dictionary headwords
    if os.path.exists(DICT_PATH):
        with open(DICT_PATH, "r", encoding="utf-8") as f:
            dict_data = json.load(f)
            for k in dict_data.keys():
                w = normalize_text(k)
                if w:
                    lexicon.add(w)

    # 3. Human assoc
    if os.path.exists(ASSOC_PATH):
        with open(ASSOC_PATH, "r", encoding="utf-8") as f:
            for line in f:
                for p in line.strip().split("\t"):
                    w = normalize_text(p)
                    if w:
                        lexicon.add(w)
    return lexicon

VIETNAMESE_RE = re.compile(r'^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s\-]+$')
VALID_LEXICON = None

def is_valid_vietnamese_token(w):
    global VALID_LEXICON
    if VALID_LEXICON is None:
        VALID_LEXICON = load_valid_lexicon()
    if not w or len(w) < 2 or len(w) > 30:
        return False
    if not VIETNAMESE_RE.match(w):
        return False
    if re.search(r'\d', w):
        return False
    return w in VALID_LEXICON

def build_graph():
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    blocklist = load_blocklist()
    print(f"Loaded {len(blocklist)} blocklisted words.")

    # graph: word -> {related_word: score}
    graph = defaultdict(lambda: defaultdict(float))

    def add_edge(w1, w2, weight, bidirectional=True):
        w1 = normalize_text(w1)
        w2 = normalize_text(w2)
        if not is_valid_vietnamese_token(w1) or not is_valid_vietnamese_token(w2):
            return
        if w1 == w2:
            return
        if w1 in blocklist or w2 in blocklist:
            return
        if w1 in STOPWORDS or w2 in STOPWORDS:
            return

        # Keep maximum weight if edge already exists
        if weight > graph[w1][w2]:
            graph[w1][w2] = round(weight, 3)

        if bidirectional:
            rev_w = weight * 0.9 # slightly lower in reverse
            if rev_w > graph[w2][w1]:
                graph[w2][w1] = round(rev_w, 3)

    # 1. Parse Human Association Dataset (Primary High-Precision Signal)
    if os.path.exists(ASSOC_PATH):
        print(f"1. Processing human association dataset ({ASSOC_PATH})...")
        with open(ASSOC_PATH, "r", encoding="utf-8") as f:
            f.readline()
            weights = [1.0, 0.92, 0.85, 0.78, 0.72]
            count = 0
            for line in f:
                parts = [p.strip() for p in line.strip().split("\t") if p.strip()]
                if len(parts) >= 2:
                    q = parts[0]
                    answers = parts[1:]
                    for idx, ans in enumerate(answers):
                        w = weights[idx] if idx < len(weights) else 0.65
                        add_edge(q, ans, w, bidirectional=True)
                    count += 1
        print(f"   Added edges from {count} human association query sets.")

    # 2. Parse Wiktionary / WordNet Synsets (data_raw/wn-wikt-vie.tab)
    if os.path.exists(WIKT_PATH):
        print(f"2. Processing WordNet synset mappings ({WIKT_PATH})...")
        synset_map = defaultdict(list)
        with open(WIKT_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.strip().split("\t")
                if len(parts) >= 3 and parts[1] == "vie:lemma":
                    synset_id = parts[0]
                    lemma = parts[2]
                    synset_map[synset_id].append(lemma)

        synset_edges = 0
        for syn_id, words in synset_map.items():
            if len(words) > 1:
                for i in range(len(words)):
                    for j in range(i + 1, len(words)):
                        add_edge(words[i], words[j], 0.88, bidirectional=True)
                        synset_edges += 1
        print(f"   Added {synset_edges} synonym edges from WordNet synsets.")

    # 3. Parse ViSim-400 (data_raw/visim400.txt)
    if os.path.exists(VISIM_PATH):
        print(f"3. Processing ViSim-400 semantic similarity pairs ({VISIM_PATH})...")
        visim_edges = 0
        with open(VISIM_PATH, "r", encoding="utf-8") as f:
            f.readline()
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 5:
                    w1 = parts[0].replace('_', ' ')
                    w2 = parts[1].replace('_', ' ')
                    try:
                        sim2 = float(parts[4]) # relatedness (1 - 10)
                        if sim2 >= 5.0:
                            weight = round(0.55 + (sim2 / 10.0) * 0.35, 3) # 0.72 - 0.90
                            add_edge(w1, w2, weight, bidirectional=True)
                            visim_edges += 1
                    except ValueError:
                        continue
        print(f"   Added {visim_edges} graded similarity edges from ViSim-400.")

    # 4. Parse Dictionary Definitions & Semantic Co-occurrence (data_raw/dictionary.json)
    if os.path.exists(DICT_PATH):
        print(f"4. Processing dictionary definitions ({DICT_PATH})...")
        with open(DICT_PATH, "r", encoding="utf-8") as f:
            dict_data = json.load(f)

        known_headwords = set(dict_data.keys())
        # Filter known headwords: must be >= 2 chars, not stopword, not blocklist
        clean_headwords = {
            hw: normalize_text(hw)
            for hw in known_headwords
            if normalize_text(hw) not in blocklist and normalize_text(hw) not in STOPWORDS and len(normalize_text(hw)) >= 2
        }

        # For fast lookup: length-based word candidates to match in text
        # Match multi-word first, then single word
        sorted_candidates = sorted(clean_headwords.values(), key=lambda x: len(x.split()), reverse=True)
        # Keep candidate vocabulary under 15k most useful words for definition matching
        def_vocab = set(sorted_candidates[:15000])

        dict_edges = 0
        for headword, entries in dict_data.items():
            hw_norm = normalize_text(headword)
            if hw_norm not in def_vocab:
                continue

            # Extract words mentioned in definitions and examples
            combined_text = []
            for entry in entries:
                d = entry.get("definition", "")
                ex = entry.get("example", "")
                combined_text.append(d)
                combined_text.append(ex)

            full_text = normalize_text(" ".join(combined_text))
            tokens = full_text.split()
            token_set = set(tokens)

            # Check 1-word and 2-word co-occurrences
            for i in range(len(tokens)):
                # unigram
                t1 = tokens[i]
                if t1 in def_vocab and t1 != hw_norm and len(t1) >= 2:
                    add_edge(hw_norm, t1, 0.60, bidirectional=False)
                    dict_edges += 1
                # bigram
                if i < len(tokens) - 1:
                    t2 = f"{tokens[i]} {tokens[i+1]}"
                    if t2 in def_vocab and t2 != hw_norm:
                        add_edge(hw_norm, t2, 0.68, bidirectional=False)
                        dict_edges += 1

        print(f"   Added {dict_edges} definition-context edges from dictionary.")

    # 5. Spreading Activation (ConceptNet traversal simulation)
    # If A -> B and B -> C, propagate partial activation A -> C
    print("5. Performing spreading activation (2-hop graph traversal)...")
    extended_edges = 0
    all_keys = list(graph.keys())
    for a in all_keys:
        a_neighbors = list(graph[a].items())
        # Sort top neighbors of A
        a_neighbors.sort(key=lambda x: x[1], reverse=True)
        for b, w_ab in a_neighbors[:8]: # top 8 1-hop
            if w_ab >= 0.70:
                b_neighbors = list(graph[b].items())
                b_neighbors.sort(key=lambda x: x[1], reverse=True)
                for c, w_bc in b_neighbors[:5]:
                    if c != a and c not in graph[a] and w_bc >= 0.70:
                        # 2-hop score
                        w_ac = round(w_ab * w_bc * 0.65, 3) # e.g. 0.9 * 0.85 * 0.65 = 0.50
                        if w_ac >= 0.40:
                            graph[a][c] = w_ac
                            extended_edges += 1

    print(f"   Added {extended_edges} 2-hop association edges.")

    # Prune and convert to clean serializable dict
    # Keep top 30 strongest relations per word to optimize file size
    compact_graph = {}
    for w, neighbors in graph.items():
        if len(neighbors) == 0:
            continue
        sorted_n = sorted(neighbors.items(), key=lambda x: x[1], reverse=True)[:25]
        compact_graph[w] = {k: v for k, v in sorted_n}

    with open(OUTPUT_GRAPH, "w", encoding="utf-8") as f:
        json.dump(compact_graph, f, ensure_ascii=False, indent=None)

    file_size_mb = os.path.getsize(OUTPUT_GRAPH) / 1024 / 1024
    print(f"\n🎉 Successfully created Association Knowledge Graph!")
    print(f"Total headwords with associations: {len(compact_graph):,}")
    print(f"File saved: {OUTPUT_GRAPH} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    build_graph()
