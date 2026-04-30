import * as crypto from 'crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 10): string {
  return Array.from(
    crypto.randomBytes(length),
    (byte) => CHARS[byte % CHARS.length],
  ).join('');
}
