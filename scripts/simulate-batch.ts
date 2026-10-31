/**
 * Chạy hàng loạt trận ngẫu nhiên và in tỉ lệ thắng theo hệ, vai trò, bậc hiếm, hàng, nhân vật.
 *   npm run simulate -- --games=1000 --seed=demo --level=300 --star=10 --rarity=A,S,SS,UR --team=5
 * Thoát mã 1 nếu có trận nào vượt số hiệp tối đa.
 */
import { runBatch, formatBatchReport } from '@gacha/engine';
import { loadGameConfig } from '@gacha/shared/node';

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const { config } = loadGameConfig();
const report = runBatch(config, {
  games: Number(arg('games', '1000')),
  seed: arg('seed', 'batch'),
  level: Number(arg('level', '300')),
  star: Number(arg('star', '10')),
  teamSize: Number(arg('team', '5')),
  rarities: arg('rarity', '').split(',').filter(Boolean),
  tolerance: Number(arg('tolerance', '0.15')),
});
console.log(formatBatchReport(report));
if (report.rounds.max > report.maxRoundsAllowed) {
  console.error('✘ Có trận vượt số hiệp tối đa');
  process.exit(1);
}
