# Đề xuất cải thiện thuật toán luận giải 3 manh mối (Người Bạn Nhận Thư)

> Tài liệu gửi người chỉnh sửa game. Dựa trên đọc kỹ `PHAN_TICH_LIEN_TUONG_TU_KHOA.md` (kiến trúc v2.0).
> Phạm vi: giải thuật `S_friend` (mục 3 của tài liệu gốc) và các thành phần liên quan (đồ thị, embedding, chuẩn hóa đầu vào).

---

## 0. Tóm tắt nhanh (đọc phần này trước)

1. **Điểm cuối cùng thực chất do đồ thị quyết định, vector chỉ để phá hòa.** Đồ thị cho tối đa `3 × 2.0 = 6` điểm, trong khi cosine thường chỉ ~0.15–0.25. Chỉnh `λ_hub`, `1.2·D_min` gần như không đổi thứ hạng khi từ bí mật có ≥ 2 cạnh trong đồ thị.
2. **Ví dụ "cà phê" ở mục 5.4 không khớp với công thức.** Với dot 0.15 / 0.21 / 0.25 (từ mục 5.1–5.3), `D_min ≈ +0.15` chứ không phải `+0.65`, và tổng điểm khoảng **3.9** (trước khi trừ hub) chứ không phải 5.58. Cần chạy lại bằng code thật để lấy số liệu minh họa.
3. **Chưa có bộ đánh giá** nên chưa thể biết thay đổi nào thật sự có ích. Việc đầu tiên là dựng benchmark (mục 4, bước 1).
4. **Nên thay cách cộng điểm thô bằng cách gộp theo xác suất / z-score**, chuẩn hóa đồ thị theo độ phổ biến của nút, và thêm tín hiệu "mutual rank".
5. **Đòn bẩy lớn nhất là mở rộng và làm sạch đồ thị tri thức** (ở bước build, không phải lúc chạy).

---

## 1. Vấn đề phát hiện trong tài liệu hiện tại

### 1.1. Thang điểm giữa các thành phần lệch nhau
| Thành phần | Khoảng giá trị thực tế |
|---|---|
| `D̄` (trung bình cosine đã trừ hub) | ~0.1 – 0.3 |
| `1.2 · D_min` | ~ −0.4 – +0.3 |
| `G_boost` | 0 – 6 (có bước nhảy ×2 khi `hits ≥ 2`) |
| `Bonus_length` | −0.35 / +0.05 / +0.20 |

Hệ quả:
- Đồ thị lấn át toàn bộ. Nếu hai ứng viên cùng có `hits = 3`, vector mới có chút tác dụng. Nếu một ứng viên thiếu cạnh đồ thị, gần như không vector nào cứu được.
- `Bonus_length` (±0.2–0.35) lớn hơn hẳn chênh lệch cosine giữa các ứng viên (thường vài phần trăm), nên có thể tự quyết định kết quả khi hai từ sát nhau.

### 1.2. Ví dụ minh họa không nhất quán
Từ mục 5.1–5.3, độ tương đồng vector giữa "cà phê" và ba manh mối là xấp xỉ 0.15, 0.21, 0.25. Theo công thức mục 3.2:
- `D̄ ≈ 0.20`, `D_min ≈ 0.15` (chưa trừ hub),
- `G_boost = (0.55 × 3) × 2.0 = 3.30`, `Bonus_length = +0.20`,
- Tổng `S_friend ≈ 0.20 + 1.2×0.15 + 3.30 + 0.20 ≈ 3.88`.

Số trong bảng (`D_min = +0.65`, tổng 5.58) cao hơn rõ rệt. Có thể ví dụ được viết tay hoặc lấy từ phiên bản cũ. Đề nghị in log điểm thật của từng thành phần để đối chiếu.

### 1.3. Giải thích "Vector Dominance" mâu thuẫn với chuẩn hóa L2
Tài liệu nói từ ghép như "thức khuya" có "biên độ vector rất lớn" kéo lệch tâm trung bình. Nhưng mọi vector đã chuẩn hóa L2 (`‖v‖ = 1`) nên không thể có biên độ lớn hơn. Nguyên nhân thực tế nhiều khả năng là một trong hai:
- Vector của từ ghép được tạo kém (ví dụ trung bình các âm tiết) nên lệch sang vùng từ vựng đặc thù.
- Hubness: một số từ gần với quá nhiều từ khác.

