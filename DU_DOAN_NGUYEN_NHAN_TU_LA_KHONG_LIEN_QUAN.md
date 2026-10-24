# Dự đoán nguyên nhân: ứng dụng đưa ra từ không thông dụng và không liên quan tới keyword

> Nguồn phân tích: `PHAN_TICH_LIEN_TUONG_TU_KHOA.md` (kiến trúc v2.0).
> Phạm vi: **chỉ những nguyên nhân và hướng sửa MỚI**, bổ sung cho file `DE_XUAT_CAI_THIEN_LUAN_GIAI_3_MANH_MOI.md` (đã nêu: chênh thang điểm đồ thị/vector, ví dụ "cà phê" lệch số, hubness của đồ thị, chuẩn hóa đồ thị theo bậc, mutual rank, prior từ bí mật, embedding 128 chiều, gõ không dấu nhiều giả thuyết, học trọng số).
>
> ⚠️ **Đây là dự đoán dựa trên tài liệu mô tả, chưa có code, từ điển, đồ thị hay log thật.** Mỗi nguyên nhân có mức tin cậy và cách kiểm chứng nhanh. Người sửa game nên chạy bước chẩn đoán (mục 4) trước khi sửa.

---

## 0. Tóm tắt: 5 nghi phạm hàng đầu

| # | Nghi phạm | Tin cậy | Vì sao nghi |
|---|---|---|---|
| N1 | **Hub penalty (CSLS) vô tình ưu tiên từ lạ**: từ phổ biến nằm vùng dày nên bị trừ nặng, từ hiếm nằm vùng thưa nên gần như không bị trừ | Cao | Công thức `cos − 0.3·Hub(w)` ở mục 2.2 và 3.2 |
| N2 | **Kho từ ứng viên không được lọc theo độ quen thuộc** (từ cổ, Hán-Việt hiếm, phương ngữ, tên riêng, mảnh âm tiết) | Cao | Tài liệu chỉ có lọc chữ cái đầu và `Bonus_length`, không có lọc tần suất |
| N3 | **Cạnh đồ thị thiên lệch về từ hiếm** (PMI/đếm ít mẫu, cạnh gán tay 0.95, `max` hai chiều) | Trung bình–Cao | `G = max(Graph[c][w], Graph[w][c])`, hệ số `α = 1.2`, `×2.0` khi `hits ≥ 2` |
| N4 | **Vector của từ hiếm nhiễu/kém**, cộng thêm thành phần "tần suất" chưa được loại | Trung bình–Cao | Embedding 128 chiều, không thấy bước hậu xử lý |
| N5 | **Luôn bắt buộc trả về #1** dù điểm rất thấp (không có ngưỡng tin cậy / không từ chối) | Cao | "Đúng 1 phỏng đoán #1" cùng ràng buộc chữ cái đầu |

Nếu chỉ sửa được ít việc: **N5 (ngưỡng tin cậy) + N2 (lọc kho từ) + N1 (sửa hub)** thường cho hiệu quả lớn nhất trên "tỉ lệ từ lạ ở top 1".

---

## 1. Định nghĩa lỗi cần đo

Tách 3 loại lỗi, vì nguyên nhân khác nhau:

| Loại | Ví dụ | Nghi nguyên nhân |
|---|---|---|
| A. **Lạ nhưng có liên quan** | keyword "mưa" → "mưa ngâu" (hiếm nhưng hợp) | N2 (kho từ), thiếu prior quen thuộc |
| B. **Lạ và không liên quan** | keyword "cà phê" → một từ Hán-Việt hiếm không dính | N1, N3, N4, N6 |
| C. **Thông dụng nhưng không liên quan** | keyword "hạt" → "bản" (âm tiết không độc lập) | N7, N8, N9 |

Chỉ số nên theo dõi (xem mục 6): **Rarity@1** (tỉ lệ top-1 nằm ngoài top-N từ phổ biến) và **Junk@1** (tỉ lệ top-1 bị người chấm gắn nhãn "không liên quan").

