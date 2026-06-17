# ✦ Pixel Toolbox ✦

> 像素風線上工具箱 · 100% 在你的瀏覽器處理 · 不上傳

![Vue](https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

一個視覺風格走 **8-bit 復古像素風** 的線上工具集合,主打:

- 🔒 **隱私第一** — 所有檔案處理都在你的瀏覽器,**不會傳到任何伺服器**
- 🎮 **像素美學** — 16 色復古調色盤、繁中像素字型 Cubic 11、NES 風格的「凸起」按鈕
- 📱 **手機友善** — 響應式設計,觸控操作 OK
- 🌗 **深淺色切換** — Light / Dark(首次造訪會跟隨系統,之後記住偏好)

---

## 🛠️ 內含工具(16 個)

### PDF
| 圖示 | 工具 | 功能 |
|------|------|------|
| ✏️ | PDF 簽名 | 手寫 / 上傳圖片簽名,拖曳到位、拉角縮放,可下載簽名重複用 |
| 🗂️ | PDF 合併 | 多份 PDF 拖曳上傳 + 排序,首頁縮圖預覽 |
| ✂️ | PDF 拆分 | 點縮圖切換選取,範圍語法自動互轉 |
| 🔄 | PDF 頁面管理 | 旋轉、刪除、拖曳排序 |
| 💧 | PDF 加浮水印 | 文字 / 圖片,拖移、縮放、旋轉、即時預覽全有 |
| 🖼️ | PDF → 圖片 | 每頁變成 JPG / PNG,可批次 ZIP |
| 📄 | 圖片 → PDF | 多張圖合成一份 PDF,可選紙張尺寸 |
| 📰 | HTML → PDF | 貼 HTML + CSS,自動分頁產 PDF |
| 📝 | Markdown → PDF/HTML | GFM 表格、勾選框,可出 PDF 或 HTML |

### 圖片
| 圖示 | 工具 | 功能 |
|------|------|------|
| 📐 | 圖片裁切縮放 | 拖框裁切、90° 旋轉、改尺寸 |
| 🗜️ | 圖片壓縮 | 縮小檔案、保留品質 |
| 🎨 | 圖片格式互轉 | JPG ↔ PNG ↔ WebP |
| 🍎 | HEIC → JPG/PNG | iPhone 照片一鍵變 JPG |
| 🎯 | 圖片取色 | 自動萃取 + 點圖任意點取色 |

### 雜項
| 圖示 | 工具 | 功能 |
|------|------|------|
| 🌈 | 色票產生器 | 主色 → 6 種配色方案,可下載 CSS / JSON |
| 📱 | QR Code 產生器 | 即時產生,可下載 PNG / SVG |

---

## 🚀 在本機跑

需要 [Node.js](https://nodejs.org/) 20+ 跟 npm。

```bash
# 1. 裝套件
npm install

# 2. 啟動 dev server
npm run dev
# → http://localhost:5817/

# 3. 打包正式版
npm run build

# 4. 預覽正式版
npm run preview
```

---

## 🧱 技術棧

| 類別 | 用了什麼 |
|------|----------|
| 框架 | Vue 3 + TypeScript |
| 打包 | Vite 6 |
| 路由 | Vue Router 4 |
| PDF 處理 | [pdf-lib](https://pdf-lib.js.org/) + [PDF.js](https://mozilla.github.io/pdf.js/) |
| HEIC 解碼 | [heic2any](https://alexcorvi.github.io/heic2any/) |
| 圖片壓縮 | [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) |
| QR Code | [node-qrcode](https://github.com/soldair/node-qrcode) |
| HTML → PDF | [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) |
| Markdown | [marked](https://marked.js.org/) |
| 打包多檔下載 | [JSZip](https://stuk.github.io/jszip/) |
| 像素字型 | [Cubic 11](https://github.com/ACh-K/Cubic-11)(繁中)+ Press Start 2P(英文) |

---

## 🎨 設計

- 配色:16 色復古調色盤,**藍 / 黃 / 綠** 為主色
- 字型:
  - 英文 / 數字 → Press Start 2P(8-bit 字體)
  - 中文 → Cubic 11(像素風繁中字型)
- UI 規則:無圓角、無漸層、粗邊框、實心 box-shadow 模擬「凸起」感

---

## 📁 專案結構

```
pixel-toolbox/
├── public/                       # 靜態資源(favicon)
├── src/
│   ├── assets/
│   │   └── logo.png              # 個人 logo
│   ├── components/
│   │   ├── PixelButton.vue       # 像素風按鈕(共用)
│   │   ├── PixelCard.vue         # 像素風卡片(共用)
│   │   ├── ThemeToggle.vue       # 深淺色切換
│   │   ├── ToolLayout.vue        # 每個工具頁共用版型
│   │   ├── AppFooter.vue
│   │   ├── FeedbackFab.vue       # 浮動回饋按鈕
│   │   └── FeedbackModal.vue     # 回饋表單(會跳到 GitHub Issues)
│   ├── composables/
│   │   ├── useTheme.ts           # 深淺色狀態管理
│   │   └── useFeedback.ts        # 回饋 modal 共用狀態
│   ├── lib/
│   │   ├── color.ts              # HSL/HEX 轉換、配色方案、取色演算法
│   │   ├── download.ts           # 下載 Blob 助手
│   │   ├── pdfjs.ts              # PDF.js worker 設定
│   │   └── platform.ts           # 平台偵測(隱藏 Android 不需要的工具)
│   ├── router/
│   │   └── index.ts
│   ├── views/                    # 每個工具一頁
│   │   ├── Home.vue
│   │   ├── PdfSign.vue           # ✏️ PDF 簽名
│   │   ├── PdfMerge.vue          # 🗂 PDF 合併
│   │   ├── PdfSplit.vue          # ✂️ PDF 拆分
│   │   ├── PdfPages.vue          # 🔄 PDF 頁面管理
│   │   ├── PdfWatermark.vue      # 💧 PDF 加浮水印
│   │   ├── PdfToImages.vue       # 🖼 PDF → 圖片
│   │   ├── ImagesToPdf.vue       # 📄 圖片 → PDF
│   │   ├── HtmlToPdf.vue         # 📰 HTML → PDF
│   │   ├── MarkdownToPdf.vue     # 📝 Markdown → PDF/HTML
│   │   ├── ImageEdit.vue         # 📐 圖片裁切縮放
│   │   ├── ImageCompress.vue     # 🗜 圖片壓縮
│   │   ├── ImageConvert.vue      # 🎨 圖片格式互轉
│   │   ├── HeicConvert.vue       # 🍎 HEIC → JPG/PNG
│   │   ├── ImageColors.vue       # 🎯 圖片取色
│   │   ├── Palette.vue           # 🌈 色票產生器
│   │   └── QrCode.vue            # 📱 QR Code 產生
│   ├── App.vue
│   ├── config.ts                 # 修改 GitHub repo 名稱在這
│   ├── main.ts
│   └── style.css                 # 全域樣式 + 16 色調色盤
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔒 隱私說明

這個網站**不會把任何檔案傳到任何伺服器**:

- 所有 PDF / 圖片處理都在你的瀏覽器內進行(透過 `pdf-lib`、PDF.js、Canvas API)
- 沒有 analytics、沒有追蹤腳本
- 唯一會連外的東西:
  - Google Fonts(Press Start 2P 字型)
  - jsDelivr CDN(Cubic 11 字型)

如果連這兩個你都不想要,可以把字型下載到 `public/fonts/` 並改 `style.css` 的 `@font-face` 路徑。

---

## 📄 授權

[MIT](./LICENSE) © Xuan

---

## 🙏 Credits

字型(均為開源 [SIL Open Font License 1.1](https://scripts.sil.org/OFL))
- [Cubic 11(方塊宋)](https://github.com/ACh-K/Cubic-11) by [@ACh-K](https://github.com/ACh-K) — 繁體中文像素字型
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by codeman38 — 英文 8-bit 字型

所有 PDF、圖片、HEIC、Markdown、QR Code、html2pdf、JSZip 等開源套件作者見上方「技術棧」表格的連結。

---

## 💭 為什麼做這個

常常要轉檔、簽 PDF、壓縮圖片,每次都得 Google「ilovepdf」、「heictojpg」、「qrcode generator」,
每個網站還都長不一樣、有廣告、有上傳限制 ——
不如把常用的全部集中到一個地方,順便:

- 練 Vue 3 + TypeScript
- 試試純前端 PDF 處理(意外地強大)
- 玩 8-bit 像素風設計

---

