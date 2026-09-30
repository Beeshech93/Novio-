import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('liveness does not need the database', () => expect(new HealthController({} as any).live()).toEqual({ status: 'ok' }));
  it('readiness reports up/down without leaking details', async () => {
    const ok = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([1]) } as any);
    expect(await ok.ready()).toEqual({ status: 'ok', db: 'up' });
    const bad = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('secret connection string')) } as any);
    await expect(bad.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await bad.ready().catch((e) => expect(JSON.stringify(e.getResponse())).not.toContain('secret'));
  });
});
