import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

/**
 * Securely retrieves and validates the ENCRYPTION_KEY from environment variables.
 * Ensures the key is exactly 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY?.trim()

  if (!keyString) {
    throw new Error("CRITICAL: ENCRYPTION_KEY environment variable is not set on the server.")
  }

  // Convert the 64-character hex string into a 32-byte Buffer
  const buffer = Buffer.from(keyString, 'hex')

  if (buffer.length !== 32) {
    throw new Error(`CRITICAL: ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${buffer.length} bytes.`)
  }

  return buffer
}

/**
 * Encrypts a plaintext string (e.g., a mnemonic phrase) using AES-256-CBC.
 */
export function encryptPhrase(phrase: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(phrase, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return {
    encrypted,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 * Returns the plaintext phrase.
 */
export function decryptPhrase(encryptedPhrase: string, ivHex: string): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  
  if (iv.length !== 16) {
    throw new Error(`Invalid IV length: ${iv.length} bytes. Expected 16.`)
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  
  let decrypted = decipher.update(encryptedPhrase, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
