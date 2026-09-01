#!/usr/bin/env bash
# 部署「轻养」后端到你自己的 Cloudflare 账号（Workers + D1）。
#
# 前置（一次性）：先在你的终端里登录
#   npx wrangler login
#
# 用法（登录后一条命令即可，D1 库不存在会自动创建）：
#   ./scripts/deploy-cloudflare.sh
#
# 可选环境变量：
#   CLOUDFLARE_D1_NAME=xxx            D1 数据库名，默认 nourish
#   CLOUDFLARE_D1_DATABASE_ID=xxx     已有 D1 库则直接复用，跳过自动创建
#   CLOUDFLARE_WORKER_NAME=xxx        Worker 名，默认 nourish-backend
#   CLOUDFLARE_CONFIG_ENCRYPTION_KEY=xxx  给 AI 密钥加密用的 32 字节密钥（首次部署建议设置）
set -euo pipefail

D1_NAME="${CLOUDFLARE_D1_NAME:-nourish}"
WORKER_NAME="${CLOUDFLARE_WORKER_NAME:-nourish-backend}"
D1_ID="${CLOUDFLARE_D1_DATABASE_ID:-}"
CONFIG="dist/server/wrangler.json"

echo "==> 构建（vinext build）"
npm run build

# 若未指定 D1 数据库 id，则自动创建并解析其 id
if [ -z "$D1_ID" ]; then
  echo "==> 未指定 D1 数据库，自动创建 \"$D1_NAME\""
  CREATE_OUT="$(npx wrangler d1 create "$D1_NAME")"
  echo "$CREATE_OUT"
  D1_ID="$(printf '%s' "$CREATE_OUT" | sed -nE 's/.*database_id[ "=]+([0-9a-fA-F-]{36}).*/\1/p' | head -1)"
  if [ -z "$D1_ID" ]; then
    D1_ID="$(printf '%s' "$CREATE_OUT" | grep -oE '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | head -1)"
  fi
fi

if [ -z "$D1_ID" ]; then
  echo "❌ 无法获取 D1 数据库 id。请手动运行："
  echo "   npx wrangler d1 create $D1_NAME"
  echo "   复制输出的 database_id，然后："
  echo "   CLOUDFLARE_D1_DATABASE_ID=xxx ./scripts/deploy-cloudflare.sh"
  exit 1
fi
echo "   使用 D1: $D1_NAME ($D1_ID)"

echo "==> 写入真实 Worker 名与 D1 绑定到 $CONFIG"
CONFIG_PATH="$CONFIG" WORKER_NAME="$WORKER_NAME" D1_NAME="$D1_NAME" D1_ID="$D1_ID" node -e '
const fs = require("fs");
const c = JSON.parse(fs.readFileSync(process.env.CONFIG_PATH, "utf8"));
c.name = process.env.WORKER_NAME;
c.d1_databases = [{ binding: "DB", database_name: process.env.D1_NAME, database_id: process.env.D1_ID }];
fs.writeFileSync(process.env.CONFIG_PATH, JSON.stringify(c));
console.log("   worker:", c.name, "-> d1:", c.d1_databases[0].database_id);
'

echo "==> 应用数据库迁移（drizzle/*.sql 按序执行）"
for f in drizzle/*.sql; do
  [ -e "$f" ] || continue
  echo "   apply $f"
  npx wrangler d1 execute DB --remote --file="$f" --config "$CONFIG"
done

# 可选：设置 AI 密钥加密密钥（首次部署强烈建议）
if [ -n "${CLOUDFLARE_CONFIG_ENCRYPTION_KEY:-}" ]; then
  echo "==> 写入 CONFIG_ENCRYPTION_KEY 到 Worker secrets"
  printf '%s' "$CLOUDFLARE_CONFIG_ENCRYPTION_KEY" | npx wrangler secret put CONFIG_ENCRYPTION_KEY --config "$CONFIG"
else
  echo "ℹ️  未设置 CLOUDFLARE_CONFIG_ENCRYPTION_KEY，AI 密钥将使用开发兜底密钥加密。"
  echo "   建议（可选，生成 32 字节随机串并写入）:"
  echo "     openssl rand -base64 32 | npx wrangler secret put CONFIG_ENCRYPTION_KEY --config $CONFIG"
fi

echo "==> 部署到 Cloudflare Workers"
npx wrangler deploy --config "$CONFIG"

echo ""
echo "✅ 部署完成。Worker 地址形如 https://$WORKER_NAME.<你的子域>.workers.dev"
echo "   建议在 Cloudflare 后台绑定你自己的域名后，再同步到 iOS 配置："
echo "     CAP_SERVER_URL=https://你的域名 npm run cap:sync"