---

## 2. Các nguyên nhân dự đoán (chi tiết)

### N1. Hub penalty trong CSLS vô tình thưởng cho từ hiếm
**Mức tin cậy: Cao.**

**Cơ chế.** `Hub(w)` là trung bình cosine của `w` với `k` láng giềng gần nhất. Từ phổ biến thường nằm vùng dày, nhiều từ gần nó, nên `Hub` cao. Từ hiếm thường nằm vùng thưa, hoặc vector kém, nên `Hub` thấp. Khi trừ `0.3·Hub(w)`, từ phổ biến bị trừ nhiều hơn từ hiếm. Hiệu ứng ròng là **chuyển điểm sang phía từ hiếm**, ngược với ý định giảm "hub".

**Minh họa bằng số giả định** (chỉ để thấy cơ chế, không phải số đo thật):

| Ứng viên | cos với keyword | Hub | `cos − 0.3·Hub` |
|---|---|---|---|
| Từ phổ biến, liên quan thật | 0.25 | 0.45 | **0.115** |
| Từ hiếm, không liên quan | 0.22 | 0.10 | **0.190** |

Vì chênh lệch cosine giữa các ứng viên chỉ vài phần trăm (xem mục 2.2 tài liệu gốc), một số hạng phạt 0.1–0.15 là đủ đảo thứ hạng.

**Kiểm chứng.** Chạy lại với `λ_hub = 0` và `λ_hub ∈ {0.1, 0.2, 0.3}`, đo Rarity@1. Nếu Rarity@1 giảm rõ khi giảm `λ_hub`, N1 được xác nhận. Kiểm tra thêm: tương quan giữa `Hub(w)` và log tần suất (nếu tương quan dương mạnh, N1 gần như chắc chắn).

**Cách sửa.**
- Tính `Hub` **theo nhóm tần suất** (so mỗi từ với các từ cùng nhóm tần suất), hoặc chỉ tính trên tập từ phổ biến.
- Hoặc chuyển sang chuẩn hóa dựa trên thứ hạng (ví dụ inverted softmax hoặc mutual rank), thay vì trừ `Hub` thô.
- Giới hạn hạng phạt: `penalty = λ · clip(Hub − median_hub, 0, cap)`, chỉ phạt phần vượt trội so với mức thường.
- Kiểm tra giá trị `k` dùng để tính `Hub` (tài liệu không nêu).

---

### N2. Kho từ ứng viên 𝒱 chưa được lọc theo độ quen thuộc
**Mức tin cậy: Cao.**

**Cơ chế.** Bộ lọc duy nhất được mô tả là chữ cái đầu và `Bonus_length`. Nếu 𝒱 lấy từ từ điển hoặc vocab của embedding mà không lọc, nó chứa:
- từ cổ, từ địa phương, Hán-Việt hiếm, thuật ngữ chuyên ngành;
- tên riêng, địa danh, từ viết tắt, từ tiếng Anh, số, lỗi chính tả trong ngữ liệu;
- **mảnh âm tiết không phải từ độc lập** (ví dụ "bản", "cơ", "thể" đứng riêng), nhất là khi vocab là âm tiết.

Đặc biệt, `Bonus_length = +0.20` cho mọi từ 1–2 âm tiết, **không phân biệt quen hay lạ**, nên từ hiếm 2 âm tiết vẫn nhận thưởng ngang từ thông dụng.

**Kiểm chứng.** Lấy 200 kết quả top-1 "lạ", tra thứ hạng tần suất và nhãn từ điển (cổ, phương ngữ, tên riêng...). Thống kê tỉ lệ rơi vào nhóm nào.

