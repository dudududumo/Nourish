from PIL import Image

SRC = "/Users/dsm/Documents/Codex/2026-08-28/ni/work/nourish-os/assets/icon-source.jpg"
OUT_ICON = "/Users/dsm/Documents/Codex/2026-08-28/ni/work/nourish-os/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SPLASH_DIR = "/Users/dsm/Documents/Codex/2026-08-28/ni/work/nourish-os/ios/App/App/Assets.xcassets/Splash.imageset/"

img = Image.open(SRC).convert("RGB")
w, h = img.size

# 1. 覆盖右下角水印：把 x>=1455, y>=1800 区域用同列 y=1780 的背景色向下填充
pix = img.load()
x0, y0, ref_y = 1455, 1800, 1780
for y in range(y0, h):
    for x in range(x0, w):
        pix[x, y] = pix[x, ref_y]

# 2. 主图标 1024x1024 PNG
icon = img.resize((1024, 1024), Image.LANCZOS)
icon.save(OUT_ICON)
print("icon saved:", OUT_ICON)

# 3. 启动图 2732x2732：苔绿渐变背景 + 居中主图标
S = 2732
top = (124, 170, 134)
bottom = (88, 122, 96)
splash = Image.new("RGB", (S, S))
dp = splash.load()
for y in range(S):
    t = y / (S - 1)
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    for x in range(S):
        dp[x, y] = (r, g, b)

mark = icon.resize((820, 820), Image.LANCZOS)
off = (S - 820) // 2
splash.paste(mark, (off, off))

for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    splash.save(SPLASH_DIR + name)
    print("splash saved:", name)