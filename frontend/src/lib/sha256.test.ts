import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { sha256 } from './sha256';
afterEach(() => vi.unstubAllGlobals());
describe('review revisions with and without browser SubtleCrypto', () => {
  it.each([0, 1, 3, 55, 56, 63, 64, 65, 127, 128, 129, 65536])(
    'matches native SHA-256 at padding/block boundaries for %i bytes',
    async (length) => {
      const input = 'a'.repeat(length);
      const expected = createHash('sha256').update(input).digest('hex');
      vi.stubGlobal('crypto', undefined);
      expect(await sha256(input)).toBe(expected);
      vi.stubGlobal('crypto', webcrypto);
      expect(await sha256(input)).toBe(expected);
    },
  );
  it('uses standard known vectors, including multiple blocks and Unicode ledger text', async () => {
    vi.stubGlobal('crypto', {});
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
    const text = JSON.stringify({ name: 'Ενοίκιο 🏠', notes: 'Μισθός\n€', empty: null });
    expect(await sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
  });
  it('does not turn a native hashing failure into approval', async () => {
    const digest = vi.fn().mockRejectedValue(new Error('Hash failed'));
    vi.stubGlobal('crypto', { subtle: { digest } });
    await expect(sha256('review')).rejects.toThrow('Hash failed');
    expect(digest).toHaveBeenCalledOnce();
  });
});
