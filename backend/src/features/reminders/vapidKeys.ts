import { createECDH } from 'node:crypto';
import { VAPID } from './vapid.constants.js';
export interface SigningKeys {
  publicKey: string;
  privateKey: string;
}
/** Validate encoding, P-256 lengths and the actual private/public relationship without exposing either value.
 * @param {unknown} value - Generated, persisted or explicitly configured key pair.
 * @returns {SigningKeys} Validated pair; malformed/corrupt values never trigger automatic rotation. */
export function validateSigningKeys(value: unknown): SigningKeys {
  try {
    const keys = value as SigningKeys;
    if (
      !keys ||
      typeof keys.publicKey !== 'string' ||
      typeof keys.privateKey !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(keys.publicKey) ||
      !/^[A-Za-z0-9_-]+$/.test(keys.privateKey)
    ) {
      throw new Error();
    }
    const publicBytes = Buffer.from(keys.publicKey, 'base64url');
    const privateBytes = Buffer.from(keys.privateKey, 'base64url');
    const curve = createECDH(VAPID.curve);
    curve.setPrivateKey(privateBytes);
    if (
      publicBytes.length !== VAPID.publicBytes ||
      privateBytes.length !== VAPID.privateBytes ||
      curve.getPublicKey('base64url', 'uncompressed') !== keys.publicKey
    ) {
      throw new Error();
    }
    return { publicKey: keys.publicKey, privateKey: keys.privateKey };
  } catch {
    throw new Error(VAPID.invalidKeys);
  }
}
