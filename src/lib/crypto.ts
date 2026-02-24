import crypto from 'crypto';

/**
 * CANONICAL UNIVERSAL ENCRYPTION SYSTEM (AES-256-CBC)
 * 
 * This utility ensures perfect compatibility across all applications
 * sharing the vault.
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY_MISSING");
  }

  // Handle 64-character hex string as raw 32-byte Buffer
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Fallback: SHA-256 derivation to ensure an exact 32-byte key
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts a plaintext string into a hex ciphertext and IV.
 */
export function encryptPhrase(text: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts a hex ciphertext using the provided hex IV.
 */
export function decryptPhrase(encryptedText: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length} bytes. Expected ${IV_LENGTH}.`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
