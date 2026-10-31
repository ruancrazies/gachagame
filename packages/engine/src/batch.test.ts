import { describe, expect, it } from 'vitest';
import { formatBatchReport, runBatch, type BatchOptions } from './batch';
import { realConfig } from './testkit';

const config = realConfig();
const options: BatchOptions = { games: 1000, seed: 'ci', level: 300, star: 10, teamSize: 5 };

describe('runBatch (1000 trận mẫu)', () => {
  const report = runBatch(config, options);

  it('chạy trọn 1000 trận không lỗi, không trận nào vượt số hiệp tối đa', () => {
    expect(report.winsA + report.winsB + report.draws).toBe(1000);
    expect(report.rounds.max).toBeLessThanOrEqual(config.rules.battle.maxRounds);
    expect(report.rounds.average).toBeGreaterThan(1);
  });

  it('cùng tham số thì báo cáo giống hệt', () => {
    expect(runBatch(config, options)).toEqual(report);
  });

  it('khác seed thì báo cáo khác', () => {
    expect(runBatch(config, { ...options, seed: 'khac', games: 200 })).not.toEqual(runBatch(config, { ...options, games: 200 }));
  });

  it('báo cáo đủ các nhóm: 6 hệ, 5 vai trò, 4 bậc hiếm, 3 hàng, 12 nhân vật', () => {
    expect(report.byElement).toHaveLength(6);
    expect(report.byRole).toHaveLength(5);
    expect(report.byRarity).toHaveLength(4);
    expect(report.byRow.map((r) => r.key)).toEqual(['hàng 1', 'hàng 2', 'hàng 3']);
    expect(report.byHero).toHaveLength(12);
  });

  it('chốt chặn thô: chưa có hệ hay vai trò nào thắng hoặc thua áp đảo (ngoài 25%–75%) với dữ liệu mẫu', () => {
    // Đây chỉ là rào chắn cho dữ liệu placeholder; ngưỡng cân bằng thật do nhà thiết kế quyết định ở Giai đoạn 4.
    for (const row of [...report.byElement, ...report.byRole]) {
      expect(row.rate, row.key).toBeGreaterThan(0.25);
      expect(row.rate, row.key).toBeLessThan(0.75);
    }
  });

  it('in được báo cáo dạng chữ', () => {
    const text = formatBatchReport(report);
    expect(text).toContain('1000 trận');
    expect(text).toContain('Theo hệ');
    expect(text).toContain('Theo nhân vật');
  });

  it('lọc theo bậc hiếm; báo lỗi khi không đủ nhân vật lập đội', () => {
    const small = runBatch(config, { ...options, games: 50, rarities: ['UR'], teamSize: 3 });
    expect(small.byRarity.map((r) => r.key)).toEqual(['UR']);
    expect(() => runBatch(config, { ...options, rarities: ['UR'] })).toThrow(RangeError);
  });
});
