import sys, json
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
v = json.load(open('public/data/vocab.json', encoding='utf-8'))
w2i = {x['w']: i for i, x in enumerate(v)}
i2w = {i: x['w'] for i, x in enumerate(v)}
vectors = np.fromfile('public/data/vectors.bin', dtype=np.float16).reshape(len(v), 300).astype(np.float32)
g = json.load(open('public/data/graph.json', encoding='utf-8'))

def test_deduction(prefix, clue, secret):
    print(f'=== Courier clue: "{clue}" (prefix: "{prefix}") ===')
    v_p = vectors[w2i[prefix]] if prefix in w2i else np.zeros(300)
    v_c = vectors[w2i[clue]] if clue in w2i else np.zeros(300)
    v_query = 0.3 * v_p + 0.7 * v_c
    norm = np.linalg.norm(v_query)
    if norm > 1e-6:
        v_query /= norm
    
    sims = np.dot(vectors, v_query)
    scored = []
    for i, item in enumerate(v):
        w = item['w']
        if w == prefix or w == clue:
            continue
        score = float(sims[i])
        # Knowledge graph boost
        if clue in g and w in g[clue]:
            score += g[clue][w] * 0.8
        # Prefix bonus: courier knows word starts with prefix!
        if w.startswith(prefix + ' ') or w == prefix:
            score += 0.35
        scored.append((w, score))
    
    scored.sort(key=lambda x: -x[1])
    for rank, (w, s) in enumerate(scored[:5], 1):
        is_secret = ' 🎯 [SECRET! LEAKED!]' if w == secret else ''
        print(f'  #{rank}: {w} (score: {s:.3f}){is_secret}')

def test_friend(prefix, clues, secret):
    print(f'\n=== Friend receiving all 3 clues: {clues} ===')
    v_p = vectors[w2i[prefix]] if prefix in w2i else np.zeros(300)
    vecs = [v_p * 0.3]
    for c in clues:
        if c in w2i:
            vecs.append(vectors[w2i[c]] * 0.4)
    v_query = np.sum(vecs, axis=0)
    norm = np.linalg.norm(v_query)
    if norm > 1e-6:
        v_query /= norm
    
    sims = np.dot(vectors, v_query)
    scored = []
    for i, item in enumerate(v):
        w = item['w']
        if w == prefix or w in clues:
            continue
        score = float(sims[i])
        
        # Intersecting graph associations
        hits = 0
        graph_bonus = 0.0
        for c in clues:
            if c in g and w in g[c]:
                hits += 1
                graph_bonus += g[c][w] * 0.7
        if hits >= 2:
            graph_bonus *= (1.5 ** (hits - 1))
        score += graph_bonus

        # Prefix bonus
        if w.startswith(prefix + ' ') or w == prefix:
            score += 0.35
        scored.append((w, score))
    
    scored.sort(key=lambda x: -x[1])
    for rank, (w, s) in enumerate(scored[:5], 1):
        is_secret = ' 🏆 [VICTORY! SECRET DECODED!]' if w == secret else ''
        print(f'  #{rank}: {w} (score: {s:.3f}){is_secret}')

test_deduction('cà', 'đỏ', 'cà phê')
test_deduction('cà', 'chua', 'cà phê')
test_deduction('cà', 'đen đá', 'cà phê')
test_deduction('cà', 'đắng', 'cà phê')
test_deduction('cà', 'sáng sớm', 'cà phê')

test_friend('cà', ['hạt', 'tỉnh táo', 'đắng'], 'cà phê')
