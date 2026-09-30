import { base32Decode, base32Encode, decrypt, encrypt, hotp, newSecret, verifyTotp } from './totp';

describe('totp', () => {
  const ascii = Buffer.from('12345678901234567890'); // RFC 6238 / 4226 test secret
  it('matches the RFC 4226 HOTP vectors', () => {
    ['755224', '287082', '359152', '969429', '338314', '254676'].forEach((exp, i) => expect(hotp(ascii, i)).toBe(exp));
  });
  it('matches the RFC 6238 TOTP vector (T=59 -> 287082 with 6 digits)', () => {
    expect(verifyTotp(base32Encode(ascii), '287082', 59_000)).toBe(1);
  });
  it('base32 round-trips', () => {
    const s = newSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString()).toBe('12345678901234567890');
  });
  it('accepts ±1 step of drift but not more', () => {
    const b32 = base32Encode(ascii);
    expect(verifyTotp(b32, '287082', 59_000 + 30_000)).toBe(1); // one step late
    expect(verifyTotp(b32, '287082', 59_000 + 90_000)).toBeNull(); // three steps late
  });
  it('blocks replay of an already-used step', () => {
    const b32 = base32Encode(ascii);
    expect(verifyTotp(b32, '287082', 59_000, 1)).toBeNull();
    expect(verifyTotp(b32, '287082', 59_000, 0)).toBe(1);
  });
  it('rejects malformed codes', () => {
    const b32 = base32Encode(ascii);
    for (const c of ['12345', '1234567', 'abcdef', '', '28708 ']) expect(verifyTotp(b32, c, 59_000)).toBeNull();
  });
  it('encrypts with AES-GCM and detects tampering', () => {
    process.env.TWOFA_ENCRYPTION_KEY = 'a'.repeat(64);
    const enc = encrypt('JBSWY3DPEHPK3PXP');
    expect(enc).not.toContain('JBSWY3DP');
    expect(decrypt(enc)).toBe('JBSWY3DPEHPK3PXP');
    const [iv, tag, ct] = enc.split('.');
    expect(() => decrypt([iv, tag, Buffer.from('x').toString('base64url') + ct].join('.'))).toThrow();
    process.env.TWOFA_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decrypt(enc)).toThrow();
  });
});
