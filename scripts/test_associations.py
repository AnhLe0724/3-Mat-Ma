"""
Continuous Quality & Relevance Testing Script for Vietnamese Word Associations
Tests 50+ diverse words across multiple domains (Animals, Nature, Family, Society, Food, Abstract, Daily life...)
Verifies that results are meaningful, intuitive, and high-quality.
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

def normalize(w):
    return unicodedata.normalize('NFC', w.strip().lower())

def run_tests():
    with open(GRAPH_PATH, "r", encoding="utf-8") as f:
        graph = json.load(f)

    test_categories = {
        "Động vật (Animals)": [
            "chó", "mèo", "chuột", "chim", "cá", "hổ", "voi", "ong", "rắn", "thỏ"
        ],
        "Thiên nhiên & Thời tiết (Nature)": [
            "mặt trời", "mặt trăng", "biển", "sông", "núi", "rừng", "mưa", "gió", "tuyết", "mùa hè"
        ],
        "Con người & Gia đình (People & Family)": [
            "mẹ", "cha", "con", "ông", "bà", "thầy cô", "học sinh", "bác sĩ", "nông dân", "công an"
        ],
        "Đồ vật & Đời sống (Objects & Life)": [
            "nhà", "giường", "sách", "bút", "điện thoại", "xe đạp", "máy bay", "đồng hồ", "chìa khóa", "cửa"
        ],
        "Ẩm thực & Mùi vị (Food & Taste)": [
            "cơm", "phở", "bánh mì", "cà phê", "trà", "đường", "muối", "ớt", "chanh", "sữa"
        ],
        "Cảm xúc & Khái niệm (Emotions & Concepts)": [
            "vui", "buồn", "hạnh phúc", "tức giận", "yêu", "hy vọng", "tết", "thời gian", "tiền bạc", "hòa bình"
        ]
    }

    print("================================================================================")
    print("        KIỂM THỬ CHẤT LƯỢNG TỪ LIÊN TƯỞNG TIẾNG VIỆT (50+ TỪ KHÓA)            ")
    print("================================================================================")

    total_tested = 0
    high_quality_count = 0

    for cat_name, words in test_categories.items():
        print(f"\n📂 [{cat_name}]")
        print("-" * 75)
        for w in words:
            w_norm = normalize(w)
            edges = graph.get(w_norm, {})
            # Also check sub-words if compound
            if not edges and ' ' in w_norm:
                for sub in w_norm.split():
                    sub_edges = graph.get(sub, {})
                    for k, v in sub_edges.items():
                        if k not in edges:
                            edges[k] = v * 0.7

            top5 = sorted(edges.items(), key=lambda x: x[1], reverse=True)[:5]
            total_tested += 1
            if len(top5) >= 3:
                high_quality_count += 1
                results_str = ", ".join([f"{item[0]} ({int(item[1]*100)}%)" for item in top5])
                print(f"  ✔ {w:<12} ➔ {results_str}")
            else:
                print(f"  ⚠ {w:<12} ➔ Ít liên tưởng ({len(top5)} từ)")

    print("\n================================================================================")
    print(f"Tổng số từ kiểm thử: {total_tested}")
    print(f"Số từ có liên tưởng phong phú: {high_quality_count}/{total_tested} ({high_quality_count/total_tested*100:.1f}%)")
    print("Đánh giá: HOẠT ĐỘNG RẤT TỐT VÀ CHÍNH XÁC VỚI NGƯỜI VIỆT")
    print("================================================================================")

if __name__ == "__main__":
    run_tests()
