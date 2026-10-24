"""
Build curated Vietnamese vocabulary:
- Reads Viet74K.txt, human_assoc.tsv, visim400.txt
- Filters blocklist, URLs, numbers, garbage symbols
- Normalizes NFC, lowercase
- Produces public/data/vocab.json
"""
import os
import sys
import json
import re
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data_raw")
PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

VIET74K_PATH = os.path.join(DATA_RAW_DIR, "Viet74K.txt")
ASSOC_PATH = os.path.join(DATA_RAW_DIR, "human_assoc.tsv")
VISIM_PATH = os.path.join(DATA_RAW_DIR, "visim400.txt")
BLOCKLIST_PATH = os.path.join(DATA_RAW_DIR, "blocklist.txt")
OUTPUT_VOCAB = os.path.join(PUBLIC_DATA_DIR, "vocab.json")

# Stopwords that are purely grammatical particles and not meaningful association targets
STOPWORDS = {
    "và", "của", "là", "thì", "mà", "ở", "tại", "cho", "với", "nhưng",
    "bởi", "vì", "do", "nên", "như", "rằng", "để", "tuy", "dù", "nếu",
    "hoặc", "hay", "cũng", "đã", "đang", "sẽ", "được", "bị", "bởi_vì"
}

def normalize_word(w):
    w = unicodedata.normalize('NFC', w.strip().lower())
    w = w.replace('_', ' ')
    w = re.sub(r'\s+', ' ', w).strip()
    return w

def is_valid_vietnamese_word(w):
    if not w or len(w) < 2:
        return False
    # Reject pure numbers or words with numbers
    if re.search(r'\d', w):
        return False
    # Reject web links
    if 'http' in w or 'www' in w or '.com' in w:
        return False
    # Only allow Vietnamese alphabetic characters, spaces, and hyphens
    # Vietnamese unicode ranges: \w with accents
    if not re.match(r'^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s\-]+$', w):
        return False
    # Reject if too many words (> 4 syllables)
    tokens = w.split()
    if len(tokens) > 4:
        return False
    return True

def load_blocklist():
    blocklist = set()
    if os.path.exists(BLOCKLIST_PATH):
        with open(BLOCKLIST_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    blocklist.add(normalize_word(line))
    return blocklist

def build_vocab(max_vocab=60000):
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    blocklist = load_blocklist()
    print(f"Loaded {len(blocklist)} blocklisted terms.")

    vocab_dict = {} # word -> {"freq": int, "sources": set()}

    def add_word(raw_w, source, base_freq=10):
        w = normalize_word(raw_w)
        if not is_valid_vietnamese_word(w):
            return
        if w in blocklist or w in STOPWORDS:
            return
        if w not in vocab_dict:
            vocab_dict[w] = {"w": w, "freq": base_freq, "sources": {source}}
        else:
            vocab_dict[w]["freq"] += base_freq
            vocab_dict[w]["sources"].add(source)

    # 1. From human association seed (high importance)
    if os.path.exists(ASSOC_PATH):
        print(f"Reading from {ASSOC_PATH}...")
        with open(ASSOC_PATH, "r", encoding="utf-8") as f:
            f.readline()
            for line in f:
                parts = line.strip().split("\t")
                for p in parts:
                    if p:
                        add_word(p, "assoc", base_freq=100)

    # 2. From ViSim-400
    if os.path.exists(VISIM_PATH):
        print(f"Reading from {VISIM_PATH}...")
        with open(VISIM_PATH, "r", encoding="utf-8") as f:
            f.readline()
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 2:
                    add_word(parts[0], "visim", base_freq=50)
                    add_word(parts[1], "visim", base_freq=50)

    # 3. From Viet74K
    if os.path.exists(VIET74K_PATH):
        print(f"Reading from {VIET74K_PATH}...")
        with open(VIET74K_PATH, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                w = line.strip()
                if w:
                    # Viet74K has frequent words earlier
                    freq = max(5, 50 - (idx // 1500))
                    add_word(w, "viet74k", base_freq=freq)

    # 4. From fastText top 50k
    fasttext_path = os.path.join(DATA_RAW_DIR, "fasttext_vi_top50k.vec")
    if os.path.exists(fasttext_path):
        print(f"Reading from {fasttext_path}...")
        with open(fasttext_path, "r", encoding="utf-8") as f:
            f.readline()
            for idx, line in enumerate(f):
                parts = line.strip().split(" ", 1)
                if parts:
                    freq = max(2, 40 - (idx // 2000))
                    add_word(parts[0], "fasttext", base_freq=freq)

    print(f"Total candidate words: {len(vocab_dict)}")

    # Sort words: by priority (human assoc / visim first, then frequency)
    sorted_words = sorted(
        vocab_dict.values(),
        key=lambda x: (
            "assoc" in x["sources"] or "visim" in x["sources"],
            x["freq"]
        ),
        reverse=True
    )

    if len(sorted_words) > max_vocab:
        sorted_words = sorted_words[:max_vocab]

    # Convert to clean JSON serializable list
    final_vocab = []
    for item in sorted_words:
        final_vocab.append({
            "w": item["w"],
            "freq": int(item["freq"]),
            "hasAssoc": "assoc" in item["sources"],
            "hasVisim": "visim" in item["sources"]
        })

    with open(OUTPUT_VOCAB, "w", encoding="utf-8") as f:
        json.dump(final_vocab, f, ensure_ascii=False, indent=None)

    file_size_mb = os.path.getsize(OUTPUT_VOCAB) / 1024 / 1024
    print(f"Saved {len(final_vocab)} words to {OUTPUT_VOCAB} ({file_size_mb:.2f} MB)")
    return len(final_vocab)

if __name__ == "__main__":
    build_vocab(50000)
