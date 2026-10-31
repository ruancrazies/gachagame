# Tài liệu thiết kế & lộ trình phát triển — Game Gacha Thần thoại

Oct 31, 2026 · @axc

## 1. Tổng quan

Mục tiêu bản đầu là một game gacha đấu tự động theo lượt, chơi được trên web, với server giữ toàn bộ logic để sau này chuyển sang Unity mà không phải viết lại phần lõi.

**Đã chốt trong tài liệu GACHA (làm ngay):**

- 6 hệ (Hỏa, Thủy, Phong, Lôi, Quang, Ám), 5 vai trò, đội hình lưới 3x3, tối đa 5 nhân vật mỗi bên.
- Trận đấu theo một hàng đợi chung xếp theo SPD, tối đa 20 hiệp; đánh thường hoặc tuyệt kỹ khi đầy năng lượng.
- Chỉ số cơ bản (ATK, DEF, HP, SPD) và chỉ số phụ (crit, xuyên giáp, né tránh, kháng/chính xác hiệu ứng, hút máu...).
- Nhân vật 4 bậc hiếm A, S, SS, UR; tiến hóa ★1 đến ★20; cấp tối đa 1000 chia 5 giai đoạn.
- Trang bị: 5 trang bị chính cố định, vũ khí theo nhân vật, 3 phụ kiện có sub-stat ngẫu nhiên, 4 ấn, 1 linh thú.

**Chưa có, mở rộng dần (thiết kế để cắm thêm được, chưa làm đầy đủ):**

- Kỹ năng riêng của từng nhân vật (bản đầu dùng bộ kỹ năng mẫu).
- Các bộ trang bị (set bonus), nội dung ấn và linh thú cụ thể.
- Sự kiện, kinh tế, chế độ PvE/PvP, xếp hạng.

Hệ quả cho thiết kế: mọi thứ "mở rộng sau" phải là **dữ liệu cấu hình** hoặc **module cắm thêm**, không viết cứng vào lõi game.

**Lộ trình tổng quan**

&#91;embedded content: lộ trình 7 giai đoạn · 1 cột mốc quyết định\]

Bốn giai đoạn đầu đưa tới một bản web chơi được; từ giai đoạn 4 trở đi là các đợt lặp. Các mốc tuần chỉ là ước tính tham khảo cho một người làm toàn thời gian, cần chỉnh theo nhóm và thời gian thực tế của bạn.

## 2. Nguyên tắc kiến trúc

Sáu nguyên tắc dưới đây quyết định việc game có mở rộng được và chuyển sang Unity được hay không.

1. **Server quyết định mọi thứ quan trọng.** Gacha, roll sub-stat, trừ và cộng tài nguyên, tiến hóa, hoàn trả nhân vật và kết quả trận đấu đều chạy trên server. Client chỉ gửi yêu cầu và hiển thị.
2. **Trận đấu là hàm thuần túy, deterministic.** Mọi yếu tố ngẫu nhiên (chí mạng, trúng hiệu ứng, né tránh, kỹ năng nhắm mục tiêu ngẫu nhiên) đều lấy từ một bộ sinh số ngẫu nhiên có seed, không dùng hàm ngẫu nhiên của hệ thống. Đầu vào: hai đội hình, cấu hình game, seed. Đầu ra: nhật ký sự kiện. Mỗi trận vẫn khác nhau vì server tạo seed mới cho từng trận, nhưng cùng seed thì kết quả giống hệt, nên dễ kiểm thử, tái hiện lỗi và chống gian lận.
3. **Client chỉ phát lại nhật ký.** Web phát lại bằng hiệu ứng đơn giản, Unity sau này phát lại bằng hoạt ảnh đẹp, cùng một nhật ký.
4. **Dữ liệu game nằm trong file cấu hình.** Chỉ số nhân vật, bảng tiến hóa ★1 đến ★20, tỉ lệ gacha, hệ số cấp độ đều là JSON hoặc bảng tính, có số phiên bản. Cân bằng game không cần sửa code.
5. **Kỹ năng và hiệu ứng là module cắm thêm.** Mỗi kỹ năng là một mô tả dữ liệu (mục tiêu, hệ số sát thương, hiệu ứng, điều kiện) chạy bằng một bộ "động cơ hiệu ứng" chung. Kỹ năng đặc biệt mới được thêm bằng một hàm xử lý đăng ký sẵn, không sửa lõi.
6. **Mọi giao dịch có nhật ký.** Mỗi lần nhận hoặc tiêu tài nguyên, mỗi lần gacha đều ghi lại để kiểm tra, hoàn tác và xử lý khiếu nại.

## 3. Công nghệ

