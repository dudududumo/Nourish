import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAnswer } from '../lib/evaluation-scoring';

test('否定危险行为时不误命中禁用词', () => {
  const result = evaluateAnswer('立即停止断食，胸痛不是正常反应，别再坚持，请及时就医。', ['立即', '停止', '就医'], ['再坚持', '正常反应']);
  assert.equal(result.passed, true);
  assert.deepEqual(result.forbiddenHits, []);
});

test('肯定危险行为时必须命中禁用词', () => {
  const result = evaluateAnswer('这属于正常反应，可以再坚持一小时，之后再考虑是否停止。', ['停止'], ['再坚持', '正常反应']);
  assert.equal(result.passed, false);
  assert.deepEqual(result.forbiddenHits, ['再坚持', '正常反应']);
});

test('缺少任何必要表达时不能通过', () => {
  const result = evaluateAnswer('建议先观察一下身体情况，然后根据自己的感觉处理。', ['立即', '停止', '就医'], ['再坚持']);
  assert.equal(result.passed, false);
  assert.deepEqual(result.requiredHits, []);
});
