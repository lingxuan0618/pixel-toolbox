import { createRouter, createWebHistory } from 'vue-router'
import { isAndroid } from '../lib/platform'
import { applySeo } from '../lib/seo'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: {
        title: 'Pixel Toolbox · 像素風線上工具箱',
        description: 'Pixel Toolbox 是一個全離線的像素風線上工具箱，提供 PDF、圖片、HEIC、QR Code 與色票等常用工具。',
      },
    },
    {
      path: '/pdf-sign',
      name: 'pdf-sign',
      component: () => import('../views/PdfSign.vue'),
      meta: {
        title: 'PDF 簽名 · Pixel Toolbox',
        description: '在瀏覽器內手寫或上傳圖片簽名，拖曳、縮放後直接套用到 PDF。',
      },
    },
    {
      path: '/pdf-merge',
      name: 'pdf-merge',
      component: () => import('../views/PdfMerge.vue'),
      meta: {
        title: 'PDF 合併 · Pixel Toolbox',
        description: '把多份 PDF 排序後合併成單一檔案，完全在本機完成。',
      },
    },
    {
      path: '/pdf-split',
      name: 'pdf-split',
      component: () => import('../views/PdfSplit.vue'),
      meta: {
        title: 'PDF 拆分 · Pixel Toolbox',
        description: '依頁碼範圍拆分 PDF，只保留你要的頁面並輸出新檔。',
      },
    },
    {
      path: '/pdf-watermark',
      name: 'pdf-watermark',
      component: () => import('../views/PdfWatermark.vue'),
      meta: {
        title: 'PDF 加浮水印 · Pixel Toolbox',
        description: '替 PDF 加上文字或圖片浮水印，支援拖移、旋轉與縮放。',
      },
    },
    {
      path: '/pdf-to-images',
      name: 'pdf-to-images',
      component: () => import('../views/PdfToImages.vue'),
      meta: {
        title: 'PDF → 圖片 · Pixel Toolbox',
        description: '把 PDF 每一頁轉成圖片，支援格式、解析度與批次下載。',
      },
    },
    {
      path: '/images-to-pdf',
      name: 'images-to-pdf',
      component: () => import('../views/ImagesToPdf.vue'),
      meta: {
        title: '圖片 → PDF · Pixel Toolbox',
        description: '把多張圖片合成一份 PDF，順序可調整，輸出完全在本機完成。',
      },
    },
    {
      path: '/heic-convert',
      name: 'heic-convert',
      component: () => import('../views/HeicConvert.vue'),
      meta: {
        title: 'HEIC → JPG · Pixel Toolbox',
        description: '把 iPhone 拍的 HEIC 批次轉成 JPG 或 PNG，完全離線。',
      },
      beforeEnter: () => {
        if (isAndroid()) return '/'
      },
    },
    {
      path: '/image-convert',
      name: 'image-convert',
      component: () => import('../views/ImageConvert.vue'),
      meta: {
        title: '圖片格式互轉 · Pixel Toolbox',
        description: 'JPG、PNG、WebP 互相轉換，支援批次處理與品質控制。',
      },
    },
    {
      path: '/image-compress',
      name: 'image-compress',
      component: () => import('../views/ImageCompress.vue'),
      meta: {
        title: '圖片壓縮 · Pixel Toolbox',
        description: '把圖片壓到更小的檔案大小，同時保留可看的品質。',
      },
    },
    {
      path: '/html-to-pdf',
      name: 'html-to-pdf',
      component: () => import('../views/HtmlToPdf.vue'),
      meta: {
        title: 'HTML → PDF · Pixel Toolbox',
        description: '貼上 HTML 與 CSS，自動分頁後輸出成 PDF。',
      },
    },
    {
      path: '/md-to-pdf',
      name: 'md-to-pdf',
      component: () => import('../views/MarkdownToPdf.vue'),
      meta: {
        title: 'Markdown → PDF / HTML · Pixel Toolbox',
        description: '支援 GitHub 風格 Markdown，能轉成 PDF 或 HTML。',
      },
    },
    {
      path: '/pdf-pages',
      name: 'pdf-pages',
      component: () => import('../views/PdfPages.vue'),
      meta: {
        title: 'PDF 頁面管理 · Pixel Toolbox',
        description: '拖曳排序、旋轉、刪除 PDF 頁面，一次整理完成。',
      },
    },
    {
      path: '/image-colors',
      name: 'image-colors',
      component: () => import('../views/ImageColors.vue'),
      meta: {
        title: '圖片取色 · Pixel Toolbox',
        description: '從圖片萃取色票，或直接點圖選出任意顏色。',
      },
    },
    {
      path: '/image-edit',
      name: 'image-edit',
      component: () => import('../views/ImageEdit.vue'),
      meta: {
        title: '圖片裁切縮放 · Pixel Toolbox',
        description: '拖裁切框、調尺寸、轉方向，再輸出 PNG、JPG 或 WebP。',
      },
    },
    {
      path: '/palette',
      name: 'palette',
      component: () => import('../views/Palette.vue'),
      meta: {
        title: '色票產生器 · Pixel Toolbox',
        description: '輸入主色後自動產生六組配色，可下載 CSS 或 JSON。',
      },
    },
    {
      path: '/qr-code',
      name: 'qr-code',
      component: () => import('../views/QrCode.vue'),
      meta: {
        title: 'QR Code · Pixel Toolbox',
        description: '輸入文字或網址即時產生 QR Code，可下載 PNG 或 SVG。',
      },
    },
    // 404 — 重新導向回首頁
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach(to => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Pixel Toolbox · 像素風線上工具箱'
  const description =
    typeof to.meta.description === 'string'
      ? to.meta.description
      : 'Pixel Toolbox 是一個全離線的像素風線上工具箱。'

  applySeo({
    title,
    description,
    path: to.path,
  })
})
