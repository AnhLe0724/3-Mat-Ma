"""
Check raw data sources and download basic benchmarks (ViSim-400)
"""
import os
import sys
import urllib.request
import json

DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data_raw")
VISIM_URL = "https://raw.githubusercontent.com/NLP-Projects/Word-Similarity/master/datasets/ViSim-400/Visim-400.txt"
VISIM_FILE = os.path.join(DATA_RAW_DIR, "visim400.txt")

def ensure_visim400():
    os.makedirs(DATA_RAW_DIR, exist_ok=True)
    if not os.path.exists(VISIM_FILE):
        print(f"Downloading ViSim-400 to {VISIM_FILE}...")
        try:
            urllib.request.urlretrieve(VISIM_URL, VISIM_FILE)
            print("ViSim-400 downloaded successfully.")
        except Exception as e:
            print("Failed to download ViSim-400:", e)
            return False
    else:
        print(f"ViSim-400 already exists at {VISIM_FILE}.")

    # Validate lines
    with open(VISIM_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
        print(f"ViSim-400 total rows: {len(lines)}")
        if len(lines) > 300:
            print("ViSim-400 check: OK")
            return True
        else:
            print("ViSim-400 check: Corrupted or too short!")
            return False

def check_sources():
    ok = True
    print("--- 1. Checking ViSim-400 Benchmark ---")
    if not ensure_visim400():
        ok = False

    print("\n--- 2. Checking System Dependencies ---")
    for mod in ["numpy", "scipy", "requests"]:
        try:
            m = __import__(mod)
            print(f"  {mod}: OK (version {getattr(m, '__version__', 'unknown')})")
        except ImportError:
            print(f"  {mod}: MISSING")
            ok = False

    print("\nCheck summary:", "ALL PASS" if ok else "FAILED CHECKS")
    return ok

if __name__ == "__main__":
    if not check_sources():
        sys.exit(1)