Cần kiểm tra lại bằng cách in 20 láng giềng gần nhất của vài từ ghép.

### 1.4. Vector 128 chiều quá thấp và chênh lệch quá nhỏ
Các dot trong ví dụ (0.15 / 0.19 / 0.21 / 0.25) chênh nhau vài phần trăm, nằm trong mức nhiễu. Embedding gần như không phân biệt được ứng viên; mọi phân biệt thật đến từ đồ thị.

### 1.5. Các điểm rủi ro khác
- `hits ≥ 2 → ×2.0` là bước nhảy không liên tục, hai ứng viên sát nhau dễ đảo thứ hạng khi đổi một cạnh nhỏ.
- `G` chưa chuẩn hóa theo bậc của nút, nên nút bậc cao ("cây", "con", "nước") được lợi không đáng.
- `D_min` hiện phạt rất nặng khi một manh mối "xiên", nhưng người chơi thường cố ý chọn manh mối xiên (ví dụ "thức khuya" → cà phê). Cosine đo mức "giống nhau", còn liên tưởng là quan hệ có hướng.
- Gõ không dấu: ánh xạ qua `unaccented_map.json` chỉ chọn một dạng ("nau" có thể là *nâu* hoặc *nấu*).
- Bộ lọc chữ cái đầu: cần quy ước rõ chữ ghép (`ch, kh, ng, ngh, nh, th, tr, ph, gi, qu`), `đ`, và dạng viết hoa/thường sau NFC.

---

## 2. Dự đoán các kiểu thất bại (nên kiểm tra bằng test)

| Tình huống | Dự đoán | Nguyên nhân |
|---|---|---|
| Từ bí mật ít/không có cạnh đồ thị (từ trừu tượng, động từ, từ hiếm) | Gần như đoán ngẫu nhiên trong vài nghìn từ cùng chữ cái | Vector yếu, không còn gì bù |
| Manh mối "xiên" (liên quan gián tiếp) | Đáp án đúng bị `D_min` phạt đúng chỗ cần thưởng | Cosine không mô hình hóa quan hệ có hướng |
| Manh mối chung chung, nhiều cạnh ("nước", "người") | Nhiều ứng viên cùng ăn ×2.0, thứ hạng gần như ngẫu nhiên | Đồ thị chưa chuẩn hóa theo bậc |
| Ứng viên là nút bậc cao ("cây", "con") | Hay lọt top 2–3, đôi khi vượt đáp án đúng | CSLS chỉ sửa hub của vector, chưa sửa hub của đồ thị |
| Hai ứng viên sát điểm | Thứ hạng đảo khi đổi trọng số nhỏ | Bước nhảy `hits ≥ 2` |
| Gõ không dấu "nau", "hat" | Chọn nhầm nâu/nấu, hạt/hát/hắt | Chỉ giữ một giả thuyết |
| Từ bí mật 3 âm tiết trở lên, hoặc manh mối dài | Bị phạt oan | `Bonus_length` quá lớn so với chênh lệch cosine |

---

## 3. Giải pháp đề xuất

### 3.1. Gộp theo xác suất thay vì cộng điểm thô
Mỗi manh mối tự chuẩn hóa trên tập ứng viên `C_L` (các từ bắt đầu bằng chữ `L`), rồi cộng log-xác suất:

```
s_k(w)   = z( cos(c_k, w) − 0.3·Hub(w) )
         + z( G_norm(c_k, w) )
         + z( −log mutual_rank(c_k, w) )        # xem 3.3
p_k(w)   = softmax_w( s_k(w) / τ )
score(w) = log π(w) + Σ_k log( (1−ε)·p_k(w) + ε/|C_L| )
```

- `z(·)` là z-score trên toàn bộ ứng viên của truy vấn này, nên các thành phần có cùng thang.
- `ε` (khởi điểm 0.02–0.05) giúp một manh mối lạc quẻ không "giết" đáp án đúng.
- `π(w)` là prior của từ bí mật (mục 3.5).
- Cách này thay thế cho `D̄`, `1.2·D_min` và bước nhảy ×2.0, và tự nhiên thể hiện "và mềm": từ liên quan đủ cả ba sẽ cộng dồn mạnh nhất.
- Nếu muốn giữ ý tưởng "min", dùng soft-min trên điểm đã z-score: `softmin(x) = −(1/β)·log Σ_k exp(−β·x_k)` (β khởi điểm ~3).

