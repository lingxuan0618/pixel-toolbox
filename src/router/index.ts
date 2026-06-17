import { createRouter, createWebHashHistory } from 'vue-router'
import { isAndroid } from '../lib/platform'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { title: 'Pixel Toolbox · 像素風線上工具箱' },
    },
    {
      path: '/pdf-sign',
      name: 'pdf-sign',
      component: () => import('../views/PdfSign.vue'),
      meta: { title: 'PDF 簽名 · Pixel Toolbox' },
    },
    {
      path: '/pdf-merge',
      name: 'pdf-merge',
      component: () => import('../views/PdfMerge.vue'),
      meta: { title: 'PDF 合併 · Pixel Toolbox' },
    },
    {
      path: '/pdf-split',
      name: 'pdf-split',
      component: () => import('../views/PdfSplit.vue'),
      meta: { title: 'PDF 拆分 · Pixel Toolbox' },
    },
    {
      path: '/pdf-watermark',
      name: 'pdf-watermark',
      component: () => import('../views/PdfWatermark.vue'),
      meta: { title: 'PDF 加浮水印 · Pixel Toolbox' },
    },
    {
      path: '/pdf-to-images',
      name: 'pdf-to-images',
      component: () => import('../views/PdfToImages.vue'),
      meta: { title: 'PDF → 圖片 · Pixel Toolbox' },
    },
    {
      path: '/images-to-pdf',
      name: 'images-to-pdf',
      component: () => import('../views/ImagesToPdf.vue'),
      meta: { title: '圖片 → PDF · Pixel Toolbox' },
    },
    {
      path: '/heic-convert',
      name: 'heic-convert',
      component: () => import('../views/HeicConvert.vue'),
      meta: { title: 'HEIC → JPG · Pixel Toolbox' },
      beforeEnter: () => {
        if (isAndroid()) return '/'
      },
    },
    {
      path: '/image-convert',
      name: 'image-convert',
      component: () => import('../views/ImageConvert.vue'),
      meta: { title: '圖片格式互轉 · Pixel Toolbox' },
    },
    {
      path: '/image-compress',
      name: 'image-compress',
      component: () => import('../views/ImageCompress.vue'),
      meta: { title: '圖片壓縮 · Pixel Toolbox' },
    },
    {
      path: '/html-to-pdf',
      name: 'html-to-pdf',
      component: () => import('../views/HtmlToPdf.vue'),
      meta: { title: 'HTML → PDF · Pixel Toolbox' },
    },
    {
      path: '/md-to-pdf',
      name: 'md-to-pdf',
      component: () => import('../views/MarkdownToPdf.vue'),
      meta: { title: 'Markdown → PDF / HTML · Pixel Toolbox' },
    },
    {
      path: '/pdf-pages',
      name: 'pdf-pages',
      component: () => import('../views/PdfPages.vue'),
      meta: { title: 'PDF 頁面管理 · Pixel Toolbox' },
    },
    {
      path: '/image-colors',
      name: 'image-colors',
      component: () => import('../views/ImageColors.vue'),
      meta: { title: '圖片取色 · Pixel Toolbox' },
    },
    {
      path: '/image-edit',
      name: 'image-edit',
      component: () => import('../views/ImageEdit.vue'),
      meta: { title: '圖片裁切縮放 · Pixel Toolbox' },
    },
    {
      path: '/palette',
      name: 'palette',
      component: () => import('../views/Palette.vue'),
      meta: { title: '色票產生器 · Pixel Toolbox' },
    },
    {
      path: '/qr-code',
      name: 'qr-code',
      component: () => import('../views/QrCode.vue'),
      meta: { title: 'QR Code · Pixel Toolbox' },
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
  const t = to.meta.title
  if (typeof t === 'string') document.title = t
})
