# Kế hoạch chi tiết: Web "Từ Liên Tưởng" (chạy local, offline, không API)

> Mục tiêu: nhập 1 từ khóa → bấm **Tìm từ tương đồng** → trả về **1 từ liên tưởng mạnh nhất (kèm % tương đồng)** và **4 từ gần nhất tiếp theo**, mô phỏng cách con người liên tưởng. Toàn bộ chạy local bằng `npm run dev`, model tải sẵn, không gọi API ngoài khi chạy.

---

## 1. Phạm vi & nguyên tắc

| Hạng mục | Quyết định |
|---|---|
| Ngôn ngữ chính | Tiếng Việt (có hỗ trợ phụ tiếng Anh nếu nguồn dữ liệu cho phép) |
| Chạy | `npm run dev` (Vite), mọi tính toán trong trình duyệt (Web Worker) |
| Mạng | Chỉ cần mạng ở bước **cài đặt/tải model một lần**. Lúc chạy: offline hoàn toàn |
| UI | Chỉ 1 ô nhập + 1 nút + khu kết quả + console panel phía dưới |
| Tiêu chí thành công | Kết quả "nghe hợp lý với người Việt", ổn định, trả lời < 300 ms sau khi model đã nạp |

**Nguyên tắc:** chất lượng liên tưởng quan trọng hơn mọi thứ khác. Mọi lựa chọn kỹ thuật đều phải **đo được** bằng benchmark (mục 7), không chọn theo cảm tính.

---

## 2. Phương pháp: vì sao dùng "Hybrid" thay vì 1 model đơn lẻ

### 2.1. Các lựa chọn đã cân nhắc

| Phương pháp | Ưu | Nhược | Kết luận |
|---|---|---|---|
| Word2Vec/GloVe/fastText tiếng Việt (vd. PhoW2V, fastText `cc.vi.300`) | Nhanh, nhẹ, bản chất là "từ gần từ" | Thiên về đồng xuất hiện; từ nhiều âm tiết/OOV yếu | Dùng làm **tín hiệu nền** |
| ConceptNet Numberbatch (có tiếng Việt) | Kết hợp tri thức thường thức + embedding → gần "liên tưởng của người" hơn (chó → mèo, xương, sủa…) | Độ phủ tiếng Việt vừa phải | Dùng làm **tín hiệu chính về ngữ nghĩa thường thức** |
| Sentence embedding đa ngữ (vd. `multilingual-e5-small`, `paraphrase-multilingual-MiniLM-L12-v2`) chạy bằng Transformers.js (ONNX/WASM) | Xử lý được từ lạ, cụm từ, từ ghép; có ngữ cảnh | Với 1 từ đơn đôi khi kém hơn static embedding; nặng hơn | Dùng làm **tín hiệu bổ sung + fallback OOV** |
| LLM nhỏ chạy local (sinh từ liên tưởng) | Gần cách người nghĩ | Chậm, không ổn định, không có điểm số xác suất chuẩn, nặng | **Không dùng** cho lõi (có thể là thử nghiệm sau) |
| Dữ liệu liên tưởng của người (kiểu Small World of Words) | Là "đáp án thật" của liên tưởng | Chưa có bản tiếng Việt quy mô lớn | Dùng như **ý tưởng đánh giá**, tự thu một bộ nhỏ để tinh chỉnh trọng số |

### 2.2. Quyết định: Ensemble 3 tầng + hiệu chỉnh

1. **Tầng 1 – Static embeddings (ensemble)**: Numberbatch + PhoW2V/fastText, mỗi vector chuẩn hóa L2 rồi nối (concat) có trọng số. Cosine của vector nối = trung bình có trọng số của các cosine thành phần.
2. **Tầng 2 – Sentence embedding đa ngữ**: tính embedding của từ khóa lúc chạy (hoặc tra sẵn nếu đã tiền tính), so với embedding đã tiền tính của toàn bộ từ ứng viên.
3. **Tầng 3 – Hậu xử lý kiểu "người"**: sửa hubness (CSLS), ưu tiên từ phổ biến, lọc biến thể/trùng/nhạy cảm.

