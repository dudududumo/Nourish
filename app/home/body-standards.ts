// Conventional wellness references for display only; they are not medical diagnoses.

export const metrics = [
  ['体重', '', 'kg'], ['BMI', '', ''],
  ['体脂率', '', '%'], ['脂肪量', '', 'kg'],
  ['肌肉量', '', 'kg'], ['肌肉率', '', '%'],
  ['骨骼肌', '', 'kg'], ['去脂体重', '', 'kg'],
  ['体水分', '', '%'], ['蛋白质率', '', '%'],
  ['骨量', '', 'kg'], ['骨盐率', '', '%'],
  ['内脏脂肪', '', '级'], ['基础代谢', '', 'kcal'],
  ['腰臀比', '', ''], ['心率', '', '次/分'],
  ['身体得分', '', '分'], ['身体年龄', '', '岁'],
] as const;

// ===== 各指标的科学分级区间（常规健康参考，不构成医疗建议） =====
const ZC = {
  low: '#3B82F6',    // 偏低 / 不足 → 蓝（信息提示）
  norm: '#22C55E',   // 正常 / 良好 → 健康绿
  high: '#F59E0B',   // 偏高 / 轻度超标 → 橙（提醒）
  danger: '#EF4444', // 健康风险 → 红（危险）
};

type ZoneDef = { label: string; min: number; max: number; color: string };
type MetricStandard = {
  zones?: ZoneDef[];   // 未区分性别时的默认区间
  male?: ZoneDef[];
  female?: ZoneDef[];
  guide: string;
};

