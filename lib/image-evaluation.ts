import { BODY_METRIC_NAMES, sanitizeBodyMetrics, type BodyMetricValues } from './body-metrics';

export type ImageFieldResult = { field: string; expected?: number; predicted?: number; status: 'matched' | 'wrong' | 'missing' | 'unexpected'; error?: number };

function numeric(value: string | number | undefined) {
  if (value === undefined) return undefined;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function scoreBodyMetrics(groundTruth: BodyMetricValues, prediction: BodyMetricValues) {
  const truth = sanitizeBodyMetrics(groundTruth);
  const predicted = sanitizeBodyMetrics(prediction);
  const fields: ImageFieldResult[] = BODY_METRIC_NAMES.flatMap((field) => {
    const expected = numeric(truth[field]);
    const actual = numeric(predicted[field]);
    if (expected === undefined && actual === undefined) return [];
    if (expected === undefined) return [{ field, predicted: actual, status: 'unexpected' as const }];
    if (actual === undefined) return [{ field, expected, status: 'missing' as const }];
    const error = Math.abs(actual - expected);
    const tolerance = Math.max(0.1, Math.abs(expected) * 0.005);
    return [{ field, expected, predicted: actual, error, status: error <= tolerance ? 'matched' as const : 'wrong' as const }];
  });
  const expectedCount = Object.keys(truth).length;
  const predictedCount = Object.keys(predicted).length;
  const matched = fields.filter((field) => field.status === 'matched').length;
  const missing = fields.filter((field) => field.status === 'missing').length;
  const wrong = fields.filter((field) => field.status === 'wrong').length;
  const unexpected = fields.filter((field) => field.status === 'unexpected').length;
  return {
    expectedCount, predictedCount, matched, missing, wrong, unexpected,
    fieldAccuracy: expectedCount ? Math.round((matched / expectedCount) * 1000) / 10 : 0,
    precision: predictedCount ? Math.round((matched / predictedCount) * 1000) / 10 : 0,
    fields,
  };
}
