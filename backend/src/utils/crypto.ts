// ============================================
// Encryption Utilities for Sensitive Data
// ============================================

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive encryption key from JWT secret
function getEncryptionKey(): Buffer {
  return crypto.scryptSync(config.jwtSecret, 'salt', 32);
}

/**
 * Encrypt sensitive data (e.g., Twilio Auth Token)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Return iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = encryptedText.split(':');
  
  if (!ivHex || !tagHex || !encrypted) {
    throw new Error('Invalid encrypted format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask sensitive data for display (show only last 4 chars)
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) {
    return '••••••••';
  }
  return '••••••••' + secret.slice(-4);
}

