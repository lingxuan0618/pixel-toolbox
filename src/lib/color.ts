// 顏色運算助手 - HSL / HEX / RGB 互轉,搭配配色方案產生

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export function hexToRgb(hex: string): RGB | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i)
  if (!m) return null
  let s = m[1]
  if (s.length === 3) s = s.split('').map(c => c + c).join('')
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return '#' + h(Math.round(r)) + h(Math.round(g)) + h(Math.round(b))
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
      case gn: h = ((bn - rn) / d + 2); break
      case bn: h = ((rn - gn) / d + 4); break
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = ((h % 360) + 360) % 360 / 360
  const sn = Math.max(0, Math.min(1, s / 100))
  const ln = Math.max(0, Math.min(1, l / 100))
  if (sn === 0) {
    const v = Math.round(ln * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  }
}

export function shiftHue(hex: string, deg: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  hsl.h = (hsl.h + deg) % 360
  return rgbToHex(hslToRgb(hsl))
}

export function withLightness(hex: string, l: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  hsl.l = Math.max(0, Math.min(100, l))
  return rgbToHex(hslToRgb(hsl))
}

// === 配色方案 ===
export interface Scheme {
  name: string
  desc: string
  colors: string[]
}

export function generateSchemes(base: string): Scheme[] {
  return [
    {
      name: '補色',
      desc: '主色 + 180° 反色',
      colors: [base, shiftHue(base, 180)],
    },
    {
      name: '類比',
      desc: '色輪上左右各 30°',
      colors: [shiftHue(base, -30), base, shiftHue(base, 30)],
    },
    {
      name: '三角',
      desc: '色輪上 120° 等分',
      colors: [base, shiftHue(base, 120), shiftHue(base, 240)],
    },
    {
      name: '分裂補色',
      desc: '補色再左右各分 30°',
      colors: [base, shiftHue(base, 150), shiftHue(base, 210)],
    },
    {
      name: '四角',
      desc: '色輪上 90° 等分',
      colors: [base, shiftHue(base, 90), shiftHue(base, 180), shiftHue(base, 270)],
    },
    {
      name: '單色',
      desc: '同色相,不同明度',
      colors: [20, 35, 50, 65, 80].map(l => withLightness(base, l)),
    },
  ]
}

// === 從圖片萃取主色票 ===
export function extractPalette(
  imageData: ImageData,
  count = 6
): string[] {
  // 簡單直方圖量化:把每個 channel 切成 6 個 bucket(32 階)
  const buckets = new Map<string, number>()
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = Math.floor(data[i] / 32) * 32
    const g = Math.floor(data[i + 1] / 32) * 32
    const b = Math.floor(data[i + 2] / 32) * 32
    const key = `${r},${g},${b}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  // 排掉太接近的色(避免 5 色都是灰色)
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1])
  const result: RGB[] = []
  for (const [key] of sorted) {
    if (result.length >= count) break
    const [r, g, b] = key.split(',').map(Number)
    const tooClose = result.some(c =>
      Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b) < 50
    )
    if (!tooClose) result.push({ r, g, b })
  }
  return result.map(rgbToHex)
}
