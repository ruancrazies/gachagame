# Luật cần chốt trước khi viết engine (Giai đoạn 1)

Mỗi dòng ghi: câu hỏi, đề xuất mặc định của mình, và chỗ nó nằm trong code/cấu hình. Tick khi bạn đã quyết (kể cả khi đồng ý với đề xuất).
Phần cấu hình nào còn `placeholder` hoặc `draft` sẽ hiện trong cảnh báo của `npm run validate:config`.

## A. Từ danh sách ở mục 13 của tài liệu thiết kế

| # | Câu hỏi | Đề xuất mặc định | Nằm ở |
| --- | --- | --- | --- |
| [ ] 1 | Duyệt công thức sát thương và hằng số (phụ lục A) | Giữ nguyên phụ lục A | `config/rules.json` → `damage` (đã nạp, trạng thái `draft`) |
| [ ] 2 | Duyệt tỉ lệ gacha, pity, loại banner (phụ lục B) | Giữ nguyên phụ lục B | Chưa nạp vào cấu hình; làm ở Giai đoạn 2 |
| [ ] 3 | Phí hoàn trả: xác nhận mất 20% / hoàn 80%; tỉ lệ cho mảnh tướng và xác | 80% cho mọi loại nguyên liệu | `rules.economy.refundRate` (hiện 0.8 cho tất cả) |
| [ ] 4 | Kỹ năng #5 chỉ UR hay cả SS | Chỉ UR | `rules.heroSkillSlots` (A 4, S 4, SS 4, UR 5) |
| [ ] 5 | Năng lượng: mỗi hành động cộng bao nhiêu, cần bao nhiêu để tung tuyệt kỹ | Tối đa 100; đánh thường +30; chưa cộng khi bị đánh | `rules.energy.max`, `skills[].energyGain` (con số +30 là placeholder) |
| [ ] 6 | SPD bằng nhau thì ai đi trước | Bên tấn công trước, rồi theo thứ tự ô trong lưới (hàng trước, trái sang phải) | Chưa có; thêm vào `rules.battle` khi chốt |
| [ ] 7 | Vị trí trong lưới có ảnh hưởng gì ngoài việc bị nhắm | Không (chỉ ảnh hưởng luật chọn mục tiêu) | Chưa có |
| [ ] 8 | Mục tiêu chết giữa chừng thì chọn lại thế nào | Chọn lại bằng cùng luật trong số mục tiêu còn sống; không còn ai thì hành động hụt, không hoàn năng lượng | Chưa có; là hành vi của engine |
| [ ] 9 | Main-stat cố định của nhẫn, vòng tay, vòng cổ; điều kiện mở 4 slot ấn | Không có đề xuất, cần bạn quyết | Mẫu trang bị và ấn làm ở Giai đoạn 2 và 4 |

## B. Chỗ mình phải điền tạm vì tài liệu chưa nói (cần bạn xác nhận hoặc thay)

Tài liệu thiết kế dựa vào "tài liệu GACHA" gốc mà mình không có trong tay, nên các mục dưới đây là số liệu điền tạm (`placeholder`), không phải quyết định.

| # | Điểm | Mình đã điền | Cần bạn |
| --- | --- | --- | --- |
| [ ] 10 | **Tên 5 vai trò** | Chiến binh, Pháp sư, Sát thủ, Hộ vệ, Hỗ trợ | Cho mình 5 vai trò thật (`config/taxonomy.json`) |
| [ ] 11 | **Các loại vũ khí** | Kiếm, Thương, Cung, Trượng, Chủy thủ | Danh sách thật (`config/taxonomy.json`) |
| [ ] 12 | **Quan hệ khắc hệ giữa 4 hệ cơ bản** (tài liệu chỉ nói +10% / -10%, Quang-Ám +15%, không nói hệ nào khắc hệ nào) | Vòng Hỏa → Phong → Lôi → Thủy → Hỏa | Xác nhận hoặc đổi (`rules.damage.elementBeats`); schema bắt buộc là một vòng, không có cặp khắc lẫn nhau |
| [ ] 13 | **Bảng tiến hóa ★1-★20** (nguyên liệu, cấp tối đa từng bậc) | Số do công thức đơn giản sinh ra, cấp tối đa ★n = 50×n | Gửi bảng trong tài liệu GACHA; cấu trúc cột mình đoán: bản sao, xác theo sao, đá thức tỉnh, tinh thể máu, đá thời không |
| [ ] 14 | **Kỹ năng của nhân vật**: mỗi nhân vật có những loại nào | Mỗi nhân vật có 1 đánh thường + 1 tuyệt kỹ theo vai trò; UR thêm 1 bị động mở ở ★15. Chưa có bị động #1-#4 | Cho biết bộ khung kỹ năng thật (số bị động, mốc ★ mở khóa) |
| [ ] 15 | **Chỉ số a, b của 12 nhân vật mẫu**, tên nhân vật | Tên tự đặt, chỉ số theo vai trò và bậc hiếm (L1000 của Chiến binh bậc A: ATK ≈ 9100, DEF ≈ 5450, HP ≈ 90 900) | Chỉ để chạy thử; cân bằng thật làm bằng mô phỏng ở Giai đoạn 1 |

## C. Một điểm mơ hồ trong công thức chỉ số theo cấp

Công thức `T(L) = a + b·Σ kᵢ·nᵢ(L)` dùng nᵢ(L) là "số cấp của giai đoạn i đã đi qua", nhưng chưa nói ở cấp 1 thì nᵢ bằng bao nhiêu.

- [ ] 16 Đề xuất: cấp 1 cho đúng chỉ số gốc `a` (mọi nᵢ = 0); mỗi lần lên cấp tính vào giai đoạn chứa cấp mới. Khi đó cấp 1000 có n = (149, 200, 350, 180, 120), tổng kᵢ·nᵢ = 1634. Nếu bạn muốn n₁(150) = 150 thì cấp 1 đã có chỉ số cao hơn `a` một chút. Chốt trước khi viết bộ dựng chỉ số (Giai đoạn 2); lúc đó nên có test tính tay các mốc 1, 150, 151, 350, 351, 700, 701, 880, 881, 1000.

## D. Quyết định thiết kế mình tự đưa ra khi dựng khung (dễ đổi, nhưng nên biết)

- **Khóa trong code bằng tiếng Anh**, tên hiển thị tiếng Việt: hệ `fire/water/wind/lightning/light/dark`, bậc hiếm `A/S/SS/UR`, chỉ số `atk/def/hp/spd/critRate/critDamage/damageBonus/healingBonus/penetration/evasion/effectResistance/effectAccuracy/lifesteal/damageReduction`.
- **Kỹ năng mở khóa theo `skills[].unlockStar`**, không lặp lại trong bảng tiến hóa, để chỉ có một nơi ghi mốc mở khóa.
- **Luật chọn mục tiêu** có thêm `lowest_hp` (cho kỹ năng hồi máu, sát thủ) và `all` (diện rộng) so với danh sách 6 luật trong tài liệu; hiệu ứng có thêm loại `dot` (thiêu đốt).
- **Mỗi file cấu hình có `status`** (`placeholder` / `draft` / `final`). Khi chốt xong từng phần, đổi sang `final`; `npm run validate:config -- --strict` sẽ không cho phát hành khi còn phần chưa final.
