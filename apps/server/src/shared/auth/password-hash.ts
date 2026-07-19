import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  }).toString('hex');

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [algorithm, rawN, rawR, rawP, salt, storedHash] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !rawN || !rawR || !rawP || !salt || !storedHash) {
    return false;
  }

  const expected = Buffer.from(storedHash, 'hex');
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(rawN),
    r: Number(rawR),
    p: Number(rawP)
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