### 3.2. Chuẩn hóa đồ thị
- Giảm trọng số cạnh theo bậc của nút (kiểu IDF hoặc PPMI): `G_norm(c, w) = G(c, w) / log(2 + deg(w))` hoặc dùng PPMI trực tiếp.
- Thay `hits` nhị phân bằng noisy-OR liên tục: `G_comb(w) = 1 − Π_k (1 − G_norm(c_k, w))`, hoặc thưởng theo cặp `Σ_{i<j} G_i · G_j`.
- Như vậy hợp lưu 3 manh mối tăng đều, không còn "vách đá" ở `hits = 2`.

### 3.3. Thêm tín hiệu có hướng: mutual rank
Với cặp (manh mối `c`, ứng viên `w`):

```
mutual_rank(c, w) = sqrt( rank_c(w) · rank_w(c) )
```

`rank_c(w)` là thứ hạng của `w` trong danh sách láng giềng của `c` (tính trên toàn từ điển, hoặc trên cả vector lẫn đồ thị). Ý nghĩa: người chơi chọn "thức khuya" vì nó nằm trong top liên tưởng của "cà phê", chứ không chỉ vì hai vector gần nhau. Đây là cách rẻ để mô hình hóa "vì sao người chơi chọn manh mối này cho từ này". Có thể tiền tính và lưu bảng top-K láng giềng cho mỗi từ.

### 3.4. Nâng embedding
- Chuyển từ 128 chiều sang vector nối đa nguồn ~300 chiều: ConceptNet Numberbatch (tiếng Việt) + PhoW2V hoặc fastText tiếng Việt, mỗi nguồn chuẩn hóa L2 rồi nối có trọng số.
- Thêm sentence embedding đa ngữ chạy local (Transformers.js/ONNX) làm tín hiệu bổ sung và fallback cho từ ngoài từ điển.
- Kiểm tra lại cách tạo vector cho từ ghép nhiều âm tiết (nên có vector riêng, không chỉ trung bình âm tiết).
- Kiểm tra giấy phép từng nguồn dữ liệu trước khi phát hành.

### 3.5. Prior cho từ bí mật
Từ bí mật không phải ngẫu nhiên trong cả từ điển: thường là danh từ cụ thể, quen thuộc. Dùng `π(w)` theo tần suất và độ cụ thể, hoặc giới hạn ứng viên vào kho từ của game. Thay `Bonus_length` cố định bằng một feature nhỏ trong `π(w)` (và học trọng số, xem 3.7).

### 3.6. Mở rộng đồ thị tri thức (ưu tiên cao)
Vì đồ thị chi phối kết quả, tăng độ phủ và chất lượng đồ thị là việc đáng làm nhất:
- Khai thác PPMI/đồng xuất hiện từ ngữ liệu tiếng Việt.
- Thêm cạnh từ ConceptNet tiếng Việt.
- Dùng LLM **ở bước build, không phải lúc chạy** để sinh 10–20 manh mối người Việt hay dùng cho mỗi từ trong kho, rồi lưu thành cạnh có trọng số. Sau đó duyệt tay mẫu để loại cạnh sai. Khi chạy game vẫn hoàn toàn offline.
- Tránh gán tay các giá trị như 0.95 / 0.55 cho phần lớn cạnh; dùng trọng số theo tần suất/PPMI để đỡ thiên lệch.

### 3.7. Học trọng số thay vì đặt tay
Các hằng số hiện tại (0.3, 1.2, 2.0, 0.20, −0.35, 0.05) là số đặt tay. Khi có log hoặc benchmark:
- Fit mô hình xếp hạng nhỏ (logistic regression, hoặc LightGBM nếu đủ dữ liệu) trên các feature: cos trung bình, soft-min, noisy-OR đồ thị, mutual rank, log tần suất, độ dài, `approx` (vector gần đúng).
- Vài trăm mẫu đã đủ cho logistic regression. Lưu trọng số vào file cấu hình (`config/ranking.json`), không hard-code.

### 3.8. Gõ không dấu: giữ nhiều giả thuyết
- Mỗi manh mối không dấu sinh ra tập biến thể có dấu (`nau → nâu, nấu, nạu…`) kèm trọng số theo tần suất.
- Tính điểm cho từng biến thể, lấy `max` (hoặc log-sum-exp) theo từng manh mối.
- Ba manh mối tự khử mơ hồ cho nhau: "nâu" hợp "cà phê" hơn "nấu" khi đi cùng "hạt".