**Cách sửa.**
- Dựng **whitelist theo tầng**: T1 = top ~10–15k từ quen thuộc nhất (theo tần suất đời thường, không phải văn bản hành chính); T2 = đến ~40k, có phạt; T3 = loại, trừ khi khớp chính xác với keyword. (Số ngưỡng chỉ là điểm xuất phát, cần chỉnh theo benchmark.)
- Loại theo nhãn từ điển: từ cổ, phương ngữ, tên riêng, viết tắt, từ nước ngoài chưa Việt hóa.
- Lọc ký tự lạ, số, token chứa dấu câu, chuỗi có lỗi chính tả.
- Thay `Bonus_length` cố định bằng feature độ quen thuộc `fam(w) = norm(log count(w))`.

---

### N3. Cạnh đồ thị thiên lệch về từ hiếm
**Mức tin cậy: Trung bình–Cao** (phụ thuộc cách xây đồ thị, tài liệu không nêu).

**Cơ chế, có thể gồm nhiều nguồn cùng lúc:**
1. **Thiên lệch của PMI với từ hiếm.** Nếu cạnh lấy từ đồng xuất hiện bằng PMI, từ xuất hiện 2–3 lần mà đều đi cùng keyword sẽ có PMI rất lớn. Đây là lỗi kinh điển của PMI khi thiếu ngưỡng đếm tối thiểu.
2. **`max` hai chiều.** `G = max(Graph[c][w], Graph[w][c])`: nếu danh sách liên tưởng của từ hiếm `w` liệt kê từ phổ biến `c` (ví dụ lấy từ định nghĩa từ điển), cạnh ngược này nhận trọng số cao dù chỉ là quan hệ từ điển, người chơi không liên tưởng như vậy.
3. **Cạnh gán tay mạnh** (0.95 và 0.55 trong các ví dụ) cho từ "bẫy" ("cơm", "cát", "cú mèo"). Nếu quy trình tương tự dùng để mở rộng đồ thị, cạnh cứng 0.95 sẽ chiến thắng mọi tín hiệu vector.
4. **Khuếch đại `×2.0` khi `hits ≥ 2`** trên cạnh nhiễu: hai cạnh nhiễu cùng trỏ vào một từ hiếm sẽ được nhân đôi.
5. Cạnh không có nguồn gốc/độ tin cậy (không biết cạnh do người, ngữ liệu hay LLM tạo).

**Kiểm chứng.** Với 50 lỗi loại B, in ra các cạnh đồ thị đóng góp điểm (giá trị, chiều, nguồn). Đếm bao nhiêu lỗi **chỉ** nhờ đồ thị mà đứng đầu (đặt `α_graph = 0` để so sánh).

**Cách sửa.**
- Dùng **PPMI với làm trơn phân phối ngữ cảnh** (mũ 0.75) và ngưỡng đếm tối thiểu, hoặc thống kê có ý nghĩa như log-likelihood (G²), NPMI, Dice.
- Lưu **nguồn và độ tin cậy** cho mỗi cạnh. Cạnh chỉ một nguồn thì giảm trọng số; cạnh được nhiều nguồn xác nhận thì tăng.
- Bỏ `max` thô: dùng cạnh theo hướng người chơi thật sự dùng (`manh mối → từ bí mật`), cạnh ngược chỉ cộng một phần nhỏ.
- Không để cạnh tới từ ngoài tầng T1/T2 (N2) tham gia tính điểm.
- Giữ top-K cạnh mạnh nhất cho mỗi nút để tránh nút có danh sách dài.

---

### N4. Vector từ hiếm nhiễu và còn thành phần "tần suất"
**Mức tin cậy: Trung bình–Cao.**

**Cơ chế.**
- Từ hiếm có ít mẫu huấn luyện nên vector gần như ngẫu nhiên hoặc phản ánh vài câu duy nhất. Sau chuẩn hóa L2 nó vẫn có độ dài 1 và vẫn có thể vô tình có cosine cao với keyword.
- Embedding thường chứa một vài hướng chính (thành phần chung/tần suất) khiến cosine bị chi phối bởi tần suất thay vì nghĩa. Giảm chiều xuống 128 (nếu có) có thể làm hiện tượng này rõ hơn.
- Tài liệu không mô tả bước hậu xử lý nào (loại hướng chính, làm trơn).

