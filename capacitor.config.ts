import type { CapacitorConfig } from '@capacitor/cli';

// 后端地址：iOS App 会加载这个地址（现有全栈后端，含登录/D1 数据/AI）。
// 部署上线后设置正式域名，例如：
//   CAP_SERVER_URL=https://app.你的域名.com npm run cap:sync
// 未设置时默认连本地开发服务器（仅 iOS 模拟器可用；真机需改成本机局域网 IP 或正式域名）。
const serverUrl = process.env.CAP_SERVER_URL || 'http://localhost:3000';

const config: CapacitorConfig = {
  appId: 'com.nourishos.app',
  appName: '轻养',
  webDir: 'public',
  server: {
    url: serverUrl,
    // 仅当用 http（本地开发）时允许明文；生产 https 自动关闭
    cleartext: serverUrl.startsWith('http://'),
  },
  ios: {
    // 网页自己处理安全区（顶部 16px + safe-area-inset），原生不再额外内缩
    contentInset: 'never',
  },
};

export default config;