import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://nourish-health-os.sites.openai.com'),
  title: '轻养 Nourish — 你的每日健康系统',
  description: '把饮食、冰箱库存、训练、轻断食和身体趋势放进一个温和而专业的健康闭环。',
  openGraph: { title: '轻养 · Nourish', description: '你的每日健康系统', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: '轻养 · Nourish', description: '你的每日健康系统', images: ['/og.png'] },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '轻养' },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
