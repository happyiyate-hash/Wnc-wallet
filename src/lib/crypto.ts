import crypto from 'crypto';

/**
 * CANONICAL INSTITUTIONAL ENCRYPTION PROTOCOL
 * Version: 2.0.0
 * Algorithm: AES-256-CBC
 * Key Derivation: SHA-256 Hash of Environment Secret
 * 
 * USE THIS EXACT LOGIC IN EXTERNAL APPS TO ENSURE VAULT COMPATIBILITY.
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 bytes for AES-CBC

/**
 * Derives a strictly 32-byte key from any input secret.
 * This is the "Magic Link" that allows Smarter Seller and Wevina to share data.
 */
function getInstitutionalKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY_MISSING");
  }

  // We hash the secret to ensure it is always exactly 32 bytes (256 bits)
  // regardless of how long the input string is.
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string into a hex ciphertext and hex IV.
 * @param text The data to protect (e.g. mnemonic)
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
 * Decrypts hex ciphertext using a provided hex IV.
 * @param encryptedText The hex string from 'vault_phrase' or 'vault_infura_key'
 * @param ivHex The hex string from 'iv' or 'infura_iv'
 */
export function decryptPhrase(encryptedText: string, ivHex: string): string {
  try {
    const key = getInstitutionalKey();
    const iv = Buffer.from(ivHex, 'hex');
    
    if (iv.length !== IV_LENGTH) {
      throw new Error(`IV length mismatch: expected ${IV_LENGTH}, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    console.error("CANONICAL_DECRYPT_FAILURE:", error.message);
    throw new Error("DECRYPTION_FAILED");
  }
}
