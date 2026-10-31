# Game Gacha Thần thoại

Game gacha đấu tự động theo lượt, chơi trên web, server giữ toàn bộ logic để sau này chuyển sang Unity mà không viết lại phần lõi.
Tài liệu thiết kế và lộ trình: xem [docs/thiet-ke-va-lo-trinh.md](docs/thiet-ke-va-lo-trinh.md). Repo này đang ở **Giai đoạn 0 (nền móng)**.

## Cấu trúc

```
config/            Dữ liệu game (JSON, có phiên bản): luật, nhân vật, kỹ năng, hiệu ứng, tiến hóa
docs/              Ghi chú quyết định (rules-decisions.md: các luật cần chốt)
scripts/           Công cụ dòng lệnh (validate-config)
packages/
  shared/          Kiểu dữ liệu, schema Zod cho cấu hình, kiểm tra tham chiếu chéo, hợp đồng nhật ký trận
  engine/          Mô phỏng trận (hàm thuần túy, deterministic). Hiện có bộ sinh số ngẫu nhiên có seed
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
| `skills.json` | Kỹ năng mẫu theo vai trò, 1 bị động UR mở ở ★15 | placeholder |
| `heroes.json` | 12 nhân vật mẫu phủ đủ 6 hệ, 5 vai trò, 4 bậc hiếm | placeholder |
| `evolution.json` | Bảng tiến hóa ★1-★20 | placeholder |

`placeholder` là số liệu mình điền tạm để dựng khung, `draft` là đề xuất chờ duyệt, `final` là đã chốt.
Danh sách chi tiết những gì cần bạn xác nhận: [docs/rules-decisions.md](docs/rules-decisions.md).

Thêm nội dung = thêm dòng dữ liệu rồi chạy `npm run validate:config`. Trình kiểm tra bắt: id trùng, tham chiếu tới vai trò/kỹ năng/hiệu ứng không tồn tại,
nhân vật thiếu đánh thường hoặc tuyệt kỹ, vượt số kỹ năng theo bậc hiếm, đường cong cấp bị hở, vòng khắc hệ sai, thiếu bậc tiến hóa, gõ sai tên trường.

## Giai đoạn kế tiếp

Giai đoạn 1 (bộ mô phỏng trận) cần các luật ở [docs/rules-decisions.md](docs/rules-decisions.md) mục A đã chốt, nhất là năng lượng, thứ tự khi SPD bằng nhau và chọn lại mục tiêu.