**Kiểm chứng.**
- Vẽ cosine trung bình tới các từ ngẫu nhiên theo nhóm tần suất. Nếu nhóm hiếm có cosine nền cao bất thường, vector nhiễu.
- Nếu còn độ dài vector gốc (trước chuẩn hóa L2), kiểm tra tương quan với tần suất.

**Cách sửa.**
- Hậu xử lý **"all-but-the-top"**: trừ trung bình và loại 1–3 thành phần chính đầu tiên, rồi chuẩn hóa lại.
- Với từ dưới ngưỡng đếm tối thiểu: **không cho làm ứng viên** (vẫn có thể dùng làm keyword), hoặc làm trơn vector bằng trung bình có trọng số với láng giềng phổ biến.
- Huấn luyện lại hoặc đổi nguồn embedding (đã nêu ở file trước), nhưng trước hết hãy đảm bảo ngưỡng tần suất tối thiểu khi huấn luyện.

---

### N5. Luôn bắt buộc có #1, không có ngưỡng tin cậy
**Mức tin cậy: Cao.**

**Cơ chế.** Hệ thống luôn trả ứng viên đứng đầu sau lọc chữ cái. Khi tập từ ứng viên của chữ `L` ít từ liên quan thật, "tốt nhất trong các lựa chọn tồi" vẫn thắng, và thường là từ lạ. Tập ứng viên theo chữ cái cũng **mất cân bằng**: một số chữ (ê, ô, ơ, ư, y, và các chữ ghép) có rất ít từ quen thuộc.

**Kiểm chứng.** Thống kê Rarity@1 theo từng chữ cái đầu, và tương quan với số từ T1 thuộc chữ đó. Vẽ phân phối điểm top-1 và biên (top-1 trừ top-2).

**Cách sửa.**
- Thêm **ngưỡng tuyệt đối** (`score_top1 ≥ θ1`) và **ngưỡng biên** (`score_top1 − score_top2 ≥ θ2`). Không đạt thì đánh dấu "kém chắc chắn".
- **Mở rộng theo bậc**: tìm trong T1 trước; chỉ mở sang T2 khi chưa đạt ngưỡng; hạn chế T3.
- Trong công cụ tìm từ tương quan (không có ràng buộc chữ cái), hiển thị "độ tin cậy thấp" hoặc ít hơn 5 từ thay vì lấp đầy bằng từ lạ.
- Kiểm tra cân bằng chữ cái: số từ T1 theo chữ phải đủ lớn (ví dụ ≥ 200, tùy chỉnh); chữ nào thiếu thì xử lý riêng.
- Trong game: chọn từ bí mật sao cho mỗi chữ cái đầu có đủ ứng viên phân tán.

---

### N6. Phân đoạn từ và khôi phục dấu chọn nhầm từ hiếm
**Mức tin cậy: Trung bình.**

**Cơ chế.**
- Sơ đồ ở mục 1 có hai bước: "Chuẩn hóa Unicode NFC & Khôi phục dấu" và "Phân giải biến thể chính tả/đồng nghĩa". Nếu bước khôi phục dấu hoặc ánh xạ biến thể chọn **dạng hiếm** (ví dụ ánh xạ cứng tới một từ ít gặp), keyword đã sai ngay từ đầu, và kết quả đương nhiên không liên quan.
- Tiếng Việt cần phân đoạn từ (`thức khuya`, `cà phê`). Nếu ngữ liệu huấn luyện và phép tra cứu dùng **hai bộ phân đoạn khác nhau**, vector của từ ghép có thể là trung bình âm tiết, và hàng xóm của nó sẽ là các từ chung âm tiết chứ không chung nghĩa.
- Keyword ngoài từ điển hoặc gõ sai: nếu có cơ chế dự phòng (ví dụ vector băm/ký tự), hàng xóm sẽ gần như ngẫu nhiên.

