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
        title: 'Pixel Toolbox',
        description: '一組直接在瀏覽器內使用的 PDF 與圖片工具。',
      },
    },
    {
      path: '/pdf-pages',
      name: 'pdf-pages',
      component: () => import('../views/PdfPages.vue'),
      meta: {
        title: 'PDF 頁面工具 - Pixel Toolbox',
        description: '合併、拆頁、調整順序、旋轉與刪除 PDF 頁面後再匯出。',
      },
    },
    {
      path: '/pdf-sign',
      name: 'pdf-sign',
      component: () => import('../views/PdfSign.vue'),
      meta: {
        title: 'PDF 簽名 - Pixel Toolbox',
        description: '在 PDF 上加入簽名、文字或標記。',
      },
    },
    {
      path: '/pdf-merge',
      name: 'pdf-merge',
      component: () => import('../views/PdfMerge.vue'),
      meta: {
        title: 'PDF 合併 - Pixel Toolbox',
        description: '把多個 PDF 合成一份，保留頁面順序。',
      },
    },
    {
      path: '/pdf-split',
      name: 'pdf-split',
      component: () => import('../views/PdfSplit.vue'),
      meta: {
        title: 'PDF 拆分 - Pixel Toolbox',
        description: '將 PDF 拆成單頁或指定頁段。',
      },
    },
    {
      path: '/pdf-watermark',
      name: 'pdf-watermark',
      component: () => import('../views/PdfWatermark.vue'),
      meta: {
        title: 'PDF 浮水印 - Pixel Toolbox',
        description: '替 PDF 加上文字或圖片浮水印。',
      },
    },
    {
      path: '/pdf-to-images',
      name: 'pdf-to-images',
      component: () => import('../views/PdfToImages.vue'),
      meta: {
        title: 'PDF 轉圖片 - Pixel Toolbox',
        description: '把 PDF 每一頁輸出成 JPG 或 PNG，支援解析度與批次下載。',
      },
    },
    {
      path: '/images-to-pdf',
      name: 'images-to-pdf',
      component: () => import('../views/ImagesToPdf.vue'),
      meta: {
        title: '圖片轉 PDF - Pixel Toolbox',
        description: '把多張圖片排成一份 PDF，方便列印與歸檔。',
      },
    },
    {
      path: '/heic-convert',
      name: 'heic-convert',
      component: () => import('../views/HeicConvert.vue'),
      meta: {
        title: 'HEIC 轉 JPG - Pixel Toolbox',
        description: '把 iPhone 拍的 HEIC 轉成 JPG 或 PNG。',
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
        title: '圖片格式轉換 - Pixel Toolbox',
        description: 'JPG、PNG、WebP 互轉，支援批次處理。',
      },
    },
    {
      path: '/image-compress',
      name: 'image-compress',
      component: () => import('../views/ImageCompress.vue'),
      meta: {
        title: '圖片壓縮 - Pixel Toolbox',
        description: '批次壓縮圖片，控制容量與尺寸。',
      },
    },
    {
      path: '/html-to-pdf',
      name: 'html-to-pdf',
      component: () => import('../views/HtmlToPdf.vue'),
      meta: {
        title: 'HTML 轉 PDF - Pixel Toolbox',
        description: '把 HTML 頁面輸出成可下載的 PDF。',
      },
    },
    {
      path: '/md-to-pdf',
      name: 'md-to-pdf',
      component: () => import('../views/MarkdownToPdf.vue'),
      meta: {
        title: 'Markdown 轉 PDF / HTML - Pixel Toolbox',
        description: '把 GitHub Flavored Markdown 轉成 PDF 或 HTML。',
      },
    },
    {
      path: '/image-colors',
      name: 'image-colors',
      component: () => import('../views/ImageColors.vue'),
      meta: {
        title: '圖片取色 - Pixel Toolbox',
        description: '從圖片抓出代表色與色碼。',
      },
    },
    {
      path: '/image-edit',
      name: 'image-edit',
      component: () => import('../views/ImageEdit.vue'),
      meta: {
        title: '圖片編輯 - Pixel Toolbox',
        description: '裁切、旋轉、調整大小，處理完直接下載。',
      },
    },
    {
      path: '/palette',
      name: 'palette',
      component: () => import('../views/Palette.vue'),
      meta: {
        title: '色票產生器 - Pixel Toolbox',
        description: '建立與管理常用色盤，支援匯出 JSON 與 CSS。',
      },
    },
    {
      path: '/qr-code',
      name: 'qr-code',
      component: () => import('../views/QrCode.vue'),
      meta: {
        title: 'QR Code - Pixel Toolbox',
        description: '輸入文字或網址，快速產生 QR Code。',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Pixel Toolbox'
  const description =
    typeof to.meta.description === 'string'
      ? to.meta.description
      : '一組直接在瀏覽器內使用的 PDF 與圖片工具。'

  applySeo({
    title,
    description,
    path: to.path,
  })
})
