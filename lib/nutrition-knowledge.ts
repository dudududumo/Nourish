export type KnowledgeEntry = { id: string; title: string; content: string; tags: string[]; source: string; sourceUrl: string; updatedAt: string };

export const NUTRITION_KNOWLEDGE: KnowledgeEntry[] = [
  { id: 'who-activity-adult', title: 'WHO 成人身体活动建议', content: '18—64 岁成人每周至少进行 150 分钟中等强度或 75 分钟高强度有氧活动，并在每周至少 2 天进行主要肌群力量训练。循序渐进，少量活动也优于完全不活动。', tags: ['运动', '活动', '力量训练', '减脂'], source: 'World Health Organization', sourceUrl: 'https://www.who.int/initiatives/behealthy/physical-activity', updatedAt: '2026-09-04' },
  { id: 'cdc-gradual-loss', title: 'CDC 渐进减重原则', content: '健康减重应结合饮食模式、规律活动、睡眠与压力管理。渐进稳定的减重通常比快速减重更容易维持；药物、疾病、压力、年龄等也会影响体重管理。', tags: ['减重', '减脂', '体重', '热量', '睡眠'], source: 'U.S. CDC', sourceUrl: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html', updatedAt: '2026-09-04' },
  { id: 'nhc-balanced-diet', title: '中国居民平衡膳食原则', content: '合理膳食强调食物多样、营养均衡、少盐少油、控糖限酒，并结合个人饮食习惯与实际情况调整，不应机械照搬示例食谱。', tags: ['膳食', '食谱', '均衡', '盐', '油', '糖'], source: '国家卫生健康委员会', sourceUrl: 'https://www.nhc.gov.cn/wjw/jiany/202309/8295502ae74c4f94ba69865e773381d1.shtml', updatedAt: '2026-09-04' },
  { id: 'nhc-protein-foods', title: '优质蛋白与食物多样', content: '一般人群应适量摄入鱼、禽、蛋、瘦肉，同时结合奶类、大豆及其制品；具体食谱需要考虑过敏、忌口、健康状况与可获得食材。', tags: ['蛋白质', '鱼', '鸡蛋', '瘦肉', '大豆', '素食'], source: '国家卫生健康委员会', sourceUrl: 'https://www.nhc.gov.cn/wjw/jiany/202212/d60248c1741a4818abc3ebe8c565e2ee.shtml', updatedAt: '2026-09-04' },
  { id: 'niddk-diabetes-fasting', title: '糖尿病人群断食风险', content: '糖尿病人群断食的主要风险包括低血糖、高血糖和脱水，药物调整需要专业判断，不建议在没有医疗监督的情况下自行开始或调整断食。', tags: ['糖尿病', '低血糖', '断食', '用药', '脱水'], source: 'NIDDK', sourceUrl: 'https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/fasting-safely-with-diabetes', updatedAt: '2026-09-04' },
];

function grams(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
  return result;
}

export function retrieveNutritionKnowledge(query: string, limit = 3) {
  const queryTerms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  const queryGrams = grams(query);
  return NUTRITION_KNOWLEDGE.map((entry) => {
    const searchable = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
    const sparse = queryTerms.reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0) / Math.max(1, queryTerms.length);
    const entryGrams = grams(searchable);
    const overlap = [...queryGrams].filter((gram) => entryGrams.has(gram)).length;
    const fuzzy = overlap / Math.max(1, Math.sqrt(queryGrams.size * entryGrams.size));
    return { ...entry, score: Math.round((sparse * 0.65 + fuzzy * 0.35) * 1000) / 1000 };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function formatKnowledgeContext(entries: ReturnType<typeof retrieveNutritionKnowledge>) {
  if (!entries.length) return '未检索到直接相关的知识条目；不要编造来源。';
  return entries.map((entry, index) => `[K${index + 1}] ${entry.title}\n${entry.content}\n来源：${entry.source} ${entry.sourceUrl}`).join('\n\n');
}