**Kiểm chứng.** In ra keyword **sau chuẩn hóa** cho các ca lỗi. Đếm tỉ lệ lỗi tập trung ở keyword có biến đổi/ngoài từ điển.

**Cách sửa.**
- Khôi phục dấu bằng mô hình có xác suất, kèm **prior tần suất**, và giữ top-N giả thuyết thay vì ép một dạng. Không bao giờ ánh xạ sang từ dưới ngưỡng quen thuộc nếu có dạng quen hơn.
- Dùng **một bộ phân đoạn duy nhất** cho cả ngữ liệu, vocab và truy vấn. Ghi nhận độ phủ từ ghép.
- Với keyword ngoài từ điển: báo rõ "không có dữ liệu" hoặc hạ độ tin cậy, đừng trả kết quả như bình thường.

---

### N7. Âm tiết không độc lập và từ chức năng lọt vào ứng viên
**Mức tin cậy: Trung bình.**

**Cơ chế.** Nếu 𝒱 gồm cả âm tiết lẻ, những âm tiết như "bản", "cơ", "thể", "tính", "học" có thể có vector sạch vì tần suất cực cao, rồi nhận `+0.20` do là "1 âm tiết". Người dùng thấy đây là "từ không thông dụng" hoặc "vô nghĩa" khi đứng riêng. Từ chức năng và tiểu từ cũng thuộc nhóm này.

**Kiểm chứng.** Lọc các kết quả lỗi loại C, đếm tỉ lệ 1 âm tiết, đối chiếu với danh sách "từ đơn có nghĩa độc lập".

**Cách sửa.** Lập danh sách từ đơn hợp lệ (từ điển có nhãn từ loại), loại âm tiết ràng buộc (yếu tố Hán-Việt không độc lập), và loại từ chức năng khỏi ứng viên.

---

### N8. Từ nhiều nghĩa: vector trộn nghĩa, hàng xóm đến từ nghĩa phụ
**Mức tin cậy: Trung bình.**

**Cơ chế.** Tiếng Việt có nhiều từ đơn đa nghĩa ("hạt", "cây", "đá", "bản"). Embedding gộp mọi nghĩa vào một vector, nên hàng xóm gần nhất có thể thuộc **nghĩa phụ** (ví dụ "hạt" → các từ vật lý hạt nhân), lạ với nhiều người dùng. Với 3 manh mối, trộn nghĩa còn làm giao điểm mơ hồ.

**Kiểm chứng.** Với 20 keyword đa nghĩa, in 30 hàng xóm gần nhất và xem có tách thành các cụm nghĩa không.

**Cách sửa.**
- Phân cụm hàng xóm thành các nghĩa; xếp nghĩa theo mức phổ biến.
- Với 3 manh mối: chọn nghĩa của mỗi manh mối **phù hợp nhất với hai manh mối còn lại** (tối đa hóa giao thoa), rồi mới tính điểm.
- Với công cụ tìm từ tương quan: dùng MMR để top 5 không bị một nghĩa phụ chiếm hết, nhưng ưu tiên nghĩa chính.

---

### N9. Lệch phong cách ngôn ngữ giữa ngữ liệu và người chơi
**Mức tin cậy: Trung bình.**

**Cơ chế.** Nếu embedding/đồ thị được huấn luyện từ tin tức, Wikipedia, văn bản pháp lý, hàng xóm của một từ đời thường sẽ là từ trang trọng, Hán-Việt hoặc thuật ngữ. Người chơi nghĩ theo ngôn ngữ nói hằng ngày, nên kết quả nghe "lạ".

