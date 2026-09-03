const sections = [
  ['场景判断', '健康管理需要处理非结构化描述、截图与动态偏好，适合让模型负责理解和生成；禁忌判断、数据校验、确认落库等高风险环节使用确定性规则。'],
  ['核心用户问题', '身体数据、饮食计划和执行反馈散落在不同工具中，用户难以把一次测量转化为一周可执行方案，也难以安全地局部调整。'],
  ['产品闭环', '身体数据输入 → AI 生成计划 → 用户预览调整 → 确认后落库 → 执行反馈进入下一周期。冰箱只作为上下文增强，轻断食作为辅助能力。'],
  ['失败兜底', '缺少关键资料时补问；高风险人群不自动推荐断食；结构化输出解析失败时不落库；任何计划调整必须经过二次确认。'],
  ['成功指标', '离线评测通过率、字段准确率、JSON 成功率、指令遵循率、安全违规数、人工复核覆盖率、响应耗时、Token 与估算成本。'],
  ['关键取舍', '没有为了“看起来更 AI”而强行使用多 Agent。当前任务由可观测 Workflow 完成；只有出现可独立路由、并行工具调用和明确收益时才引入 Agent。'],
];

export default function ProductCaseStudy() {
  return <main className="min-h-screen bg-[var(--grouped-background)] text-[var(--label)]"><div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-16"><a href="/" className="text-sm text-[var(--secondary-label)]">← 返回 Nourish</a><p className="mt-10 text-xs font-semibold uppercase tracking-[.18em] text-[var(--system-green)]">AI Product Case Study</p><h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Nourish：把健康建议做成<br />可确认、可评测的行动闭环</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--secondary-label)]">个人独立产品实践。覆盖场景判断、结构化数据、模型 Workflow、安全门禁、确认交互、评测与 Cloudflare 部署。</p><div className="mt-10 grid gap-3 sm:grid-cols-3"><Stat value="18/18" label="固定文本回归集" /><Stat value="2 阶段" label="调整预览与确认" /><Stat value="7/7" label="当前自动化测试" /></div><div className="mt-12 grid gap-5">{sections.map(([title, content], index) => <section key={title} className="rounded-3xl border border-[var(--separator)] bg-white p-6"><p className="text-xs font-semibold text-[var(--system-green)]">0{index + 1}</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-[var(--secondary-label)]">{content}</p></section>)}</div><div className="mt-8 flex flex-wrap gap-3"><a href="/evaluation" className="rounded-2xl bg-[var(--system-green)] px-5 py-3 text-sm font-semibold text-white">查看真实评测台</a><a href="/case-study/evaluation" className="rounded-2xl border border-[var(--separator)] bg-white px-5 py-3 text-sm font-semibold text-[var(--system-green)]">查看数据评测案例</a></div></div></main>;
}
function Stat({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-[#F0FDF4] p-5"><p className="text-2xl font-semibold text-[var(--system-green)]">{value}</p><p className="mt-1 text-xs text-[var(--secondary-label)]">{label}</p></div>; }
