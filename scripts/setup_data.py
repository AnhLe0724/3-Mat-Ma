"""
Unified setup script for all offline data:
Run via: npm run setup:data
"""
import os
import sys
import subprocess
import time

sys.stdout.reconfigure(encoding='utf-8')

SCRIPTS_DIR = os.path.dirname(__file__)

def run_step(title, script_name, args=None):
    print(f"\n=======================================================")
    print(f"  [STEP] {title}")
    print(f"=======================================================")
    start = time.time()
    cmd = [sys.executable, os.path.join(SCRIPTS_DIR, script_name)]
    if args:
        cmd.extend(args)
    ret = subprocess.run(cmd)
    if ret.returncode != 0:
        print(f"❌ Error in {script_name}! Exit code {ret.returncode}")
        sys.exit(ret.returncode)
    print(f"✔ Completed in {time.time() - start:.2f}s")

def main():
    print("🚀 Starting Từ Liên Tưởng Offline Data Pipeline Setup...")
    start_all = time.time()

    # 1. Check sources
    run_step("1/6 Checking Sources and Dependencies", "check_sources.py")

    # 2. Download fastText top 50k
    run_step("2/6 Streaming FastText Vectors (Top 50k)", "download_fasttext.py", ["50000"])

    # 3. Build Vocab
    run_step("3/6 Building Curated Vocabulary (vocab.json)", "build_vocab.py")

    # 4. Build Vectors
    run_step("4/6 Generating Binary Float16 Matrix (vectors.bin)", "build_vectors.py")

    # 5. Build Extras (Hubness & Variants)
    run_step("5/6 Computing Hubness CSLS (hub.bin) & Variants (variants.json)", "build_extras.py")

    # 6. Tune & Calibrate
    run_step("6/7 Tuning Parameters & Fitting Calibration Curves", "tune_params.py")

    # 7. Knowledge Graph compilation
    run_step("7/7 Compiling Association Knowledge Graph (graph.json)", "build_association_graph.py")

    total_time = time.time() - start_all
    print(f"\n🎉 ALL OFFLINE DATA SUCCESSFULLY GENERATED IN {total_time:.1f}s!")
    print("You can now run: npm run dev")

if __name__ == "__main__":
    main()