**Kiểm chứng.** So sánh phân phối từ loại/phong cách của top-1 với danh sách từ người chơi hay dùng làm manh mối (từ log game).

**Cách sửa.** Bổ sung ngữ liệu hội thoại (bình luận, phụ đề, diễn đàn) và dùng **tần suất theo ngữ liệu đời thường** làm `fam(w)`. Có thể dùng log game để ước lượng độ quen thuộc theo người chơi thật.

---

### N10. Điểm đồ thị cộng vào ứng viên không qua kiểm tra tương hợp vector
**Mức tin cậy: Trung bình.**

**Cơ chế.** Công thức hiện tại là cộng tuyến tính; một cạnh đồ thị mạnh có thể bù hoàn toàn cho cosine rất thấp. Không có điều kiện kiểu "đồ thị chỉ có hiệu lực khi vector cũng đạt ngưỡng tối thiểu", nên cạnh nhiễu nâng một từ hoàn toàn xa về mặt ngữ nghĩa lên top.

**Kiểm chứng.** Đếm số lỗi mà `cos` của top-1 nằm dưới phân vị 50 của các ứng viên.

**Cách sửa.** Thêm **cổng đồng thuận**: chỉ cho cạnh đồ thị đóng góp tối đa khi cosine ≥ ngưỡng thấp (hoặc nhân hệ số đồ thị với hàm sigmoid của cosine đã chuẩn hóa). Tín hiệu từ hai nguồn độc lập đồng ý nên được ưu tiên hơn một nguồn mạnh đơn lẻ.

---

### N11. Không có vòng phản hồi từ người chơi
**Mức tin cậy: Cao (là thiếu sót thiết kế, không phải lỗi thuật toán).**

**Cơ chế.** Không thấy cơ chế ghi nhận "từ này lạ/không liên quan" từ người chơi, nên lỗi lặp lại mãi.

**Cách sửa.**
- Thêm nút báo "từ lạ/không liên quan" và lưu `(keyword, từ trả về, thời gian)`.
- Tự động hạ trọng số các từ bị báo nhiều (blocklist mềm), và dùng làm dữ liệu huấn luyện cho trọng số (mục 3.7 ở file trước).
- Dùng click/chọn của người chơi làm tín hiệu tích cực để củng cố cạnh đồ thị.

---

## 3. Bảng ưu tiên

| Nguyên nhân | Tác động dự kiến | Công sức | Ưu tiên |
|---|---|---|---|
| N5 ngưỡng tin cậy + mở rộng theo tầng | Cao | Thấp | **1** |
| N2 lọc kho từ theo tầng quen thuộc | Cao | Thấp–Trung bình | **1** |
| N1 sửa hub penalty | Cao | Thấp | **1** |
| N3 làm sạch/chuẩn hóa cạnh đồ thị | Cao | Trung bình–Cao | 2 |
| N10 cổng đồng thuận vector–đồ thị | Trung bình | Thấp | 2 |
| N6 khôi phục dấu + phân đoạn nhất quán | Trung bình | Trung bình | 2 |
| N4 hậu xử lý vector, ngưỡng đếm tối thiểu | Trung bình | Trung bình | 2 |
| N7 lọc âm tiết/từ chức năng | Trung bình | Thấp | 2 |
| N11 vòng phản hồi | Trung bình (dài hạn) | Thấp–Trung bình | 3 |
| N8 xử lý đa nghĩa | Trung bình | Cao | 3 |
| N9 đổi ngữ liệu/phong cách | Trung bình | Cao | 3 |

---

## 4. Quy trình chẩn đoán (làm trước khi sửa)

### 4.1. Dữ liệu cần log cho mỗi truy vấn
Với top-10 ứng viên: `word`, `cos`, `Hub`, `cos − λ·Hub`, `G_raw`, `hits`, `G_boost`, `Bonus_length`, `score`, **`freq_rank`**, **`n_syllables`**, **`degree` trong đồ thị**, **`nguồn cạnh`**, **`nhãn từ điển`**. Với keyword: dạng gốc, dạng sau chuẩn hóa, có trong từ điển hay không.

