import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

// Securely gets the ENCRYPTION_KEY from your environment variables.
const keyString = process.env.ENCRYPTION_KEY

if (!keyString) {
  throw new Error("CRITICAL: ENCRYPTION_KEY is not set in the environment variables.")
}

// Convert the 64-character hex string into a 32-byte Buffer for aes-256-cbc
const KEY = Buffer.from(keyString, 'hex')

if (KEY.length !== 32) {
  throw new Error("CRITICAL: ENCRYPTION_KEY must be a 64-character hex string (32 bytes).")
}

/**
 * Encrypts a plaintext string (e.g., a mnemonic phrase) using AES-256-CBC.
 */
export function encryptPhrase(phrase: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  
  let encrypted = cipher.update(phrase, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return {
    encrypted,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 */
export function decryptPhrase(encryptedPhrase: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  
  let decrypted = decipher.update(encryptedPhrase, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