Kết hợp điểm bằng **z-score theo từng truy vấn + trọng số** (hoặc RRF – Reciprocal Rank Fusion, so sánh cả hai trong benchmark rồi chọn cái tốt hơn).

> ⚠️ Cần kiểm tra lại tên model, link tải, **giấy phép** và phiên bản thư viện tại thời điểm cài đặt (các tên trên là ứng viên, không phải cam kết cố định).

---

## 3. Kiến trúc tổng thể

```
┌───────────────────────────── Browser ─────────────────────────────┐
│  UI (React + TS)                                                  │
│   ├─ SearchCard (input + nút)                                     │
│   ├─ ResultView (1 từ chính + 4 từ phụ)                           │
│   └─ ConsolePanel (log: quy trình / lỗi / nút bấm)                │
│                │  postMessage                                     │
│  Web Worker ◄──┴──► Logger (event bus → ConsolePanel)             │
│   ├─ Loader: nạp vocab.json + vectors.bin (+ ONNX model)          │
│   ├─ Normalizer: NFC, lowercase, tách âm tiết, tra vocab          │
│   ├─ Retriever: brute-force dot product (Float32Array)            │
│   ├─ Fusion + CSLS + Prior + Filter                               │
│   └─ Calibrator: cosine → % tương đồng, softmax → xác suất        │
└───────────────────────────────────────────────────────────────────┘
        ▲ file tĩnh trong /public/data và /public/models (tải sẵn)
```

**Vì sao brute-force, không cần vector DB/ANN?** 100k từ × ~600 chiều ≈ 60 triệu phép nhân – cộng, chạy trong Worker khoảng vài chục ms. Đơn giản, chính xác tuyệt đối (không mất recall như ANN).

---

## 4. Pipeline dữ liệu offline (chạy 1 lần)

Script Python (hoặc Node) trong `scripts/`, chạy bằng `npm run setup:data`.

### 4.1. Bước tải
1. Tải embeddings: Numberbatch (bản đa ngữ, lọc tiền tố `/c/vi/`), PhoW2V hoặc fastText `cc.vi.300`.
2. Tải model ONNX sentence embedding đa ngữ vào `public/models/<tên-model>/` (kèm tokenizer, config).
3. Tải danh sách từ tiếng Việt (từ điển mở, danh sách từ vựng đã tách từ) để làm **kho từ ứng viên**.

### 4.2. Xây kho từ ứng viên (`vocab`)
- Chuẩn hóa Unicode **NFC**, chữ thường, bỏ ký tự lạ/số/URL/tên riêng quá hiếm.
- Giữ cả **từ ghép nhiều âm tiết** (`con chó`, `bầu trời`) – đây là điểm khó của tiếng Việt.
- Lọc theo tần suất: giữ khoảng **50k–100k** từ phổ biến nhất có vector ở ít nhất 1 nguồn.
- Loại stopword (`và`, `của`, `là`…), từ viết tắt rác, từ tục/nhạy cảm (danh sách chặn riêng `blocklist.txt`).
- Lưu `vocab.json`: `[{ w, freq, hasNB, hasPho }]`.

### 4.3. Dựng ma trận vector
- Với mỗi từ: lấy vector từng nguồn → chuẩn hóa L2 → nhân trọng số `sqrt(w_i)` → nối.
- Từ ghép thiếu vector: **trung bình các vector âm tiết** (fallback), đánh dấu cờ `approx=true` (có thể giảm điểm nhẹ).
- Lượng tử hóa: **float16** (hoặc int8 + scale) để giảm kích thước (100k × 600 dims ≈ 120 MB fp16 / 60 MB int8 – chọn theo benchmark sai số).
- Xuất `vectors.bin` + `meta.json` (số chiều, thứ tự nguồn, scale).

### 4.4. Tiền tính phục vụ chất lượng
- **Hubness `r_c`**: với mỗi từ ứng viên, trung bình cosine tới k=10 láng giềng gần nhất → `hub.bin`.
- **Sentence embedding** cho toàn bộ ứng viên → `sent.bin` (cùng model sẽ chạy lúc runtime).
- **Bảng nhóm biến thể**: gom các từ chỉ khác nhau về dấu/chính tả/số ít–nhiều để chống lặp (`hoà/hòa`, `thuỷ/thủy`…) → `variants.json`.
- Kiểm tra toàn vẹn: in thống kê (số từ, % phủ, kích thước), băm SHA256 các file.

