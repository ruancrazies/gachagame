import { ELEMENTS, ELEMENT_LABELS_VI, RARITIES } from '@gacha/shared';

/**
 * Khung client Giai đoạn 0. Client chỉ hiển thị: mọi luật game nằm ở server và engine.
 * Màn hình thật (đăng nhập, triệu hồi, đội hình, chiến đấu...) làm ở Giai đoạn 3.
 */
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem auto', maxWidth: 640, padding: '0 1rem' }}>
      <h1>Game Gacha Thần thoại</h1>
      <p>Giai đoạn 0: khung dự án đã chạy. Client dùng chung kiểu dữ liệu với server qua gói @gacha/shared.</p>
      <p>
        <strong>6 hệ:</strong> {ELEMENTS.map((e) => ELEMENT_LABELS_VI[e]).join(', ')}
      </p>
      <p>
        <strong>Bậc hiếm:</strong> {RARITIES.join(', ')}
      </p>
    </main>
  );
}
