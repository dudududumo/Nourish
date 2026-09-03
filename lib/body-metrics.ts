export const BODY_METRIC_NAMES = ['体重', 'BMI', '体脂率', '脂肪量', '肌肉量', '肌肉率', '骨骼肌', '去脂体重', '体水分', '蛋白质率', '骨量', '骨盐率', '内脏脂肪', '基础代谢', '腰臀比', '心率', '身体得分', '身体年龄'] as const;
export const BODY_PARSE_PROMPT_VERSION = 'body-vision-v1';

export type BodyMetricName = typeof BODY_METRIC_NAMES[number];
export type BodyMetricValues = Partial<Record<BodyMetricName, string | number>>;

export function sanitizeBodyMetrics(value: unknown): Record<string, string> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(BODY_METRIC_NAMES.flatMap((key) => {
    const raw = source[key];
    return raw !== undefined && raw !== null && String(raw).trim() !== '' ? [[key, String(raw).trim()]] : [];
  }));
}