---

## 5. Thuật toán xếp hạng lúc chạy

Cho từ khóa `q` đã chuẩn hóa:

**Bước 1 – Tra vector**
- Có trong vocab → dùng vector sẵn.
- Không có → (a) trung bình vector âm tiết; (b) vẫn luôn tính được qua sentence embedding. Ghi log mức độ tin cậy `OOV-partial`/`OOV-full`.

**Bước 2 – Điểm thô cho mọi ứng viên `c`**
- `s_static(q,c)` = cosine trên vector nối (Tầng 1).
- `s_sent(q,c)` = cosine sentence embedding (Tầng 2).

**Bước 3 – Sửa hubness (CSLS)**
```
CSLS(q,c) = 2·cos(q,c) − r_c − r_q
```
`r_q` tính từ top-k của `q`; `r_c` tiền tính. Giúp các từ "hub" (gần mọi thứ) không lấn át.

**Bước 4 – Hợp nhất**
```
z_static = zscore(CSLS_static)    // z-score trên toàn bộ ứng viên của truy vấn này
z_sent   = zscore(cos_sent)
score    = α·z_static + β·z_sent + γ·log(freq_c) − δ·approx_c
```
`α, β, γ, δ` tinh chỉnh bằng benchmark (khởi điểm gợi ý: α=0.55, β=0.35, γ=0.10, δ nhỏ).
Chạy song song phương án RRF để đối chiếu.

**Bước 5 – Lọc**
- Loại chính `q` và mọi biến thể của nó (`variants.json`).
- Loại ứng viên chứa nguyên `q` kiểu hiển nhiên nếu gây trùng lặp vô nghĩa (cấu hình được).
- Loại `blocklist`, từ quá hiếm (freq dưới ngưỡng).
- Khử trùng giữa các kết quả (không để 2 biến thể của cùng 1 từ trong top 5).

**Bước 6 – Chọn Top 5** theo `score` giảm dần: #1 = "từ liên quan nhất", #2–#5 = "4 từ gần tiếp theo".

**Bước 7 – Tính phần trăm** (mục 6).

---

## 6. "Bao nhiêu %": định nghĩa trung thực

Cosine thô **không phải xác suất**, nên app hiển thị 2 đại lượng có định nghĩa rõ ràng:

1. **% Tương đồng (hiển thị chính)** – cosine/score được **hiệu chỉnh** về thang người chấm:
   - Dùng bộ **ViSim-400** (hoặc bộ tự thu) để huấn luyện hàm hiệu chỉnh đơn điệu (**isotonic regression** hoặc logistic) ánh xạ `score → [0,100]%`.
   - Nhờ vậy 90% nghĩa là "rất gần như người cảm nhận", không phải con số tùy tiện.
2. **Xác suất liên tưởng (hiển thị phụ, tooltip)** – softmax trên top-K (K≈50):
```
p_i = exp(score_i / T) / Σ_j exp(score_j / T)
```
   `T` chọn sao cho phân bố khớp với tần suất "từ được người nêu đầu tiên" trên bộ thử.

Trong UI ghi chú nhỏ: *"% tương đồng đã hiệu chỉnh; không phải xác suất tuyệt đối."*

---

## 7. Đánh giá chất lượng (bắt buộc trước khi chốt)

| Benchmark | Mục đích | Chỉ số |
|---|---|---|
| ViSim-400 (độ tương đồng từ tiếng Việt do người chấm) | Chọn nguồn vector, trọng số | Spearman ρ (cao hơn tốt hơn) |
| Bộ thử tự tạo **200–300 từ khóa** × đáp án liên tưởng do 5–10 người Việt viết (3 từ/người) | Đo "giống người" thực sự | Hit@5, MRR, nDCG@5 |
| Danh sách "bẫy": từ đa nghĩa, từ ghép, từ mượn, từ lóng, từ sai dấu | Phát hiện lỗi | Duyệt tay |
| Hiệu năng | Đảm bảo mượt | Thời gian nạp, thời gian truy vấn p50/p95, RAM |

