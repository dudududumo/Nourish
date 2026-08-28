import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiSettings } from '@/db/schema';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }

// Fallback key for development / demo
const FALLBACK_KEY = 'nourish-dev-encryption-key-2026!';

async function encryptionKey() {
  const value = process.env.CONFIG_ENCRYPTION_KEY;
  const keyValue = value || FALLBACK_KEY;
  const keyBytes = new Uint8Array(32);
  const keyStr = keyValue.padEnd(32, '0').slice(0, 32);
  for (let i = 0; i < 32; i++) keyBytes[i] = keyStr.charCodeAt(i);
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function validateEndpoint(value: string) {
  const url = new URL(value);
  // Allow http for localhost / dev environments
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && !url.hostname.endsWith('.local')) {
    throw new Error('生产环境接口必须使用 HTTPS。');
  }
  return url.toString();
}

export async function saveAiSettings(userId: string, input: { provider: string; endpoint: string; model: string; apiKey: string }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(input.apiKey));
  await getDb().insert(aiSettings).values({
    userId,
    provider: input.provider,
    endpoint: validateEndpoint(input.endpoint),
    model: input.model,
    encryptedApiKey: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: aiSettings.userId,
    set: {
      provider: input.provider,
      endpoint: validateEndpoint(input.endpoint),
      model: input.model,
      encryptedApiKey: bytesToBase64(new Uint8Array(encrypted)),
      iv: bytesToBase64(iv),
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function getAiSettings(userId: string) {
  const row = await getDb().select().from(aiSettings).where(eq(aiSettings.userId, userId)).get();
  if (!row) return null;
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(row.iv) }, await encryptionKey(), base64ToBytes(row.encryptedApiKey));
  return { provider: row.provider, endpoint: row.endpoint, model: row.model, apiKey: decoder.decode(decrypted) };
}
