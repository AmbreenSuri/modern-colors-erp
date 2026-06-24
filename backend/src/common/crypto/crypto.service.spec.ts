import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

// Invariant I2: the Claude key is encrypted at rest and never returned in full.
describe('CryptoService', () => {
  let svc: CryptoService;

  beforeEach(() => {
    const key = 'a'.repeat(64); // 32 bytes hex
    const config = { getOrThrow: () => key } as unknown as ConfigService;
    svc = new CryptoService(config);
    svc.onModuleInit();
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const secret = 'sk-ant-api03-THIS-IS-A-FAKE-KEY-1234567890';
    const enc = svc.encrypt(secret);
    expect(enc.ciphertext).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('produces a unique IV per encryption (no deterministic ciphertext)', () => {
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('fails to decrypt if the auth tag is tampered (GCM integrity)', () => {
    const enc = svc.encrypt('secret');
    const badTag = Buffer.from('0'.repeat(32), 'hex').toString('base64');
    expect(() => svc.decrypt({ ...enc, authTag: badTag })).toThrow();
  });

  it('masks a key without revealing the middle', () => {
    const masked = svc.mask('sk-ant-api03-abcdefghijklmnop-x9f2');
    expect(masked.startsWith('sk-ant-a')).toBe(true);
    expect(masked.endsWith('x9f2')).toBe(true);
    expect(masked).toContain('…');
    expect(masked).not.toContain('abcdefghijklmnop');
  });

  it('rejects an ENCRYPTION_KEY that is not 32 bytes', () => {
    const bad = new CryptoService({ getOrThrow: () => 'abcd' } as unknown as ConfigService);
    expect(() => bad.onModuleInit()).toThrow();
  });
});