**Quy trình tinh chỉnh:** thử từng cấu hình (chỉ Numberbatch / chỉ PhoW2V / chỉ sentence / ensemble, bật–tắt CSLS, bật–tắt prior, fusion z-score vs RRF) → bảng kết quả → chọn cấu hình tốt nhất → khóa tham số vào `config/ranking.json`.

Kết quả ghi vào `docs/benchmark.md` để so sánh khi thay model sau này.

---

## 8. Thiết kế giao diện (UI/UX)

### 8.1. Phong cách
Kết hợp cảm giác **Raycast / Spotlight** (ô tìm kiếm trung tâm, bo tròn, kính mờ) với **Linear/Vercel** (dark mode tối giản, typography sắc nét) và **panel console kiểu VS Code** ở dưới.

### 8.2. Design tokens
- Nền: `#0B0C0F` / bề mặt `#14161B` / viền `rgba(255,255,255,0.08)`.
- Nhấn: gradient tím–xanh (`#7C5CFF → #3BA3FF`), trạng thái: xanh lá (OK), vàng (cảnh báo), đỏ (lỗi).
- Font: **Inter** (UI), **JetBrains Mono** (console). Bo góc 12–16px, bóng mềm, hiệu ứng blur nền.
- Có chế độ sáng/tối theo `prefers-color-scheme` (mặc định tối).

### 8.3. Bố cục
```
┌────────────────────────────────────────────────────┐
│                  Từ Liên Tưởng                     │  ← tiêu đề nhỏ
│                                                    │
│   ┌──────────────────────────────────────┐         │
│   │ 🔍  Nhập một từ…                      │         │  ← input lớn, autofocus
│   └──────────────────────────────────────┘         │
│            [  Tìm từ tương đồng  ]                 │  ← 1 nút duy nhất
│                                                    │
│   ┌──────────── TỪ LIÊN QUAN NHẤT ─────────┐       │
│   │      mèo          ◯ 87%                │       │  ← thẻ hero
│   └────────────────────────────────────────┘       │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│   │ sủa  │ │xương │ │ thú  │ │ cún  │              │  ← 4 thẻ phụ + thanh %
│   │ 74%  │ │ 71%  │ │ 69%  │ │ 66%  │              │
│   └──────┘ └──────┘ └──────┘ └──────┘              │
├──────────────── ▾ Console (kéo thay đổi cao) ──────┤
│ 14:02:11.034 INFO  [UI]     Click "Tìm từ tương đồng"│
│ 14:02:11.036 INFO  [Search] Chuẩn hóa: "Chó"→"chó"   │
│ 14:02:11.071 INFO  [Search] Top-5 xong (35 ms)       │
└────────────────────────────────────────────────────┘
```

### 8.4. Trạng thái & tương tác
- **Lần đầu**: màn hình nạp dữ liệu có thanh tiến độ (nạp vocab → vectors → model); nút bị vô hiệu cho đến khi sẵn sàng.
- **Đang tìm**: nút hiện spinner, thẻ kết quả dạng skeleton.
- **Kết quả**: animation xuất hiện lần lượt (stagger 60 ms), số % đếm lên, thanh % chạy.
- **Rỗng/OOV**: thông báo thân thiện + gợi ý "thử từ khác"; vẫn hiển thị kết quả gần đúng nếu có, kèm nhãn "độ tin cậy thấp".
- **Lỗi**: banner đỏ gọn + chi tiết trong console.
- **Phím tắt**: `Enter` = tìm; `Ctrl+\`` = bật/tắt console.
- **Trợ năng**: label cho input, tương phản ≥ 4.5:1, focus ring rõ, `aria-live="polite"` cho kết quả.
- Giao diện **chỉ có**: ô nhập + nút tìm + kết quả + console (không thêm menu/cài đặt).

---

## 9. Panel Console (đặc tả)

**Vị trí:** cố định dưới cùng, có thanh kéo đổi chiều cao, thu gọn/mở rộng.

**Mức log:** `DEBUG`, `INFO`, `WARN`, `ERROR` (màu khác nhau).

