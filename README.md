# Pixel Toolbox

一個純前端的 PDF 與圖片工具箱，所有處理都在瀏覽器內完成。

## 功能

- PDF 頁面工具：合併、拆分、重排、旋轉、刪除後匯出
- PDF 合併
- PDF 拆分
- PDF 浮水印
- PDF 轉圖片
- 圖片轉 PDF
- HEIC 轉 JPG / PNG
- 圖片格式轉換
- 圖片壓縮
- 圖片編輯
- 圖片取色
- 色票產生器
- QR Code 產生器
- HTML 轉 PDF
- Markdown 轉 PDF / HTML

## 本機執行

需求：

- Node.js 20 以上
- npm

安裝與啟動：

```bash
npm install
npm run dev
```

預設開發位址通常是 `http://localhost:5173/`。

## 建置

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

這個專案是靜態網站，適合直接部署到 GitHub Pages。

1. 在 GitHub 建立 repo
2. 把專案推上去
3. 使用 GitHub Actions 建置 `dist`
4. 將 Pages 的來源指向 GitHub Actions

如果你要部署在子路徑，例如 `https://username.github.io/pixel-toolbox/`，記得同步確認 `vite.config.ts` 的 base 設定。

## 技術

- Vue 3
- TypeScript
- Vite
- Vue Router
- pdf-lib
- PDF.js
- browser-image-compression
- heic2any
- JSZip
- html2pdf.js
- marked

## 授權

MIT
