// 生成 PWA 图标 — 用 SVG 写到 public/icons
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function makeSVG(size) {
  const r = Math.round(size * 0.22)  // corner radius
  const fontSize = Math.round(size * 0.42)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#0D0D0D"/>
  <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
    font-family="-apple-system, 'PingFang SC', sans-serif"
    font-size="${fontSize}" font-weight="700" fill="white">顾</text>
</svg>`
}

const sizes = [16, 32, 57, 72, 76, 114, 120, 144, 152, 180, 192, 512]
for (const s of sizes) {
  writeFileSync(join(outDir, `icon-${s}.svg`), makeSVG(s))
}
// favicon
writeFileSync(join(__dirname, '../public/favicon.svg'), makeSVG(32))
console.log('Icons generated:', sizes.map(s => `icon-${s}.svg`).join(', '))
