'use client';

import { useState } from 'react';
import { Leaf, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { phone, password }
        : { phone, password, nickname };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');

      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--grouped-background)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex size-16 rounded-2xl bg-[var(--system-green)] text-white items-center justify-center mb-4 shadow-lg shadow-green-500/30">
            <Leaf className="size-8" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">轻养</h1>
          <p className="text-[15px] text-[var(--secondary-label)] mt-1.5">你的每日健康系统</p>
        </div>

        {/* Segmented Control */}
        <div className="flex bg-[var(--system-gray6)] rounded-xl p-1 mb-6">
          <button
            className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-all ${
              mode === 'login'
                ? 'bg-[var(--secondary-grouped-background)] text-[var(--label)] shadow-sm'
                : 'text-[var(--secondary-label)]'
            }`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            登录
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-all ${
              mode === 'register'
                ? 'bg-[var(--secondary-grouped-background)] text-[var(--label)] shadow-sm'
                : 'text-[var(--secondary-label)]'
            }`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            注册
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[var(--secondary-grouped-background)] rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[var(--separator)]">
              <label className="text-[12px] text-[var(--secondary-label)] block mb-1">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full text-[16px] bg-transparent outline-none"
                maxLength={11}
              />
            </div>
            {mode === 'register' && (
              <div className="px-4 py-3.5 border-b border-[var(--separator)]">
                <label className="text-[12px] text-[var(--secondary-label)] block mb-1">昵称（可选）</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="给自己起个名字"
                  className="w-full text-[16px] bg-transparent outline-none"
                  maxLength={20}
                />
              </div>
            )}
            <div className="px-4 py-3.5">
              <label className="text-[12px] text-[var(--secondary-label)] block mb-1">密码</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="flex-1 text-[16px] bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[var(--secondary-label)] p-1"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-[var(--system-red)] text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phone || !password}
            className="w-full h-12 rounded-xl bg-[var(--system-green)] text-white font-semibold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                {mode === 'login' ? '登录' : '创建账号'}
                <ArrowRight className="size-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-[12px] text-[var(--tertiary-label)] text-center mt-8 leading-[18px]">
          登录即表示同意《用户协议》和《隐私政策》
        </p>
      </div>
    </div>
  );
}
