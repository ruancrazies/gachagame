/**
 * Phần chỉ chạy trên Node (đọc file cấu hình). Tách khỏi index.ts để web không kéo node:fs vào bundle.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_SECTIONS, validateGameConfig, type GameConfig } from './config';

export class ConfigError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Cấu hình game không hợp lệ (${errors.length} lỗi):\n- ${errors.join('\n- ')}`);
    this.name = 'ConfigError';
    this.errors = errors;
  }
}

/** Thư mục /config ở gốc repo; có thể đổi bằng biến môi trường GACHA_CONFIG_DIR. */
export function defaultConfigDir(): string {
  return process.env['GACHA_CONFIG_DIR'] ?? fileURLToPath(new URL('../../../config', import.meta.url));
}

/** Đọc các file <phần>.json thành một object thô, chưa kiểm tra schema. */
export function readRawConfig(dir: string = defaultConfigDir()): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const section of CONFIG_SECTIONS) {
    const file = join(dir, `${section}.json`);
    try {
      raw[section] = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`${section}.json: không đọc được (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (errors.length > 0) throw new ConfigError(errors);
  return raw;
}

/** Đọc và kiểm tra toàn bộ cấu hình; ném ConfigError nếu có lỗi (server dùng lúc khởi động để fail fast). */
export function loadGameConfig(dir: string = defaultConfigDir()): { config: GameConfig; warnings: string[] } {
  const result = validateGameConfig(readRawConfig(dir));
  if (!result.ok) throw new ConfigError(result.errors);
  return { config: result.config, warnings: result.warnings };
}