### 4.2. Các thí nghiệm (mỗi thí nghiệm đổi một biến, đo Rarity@1 và Junk@1 trên cùng bộ 200–300 truy vấn)

| Thí nghiệm | Nếu kết quả cải thiện rõ ⇒ nghi |
|---|---|
| E1. `λ_hub = 0` | N1 |
| E2. `α_graph = 0` (chỉ vector) | N3, N10 |
| E3. Chỉ giữ ứng viên thuộc top-20k tần suất | N2, N7 |
| E4. Tắt `Bonus_length` | N2 (thưởng độ dài không phân biệt quen/lạ) |
| E5. Áp ngưỡng điểm, xem tỉ lệ bị loại | N5 |
| E6. Bỏ ứng viên dưới ngưỡng đếm của embedding | N4 |
| E7. Dùng nguyên văn keyword đã gõ đúng dấu (bỏ bước khôi phục) | N6 |
| E8. Chia kết quả theo chữ cái đầu | N5 (chữ ít từ) |

### 4.3. Bảng triệu chứng → nguyên nhân

| Triệu chứng quan sát | Nghi nguyên nhân |
|---|---|
| Từ lạ có `Hub` rất thấp, `cos` ngang các từ thường | N1 |
| Từ lạ nhận điểm chủ yếu từ `G_boost`, `cos` thấp | N3, N10 |
| Từ lạ có `freq_rank` rất lớn (> 50k), nhãn từ cổ/phương ngữ/tên riêng | N2 |
| Từ lạ có đếm thấp trong ngữ liệu huấn luyện | N4 |
| Lỗi tập trung ở một số chữ cái | N5 |
| Lỗi tập trung ở keyword không dấu/viết lạ | N6 |
| Kết quả 1 âm tiết mơ hồ ("bản", "cơ") | N7 |
| Kết quả thuộc nghĩa phụ của keyword | N8 |
| Kết quả đúng nghĩa nhưng quá trang trọng | N9 |

---

## 5. Gói giải pháp theo tầng (tổng hợp)

1. **Tầng ứng viên** (N2, N7): whitelist T1/T2/T3, loại nhãn từ điển, loại âm tiết ràng buộc, loại từ dưới ngưỡng đếm.
2. **Tầng chuẩn hóa đầu vào** (N6): khôi phục dấu có xác suất + prior tần suất, một bộ phân đoạn thống nhất, báo rõ keyword ngoài từ điển.
3. **Tầng vector** (N4): all-but-the-top, ngưỡng đếm, làm trơn từ hiếm.
4. **Tầng đồ thị** (N3, N10): PPMI/G² có làm trơn, lưu nguồn và độ tin cậy, bỏ `max` thô, cổng đồng thuận với vector.
5. **Tầng chấm điểm** (N1): sửa hub theo nhóm tần suất hoặc dùng chuẩn hóa thứ hạng, thêm feature độ quen thuộc `fam(w)` thay cho `Bonus_length`.
6. **Tầng quyết định** (N5, N8): ngưỡng tin cậy, mở rộng theo tầng, xử lý đa nghĩa, MMR cho công cụ tìm từ.
7. **Tầng phản hồi** (N11): nút báo lỗi, blocklist mềm, dùng log để học trọng số.

**Công thức gợi ý** (điểm xuất phát, cần chỉnh theo benchmark):

```
score'(w) = score(w)                       # công thức hiện tại hoặc bản đã nâng cấp
          + β · fam(w)                     # fam = chuẩn hóa log tần suất đời thường (0..1)
          − γ · [w ∈ T2]                   # phạt nhẹ nhóm ít quen
          (loại hẳn nếu w ∈ T3, trừ khi trùng keyword)

đủ tin cậy ⇔ score'(top1) ≥ θ1  và  score'(top1) − score'(top2) ≥ θ2
```

