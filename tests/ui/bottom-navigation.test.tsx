import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { routerPush } from './next-navigation';

const today = {
  plan: null,
  today: { date: '2026-09-04', calories: 0, protein: 0, meals: {} },
  insights: [],
  hasPlan: false,
};

const fasting = {
  planHours: 14, goal: 'health', experience: 'beginner', windowEndHour: 20,
  active: false, startAt: null, elapsedMinutes: 0, remainingMinutes: 840,
  progress: 0, canComplete: false, todayCompleted: false, todayFastHours: 0,
  todayFeel: { energy: null, hunger: null }, streak: 0,
  stage: { key: 'ready', title: '准备开始', desc: '按计划执行', accent: 'green', progress: 0 },
  mealGuide: { windowStart: '06:00', windowEnd: '20:00', eatHours: 10, mealCount: 3, meals: [], note: '' },
  profile: { hasProfile: false, sex: null, birthDate: null, heightCm: null, weightKg: null, bodySource: null, latestBody: null, screening: {} },
  recommendation: { ready: false, contraindicated: false, planHours: 14, level: 'beginner', reason: '', warnings: [], bmi: null, age: null },
  advice: { kind: 'none', title: '', content: '' }, weekLogs: [],
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }));
}

beforeEach(() => {
  routerPush.mockClear();
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/me') return json({ user: { id: 'ui-test', phone: '13800000000', nickname: '测试用户' } });
    if (url === '/api/plan/today') return json(today);
    if (url === '/api/body') return json({ metrics: null, measuredAt: null });
    if (url === '/api/fasting') return json(fasting);
    if (url.startsWith('/api/insights/list')) return json({ insights: [] });
    if (url === '/api/chat/messages') return json({ messages: [] });
    if (url === '/api/plan/week') return json({ days: [], needsRoll: false });
    if (url === '/api/shopping') return json({ items: [] });
    return json({});
  }));
});

describe('首页底栏', () => {
  it('六个入口均可切换并渲染对应页面', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(await screen.findByRole('heading', { name: '你好，测试用户' })).toBeInTheDocument();

    const cases = [
      ['计划', '周计划'],
      ['营养师', '小养营养师'],
      ['轻断食', '轻断食'],
      ['冰箱', '我的冰箱'],
      ['身体', '身体数据'],
      ['今日', '你好，测试用户'],
    ] as const;

    for (const [tab, heading] of cases) {
      await user.click(screen.getByRole('button', { name: tab }));
      await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument());
    }

    expect(routerPush).not.toHaveBeenCalledWith('/login');
  });
});
