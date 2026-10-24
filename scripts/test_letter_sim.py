import sys, json
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
v = json.load(open('public/data/vocab.json', encoding='utf-8'))
w2i = {x['w']: i for i, x in enumerate(v)}
vectors = np.fromfile('public/data/vectors.bin', dtype=np.float16).reshape(len(v), 300).astype(np.float32)
g = json.load(open('public/data/graph.json', encoding='utf-8'))

firstLetter = 'c'
secret = 'cà phê'

def test_clue(clue):
    v_c = vectors[w2i[clue]] if clue in w2i else np.zeros(300)
    sims = np.dot(vectors, v_c)
    scored = []
    for i, item in enumerate(v):
        w = item['w']
        if w == clue: continue
        s = float(sims[i])
        if clue in g and w in g[clue]:
            s += g[clue][w] * 0.8
        if w.startswith(firstLetter):
            s += 0.4
        else:
            s -= 0.2
        scored.append((w, s))
    scored.sort(key=lambda x: -x[1])
    print(f'Clue: "{clue}" (letter: "{firstLetter}"):')
    for rank, (w, s) in enumerate(scored[:5], 1):
        leak = ' 🎯 [LEAKED!]' if w == secret else ''
        print(f'  #{rank}: {w} ({s:.3f}){leak}')

test_clue('đen đá')
test_clue('sáng sớm')
test_clue('nâu')
test_clue('buổi sáng')
