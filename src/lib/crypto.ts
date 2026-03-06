import crypto from 'crypto';

/**
 * CANONICAL INSTITUTIONAL ENCRYPTION PROTOCOL (HARDCODED)
 * Project: SmarterSeller Standard
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Institutional Master Key - HARDCODED FOR PRODUCTION RELIABILITY
const MASTER_KEY_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

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
    throw new Error("DECRYPTION_FAILED: Protocol mismatch or invalid key.");
  }
}
