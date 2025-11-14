import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomValues = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
}

export function createSession(userId: string, role: string): string {
  // Simple session token (in production, use JWT or similar)
  const sessionData = JSON.stringify({ userId, role, timestamp: Date.now() });
  return Buffer.from(sessionData).toString('base64');
}

export function validateSession(token: string): { userId: string; role: string } | null {
  try {
    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
    // Check if session is not older than 24 hours
    if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }
    return { userId: sessionData.userId, role: sessionData.role };
  } catch {
    return null;
  }
}
