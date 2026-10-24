"""
Stream and extract top N Vietnamese words with 300-dim vectors from fastText cc.vi.300.vec.gz
This runs in ~15-30 seconds by streaming only the needed gzip chunks without downloading the entire 1.2GB/4.5GB file.
"""
import os
import sys
import time
import zlib
import urllib.request
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

FASTTEXT_URL = "https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.vi.300.vec.gz"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data_raw")
OUTPUT_VEC = os.path.join(OUTPUT_DIR, "fasttext_vi_top50k.vec")

def download_top_fasttext(n_target=50000):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if os.path.exists(OUTPUT_VEC):
        print(f"File already exists: {OUTPUT_VEC}")
        return True

    print(f"Streaming top {n_target} words from fastText ({FASTTEXT_URL})...")
    start_time = time.time()

    req = urllib.request.Request(FASTTEXT_URL, headers={'User-Agent': 'Mozilla/5.0'})
    decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    
    count = 0
    buffer = b''
    
    with open(OUTPUT_VEC, "w", encoding="utf-8") as out_f:
        with urllib.request.urlopen(req, timeout=30) as resp:
            # First line is header: 2000000 300
            # We will read chunks
            while count < n_target:
                chunk = resp.read(128 * 1024) # 128KB
                if not chunk:
                    break
                decompressed = decompressor.decompress(chunk)
                buffer += decompressed
                lines = buffer.split(b'\n')
                buffer = lines[-1]
                
                for line in lines[:-1]:
                    if not line:
                        continue
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    if count == 0 and len(line_str.split()) == 2:
                        # header line (e.g. '2000000 300')
                        out_f.write(f"{n_target} 300\n")
                        count += 1
                        continue
                    out_f.write(line_str + "\n")
                    count += 1
                    if count % 10000 == 0:
                        print(f"  Extracted {count}/{n_target} words ({time.time() - start_time:.1f}s)...")
                    if count >= n_target:
                        break

    print(f"Finished extracting {count} words in {time.time() - start_time:.2f}s!")
    print(f"Saved to: {OUTPUT_VEC}")
    return True

if __name__ == "__main__":
    n = 50000
    if len(sys.argv) > 1:
        n = int(sys.argv[1])
    download_top_fasttext(n)
