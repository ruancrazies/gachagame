# Luật của engine (Giai đoạn 1)

Tài liệu này ghi **chính xác** engine đang làm gì, để bạn duyệt hoặc đổi. Mỗi mục có đánh dấu nguồn:
**[TL]** = lấy từ tài liệu thiết kế, **[ĐX]** = đề xuất mặc định trong `docs/rules-decisions.md`, **[MỚI]** = engine buộc phải quyết vì tài liệu chưa nói (cần bạn xác nhận).
Đổi bất kỳ luật nào ở đây là đổi kết quả của mọi trận đã lưu: phải tăng `configVersion`, cập nhật `GOLDEN_HASH` trong `simulate.test.ts`, và nhớ rằng hồ sơ trận cũ chỉ phát lại đúng với bản cấu hình đã ghi kèm.

## Đầu vào, đầu ra

- `simulate(đội A, đội B, cấu hình, seed)` → `BattleResult` (kiểu và schema ở `packages/shared/src/battleLog.ts`). Hàm thuần túy: không đọc đồng hồ, không dùng `Math.random()`, không sửa đầu vào. **[TL]**
- Mỗi bên 1 đến 5 nhân vật, mỗi người một ô riêng trong lưới 3x3. Hàng 0 là hàng đầu (gần địch nhất), cột 0 là cột trái. **[TL]**
- Đội A là bên tấn công, đội B là bên phòng thủ. Id đơn vị: `A1..A5`, `B1..B5` theo thứ tự trong mảng truyền vào. **[MỚI]**
- Engine chỉ nhận **chỉ số cuối** (ATK, DEF, HP, SPD và các chỉ số phụ), không biết cấp, sao hay trang bị. Dựng chỉ số cuối là việc của server (Giai đoạn 2); `unitFromHero` trong `stats.ts` chỉ dựng từ cấp + sao để chạy thử. **[TL]**
- Kỹ năng của mỗi đơn vị: đúng 1 đánh thường, 1 tuyệt kỹ, và có thể thêm bị động. Người gọi đã lọc theo sao mở khóa. **[TL]**

## Hàng đợi và hiệp

