import { SHA256 } from './sha256.constants';
/** Rotate a SHA-256 word. @param {number} word - Unsigned word. @param {number} bits - Rotation.
 * @returns {number} Rotated bits. */
function rotate(word: number, bits: number): number {
  return (word >>> bits) | (word << (SHA256.wordBits - bits));
}
/** Compute standard SHA-256 when HTTP browsers do not expose SubtleCrypto; used only for review revisions.
 * @param {Uint8Array} bytes - UTF-8 payload. @returns {Uint8Array} The same digest as native SHA-256. */
export function sha256Fallback(bytes: Uint8Array): Uint8Array {
  const size = Math.ceil((bytes.length + 1 + SHA256.lengthBytes) / SHA256.blockBytes) * SHA256.blockBytes;
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded[bytes.length] = SHA256.paddingByte;
  const view = new DataView(padded.buffer);
  view.setBigUint64(size - SHA256.lengthBytes, BigInt(bytes.length) * BigInt(SHA256.byteBits));
  const state = [...SHA256.initial];
  const words = new Uint32Array(SHA256.rounds.length);
  const blockWords = SHA256.blockBytes / SHA256.wordBytes;
  for (let offset = 0; offset < size; offset += SHA256.blockBytes) {
    for (let index = 0; index < blockWords; index++) {
      words[index] = view.getUint32(offset + index * SHA256.wordBytes);
    }
    for (let index = blockWords; index < words.length; index++) {
      const near = words[index - SHA256.nearOffset]!;
      const far = words[index - SHA256.farOffset]!;
      const small0 =
        rotate(far, SHA256.small0.rotateA) ^ rotate(far, SHA256.small0.rotateB) ^ (far >>> SHA256.small0.shift);
      const small1 =
        rotate(near, SHA256.small1.rotateA) ^ rotate(near, SHA256.small1.rotateB) ^ (near >>> SHA256.small1.shift);
      words[index] = words[index - SHA256.windowWords]! + small0 + words[index - SHA256.middleOffset]! + small1;
    }
    let [a, b, c, d, e, f, g, h] = state as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < words.length; index++) {
      const big1 = rotate(e, SHA256.big1.rotateA) ^ rotate(e, SHA256.big1.rotateB) ^ rotate(e, SHA256.big1.rotateC);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + big1 + choice + SHA256.rounds[index]! + words[index]!) >>> 0;
      const big0 = rotate(a, SHA256.big0.rotateA) ^ rotate(a, SHA256.big0.rotateB) ^ rotate(a, SHA256.big0.rotateC);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      [a, b, c, d, e, f, g, h] = [(temp1 + big0 + majority) >>> 0, a, b, c, (d + temp1) >>> 0, e, f, g];
    }
    for (const [index, value] of [a, b, c, d, e, f, g, h].entries()) {
      state[index] = (state[index]! + value) >>> 0;
    }
  }
  const output = new Uint8Array(state.length * SHA256.wordBytes);
  const result = new DataView(output.buffer);
  state.forEach((value, index) => result.setUint32(index * SHA256.wordBytes, value));
  return output;
}
