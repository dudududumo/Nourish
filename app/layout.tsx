import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '轻养 Nourish — 你的每日健康系统',
  description: '把饮食、冰箱库存、训练、轻断食和身体趋势放进一个温和而专业的健康闭环。',
  openGraph: { title: '轻养 · Nourish', description: '你的每日健康系统', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: '轻养 · Nourish', description: '你的每日健康系统', images: ['/og.png'] },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '轻养' },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
};

// viewport-fit=cover 让 CSS 的 env(safe-area-inset-*) 在原生 WebView / 独立 PWA 里生效
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
              registrations.forEach(function (registration) { registration.unregister(); });
            });
          }
          if ('caches' in window) {
            caches.keys().then(function (keys) {
              keys.filter(function (key) { return key.indexOf('nourish-') === 0; })
                .forEach(function (key) { caches.delete(key); });
            });
          }
        ` }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
