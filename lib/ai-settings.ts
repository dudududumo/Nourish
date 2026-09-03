import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiSettings } from '@/db/schema';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }

async function encryptionKey() {
  const value = process.env.CONFIG_ENCRYPTION_KEY;
  if (!value || value.length < 32) throw new Error('服务端尚未配置安全的加密密钥，请联系管理员。');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function validateEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('AI 接口必须使用 HTTPS。');
  if (url.username || url.password) throw new Error('AI 接口地址不能包含用户名或密码。');
  const host = url.hostname.toLowerCase();
  const blockedHost = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0'
    || host === '127.0.0.1' || host === '::1' || host.startsWith('10.') || host.startsWith('192.168.')
    || host.startsWith('169.254.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blockedHost) throw new Error('AI 接口不能指向本机或内网地址。');
  const builtInHosts = [
    'api.openai.com', 'generativelanguage.googleapis.com', 'openrouter.ai',
    'api.deepseek.com', 'api.moonshot.cn', 'dashscope.aliyuncs.com',
    'api.siliconflow.cn', 'open.bigmodel.cn', 'ark.cn-beijing.volces.com',
  ];
  const configuredHosts = (process.env.AI_ENDPOINT_ALLOWLIST || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const allowedHosts = [...builtInHosts, ...configuredHosts];
  const allowed = allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  if (!allowed) throw new Error('该 AI 接口域名不在安全白名单中，请联系管理员添加。');
  return url.toString();
}

export async function saveAiSettings(userId: string, input: { provider: string; endpoint: string; model: string; apiKey: string }) {
  if (input.provider.length > 40 || input.model.length > 120 || input.apiKey.length > 512) throw new Error('AI 配置字段长度超出限制。');
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
