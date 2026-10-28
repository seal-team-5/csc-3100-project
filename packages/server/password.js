import bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 12;

export function validPassword(password) {
  return (
    typeof password === 'string' &&
    [...password].length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= 72
  );
}

export async function hashPassword(password) {
  if (!validPassword(password)) {
    throw new Error(
      'Password must have at least 8 characters and at most 72 UTF-8 bytes.'
    );
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
