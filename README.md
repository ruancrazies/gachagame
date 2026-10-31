# Game Gacha Thần thoại

Game gacha đấu tự động theo lượt, chơi trên web, server giữ toàn bộ logic để sau này chuyển sang Unity mà không viết lại phần lõi.
Tài liệu thiết kế và lộ trình: xem [docs/thiet-ke-va-lo-trinh.md](docs/thiet-ke-va-lo-trinh.md). Repo này đã xong **Giai đoạn 0 (nền móng)** và **Giai đoạn 1 (bộ mô phỏng trận)**.

## Cấu trúc

```
config/            Dữ liệu game (JSON, có phiên bản): luật, nhân vật, kỹ năng, hiệu ứng, tiến hóa
docs/              Tài liệu thiết kế, luật cần chốt (rules-decisions.md), luật engine đang áp dụng (engine-rules.md)
scripts/           Công cụ dòng lệnh (validate-config, simulate-batch)
packages/
  shared/          Kiểu dữ liệu, schema Zod cho cấu hình, kiểm tra tham chiếu chéo, hợp đồng nhật ký trận
  engine/          Mô phỏng trận `simulate(đội A, đội B, cấu hình, seed)`: hàm thuần túy, deterministic; công cụ chạy hàng loạt
  server/          Fastify; đọc và kiểm tra cấu hình khi khởi động (/health)
  web/             React + Vite; hiện là trang khung
```

Quy tắc phụ thuộc: `web` và `server` dùng `shared`; `engine` dùng `shared`; `shared` không phụ thuộc gói nào khác.
Các gói trỏ thẳng vào mã nguồn TypeScript (`exports` → `src/*.ts`), chưa có bước build riêng; Vite, Vitest và tsx đều chạy được như vậy.

## Dùng

Cần Node 22 trở lên.

```bash
npm install
npm run check            # lint + typecheck + test + validate:config + build web (giống CI)

npm test                 # chỉ chạy kiểm thử (Vitest)
npm run validate:config  # kiểm tra thư mục config/
npm run simulate -- --games=1000 --seed=demo --level=300 --star=10   # tỉ lệ thắng theo hệ, vai trò, hàng, nhân vật
npm run dev:server       # http://localhost:3000/health
npm run dev:web          # http://localhost:5173
```

`npm run validate:config -- --strict` coi mọi phần chưa ở trạng thái `final` là lỗi; dùng trước khi phát hành.

## Cấu hình game

Mỗi file trong `config/` là một "phần" được kiểm tra bằng schema trong `packages/shared/src/schemas.ts`:

| File | Nội dung | Trạng thái |
| --- | --- | --- |
| `manifest.json` | Số phiên bản bộ cấu hình (lưu cùng hồ sơ trận) | – |
| `rules.json` | Hằng số trận đấu, công thức sát thương (phụ lục A), đường cong cấp, hoàn trả | draft |
| `taxonomy.json` | 5 vai trò, loại vũ khí | placeholder |
| `effects.json` | Hiệu ứng trạng thái | placeholder |
| `skills.json` | Kỹ năng mẫu theo vai trò, bị động mẫu (UR ★15; phản kích, liên kích, truy kích, hành động ngay, hồi sinh) | placeholder |
| `heroes.json` | 12 nhân vật mẫu phủ đủ 6 hệ, 5 vai trò, 4 bậc hiếm | placeholder |
| `evolution.json` | Bảng tiến hóa ★1-★20 | placeholder |

`placeholder` là số liệu mình điền tạm để dựng khung, `draft` là đề xuất chờ duyệt, `final` là đã chốt.
Danh sách chi tiết những gì cần bạn xác nhận: [docs/rules-decisions.md](docs/rules-decisions.md).

Thêm nội dung = thêm dòng dữ liệu rồi chạy `npm run validate:config`. Trình kiểm tra bắt: id trùng, tham chiếu tới vai trò/kỹ năng/hiệu ứng không tồn tại,
nhân vật thiếu đánh thường hoặc tuyệt kỹ, vượt số kỹ năng theo bậc hiếm, đường cong cấp bị hở, vòng khắc hệ sai, thiếu bậc tiến hóa, gõ sai tên trường.

## Dùng engine

```ts
import { simulate, unitFromHero } from '@gacha/engine';
import { loadGameConfig } from '@gacha/shared/node';

const { config } = loadGameConfig();
const hero = (id: string) => config.heroes.heroes.find((h) => h.id === id)!;
const teamA = [unitFromHero(hero('hoa_vu'), { level: 300, star: 15, slot: { row: 0, col: 1 } }, config)];
const teamB = [unitFromHero(hero('am_nguyet'), { level: 300, star: 15, slot: { row: 0, col: 1 } }, config)];
const result = simulate(teamA, teamB, config, 'seed-cua-tran'); // result.events là nhật ký để client phát lại
```

Cùng đầu vào và seed thì nhật ký giống nhau từng byte. Luật chi tiết: [docs/engine-rules.md](docs/engine-rules.md).

## Giai đoạn kế tiếp

Giai đoạn 2 (server và dữ liệu cốt lõi): tài khoản, PostgreSQL, gacha, tiến hóa, trang bị, điểm cuối đánh trận. Cần chốt trước: tỉ lệ gacha và pity (phụ lục B), main-stat phụ kiện, điều kiện mở ấn ([docs/rules-decisions.md](docs/rules-decisions.md)), và quyết định có PvP ngay không.
