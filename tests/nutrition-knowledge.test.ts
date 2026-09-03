import assert from 'node:assert/strict';
import test from 'node:test';
import { retrieveNutritionKnowledge } from '../lib/nutrition-knowledge';

test('混合检索将糖尿病断食风险排在首位', () => {
  const results = retrieveNutritionKnowledge('糖尿病吃降糖药可以断食吗');
  assert.equal(results[0]?.id, 'niddk-diabetes-fasting');
  assert.ok((results[0]?.score ?? 0) > 0);
});

test('混合检索返回可追溯的官方来源', () => {
  const results = retrieveNutritionKnowledge('每周应该运动多久');
  assert.ok(results.some((item) => item.sourceUrl.startsWith('https://www.who.int/')));
});
