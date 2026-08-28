import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiSettings } from '@/db/schema';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }

async function encryptionKey() {
  const value = process.env.CONFIG_ENCRYPTION_KEY;
  if (!value) throw new Error('站点加密主密钥尚未配置。');
  return crypto.subtle.importKey('raw', base64ToBytes(value), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function validateEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('接口必须使用 HTTPS。');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('不允许使用本地或 IP 地址。');
  return url.toString();
}

export async function saveAiSettings(userId: string, input: { provider: string; endpoint: string; model: string; apiKey: string }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(input.apiKey));
  await getDb().insert(aiSettings).values({ userId, provider: input.provider, endpoint: validateEndpoint(input.endpoint), model: input.model, encryptedApiKey: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: aiSettings.userId, set: { provider: input.provider, endpoint: validateEndpoint(input.endpoint), model: input.model, encryptedApiKey: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv), updatedAt: new Date().toISOString() } });
}

export async function getAiSettings(userId: string) {
  const row = await getDb().select().from(aiSettings).where(eq(aiSettings.userId, userId)).get();
  if (!row) return null;
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(row.iv) }, await encryptionKey(), base64ToBytes(row.encryptedApiKey));
  return { provider: row.provider, endpoint: row.endpoint, model: row.model, apiKey: decoder.decode(decrypted) };
}
