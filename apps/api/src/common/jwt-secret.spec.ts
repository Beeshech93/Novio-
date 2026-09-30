import { resolveJwtSecret } from './jwt-secret';

const store = (initial?: string) => {
  let value = initial;
  return {
    appSecret: {
      findUnique: jest.fn(async () => (value ? { value } : null)),
      createMany: jest.fn(async ({ data }: any) => { if (!value) value = data[0].value; }), // skipDuplicates semantics
    },
  };
};

describe('resolveJwtSecret', () => {
  it('uses JWT_SECRET from the environment and never touches the database', async () => {
    const s = store();
    expect(await resolveJwtSecret(s, { JWT_SECRET: 'x'.repeat(32) })).toBe('x'.repeat(32));
    expect(s.appSecret.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a short JWT_SECRET', async () => {
    await expect(resolveJwtSecret(store(), { JWT_SECRET: 'short' })).rejects.toThrow(/16\+/);
  });
  it('generates a strong key once, stores it, and reuses it afterwards', async () => {
    const s = store();
    const a = await resolveJwtSecret(s, {});
    const b = await resolveJwtSecret(s, {});
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(s.appSecret.createMany).toHaveBeenCalledTimes(1);
    expect(s.appSecret.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });
  it('converges when two instances boot at once (loser adopts the winner)', async () => {
    let stored: string | undefined;
    const racer = { appSecret: {
      findUnique: jest.fn(async () => (stored ? { value: stored } : null)),
      createMany: jest.fn(async ({ data }: any) => { stored ??= 'winner-key-from-other-instance'; void data; }),
    } };
    expect(await resolveJwtSecret(racer, {})).toBe('winner-key-from-other-instance');
  });
  it('can be forced to require the environment variable', async () => {
    await expect(resolveJwtSecret(store(), { ALLOW_GENERATED_JWT_SECRET: '0' })).rejects.toThrow(/JWT_SECRET must be set/);
  });
});