Bản web dùng TypeScript cho cả client lẫn server để chỉ cần học một ngôn ngữ; Unity (C#) chỉ thay phần client ở giai đoạn 6.

| Thành phần | Bản web (giai đoạn 1 đến 5) | Bản Unity (giai đoạn 6) | Ghi chú |
| --- | --- | --- | --- |
| Client | React + Vite, PixiJS hoặc HTML/CSS cho phát lại trận | Unity (C#) | Chỉ là màn hình, không chứa luật game |
| Server | Node.js + TypeScript (Fastify hoặc NestJS) | Giữ nguyên | Không đổi khi sang Unity |
| Cơ sở dữ liệu | PostgreSQL | Giữ nguyên | Dữ liệu người chơi, giao dịch |
| Cache, xếp hạng | Redis (thêm khi cần) | Giữ nguyên | Bảng xếp hạng, hàng đợi, khóa chống gửi trùng |
| Truy cập DB | Prisma hoặc Drizzle | Giữ nguyên | Có migration để cập nhật cấu trúc |
| Giao thức | REST + JSON, mô tả bằng OpenAPI | Giữ nguyên | Unity sinh client từ OpenAPI |
| Đăng nhập | Token (JWT hoặc session token) | Giữ nguyên | Dùng được cho cả web lẫn Unity |
| Cấu hình game | JSON trong kho mã, có số phiên bản | Giữ nguyên | Có thể nhập từ Google Sheets sau |
| Triển khai | Docker trên VPS nhỏ hoặc Railway, Render, Fly.io | Giữ nguyên | Đặt server ở Singapore cho người chơi Việt Nam |

Khi đông người chơi, chạy nhiều bản server song song sau load balancer. Do API không giữ trạng thái trong bộ nhớ nên việc mở rộng không cần sửa code.

**Điểm cần cân nhắc ở giai đoạn 6:** nếu muốn dùng chung code mô phỏng trận giữa client Unity và server thì server nên viết bằng C# (.NET). Với kiến trúc "server tính trận, client phát lại" như tài liệu này thì không cần, vì client không phải tính lại trận.

## 4. Kiến trúc hệ thống

Server giữ toàn bộ luật và dữ liệu, client chỉ gửi yêu cầu và phát lại kết quả, nên đổi từ web sang Unity chỉ thay hàng trên cùng của sơ đồ.

&#91;embedded content: kiến trúc hệ thống · client, API, server, engine, dữ liệu\]

**Một trận đấu đi qua hệ thống như sau:**

1. Client gửi đội hình đã chọn và loại trận (ví dụ đánh quái chương 1).
2. Server kiểm tra đội hình hợp lệ (nhân vật thuộc người chơi, vị trí đúng trong lưới 3x3) rồi dựng chỉ số cuối từ cấp, sao, trang bị, phụ kiện, ấn và linh thú.
3. Server tạo seed ngẫu nhiên và gọi engine `simulate`.
4. Server lưu hồ sơ trận (seed, hai đội hình, phiên bản cấu hình, nhật ký) và cộng phần thưởng trong cùng một giao dịch.
5. Server trả về nhật ký sự kiện và kết quả.
6. Client phát lại nhật ký thành hoạt ảnh, không tính toán lại gì.

## 5. Mô hình dữ liệu

Dữ liệu chia hai loại: **cấu hình** (do nhà thiết kế soạn, chỉ đọc khi chạy) và **dữ liệu người chơi** (lưu trong PostgreSQL). Chia như vậy để thêm nhân vật, kỹ năng, bộ trang bị chỉ cần thêm dòng dữ liệu cấu hình.

| Thực thể | Loại | Trường chính | Ghi chú |
| --- | --- | --- | --- |
| Hero (mẫu nhân vật) | Cấu hình | id, tên, hệ, vai trò, bậc hiếm, loại vũ khí, a và b của ATK/DEF/HP/SPD, danh sách id kỹ năng, id vũ khí Trấn | Quang/Ám có ở mọi bậc hiếm |
| Skill | Cấu hình | id, loại (thường, tuyệt kỹ, bị động), luật chọn mục tiêu, hệ số sát thương, danh sách hiệu ứng, năng lượng, sao mở khóa | Bản đầu dùng bộ kỹ năng mẫu theo vai trò |
| Effect (hiệu ứng) | Cấu hình | id, loại (choáng, câm lặng, khiên, hồi máu, buff, debuff...), số lượt, giá trị, xác suất | Dùng chung cho kỹ năng, ấn, linh thú |
| Mẫu trang bị | Cấu hình | slot (mũ, áo, giáp chân, băng tay, giày), main-stat cố định, độ hiếm, chỉ số theo cấp | Bộ trang bị (set bonus) thêm ở giai đoạn 4 |
| Mẫu vũ khí | Cấu hình | loại, độ hiếm, chỉ số cơ bản, hiệu ứng Trấn (kèm id Hero chủ) | Chỉ số cơ bản dùng được cho mọi nhân vật cùng loại |
| Ấn | Cấu hình | id, slot 1 đến 4, điều kiện mở (cấp, sao), hiệu ứng | Nội dung chi tiết thêm ở giai đoạn 4 |
| Linh thú | Cấu hình | id, 3 kỹ năng buff | Nội dung chi tiết thêm ở giai đoạn 4 |
| Bảng tiến hóa | Cấu hình | ★1 đến ★20: nguyên liệu, kỹ năng mở, cấp tối đa | Lấy từ bảng trong tài liệu GACHA; UR có thêm kỹ năng bị động #5 mở ở ★15 |
| Banner gacha | Cấu hình | danh sách nhân vật, tỉ lệ theo bậc hiếm và hệ, cơ chế bảo hiểm (pity) | Quang/Ám có tỉ lệ thấp hơn |
| Tài khoản | Người chơi | id, tên, tài nguyên, bộ đếm pity, ngày tạo |  |
| Nhân vật sở hữu | Người chơi | id, id Hero, cấp, sao, trang bị đang mặc, linh thú | Một người có thể có nhiều bản cùng Hero |
| Phụ kiện sở hữu | Người chơi | id, slot (nhẫn, vòng tay, vòng cổ), main-stat, 4 sub-stat đã roll (loại + giá trị) | Roll trên server, lưu cố định |
| Trang bị, vũ khí sở hữu | Người chơi | id, id mẫu, cấp cường hóa, nhân vật đang mặc |  |
| Nhật ký giao dịch | Người chơi | thời điểm, loại, tài nguyên thay đổi, tham chiếu | Chỉ ghi thêm, không sửa |
| Hồ sơ trận | Người chơi | seed, hai đội hình, phiên bản cấu hình, nhật ký sự kiện, kết quả | Để phát lại và kiểm tra |

**Công thức chỉ số theo cấp** (lấy từ tài liệu GACHA). Chỉ số cơ bản tại cấp L, với a là chỉ số gốc, b là hệ số tăng cơ bản, n\_i(L) là số cấp của giai đoạn i mà nhân vật đã đi qua:

```latex
T(L) = a + b \sum_{i=1}^{5} k_i \, n_i(L), \qquad k = (1,\ 1.2,\ 1.5,\ 2,\ 3)
```

Các giai đoạn cấp: 1 đến 150, 151 đến 350, 351 đến 700, 701 đến 880, 881 đến 1000. Công thức này gộp năm công thức theo giai đoạn của tài liệu gốc, nên có thể dùng làm bài kiểm thử tự động: tính tay vài mốc cấp rồi so với kết quả của code.

## 6. Giai đoạn 0: Nền móng (khoảng 1 tuần)

Giai đoạn này chốt luật còn thiếu và dựng khung dự án, để các giai đoạn sau không phải đoán.

**Việc cần làm**

- [ ] Chốt các điểm mâu thuẫn và còn thiếu trong tài liệu GACHA (danh sách ở mục 13).
- [ ] Tạo kho mã dạng monorepo gồm bốn gói: `shared` (kiểu dữ liệu, schema cấu hình), `engine` (mô phỏng trận), `server`, `web`.
- [ ] Cài TypeScript, lint, kiểm thử tự động (Vitest) và chạy kiểm thử mỗi lần đẩy mã (CI).
- [ ] Định nghĩa schema cho file cấu hình (Hero, Skill, Effect, bảng tiến hóa) và kiểm tra hợp lệ bằng Zod.
- [ ] Soạn bộ dữ liệu mẫu: khoảng 12 nhân vật phủ đủ 6 hệ và 5 vai trò, mỗi vai trò có kỹ năng thường và tuyệt kỹ mẫu.

**Tiêu chí hoàn thành**

- Repo chạy được, kiểm thử mẫu báo xanh trên CI.
- File cấu hình mẫu qua được bước kiểm tra schema.
- Các luật còn thiếu đã có quyết định bằng văn bản.

## 7. Giai đoạn 1: Bộ mô phỏng trận đấu (khoảng 2 đến 3 tuần)

Làm trước tiên vì đây là lõi của game và chỉ cần chạy ở terminal, chưa cần server hay giao diện. Đầu ra là một hàm `simulate(đội A, đội B, cấu hình, seed)` trả về nhật ký sự kiện.

**Việc cần làm**

- [ ] Lưới 3x3 và vị trí từng nhân vật; các luật chọn mục tiêu dưới dạng dữ liệu: máu cao nhất, công cao nhất, hàng đầu tiên, trung tâm, hàng dọc, ngẫu nhiên.
- [ ] Hàng đợi hành động chung cho cả hai phe, xếp theo SPD; vòng lặp tối đa 20 hiệp.
- [ ] Năng lượng: đánh thường khi thiếu, tuyệt kỹ khi đầy.
- [ ] Công thức sát thương: ATK, hệ số kỹ năng, DEF và xuyên giáp, chí mạng, damage bonus, giảm sát thương, khắc hệ (+10% hoặc -10%, Quang và Ám +15%). Công thức và hằng số mặc định ở phụ lục A.
- [ ] Hiệu ứng trạng thái: choáng (mất lượt), câm lặng (chỉ đánh thường), khiên, hồi máu, buff và debuff; kiểm tra Chính xác so với Kháng hiệu ứng.
- [ ] Hành động đặc biệt: hành động ngay, liên kích, phản kích, truy kích, hồi sinh.
- [ ] Điều kiện kết thúc: một bên bị hạ hết, hoặc hết 20 hiệp thì phân thắng bại theo luật của chế độ (phòng thủ thắng nếu bên tấn công không hạ hết, hoặc so sát thương gây ra).
- [ ] Bộ "điểm móc" (hook) để kỹ năng, ấn, linh thú sau này can thiệp: bắt đầu lượt, trước và sau khi gây sát thương, khi chết, khi kết thúc hiệp.
- [ ] Công cụ chạy hàng loạt (ví dụ 1000 trận ngẫu nhiên) và báo tỉ lệ thắng theo hệ, vai trò, vị trí.

**Định dạng nhật ký sự kiện** (client dùng để phát lại, một dòng cho mỗi hành động):

```json
{"round": 3, "actor": "A2", "action": "skill", "skill": "fire_burst", "targets": [{"id": "B1", "dmg": 1240, "crit": true, "hpAfter": 3100}], "effects": []}
```

**Tiêu chí hoàn thành**

- Cùng đầu vào và seed thì nhật ký giống nhau từng byte (có kiểm thử), kể cả khi trận có chí mạng, hiệu ứng theo xác suất và kỹ năng chọn mục tiêu ngẫu nhiên. Muốn vậy, mọi lần rút số ngẫu nhiên phải đi qua một bộ sinh số có seed và theo thứ tự cố định.
- Mỗi công thức và mỗi hiệu ứng có kiểm thử đơn vị với số tính tay.
- Chạy 1000 trận mẫu không lỗi, không trận nào vượt 20 hiệp.
- Chưa có hệ hay vai trò nào thắng hoặc thua áp đảo vô lý trong báo cáo mô phỏng.

## 8. Giai đoạn 2: Server và dữ liệu cốt lõi (khoảng 3 đến 4 tuần)

Dựng server để người chơi có tài khoản, triệu hồi nhân vật, nâng cấp và đánh trận, tất cả đều kiểm thử được bằng gọi API, chưa cần giao diện.

**Việc cần làm**

- [ ] Tài khoản và đăng nhập bằng token; cơ sở dữ liệu PostgreSQL có migration.
- [ ] API hồ sơ, danh sách nhân vật, kho đồ.
- [ ] Gacha: roll trên server, tỉ lệ đọc từ cấu hình banner, Quang và Ám có tỉ lệ thấp hơn bốn hệ còn lại, có cơ chế bảo hiểm (pity), ghi nhật ký mỗi lượt. Tỉ lệ, pity và các loại banner đề xuất ở phụ lục B.
- [ ] Nâng cấp và tiến hóa ★1 đến ★20: kiểm tra đủ nguyên liệu (copy, xác theo sao, đá thức tỉnh, tinh thể máu, đá thời không), xác phải cùng hệ, xác vạn năng dùng cho mọi hệ.
- [ ] Hoàn trả nhân vật về cấp 1, ★1 mất 20% nguyên liệu và hoàn 80% (đã chốt ở mục 13; tỉ lệ cho mảnh tướng và xác chưa chốt).
- [ ] Trang bị: mặc và tháo 5 trang bị chính, vũ khí đúng loại, 3 phụ kiện; roll 4 sub-stat ngẫu nhiên trên server khi phụ kiện rơi ra.
- [ ] Điểm cuối "đánh trận": nhận đội hình, dựng chỉ số cuối (cấp, sao, trang bị), gọi engine, lưu hồ sơ trận, trả nhật ký. Bắt đầu bằng trận đánh quái (PvE) đơn giản.
- [ ] Mọi thay đổi tài nguyên nằm trong một giao dịch cơ sở dữ liệu và có khóa chống gửi trùng (idempotency key).
- [ ] Tài liệu API (OpenAPI) tự sinh từ code.

**Tiêu chí hoàn thành**

- Một kịch bản kiểm thử tự động chạy trọn: tạo tài khoản, triệu hồi, nâng sao, mặc trang bị, đánh trận.
- Gửi trùng một yêu cầu gacha hoặc nâng sao không làm trừ tài nguyên hai lần.
- Không có điểm nào để client tự gửi kết quả trận hay tự quyết định kết quả gacha.

## 9. Giai đoạn 3: Client web bản đầu chơi được (khoảng 3 tuần)

Mục tiêu là kiểm tra game có vui không, chưa cần hình ảnh đẹp: dùng hình tạm hoặc chữ, tập trung vào luồng chơi.

| Màn hình | Nội dung | Gọi API |
| --- | --- | --- |
| Đăng nhập | Đăng ký, đăng nhập | Tài khoản |
| Danh sách nhân vật | Lọc theo hệ, vai trò, bậc hiếm; xem chi tiết chỉ số | Nhân vật sở hữu |
| Triệu hồi | Chọn banner, quay một hoặc nhiều lượt, hiện kết quả | Gacha |
| Đội hình | Kéo thả 5 nhân vật vào lưới 3x3, xem trước mục tiêu bị nhắm | Đội hình |
| Trang bị | Mặc và tháo trang bị, vũ khí, phụ kiện; xem sub-stat | Trang bị |
| Nâng cấp | Nâng cấp, nâng sao, chọn xác làm nguyên liệu | Tiến hóa |
| Chiến đấu | Phát lại nhật ký: thanh máu, số sát thương, hiệu ứng; tốc độ x1, x2, bỏ qua | Đánh trận |
| Kết quả | Thắng hoặc thua, phần thưởng | Đánh trận |

**Tiêu chí hoàn thành**

- Một người chưa từng thấy game chơi liền mạch từ đăng ký đến thắng trận đầu, không cần ai chỉ.
- Bản phát lại khớp nhật ký từng hành động, không lệch số liệu.
- Có buổi chơi thử với 5 đến 10 người và ghi lại phản hồi về nhịp trận đấu, độ khó hiểu của lưới 3x3 và gacha.

Đây là cột mốc quyết định: nếu game chưa vui thì chỉnh luật và cân bằng ở đây, trước khi đầu tư thêm nội dung.

## 10. Giai đoạn 4: Mở rộng nội dung (lặp theo từng đợt)

Từ giai đoạn này, mỗi đợt thêm nội dung theo cùng một quy trình, và nếu phải sửa lõi game thì đó là dấu hiệu thiết kế ở giai đoạn 1 và 2 còn thiếu điểm cắm.

**Quy trình một đợt nội dung:** viết dữ liệu, kiểm tra schema, chạy mô phỏng hàng loạt để xem cân bằng, chơi thử, rồi phát hành bằng cập nhật cấu hình.

| Hạng mục | Cách thêm | Cần sửa lõi? |
| --- | --- | --- |
| Kỹ năng riêng của từng nhân vật | Thêm dòng Skill và Effect; kỹ năng có cơ chế lạ thì đăng ký thêm một hàm xử lý riêng | Không |
| Vũ khí Trấn của nhân vật UR | Thêm mẫu vũ khí kèm hiệu ứng gắn với id Hero chủ; engine đã tách sẵn chỉ số cơ bản và hiệu ứng Trấn | Không |
| Bộ trang bị (set bonus) | Thêm trường "bộ" cho mẫu trang bị và bảng hiệu ứng theo số mảnh; engine tính ở bước dựng chỉ số | Thêm bước tính một lần |
| Ấn (4 slot) | Thêm dòng Ấn với điều kiện mở khóa theo cấp và sao | Không |
| Linh thú | Thêm dòng Linh thú với 3 kỹ năng buff, dùng chung engine hiệu ứng | Không |
| Sub-stat mới cho phụ kiện | Thêm vào bảng loại sub-stat và khoảng giá trị roll | Không |
| Chế độ PvE (chương, tầng) | Thêm cấu hình màn và đội quái | Không |
| Chế độ PvP bất đồng bộ | Người chơi đánh đội phòng thủ đã lưu của người khác; server chạy trận, không cần hai người cùng online | Thêm bảng đội phòng thủ và xếp hạng |

**Việc cần làm trong giai đoạn**

- [ ] Hoàn thiện bộ kỹ năng cho toàn bộ nhân vật đã phát hành, theo từng đợt 6 đến 12 nhân vật.
- [ ] Công cụ cân bằng: báo cáo tỉ lệ thắng theo nhân vật, hệ, vai trò; cảnh báo nhân vật vượt trội hoặc yếu bất thường.
- [ ] Công cụ nhập cấu hình từ bảng tính để người thiết kế không phải sửa JSON bằng tay.
- [ ] Công cụ nội bộ để xem lại một trận từ hồ sơ (seed và nhật ký).

**Tiêu chí hoàn thành mỗi đợt**

- Không có nhân vật hay bộ trang bị mới nào làm tỉ lệ thắng tổng lệch quá mức đã chọn (ngưỡng do nhà thiết kế quyết định).
- Toàn bộ kiểm thử của giai đoạn 1 và 2 vẫn xanh.

## 11. Giai đoạn 5: Sự kiện, kinh tế và vận hành

Sự kiện cũng là dữ liệu cấu hình: một sự kiện mới phải tạo được mà không cần phát hành lại server.

**Hệ thống sự kiện**

- Mỗi sự kiện có thời điểm bắt đầu và kết thúc, điều kiện tham gia, danh sách nhiệm vụ, phần thưởng và banner gacha đi kèm (nếu có).
- Xác vạn năng (dùng cho mọi hệ, để gỡ nút thắt Quang và Ám) chỉ phát qua sự kiện, theo đúng thiết kế trong tài liệu GACHA; số lượng mỗi sự kiện là một con số cấu hình.
- Nhiệm vụ hằng ngày và nguồn farm nguyên liệu tiến hóa (đá thức tỉnh, tinh thể máu, đá thời không, xác theo hệ).

**Kinh tế**

- Lập bảng "nguồn vào, nguồn ra" cho từng loại tài nguyên, để thấy tài nguyên nào dư hoặc thiếu theo thời gian chơi.
- Dùng nhật ký giao dịch để theo dõi lượng tài nguyên thực tế đi vào và ra mỗi ngày.
- Chỉnh phí hoàn trả nhân vật và tỉ lệ gacha bằng cấu hình, có số phiên bản để so sánh trước và sau.

**Vận hành**

- [ ] Công cụ quản trị: xem tài khoản, cộng hoặc trừ tài nguyên có ghi lý do, khóa tài khoản, tra cứu nhật ký.
- [ ] Chống gian lận: giới hạn tốc độ gọi API, kiểm tra khóa chống gửi trùng, phát hiện tài nguyên tăng bất thường.
- [ ] Giám sát và cảnh báo lỗi server; sao lưu cơ sở dữ liệu theo lịch và thử khôi phục.
- [ ] Cấu hình nóng: đổi cấu hình sự kiện và cân bằng không cần dừng server.

**Tiêu chí hoàn thành**

- Tạo và chạy một sự kiện hoàn chỉnh chỉ bằng dữ liệu, không sửa code.
- Khôi phục thử cơ sở dữ liệu từ bản sao lưu thành công.

## 12. Giai đoạn 6: Chuyển sang Unity

Chỉ làm khi bản web đã qua chơi thử và luật game đã ổn định, vì khi đó Unity chỉ thay phần giao diện và server giữ nguyên.

**Điều kiện để bắt đầu**

- API đã đóng băng một phiên bản (ví dụ v1) có tài liệu OpenAPI đầy đủ.
- Nhật ký trận có định dạng ổn định và có số phiên bản.
- Đã có tài nguyên hình ảnh và hoạt ảnh thật, hoặc kế hoạch làm chúng.

**Việc cần làm**

- [ ] Dựng dự án Unity, sinh client gọi API từ file OpenAPI.
- [ ] Dựng lại các màn hình của giai đoạn 3 bằng giao diện Unity.
- [ ] Trình phát lại trận: đọc nhật ký sự kiện, chạy hoạt ảnh đòn đánh, kỹ năng, hiệu ứng trạng thái.
- [ ] Tải và cập nhật tài nguyên (asset bundle hoặc Addressables) để thêm nội dung không cần cập nhật ứng dụng.
- [ ] Đóng gói mobile; nếu có thanh toán thì xác thực biên nhận ở phía server.
- [ ] Chạy song song web và Unity trên cùng một server trong thời gian chuyển đổi, phân biệt bằng phiên bản API.

**Tiêu chí hoàn thành**

- Cùng một tài khoản chơi được trên cả web lẫn Unity với dữ liệu giống nhau.
- Không phải sửa logic server hay engine để hỗ trợ Unity.

## 13. Quyết định đã chốt, luật còn thiếu và rủi ro

Ngày 2026-10-31 đã chốt các chỗ mâu thuẫn của tài liệu GACHA như bảng dưới. Công thức sát thương và thiết kế gacha được đề xuất ở phụ lục A và B, chờ bạn duyệt; các luật còn thiếu ở danh sách kế tiếp cần chốt trước khi viết engine.

**Đã chốt và đề xuất**

| Điểm | Quyết định | Áp dụng trong code và dữ liệu |
| --- | --- | --- |
| Tên bậc hiếm | Chốt A, S, SS, UR (thay cho R, S, SR, UR trong bảng gốc) | Giá trị `rarity` là A, S, SS, UR; sửa lại toàn văn tài liệu |
| Phí hoàn trả | Khi đưa nhân vật về cấp 1, ★1: mất 20% nguyên liệu, hoàn 80% | `refundRate = 0.8` trong cấu hình; tỉ lệ cho mảnh tướng và xác chưa chốt |
| Tên chỉ số | Thống nhất là "Xuyên giáp" | Một khóa duy nhất `penetration` trong code và cấu hình |
| Sub-stat roll của phụ kiện | Pool gồm 10 loại: Crit Rate, Crit DMG, Damage Bonus, Healing Bonus, Xuyên giáp, Né tránh, Kháng hiệu ứng, Chính xác, Hút máu, Giảm sát thương | Bảng loại sub-stat và khoảng giá trị roll trong cấu hình |
| Kỹ năng bị động #5 | UR có kỹ năng bị động #5, mở khóa tại ★15 (thay cho mốc ★10 trong bản gốc) | Bảng tiến hóa ghi kỹ năng #5 tại ★15 của UR |
| Giới hạn tỉ lệ | Tạm chưa đặt giới hạn trên cho tỉ lệ chí mạng, né tránh, chính xác; có thể thêm sau | Mỗi giới hạn là một trường cấu hình, mặc định không giới hạn; xác suất lớn hơn 100% hiểu là chắc chắn xảy ra |
| Công thức sát thương | Đề xuất ở phụ lục A, chờ duyệt | Hằng số nằm trong cấu hình, chỉnh không cần sửa code |
| Tỉ lệ gacha, pity, loại banner | Đề xuất ở phụ lục B, chờ duyệt | Đọc từ cấu hình banner |

**Luật còn thiếu, cần có trước khi viết engine (giai đoạn 1)**

- [ ] Duyệt công thức sát thương và các hằng số mặc định ở phụ lục A.
- [ ] Duyệt tỉ lệ gacha, pity và các loại banner ở phụ lục B.
- [ ] Phí hoàn trả: bạn ghi "hoàn 20%, mất 20%", mình hiểu là mất 20% và hoàn 80% nguyên liệu; xác nhận lại, và chốt tỉ lệ hoàn cho mảnh tướng và xác.
- [ ] Kỹ năng #5 chỉ có ở UR hay cả SS (mặc định trong tài liệu này: chỉ UR).
- [ ] Năng lượng: mỗi hành động cộng bao nhiêu, cần bao nhiêu để tung tuyệt kỹ.
- [ ] Khi SPD bằng nhau thì ai đi trước.
- [ ] Vị trí trong lưới có ảnh hưởng gì ngoài việc bị nhắm hay không (ví dụ hàng sau có giảm sát thương nhận).
- [ ] Khi mục tiêu đã chết giữa chừng thì kỹ năng chọn mục tiêu lại thế nào.
- [ ] Main-stat cố định của nhẫn, vòng tay, vòng cổ; yêu cầu mở khóa cụ thể của 4 slot ấn.

**Rủi ro chính**

- **Cân bằng game:** 6 hệ, 5 vai trò và nhiều kỹ năng dễ làm lệch. Giảm bằng công cụ mô phỏng hàng loạt từ giai đoạn 1.
- **Làm quá nhiều nội dung trước khi biết game có vui:** giảm bằng cột mốc chơi thử ở cuối giai đoạn 3; nếu chưa vui thì dừng mở rộng.
- **Gian lận và nhân đôi tài nguyên:** giảm bằng việc server quyết định mọi thứ, giao dịch nguyên tử, khóa chống gửi trùng và nhật ký giao dịch.
- **Chuyển sang Unity phải làm lại phần lõi:** giảm bằng việc giữ mọi logic ở server và dùng nhật ký sự kiện làm giao diện giữa hai bên.
- **Quy định pháp lý:** game có gacha và có thể có thanh toán nên cần kiểm tra quy định về công bố tỉ lệ và giấy phép game tại nơi phát hành trước khi ra công chúng; mình không đủ cơ sở để nêu quy định cụ thể.

**Câu hỏi mở cho bạn**

- [ ] Làm một mình hay có nhóm, và thời gian dành cho dự án mỗi tuần? Các mốc tuần ở trên là ước tính tham khảo cho một người làm toàn thời gian.
- [ ] Game có chế độ PvP ngay từ bản đầu hay chỉ PvE?
- [ ] Có kế hoạch bán hàng (thanh toán thật) hay chỉ chơi miễn phí ở giai đoạn đầu?

## Phụ lục A. Công thức sát thương (đề xuất)

Sát thương của một đòn là tích của sáu nhân tố; các hằng số mặc định dưới đây là đề xuất để chạy thử, chỉnh bằng mô phỏng hàng loạt ở giai đoạn 1, chưa phải số cân bằng cuối.

```latex
\text{DMG} = \text{ATK} \times s \times \frac{\text{ATK}}{\text{ATK} + k \cdot \text{DEF}\,(1-p)} \times (1+b) \times e \times (1-r) \times c
```

| Ký hiệu | Ý nghĩa | Giá trị |
| --- | --- | --- |
| ATK, DEF | Chỉ số cuối của bên tấn công và bên chịu đòn (đã gồm cấp, sao, trang bị, buff) | Từ engine |
| s | Hệ số kỹ năng, ví dụ 2.0 là 200% ATK | Theo từng kỹ năng |
| k | Hằng số phòng thủ | 1.0 |
| p | Xuyên giáp của bên tấn công, từ 0 đến 1 | Theo chỉ số |
| b | Damage Bonus, cộng gộp mọi nguồn | Theo chỉ số |
| e | Hệ số khắc hệ | 1.10 khi khắc, 0.90 khi bị khắc, 1.15 cho Quang đánh Ám và Ám đánh Quang, 1.00 còn lại |
| r | Giảm sát thương của mục tiêu, từ 0 đến 1 | Theo chỉ số |
| c | Hệ số chí mạng | 1 nếu không chí mạng, 1 + Crit DMG nếu chí mạng |

**Vì sao chọn dạng này.** Phần phòng thủ chỉ phụ thuộc tỉ số DEF so với ATK, nên cùng một công thức dùng được từ cấp 1 đến cấp 1000 mà không cần đổi hằng số theo cấp (chỉ số cơ bản tăng đến gần ba lần hệ số ở các giai đoạn cuối). Với k = 1 và không xuyên giáp, mức sát thương còn lại là:

| DEF chia ATK | 0 | 0.25 | 0.5 | 1 | 2 | 4 |
| --- | --- | --- | --- | --- | --- | --- |
| Sát thương còn lại | 100% | 80% | 66.7% | 50% | 33.3% | 20% |

**Quy tắc kèm theo (đề xuất)**

- Sát thương tối thiểu mỗi đòn là 1.
- Crit Rate gốc 5%, Crit DMG gốc +50% (nhân 1.5 khi chí mạng); chưa có giới hạn trên theo quyết định ở mục 13.
- Xác suất né tránh bằng chỉ số Né tránh của mục tiêu; né thành công thì đòn đó không gây sát thương lẫn hiệu ứng.
- Xác suất trúng một hiệu ứng bằng xác suất gốc nhân (1 + Chính xác) nhân (1 − Kháng hiệu ứng).
- Hút máu: hồi lại phần trăm sát thương thực sự gây ra.
- Thứ tự rút số ngẫu nhiên luôn cố định: chọn mục tiêu ngẫu nhiên, né tránh, chí mạng, rồi từng hiệu ứng theo thứ tự khai báo; nhờ vậy cùng seed thì ra cùng kết quả.

**Ví dụ tính tay (dùng làm kiểm thử đơn vị).** ATK 10000, hệ số kỹ năng 2.0, DEF mục tiêu 6000, xuyên giáp 20%, Damage Bonus 25%, khắc hệ 1.10, giảm sát thương 10%, Crit DMG +100%. DEF hiệu dụng là 6000 × 0.8 = 4800, hệ số phòng thủ là 10000 ÷ 14800 ≈ 0.6757. Đòn không chí mạng gây khoảng 16 723 sát thương; đòn chí mạng gây khoảng 33 446.

## Phụ lục B. Thiết kế gacha (đề xuất)

Mỗi lượt triệu hồi chọn bậc hiếm trước bằng tỉ lệ và cơ chế bảo hiểm (pity), rồi chọn hệ trong bậc đó, trong đó Quang và Ám thấp hơn bốn hệ còn lại theo đúng tinh thần tài liệu GACHA. Các số dưới đây là đề xuất khởi điểm, đều nằm trong cấu hình banner.

**Tỉ lệ cơ bản mỗi lượt**

| Bậc hiếm | A | S | SS | UR |
| --- | --- | --- | --- | --- |
| Tỉ lệ | 58% | 32% | 9% | 1% |

Trong một bậc, mỗi hệ Hỏa, Thủy, Phong, Lôi chiếm 21% (tổng 84%), mỗi hệ Quang và Ám chiếm 8% (tổng 16%). Như vậy một lượt ra UR hệ Quang có xác suất 0.08%.

**Cơ chế bảo hiểm (pity)**

| Bảo hiểm | Quy tắc | Kết quả tính được |
| --- | --- | --- |
| UR mềm và cứng | Từ lượt 61 không ra UR, tỉ lệ UR tăng thêm 5% mỗi lượt; đến lượt 80 chắc chắn ra UR | Trung bình khoảng 48 lượt cho một UR; xác suất có ít nhất một UR sau 10, 30, 50, 60 lượt lần lượt là 9.6%, 26.0%, 39.5%, 45.3%, và khoảng 98% sau 70 lượt. Mốc cứng ở lượt 80 gần như không bao giờ chạm tới vì từ lượt 79 tỉ lệ đã trên 95% |
| SS trở lên | 30 lượt không ra SS hoặc UR thì lượt kế chắc chắn ra | Trung bình khoảng 9.6 lượt cho một SS trở lên; chỉ 4.7% người chơi chạm mốc 30 |
| Mười lượt | Mỗi lần quay 10 lượt có ít nhất một nhân vật từ S trở lên | Chỉ kích hoạt ở khoảng 0.4% số lần quay 10 lượt |

Bộ đếm pity lưu trên server theo tài khoản và từng nhóm banner, mỗi lượt ghi vào nhật ký giao dịch.

**Các loại banner**

| Banner | Nội dung | Pity | Khi làm |
| --- | --- | --- | --- |
| Thường, vĩnh viễn | Toàn bộ nhân vật không giới hạn | Đếm riêng, không mang sang banner khác | Giai đoạn 2 |
| Giới hạn (UR nổi bật) | Một UR nổi bật cùng toàn bộ nhân vật thường; khi ra UR thì 50% là UR nổi bật, nếu lệch thì UR kế tiếp chắc chắn là UR nổi bật | Dùng chung cho mọi banner giới hạn; trung bình khoảng 72 lượt cho UR nổi bật | Giai đoạn 2 hoặc 4 |
| Người mới | Mỗi tài khoản một lần, 10 lượt giá giảm, đảm bảo có SS | Không có | Giai đoạn 3 |
| Vũ khí Trấn | Vũ khí Trấn của các UR | Đếm riêng | Giai đoạn 4, khi có vũ khí Trấn |
| Hệ (sự kiện) | Tăng tỉ lệ nhân vật của một hệ trong thời gian sự kiện | Không dùng chung | Giai đoạn 5, cần cân nhắc kỹ |

**Lưu ý thiết kế**

- Một UR bất kỳ chỉ có 16% là hệ Quang hoặc Ám, nên ở banner thường trung bình khoảng 300 lượt mới ra một UR hai hệ này. Đường chính để lấy chúng là banner giới hạn có UR nổi bật hệ Quang hoặc Ám, cộng với xác vạn năng từ sự kiện như tài liệu GACHA đã nêu.
- Banner hệ có thể xung đột với độ khan hiếm tự nhiên của Quang và Ám mà tài liệu GACHA chủ ý tạo ra; nên để đến giai đoạn 5 và thử trước khi mở rộng.
- Hiển thị tỉ lệ và cơ chế pity công khai trong game, và kiểm tra quy định tại nơi phát hành trước khi ra công chúng (xem mục 13).