Pseudo-code cho cổng ứng viên và mở rộng theo tầng:

```python
def rank_with_tiers(query, letter, cfg):
    for tier in (T1, T2):                       # T3 không tham gia
        cands = [w for w in tier if first_unit(w) == letter and w != query]
        scored = sorted(((score_prime(query, w), w) for w in cands), reverse=True)
        if scored and confident(scored, cfg.theta1, cfg.theta2):
            return scored[:5], tier.name
    return scored[:5], "low_confidence"        # trả kèm cờ độ tin cậy thấp
```

---

## 6. Chỉ số và tiêu chí nghiệm thu

| Chỉ số | Định nghĩa | Mục tiêu (tham khảo, cần chốt cùng nhóm) |
|---|---|---|
| **Rarity@1** | % top-1 nằm ngoài top-N từ quen thuộc (N ≈ 20k) | Giảm mạnh so với hiện tại (ghi số đo trước/sau) |
| **Junk@1** | % top-1 bị 2 người chấm cùng gắn "không liên quan" | Giảm mạnh so với hiện tại |
| **Relevance@5** | % trong top-5 được chấm "liên quan" | Tăng so với hiện tại |
| **Abstain rate** | % truy vấn bị đánh dấu kém chắc chắn | Theo dõi; không để quá cao ở chữ phổ biến |
| **Rarity theo chữ cái** | Rarity@1 chia theo chữ đầu | Không có chữ nào vượt xa mức trung bình |

Quy trình chấm: lấy 200–300 truy vấn (từ log + tự viết, gồm cả keyword đa nghĩa, không dấu, hiếm), cố định bộ truy vấn này, 2 người chấm độc lập, ghi lại cả điểm đồng thuận giữa hai người chấm.

Checklist nghiệm thu:
- [ ] Có log chẩn đoán đủ trường ở mục 4.1.
- [ ] Đã chạy E1–E8, có bảng kết quả, xác định được nguyên nhân thật sự trong số N1–N11.
- [ ] Rarity@1 và Junk@1 cải thiện trên bộ truy vấn cố định mà không làm giảm Relevance@5.
- [ ] Mọi chữ cái đầu có đủ ứng viên T1 hoặc có xử lý riêng.
- [ ] Có nút báo "từ lạ" và log phản hồi.

---

## 7. Lưu ý riêng cho game

- Với **Người Giao Thư (1 manh mối)**: mục tiêu là *đánh lừa*, nên một số từ "bẫy" hơi bất ngờ là chấp nhận được, **nhưng vẫn phải là từ người chơi nhận ra ngay**. Từ lạ khiến người chơi thấy thuật toán "ngẫu nhiên", mất cảm giác công bằng, và có thể làm sai lệch tỉ lệ "an toàn".
- Với **Người Bạn (3 manh mối)**: mục tiêu là đoán đúng, nên cổng quen thuộc (T1/T2) nên áp dụng chặt hơn.
- Nên tách `fam(w)` và danh sách bẫy phân tán thành hai cấu hình riêng để chỉnh độ khó mà không ảnh hưởng chất lượng tìm từ.

---

## 8. Điều cần người sửa game làm rõ (tài liệu gốc không nêu)

1. Kho từ 𝒱 lấy từ đâu, có bao nhiêu từ, có lọc tần suất chưa?
2. Embedding được huấn luyện thế nào (ngữ liệu, độ lớn, có giảm chiều từ số chiều lớn hơn không, cấp độ âm tiết hay từ)?
3. Đồ thị tri thức được xây ra sao (gán tay, trích từ ngữ liệu, từ LLM, từ điển)? Số cạnh, số nút, phân phối bậc?
4. Giá trị `k` dùng để tính `Hub`.
5. Danh sách từ bị loại hiện có (stopword, blocklist) nếu có.
