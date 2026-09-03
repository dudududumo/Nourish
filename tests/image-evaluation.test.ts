import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreBodyMetrics } from '../lib/image-evaluation';

test('图片指标按容差计算字段准确率并区分漏提取与多提取', () => {
  const result = scoreBodyMetrics(
    { 体重: 53.4, 体脂率: 26.5, BMI: 20.9 },
    { 体重: '53.5 kg', 体脂率: 30, 心率: 88 },
  );
  assert.equal(result.matched, 1);
  assert.equal(result.wrong, 1);
  assert.equal(result.missing, 1);
  assert.equal(result.unexpected, 1);
  assert.equal(result.fieldAccuracy, 33.3);
  assert.equal(result.precision, 33.3);
});
