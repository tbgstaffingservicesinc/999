import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

export function decrypt(encryptedText: string): string {
  const encryptedBuffer = Buffer.from(encryptedText, 'hex');
  const iv = encryptedBuffer.slice(0, IV_LENGTH);
  const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
