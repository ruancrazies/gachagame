import Fastify, { type FastifyInstance } from 'fastify';
import { loadGameConfig } from '@gacha/shared/node';

export interface BuildAppOptions {
  /** Thư mục chứa các file cấu hình; mặc định là /config ở gốc repo. */
  configDir?: string;
  logger?: boolean;
}

/**
 * Dựng ứng dụng server. Cấu hình game được đọc và kiểm tra ngay lúc khởi động:
 * cấu hình sai thì server không chạy, để lỗi lộ ra sớm thay vì giữa một trận.
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const { config, warnings } = loadGameConfig(options.configDir);
  const app = Fastify({ logger: options.logger ?? false });

  app.get('/health', async () => ({
    status: 'ok',
    configVersion: config.manifest.configVersion,
    configWarnings: warnings.length,
  }));

  return app;
}