### 3.9. Quy ước chữ cái đầu
Viết hàm `firstUnit(word)` thống nhất cho toàn game: NFC, chữ thường, xử lý chữ ghép (`ngh, ng, nh, ch, kh, th, tr, ph, gi, qu`) và `đ`. Ghi rõ quy ước trong tài liệu và có unit test.

---

## 4. Kế hoạch triển khai (theo thứ tự nên làm)

1. **Dựng bộ đánh giá (làm trước tiên).**
   - Thu 300–1000 mẫu `(từ bí mật, chữ cái, 3 manh mối)` từ log game hoặc tự sinh/viết tay.
   - Chỉ số: Top-1, Top-3, MRR; chia theo loại từ (danh từ cụ thể, trừu tượng, động từ, từ ghép).
   - Làm **ablation**: bỏ đồ thị, bỏ vector, bỏ `D_min`, bỏ `Bonus_length`, xem điểm tụt bao nhiêu để biết thành phần nào thực sự đóng góp.
2. **Ghi log điểm từng thành phần** (`D̄, D_min, G_raw, G_boost, Bonus`) cho top 10 ứng viên, và chạy lại ví dụ "cà phê" để thay số liệu trong tài liệu.
3. **Thay phần gộp điểm** bằng 3.1 + 3.2 (chạy song song với bản cũ, so sánh trên benchmark).
4. **Thêm mutual rank (3.3)** và prior (3.5).
5. **Mở rộng đồ thị (3.6)** và/hoặc **nâng embedding (3.4)**.
6. **Học trọng số (3.7)**, khóa cấu hình.
7. **Sửa gõ không dấu (3.8)** và chuẩn hóa chữ cái đầu (3.9).
8. **Cập nhật tài liệu** với số liệu thật sau khi đo.

---

## 5. Tiêu chí nghiệm thu

- [ ] Có script benchmark chạy bằng một lệnh, in Top-1/Top-3/MRR và bảng ablation.
- [ ] Thuật toán mới tốt hơn thuật toán hiện tại trên benchmark (ghi số cụ thể trước/sau).
- [ ] Thứ hạng ổn định: đổi một trọng số nhỏ (±10%) không làm đảo top-1 trên quá nửa số mẫu sát điểm.
- [ ] Các ca "bẫy" (mục 2) có test riêng và không tệ hơn bản cũ.
- [ ] Ví dụ minh họa trong tài liệu khớp với điểm in ra từ code thật.
- [ ] Gõ không dấu (`hat`, `nau`, `thuc khuya`) cho kết quả đúng ở các ca có ngữ cảnh khử mơ hồ.

---

## 6. Lưu ý về thiết kế game

Gián điệp (1 manh mối) và Người Bạn (3 manh mối) hiện dùng chung mô hình và đồ thị, nên người chơi sẽ học cách "chơi với đồ thị" thay vì dựa vào trực giác của người Việt. Nên:
- Cho phía gián điệp thêm nhiễu hoặc nhiệt độ softmax riêng.
- Đo xem tỉ lệ "an toàn" có phụ thuộc quá nhiều vào vài cạnh gán tay hay không.
- Kiểm tra cân bằng độ khó: nếu Người Bạn gần như luôn đoán đúng, trò chơi thiếu thử thách; nếu gần như luôn sai, người chơi thấy bất công.

---

## 7. Phụ lục: pseudo-code gợi ý

```python
def rank_friend(clues, letter, vocab, graph, vec, hub, cfg):
    cands = [w for w in vocab if first_unit(w) == letter and w not in clues]
    log_score = {w: log(prior(w)) for w in cands}

    for c in clues:                       # có thể là tập biến thể nếu gõ không dấu
        feats = {}
        for w in cands:
            cos   = dot(vec[c], vec[w]) - cfg.lam_hub * hub[w]
            g     = graph_norm(c, w)       # chuẩn hóa theo bậc nút
            mrank = mutual_rank(c, w)
            feats[w] = (cos, g, -log(mrank))

        s = {w: sum(z_score(feats, i)[w] for i in range(3)) for w in cands}
        p = softmax(s, tau=cfg.tau)
        for w in cands:
            log_score[w] += log((1 - cfg.eps) * p[w] + cfg.eps / len(cands))

    return sorted(cands, key=lambda w: -log_score[w])[:10]
```

Đây chỉ là khung tham khảo; tên hàm, cấu trúc dữ liệu cần điều chỉnh theo code hiện tại của game.
