
import crypto from 'crypto';

/**
 * CANONICAL INSTITUTIONAL ENCRYPTION PROTOCOL (HARDCODED PRODUCTION)
 * Version: 3.0.0 (SmarterSeller Shared Standard)
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// MASTER KEY: Strictly hardcoded for SmarterSeller Inter-App Compatibility
const MASTER_KEY_HEX = 'c4b8f9e7a1d2c3f4b5e6a7d8c9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8';

function getInstitutionalKey(): Buffer {
  return crypto.createHash('sha256').update(MASTER_KEY_HEX, 'hex').digest();
}

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

export function decryptPhrase(encryptedText: string, ivHex: string): string {
  try {
    const key = getInstitutionalKey();
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedText, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error: any) {
    console.error("CANONICAL_DECRYPT_FAILURE:", error.message);
    throw new Error("DECRYPTION_FAILED: Protocol mismatch or invalid node key.");
  }
}