export const STANDARDS: Record<string, MetricStandard> = {
  BMI: {
    zones: [
      { label: '偏瘦', min: 14, max: 18.5, color: ZC.low },
      { label: '正常', min: 18.5, max: 24, color: ZC.norm },
      { label: '超重', min: 24, max: 28, color: ZC.high },
      { label: '肥胖', min: 28, max: 34, color: ZC.danger },
    ],
    guide: 'BMI = 体重(kg) ÷ 身高(m)²。中国成人标准：18.5–23.9 正常、24–27.9 超重、≥28 肥胖；低于 18.5 偏瘦。',
  },
  体脂率: {
    zones: [
      { label: '偏低', min: 10, max: 18, color: ZC.low },
      { label: '标准', min: 18, max: 28, color: ZC.norm },
      { label: '偏高', min: 28, max: 35, color: ZC.high },
      { label: '肥胖', min: 35, max: 50, color: ZC.danger },
    ],
    male: [
      { label: '偏低', min: 4, max: 10, color: ZC.low },
      { label: '标准', min: 10, max: 20, color: ZC.norm },
      { label: '偏高', min: 20, max: 25, color: ZC.high },
      { label: '肥胖', min: 25, max: 40, color: ZC.danger },
    ],
    guide: '体脂率是比体重更关键的健康指标。成年男性标准约 10–20%、女性约 18–28%；男 >25%、女 >35% 通常视为肥胖。',
  },
  内脏脂肪: {
    zones: [
      { label: '正常', min: 1, max: 10, color: ZC.norm },
      { label: '偏高', min: 10, max: 14, color: ZC.high },
      { label: '较高', min: 14, max: 20, color: ZC.danger },
    ],
    guide: '内脏脂肪等级 1–9 为正常，10–14 偏高，≥15 视为较高；内脏脂肪过高与心血管、代谢疾病风险相关。',
  },
  肌肉率: {
    zones: [
      { label: '偏低', min: 20, max: 30, color: ZC.low },
      { label: '标准', min: 30, max: 40, color: ZC.norm },
      { label: '良好', min: 40, max: 50, color: ZC.norm },
    ],
    guide: '肌肉率健康成年人约为体重的 30–40%（女性偏低、男性偏高），肌肉量高通常代谢更好，长期久坐易下降。',
  },
  体水分: {
    zones: [
      { label: '偏低', min: 40, max: 50, color: ZC.low },
      { label: '标准', min: 50, max: 60, color: ZC.norm },
      { label: '偏高', min: 60, max: 80, color: ZC.high },
    ],
    male: [
      { label: '偏低', min: 40, max: 55, color: ZC.low },
      { label: '标准', min: 55, max: 65, color: ZC.norm },
      { label: '偏高', min: 65, max: 80, color: ZC.high },
    ],
    guide: '身体水分率男性约 55–65%、女性约 50–60%。饮水不足或肌肉量偏低时数值下降。',
  },
  蛋白质率: {
    zones: [
      { label: '偏低', min: 10, max: 14, color: ZC.low },
      { label: '标准', min: 14, max: 17, color: ZC.norm },
      { label: '偏高', min: 17, max: 25, color: ZC.high },
    ],
    guide: '蛋白质率正常参考约 14–17%，偏低常见于蛋白质摄入不足或肌肉流失。',
  },
  基础代谢: {
    zones: [
      { label: '偏低', min: 900, max: 1100, color: ZC.low },
      { label: '标准', min: 1100, max: 1400, color: ZC.norm },
      { label: '偏高', min: 1400, max: 1800, color: ZC.high },
    ],
    male: [
      { label: '偏低', min: 1200, max: 1400, color: ZC.low },
      { label: '标准', min: 1400, max: 1700, color: ZC.norm },
      { label: '偏高', min: 1700, max: 2200, color: ZC.high },
    ],
    guide: '基础代谢指维持生命体征每日消耗的热量。女性约 1100–1400 kcal、男性 1400–1700 kcal，因人而异。',
  },
  腰臀比: {
    zones: [
      { label: '正常', min: 0.7, max: 0.85, color: ZC.norm },
      { label: '偏高', min: 0.85, max: 1.2, color: ZC.danger },
    ],
    male: [
      { label: '正常', min: 0.7, max: 0.9, color: ZC.norm },
      { label: '偏高', min: 0.9, max: 1.2, color: ZC.danger },
    ],
    guide: '腰臀比 = 腰围 ÷ 臀围。男性 >0.90、女性 >0.85 提示向心性肥胖风险增加。',
  },
  心率: {
    zones: [
      { label: '偏缓', min: 40, max: 60, color: ZC.low },
      { label: '正常', min: 60, max: 100, color: ZC.norm },
      { label: '偏快', min: 100, max: 160, color: ZC.danger },
    ],
    guide: '成人静息心率正常约 60–100 次/分。>100(静息) 为心动过速，长期偏高建议复查。',
  },
  身体得分: {
    zones: [
      { label: '偏低', min: 40, max: 70, color: ZC.high },
      { label: '良好', min: 70, max: 100, color: ZC.norm },
    ],
    guide: '身体得分是综合健康评分，越高代表整体越健康，70 分以上为良好。',
  },
  骨量: {
    zones: [
      { label: '偏低', min: 1.5, max: 2, color: ZC.low },
      { label: '标准', min: 2, max: 3, color: ZC.norm },
      { label: '充足', min: 3, max: 4, color: ZC.norm },
    ],
    male: [
      { label: '偏低', min: 2, max: 3, color: ZC.low },
      { label: '标准', min: 3, max: 4, color: ZC.norm },
      { label: '充足', min: 4, max: 5, color: ZC.norm },
    ],
    guide: '骨量正常参考约男性 3–4kg、女性 2–3kg，受年龄、激素、运动影响。',
  },
  骨盐率: {
    zones: [
      { label: '偏低', min: 2.5, max: 3, color: ZC.low },
      { label: '标准', min: 3, max: 5, color: ZC.norm },
      { label: '偏高', min: 5, max: 6, color: ZC.high },
    ],
    guide: '骨盐量占体重百分比，正常约 3–5%，反映骨骼无机盐含量。',
  },
  体重: { guide: '体重本身无绝对标准，需结合身高(BMI)与身体成分判断。女性标准体重≈(身高cm−100)×0.9kg。' },
  脂肪量: { guide: '脂肪量是否正常取决于体脂率，而不只是绝对重量。' },
  肌肉量: { guide: '骨骼肌+平滑肌等总和，正常约占体重 30–40%，肌肉量高通常代谢更好。' },
  骨骼肌: { guide: '骨骼肌是维持姿势与运动的主要肌肉，女性约占体重 25–30%、男性 35–40%。' },
  去脂体重: { guide: '体重减去脂肪后的重量，由肌肉、骨骼、水分等组成，越高反映瘦体重越多。' },
  '身体年龄': { guide: '设备根据身体成分估算的生理年龄，低于实际年龄通常代表代谢状态更好。' },
};

export function resolveZones(std: MetricStandard | undefined, sex: string | null | undefined): ZoneDef[] | null {
  if (!std) return null;
  const zones = (sex === 'female' ? std.female : sex === 'male' ? std.male : null) ?? std.zones;
  return zones && zones.length ? zones : null;
}

export function locateZone(std: MetricStandard | undefined, sex: string | null | undefined, num: number | null): { zone: ZoneDef | null; pos: number } {
  const zones = resolveZones(std, sex);
  if (!zones || num == null || !isFinite(num)) return { zone: null, pos: 0 };
  const domain = [zones[0].min, zones[zones.length - 1].max];
  const idx = zones.findIndex((z) => num >= z.min && num < z.max);
  const zone = idx === -1 ? (num < domain[0] ? zones[0] : zones[zones.length - 1]) : zones[idx];
  const pos = Math.min(100, Math.max(0, ((num - domain[0]) / (domain[1] - domain[0])) * 100));
  return { zone, pos };
}

// 根据所在区间生成动态备注（等级 + 建议），替代原本写死的 mock 文案
export function zoneNote(zone: ZoneDef | null): string {
  if (!zone) return '';
  const advice = zone.color === ZC.danger ? '建议关注调整'
    : zone.color === ZC.high ? '建议留意'
      : zone.color === ZC.low ? '注意加强'
        : '保持良好';
  return `${zone.label} · ${advice}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