- Mỗi hiệp, mọi đơn vị còn sống hành động **một lần**, theo SPD hiện tại giảm dần, xếp một lần ở đầu hiệp (buff SPD giữa hiệp có tác dụng từ hiệp sau). **[TL]**
- SPD bằng nhau: bên A trước bên B; cùng bên thì theo ô (hàng trước, trái sang phải). **[ĐX #6]**
- Tối đa `rules.battle.maxRounds` (20) hiệp. Trận kết thúc ngay khi một bên bị hạ hết (kể cả giữa hiệp). **[TL]**
- Hai bên cùng bị hạ hết trong một hành động → `winner = "draw"` (rất hiếm). **[MỚI]**
- Hết 20 hiệp: `rules.battle.timeoutRule` = `defender_wins` (B thắng) hoặc `higher_damage` (gây nhiều sát thương hơn thắng, hòa thì B). Mặc định `defender_wins`. **[TL: "phòng thủ thắng nếu bên tấn công không hạ hết, hoặc so sát thương"]**
- Vị trí trong lưới **không** ảnh hưởng gì ngoài việc bị nhắm (không giảm sát thương hàng sau). **[ĐX #7]**

## Lượt của một đơn vị

1. Tăng bộ đếm lượt. Chạy **thiêu đốt** (dot): mỗi hiệu ứng dot mất đúng `amount` máu (không tính DEF, không chí mạng, khiên vẫn hấp thụ). Chết vì dot thì mất lượt. **[MỚI]**
2. Đang **choáng**: ghi sự kiện `skip` (`skill: "stunned"`), mất lượt.
3. Bị động `turn_start` chạy.
4. Chọn kỹ năng: đủ năng lượng (`rules.energy.max`) và **không** bị câm lặng → tuyệt kỹ; còn lại đánh thường. **[TL]**
5. Đánh. Đánh thường cộng `energyGain` (tối đa `max`); tuyệt kỹ đưa năng lượng về 0. Năng lượng đầu trận là `rules.energy.initial` (0). **[ĐX #5]** Bị đánh không cộng năng lượng. **[ĐX #5]**
6. Nếu gây sát thương: bị động `after_damage`, rồi các hành động đặc biệt (xem dưới).
7. Cuối lượt: mọi hiệu ứng của đơn vị này giảm 1 lượt, hết thì gỡ. Hiệu ứng **vừa áp lên chính nó trong lượt của nó** thì chưa bị trừ lượt đó. **[MỚI]**
8. Cuối hiệp: bị động `round_end` của đơn vị còn sống, theo thứ tự ô.

## Chọn mục tiêu

Chỉ chọn trong đơn vị **còn sống**. Mọi luật bằng điểm hòa nhau thì phân định theo thứ tự ô. **[MỚI]**

| Luật | Cách chọn |
| --- | --- |
| `highest_hp` / `lowest_hp` | Máu hiện tại cao nhất / thấp nhất (giá trị tuyệt đối, không phải phần trăm) |
| `highest_atk` | ATK hiện tại (đã tính buff, debuff) cao nhất |
| `front_row` | Hàng còn người gần nhất; lấy tối đa `count` người, trái sang phải |
| `center` | Gần tâm lưới (1,1) nhất theo khoảng cách Manhattan |
| `column` | Cột có nhiều đơn vị còn sống nhất (hòa thì cột trái); từ hàng trước ra sau |
| `all` | Mọi đơn vị theo thứ tự ô, cắt ở `count` |
| `random` | Rút không trùng, mỗi mục tiêu một lần rút từ rng |

`side: "ally"` chọn trong đồng đội còn sống (gồm cả bản thân), `side: "self"` là chính chủ. Kỹ năng có `side: "ally"` mà `damageCoef > 0` **không** gây sát thương (chỉ kỹ năng nhắm kẻ địch mới gây sát thương). **[MỚI]**

## Một đòn đánh (thứ tự rút số ngẫu nhiên cố định)

Với mỗi mục tiêu theo thứ tự: **né tránh → chí mạng → từng hiệu ứng theo thứ tự khai báo**. Chọn mục tiêu `random` rút trước tất cả. **[TL: phụ lục A]**

- Né tránh: xác suất = Né tránh của mục tiêu. Né được thì đòn đó không gây sát thương lẫn hiệu ứng, ghi `evaded: true`.
- Chí mạng: xác suất = `baseCritRate` + Crit Rate của kẻ đánh; sát thương nhân `1 + baseCritDamage + Crit DMG`.
- Sát thương: `ATK · s · ATK/(ATK + k·DEF·(1−p)) · (1+b) · e · (1−r) · c`, làm tròn một lần ở cuối, tối thiểu `minDamage` (1). Chi tiết và ví dụ tính tay ở phụ lục A và `damage.test.ts`.
- Khiên hấp thụ trước, phần còn lại trừ máu; `dmg` trong nhật ký là tổng trước khi khiên hấp thụ, `absorbed` là phần khiên nhận. **[MỚI]**
- Hút máu: hồi `lifesteal × máu mất thật` (không tính phần khiên hấp thụ, không tính phần thừa khi hạ mục tiêu). **[TL: "phần sát thương thực sự gây ra" → diễn giải]**
- Mục tiêu đã chết trong đòn này thì không nhận hiệu ứng.

## Hiệu ứng

- Xác suất trúng: hiệu ứng **có hại** (kỹ năng nhắm kẻ địch) = `chance × (1 + Chính xác của người gây) × (1 − Kháng hiệu ứng của mục tiêu)`; hiệu ứng **có lợi** (nhắm đồng đội hoặc bản thân) chỉ dùng `chance`. Mỗi hiệu ứng luôn rút đúng một số ngẫu nhiên. **[TL: phụ lục A]**
- **Cùng id thì làm mới** (đặt lại số lượt và giá trị), không cộng dồn. **[MỚI]**
- `buff` / `debuff`: lên ATK, DEF, SPD thì nhân `(1 + tổng buff − tổng debuff)` (không âm); lên chỉ số phụ thì cộng thẳng. Buff lên `hp` không có tác dụng (HP tối đa cố định trong trận). **[MỚI]**
- `shield`: lượng khiên = `value × (ATK người gây hoặc HP tối đa mục tiêu)` chốt lúc áp. Nhiều khiên hấp thụ theo thứ tự áp.
- `heal`: `value × (…) × (1 + Healing Bonus của người hồi)`, không vượt HP tối đa.
- `dot`: sát thương mỗi lượt chốt lúc áp (`value × ATK người gây`).
- `stun`: mất lượt kế tiếp. `silence`: chỉ được đánh thường.
- Chết thì mọi hiệu ứng bị gỡ.

## Hành động đặc biệt (kỹ năng bị động có trường `special`)

| `kind` | Khi nào | Đòn dùng |
| --- | --- | --- |
| `counter` (phản kích) | Chủ bị kẻ địch đánh trúng và còn sống | Đánh thường vào kẻ vừa đánh |
| `follow_up` (liên kích) | Chủ vừa gây sát thương | Đánh thường vào mục tiêu vừa trúng |
| `pursuit` (truy kích) | Một đồng đội (không phải chủ) vừa gây sát thương | Đánh thường vào mục tiêu vừa trúng của đồng đội |
| `extra_turn` (hành động ngay) | Chủ vừa gây sát thương | Một lượt hành động đầy đủ ngay lập tức (chọn đánh thường hay tuyệt kỹ theo năng lượng) |
| `revive` (hồi sinh) | Chủ chết | Sống lại với `reviveHpRatio` máu tối đa, năng lượng về 0, **một lần mỗi trận** |

Quy tắc chung **[MỚI]**:

- Mỗi lần kích hoạt rút một số `chance`; chỉ rút khi đủ điều kiện (còn sống, không choáng, chưa hết `maxPerRound`, mặc định 1 lần mỗi hiệp mỗi kỹ năng).
- Đòn phản kích, liên kích, truy kích là **đòn phản ứng**: chỉ đánh một mục tiêu, không cộng năng lượng, **không** kích hoạt thêm phản kích, liên kích, truy kích hay hành động ngay nào khác (chặn vòng lặp vô hạn). Hành động thêm của `extra_turn` là hành động thường nên có thể bị phản kích nhưng không nối thêm `extra_turn`.
- Mục tiêu dự định đã chết (liên kích, truy kích) thì **chọn lại bằng luật của đánh thường** trong số kẻ còn sống; không còn ai thì hụt, không ghi sự kiện, không hoàn năng lượng. **[ĐX #8]**
- Kẻ đang choáng không phản ứng được; kẻ bị câm lặng vẫn phản ứng (đánh thường).

## Điểm móc (hook)

`turn_start`, `before_damage` (trước khi tính sát thương của một kỹ năng gây sát thương), `after_damage`, `on_death`, `round_end`. Bị động có `trigger` và **không** có `special` thì áp `effects` của nó lên `targeting` của nó khi điểm móc chạy, ghi sự kiện `action: "passive"`. Ấn và linh thú ở Giai đoạn 4 chỉ cần cung cấp thêm kỹ năng bị động vào danh sách `skills` của đơn vị, không phải sửa engine. Kỹ năng có cơ chế lạ (nguyên tắc kiến trúc #5) sẽ cần thêm một bộ xử lý đăng ký sẵn; chưa có nhu cầu nên chưa làm.

## Việc engine chưa làm

- Bộ trang bị, ấn, linh thú, vũ khí Trấn (Giai đoạn 4).
- Tiến hóa theo sao ảnh hưởng chỉ số, trang bị cộng chỉ số (Giai đoạn 2).
- Bộ xử lý đăng ký riêng cho kỹ năng có cơ chế đặc biệt.