**Cấu trúc 1 dòng log:** `HH:mm:ss.SSS · LEVEL · [Nguồn] · Thông điệp · (+thời gian ms)`
Nguồn: `UI`, `Loader`, `Worker`, `Model`, `Search`, `Calib`.

**Phải ghi lại:**
1. **Nút được bấm / sự kiện UI:** `Click "Tìm từ tương đồng"`, `Enter pressed`, `Input changed (len=3)`, `Toggle console`, `Clear console`.
2. **Quy trình:** bắt đầu nạp file (kích thước, thời gian), nạp xong, khởi tạo Worker, model sẵn sàng, từng bước tìm kiếm (chuẩn hóa → tra vocab → tính điểm → CSLS → fusion → lọc → hiệu chỉnh %), tổng thời gian.
3. **Kết quả:** Top-5 với `score` thô, `%` và `p`.
4. **Cảnh báo:** từ OOV, dùng fallback, độ tin cậy thấp.
5. **Lỗi:** bắt qua `try/catch`, `window.onerror`, `unhandledrejection`, lỗi Worker (`worker.onerror`), lỗi fetch file — kèm stack rút gọn.

**Tính năng:** lọc theo mức/nguồn, tự cuộn xuống cuối (tạm dừng khi người dùng cuộn lên), nút **Clear**, **Copy log**, giới hạn 1000 dòng (vòng đệm), phát log từ Worker sang UI qua `postMessage({type:'log', ...})`.

---

## 10. Công nghệ & cấu trúc dự án

**Stack:** Vite + React + TypeScript + Tailwind CSS + Framer Motion (animation) + Zustand (state) + Vitest (test). Sentence model chạy bằng `@huggingface/transformers` (Transformers.js) với `env.allowRemoteModels = false` và `localModelPath = '/models'` để đảm bảo **không gọi mạng**.

```
tu-lien-tuong/
├─ package.json            # scripts: dev, build, setup:data, bench, test
├─ vite.config.ts          # (tùy chọn) header COOP/COEP để bật WASM đa luồng
├─ config/ranking.json     # α β γ δ T, ngưỡng, K…
├─ scripts/
│  ├─ download_models.*    # tải model/embedding
│  ├─ build_vocab.*        # 4.2
│  ├─ build_vectors.*      # 4.3
│  ├─ build_extras.*       # 4.4 (hub, sent, variants)
│  └─ benchmark.*          # mục 7
├─ public/
│  ├─ data/ (vocab.json, vectors.bin, hub.bin, sent.bin, variants.json, meta.json)
│  └─ models/<sentence-model>/
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ components/ (SearchCard, ResultHero, ResultCard, ConsolePanel, LoadingScreen)
│  ├─ core/ (logger.ts, normalize.ts, ranking.ts, calibrate.ts, types.ts)
│  ├─ worker/search.worker.ts
│  ├─ store/ (useAppStore.ts)
│  └─ styles/
├─ tests/ (normalize, ranking, calibrate)
└─ docs/ (benchmark.md, KE_HOACH.md)
```

**Lệnh dự kiến:**
```
npm install
npm run setup:data   # chạy 1 lần: tải + dựng dữ liệu
npm run dev          # chạy web local
npm run bench        # đo chất lượng & hiệu năng
```

---

## 11. Lộ trình thực hiện

### Giai đoạn 0 – Chuẩn bị (0,5 ngày)
- [ ] Khảo sát lại nguồn vector/model hiện có, **ghi nhận giấy phép** từng nguồn.
- [ ] Chốt kho từ ứng viên và danh sách chặn.

### Giai đoạn 1 – Dữ liệu & baseline (1–2 ngày)
- [ ] Viết `build_vocab`, `build_vectors`; xuất file nhị phân.
- [ ] Script Python/Node baseline: nhập từ → top-5 (chỉ static).
- [ ] Chạy benchmark ViSim-400 để chọn nguồn/tỉ lệ nối.

