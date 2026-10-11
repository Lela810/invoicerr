import { readBackendPackageJsonVersion } from '@/lib/app-version';
import { createIoredisClient } from '@/modules/documents/queue/redis.config';
import prisma from '@/prisma/prisma.service';

import { HEALTH_CHECK_TIMEOUT_MS, HEALTH_PROBE_REUSE_MS, HealthService } from './health.service';

vi.mock('@/prisma/prisma.service', () => ({
  __esModule: true,
  default: { $queryRaw: vi.fn() },
}));

vi.mock('@/modules/documents/queue/redis.config', () => ({
  createIoredisClient: vi.fn(),
}));

const fakeRedis = {
  status: 'ready',
  connect: vi.fn(),
  ping: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
};

const never = () => new Promise<never>(() => undefined);

describe('HealthService', () => {
  const ORIGINAL_REF = process.env.INVOICERR_REF_NAME;
  let service: HealthService;

  beforeEach(() => {
    vi.mocked(createIoredisClient).mockReturnValue(fakeRedis as never);
    fakeRedis.status = 'ready';
    fakeRedis.ping.mockResolvedValue('PONG');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as never);
    service = new HealthService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    if (ORIGINAL_REF === undefined) {
      delete process.env.INVOICERR_REF_NAME;
    } else {
      process.env.INVOICERR_REF_NAME = ORIGINAL_REF;
    }
  });

  it('reports every field when Postgres and Redis are up', async () => {
    process.env.INVOICERR_REF_NAME = 'v2.0.0-alpha.4';

    const result = await service.check();

    expect(result).toEqual({
      healthy: true,
      report: {
        status: 'ok',
        database: 'up',
        databaseLatencyMs: expect.any(Number),
        redis: 'up',
        redisLatencyMs: expect.any(Number),
        version: 'v2.0.0-alpha.4',
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        uptimeSeconds: expect.any(Number),
      },
    });
  });

  it('keeps status and database as the first two keys, so the serialized prefix is unchanged', async () => {
    const result = await service.check();

    expect(result.healthy && JSON.stringify(result.report)).toMatch(/^\{"status":"ok","database":"up",/);
  });

  it('falls back to the package.json version when no build version is set', async () => {
    delete process.env.INVOICERR_REF_NAME;

    const result = await service.check();

    expect(result.healthy && result.report.version).toBe(readBackendPackageJsonVersion());
  });

  it('is unhealthy with redis "down" when PING rejects', async () => {
    fakeRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.check()).resolves.toEqual({
      healthy: false,
      body: { status: 'error', database: 'up', redis: 'down' },
    });
  });

  it('is unhealthy with redis "down" when PING hangs past the timeout', async () => {
    vi.useFakeTimers();
    fakeRedis.ping.mockImplementation(never);

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({
      healthy: false,
      body: { status: 'error', database: 'up', redis: 'down' },
    });
  });

  it('keeps the legacy body when the database query rejects, whatever Redis says', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connection refused'));
    fakeRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.check()).resolves.toEqual({
      healthy: false,
      body: { status: 'error', database: 'down' },
    });
  });

  it('is unhealthy when the database query hangs past the timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(prisma.$queryRaw).mockImplementation(never as never);

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ healthy: false, body: { status: 'error', database: 'down' } });
  });

  it('connects a fresh client before the first PING and reuses it afterwards', async () => {
    fakeRedis.status = 'wait';
    fakeRedis.connect.mockImplementation(async () => {
      fakeRedis.status = 'ready';
    });
    vi.useFakeTimers();

    await service.check();
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_REUSE_MS);
    await service.check();

    expect(createIoredisClient).toHaveBeenCalledTimes(1);
    expect(fakeRedis.connect).toHaveBeenCalledTimes(1);
    expect(fakeRedis.ping).toHaveBeenCalledTimes(2);
  });

  it('shares one probe between checks inside the reuse window, but not the time field', async () => {
    vi.useFakeTimers();

    const first = await service.check();
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_REUSE_MS - 1);
    const second = await service.check();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fakeRedis.ping).toHaveBeenCalledTimes(1);
    expect(first.healthy && second.healthy && first.report.time !== second.report.time).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    await service.check();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
