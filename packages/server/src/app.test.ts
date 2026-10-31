import { describe, expect, it } from 'vitest';
import { ConfigError } from '@gacha/shared/node';
import { buildApp } from './app';

describe('server', () => {
  it('GET /health trả về trạng thái và phiên bản cấu hình', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', configVersion: '0.1.0', configWarnings: 6 });
    await app.close();
  });

  it('không khởi động nếu thư mục cấu hình thiếu hoặc sai', () => {
    expect(() => buildApp({ configDir: '/nonexistent/config' })).toThrow(ConfigError);
  });
});
