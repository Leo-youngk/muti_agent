// 生成 PWA 图标 — 用 sharp 把 SVG 光栅化为 PNG 写到 public/icons
// iOS 会忽略 SVG 的 apple-touch-icon，主屏图标必须是 PNG，否则回退成页面截图。
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('缺少 sharp 依赖，无法生成 PNG 图标。请先 `npm i -D sharp` 再运行。')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function makeSVG(size) {
  const r = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.42)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#0D0D0D"/>
  <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
    font-family="-apple-system, 'PingFang SC', sans-serif"
    font-size="${fontSize}" font-weight="700" fill="white">讨</text>
</svg>`
}

const sizes = [16, 32, 57, 72, 76, 114, 120, 144, 152, 180, 192, 512]

for (const s of sizes) {
  const png = await sharp(Buffer.from(makeSVG(s))).png().toBuffer()
  writeFileSync(join(outDir, `icon-${s}.png`), png)
}

// favicon 保留 SVG（桌面浏览器支持良好）
writeFileSync(join(__dirname, '../public/favicon.svg'), makeSVG(32))

console.log('Icons generated (PNG):', sizes.map(s => `icon-${s}.png`).join(', '))
