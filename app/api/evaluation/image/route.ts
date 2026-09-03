import { getCurrentUser } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { BODY_PARSE_PROMPT_VERSION, type BodyMetricValues } from '@/lib/body-metrics';
import { scoreBodyMetrics } from '@/lib/image-evaluation';

type ImageCase = { id: string; image: string; groundTruth: BodyMetricValues };

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });
  const rate = await enforceRateLimit('image-evaluation', user.id, 10, 60 * 60);
  if (!rate.allowed) return Response.json({ error: '本小时图片评测次数已达上限。' }, { status: 429 });
  const body = await request.json().catch(() => ({})) as {
    cases?: ImageCase[];
    pricing?: { inputPerMillion?: number; outputPerMillion?: number; currency?: string };
  };
  const cases = Array.isArray(body.cases) ? body.cases.slice(0, 5) : [];
  if (!cases.length) return Response.json({ error: '请至少提供一条图片评测样本。' }, { status: 400 });
  if (cases.some((item) => !item.id || !item.image?.startsWith('data:image') || !item.groundTruth || typeof item.groundTruth !== 'object')) {
    return Response.json({ error: '图片评测样本格式不完整。' }, { status: 400 });
  }

  const results = [];
  for (const item of cases) {
    const response = await fetch(new URL('/api/body/parse', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({ image: item.image }),
    });
    const parsed = await response.json().catch(() => ({})) as {
      metrics?: BodyMetricValues;
      error?: string;
      meta?: { model?: string; durationMs?: number; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    };
    const score = scoreBodyMetrics(item.groundTruth, parsed.metrics ?? {});
    results.push({ id: item.id, prediction: parsed.metrics ?? {}, error: response.ok ? undefined : parsed.error ?? '图片解析失败', meta: parsed.meta, ...score });
  }

  const expectedCount = results.reduce((sum, item) => sum + item.expectedCount, 0);
  const predictedCount = results.reduce((sum, item) => sum + item.predictedCount, 0);
  const matched = results.reduce((sum, item) => sum + item.matched, 0);
  const promptTokens = results.reduce((sum, item) => sum + (item.meta?.usage?.prompt_tokens ?? 0), 0);
  const completionTokens = results.reduce((sum, item) => sum + (item.meta?.usage?.completion_tokens ?? 0), 0);
  const pricing = body.pricing;
  const estimatedCost = pricing && Number.isFinite(pricing.inputPerMillion) && Number.isFinite(pricing.outputPerMillion)
    ? (promptTokens * (pricing.inputPerMillion ?? 0) + completionTokens * (pricing.outputPerMillion ?? 0)) / 1_000_000
    : undefined;
  return Response.json({
    datasetVersion: `body-image-eval-${new Date().toISOString().slice(0, 10)}-v1`,
    promptVersion: BODY_PARSE_PROMPT_VERSION,
    total: results.length,
    expectedCount,
    predictedCount,
    matched,
    fieldAccuracy: expectedCount ? Math.round((matched / expectedCount) * 1000) / 10 : 0,
    precision: predictedCount ? Math.round((matched / predictedCount) * 1000) / 10 : 0,
    durationMs: results.reduce((sum, item) => sum + (item.meta?.durationMs ?? 0), 0),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost,
    currency: pricing?.currency,
    results,
  });
}