### Giai đoạn 2 – Nâng chất lượng (2–3 ngày)
- [ ] Thêm sentence embedding + `sent.bin`.
- [ ] Cài CSLS, prior tần suất, lọc biến thể, khử trùng.
- [ ] Thu bộ liên tưởng tự tạo (200–300 từ), đo Hit@5/MRR.
- [ ] Tinh chỉnh tham số, so z-score vs RRF → khóa `ranking.json`.
- [ ] Huấn luyện hàm hiệu chỉnh % và `T` cho softmax.

### Giai đoạn 3 – Lõi web (1–2 ngày)
- [ ] Khởi tạo Vite + React + TS + Tailwind.
- [ ] Logger + event bus; Web Worker nạp dữ liệu và trả kết quả.
- [ ] Port thuật toán sang `core/ranking.ts` (kết quả phải **khớp** script baseline – có test đối chiếu).

### Giai đoạn 4 – Giao diện (1–2 ngày)
- [ ] SearchCard, ResultHero, ResultCard, màn hình nạp, skeleton, animation.
- [ ] ConsolePanel đầy đủ (mục 9), bắt lỗi toàn cục.
- [ ] Trợ năng, responsive (≥ 360px).

### Giai đoạn 5 – Kiểm thử & hoàn thiện (1 ngày)
- [ ] Unit test (chuẩn hóa, ranking, hiệu chỉnh), smoke test thủ công 50 từ.
- [ ] Đo hiệu năng, tối ưu (lượng tử hóa, lazy-load model).
- [ ] Viết `README` + `docs/benchmark.md`.

---

## 12. Tiêu chí nghiệm thu

- [ ] `npm run dev` chạy được **khi ngắt mạng** (sau khi đã `setup:data`).
- [ ] Nhập 1 từ → ra đúng **1 từ chính + 4 từ phụ**, mỗi từ có %.
- [ ] Thời gian truy vấn p95 < 300 ms (sau khi nạp xong); nạp lần đầu hiển thị tiến độ.
- [ ] Benchmark: Hit@5 và Spearman **tốt hơn baseline đơn nguồn** (ghi số liệu cụ thể).
- [ ] Console ghi đủ: nút bấm, từng bước quy trình, cảnh báo, lỗi (thử cố ý gây lỗi để kiểm tra).
- [ ] Không có từ nhạy cảm/trùng biến thể trong top 5 với bộ 50 từ thử.
- [ ] Giao diện chỉ gồm chọn/nhập 1 từ + nút tìm (+ kết quả + console).

---

## 13. Rủi ro & cách giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Từ ghép/OOV tiếng Việt cho kết quả kém | Fallback trung bình âm tiết + sentence embedding; gắn nhãn độ tin cậy |
| Static embedding thiên về đồng xuất hiện chứ không phải "liên tưởng" | Ensemble với Numberbatch (thường thức) + hiệu chỉnh bằng bộ liên tưởng của người |
| Kết quả "hub" (từ chung chung xuất hiện mãi) | CSLS + ngưỡng tần suất + blocklist |
| File dữ liệu lớn, nạp chậm | Lượng tử hóa fp16/int8, nạp trong Worker, hiển thị tiến độ, cache của trình duyệt |
| Model ONNX chạy chậm trên máy yếu | Dùng model small, tiền tính phía ứng viên, chỉ tính 1 embedding/truy vấn |
| % gây hiểu lầm | Hiệu chỉnh + ghi chú định nghĩa rõ trong UI |
| Giấy phép dữ liệu (nhiều nguồn dùng CC-BY-SA hoặc tương tự) | Ghi rõ nguồn/giấy phép trong README; kiểm tra điều kiện trước khi deploy công khai |
| Thiên lệch/nội dung nhạy cảm trong embedding | Blocklist + duyệt tay bộ từ thử |

---

## 14. Việc cần chốt trước khi bắt tay làm

1. Có cần hỗ trợ **tiếng Anh** song song không? (ảnh hưởng chọn model/nguồn vector)
2. Giới hạn dung lượng chấp nhận được cho dữ liệu + model (gợi ý: 150–400 MB).
3. Phong cách giao diện: giữ **dark kiểu Raycast/Linear** hay thích kiểu sáng như Notion/Google?
4. Có sẵn Python trên máy để chạy bước tiền xử lý không? (nếu không, chuyển script sang Node.)
