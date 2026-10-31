/**
 * Kiểm tra thư mục /config: schema từng file và tham chiếu chéo giữa các file.
 *   npm run validate:config            in lỗi (thoát mã 1) và cảnh báo (thoát mã 0)
 *   npm run validate:config -- --strict   coi cảnh báo placeholder/draft là lỗi (dùng khi phát hành)
 */
import { ConfigError, defaultConfigDir, loadGameConfig } from '@gacha/shared/node';

const strict = process.argv.includes('--strict');
const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length) ?? defaultConfigDir();

console.log(`Đang kiểm tra cấu hình tại ${dir}`);

try {
  const { config, warnings } = loadGameConfig(dir);
  console.log(`✔ Cấu hình hợp lệ (phiên bản ${config.manifest.configVersion})`);
  console.log(
    `  ${config.heroes.heroes.length} nhân vật, ${config.skills.skills.length} kỹ năng, ` +
      `${config.effects.effects.length} hiệu ứng, ${config.evolution.steps.length} bậc tiến hóa`,
  );
  if (warnings.length > 0) {
    console.log(`\n⚠ ${warnings.length} phần chưa chốt:`);
    for (const w of warnings) console.log(`  - ${w}`);
    if (strict) {
      console.error('\n✘ Chế độ --strict: còn phần chưa ở trạng thái final.');
      process.exit(1);
    }
  }
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`✘ ${err.message}`);
    process.exit(1);
  }
  throw err;
}
