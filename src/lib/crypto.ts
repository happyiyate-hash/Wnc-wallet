import crypto from 'crypto';

/**
 * CANONICAL INSTITUTIONAL ENCRYPTION PROTOCOL
 * Version: 2.2.0 (Environment Synced)
 * Algorithm: AES-256-CBC
 * Key Derivation: SHA-256 Hash of Master Key HEX
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Prioritize environment key for production-grade security
const MASTER_KEY_HEX = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

/**
 * Derives the 32-byte AES key using the SHA-256 hash of the Master Key.
 */
function getInstitutionalKey(): Buffer {
  return crypto.createHash('sha256').update(MASTER_KEY_HEX).digest();
}

/**
 * Encrypts a plaintext string into a hex ciphertext and hex IV.
 * Compatible with SmarterSeller profiles table logic.
 */
export function encryptPhrase(text: string): { encrypted: string; iv: string } {
  const key = getInstitutionalKey();
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
 * Decrypts hex ciphertext using a provided hex IV and the Master Key.
 */
export function decryptPhrase(encryptedText: string, ivHex: string): string {
  try {
    const key = getInstitutionalKey();
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedText, 'hex');
    
    if (iv.length !== IV_LENGTH) {
      throw new Error(`IV length mismatch: expected ${IV_LENGTH}, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    console.error("CANONICAL_DECRYPT_FAILURE:", error.message);
    throw new Error("DECRYPTION_FAILED");
  }
}
