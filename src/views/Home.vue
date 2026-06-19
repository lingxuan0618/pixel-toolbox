<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PixelCard from '../components/PixelCard.vue'
import PixelButton from '../components/PixelButton.vue'
import { isAndroid } from '../lib/platform'

interface Tool {
  icon: string
  name: string
  desc: string
  to?: string
  status: 'ready' | 'soon'
  hideOnPlatforms?: ('android' | 'ios')[]
}

const allTools: Tool[] = [
  { icon: '🧩', name: 'PDF 頁面整理', desc: '選頁、排序、合併一次完成', to: '/pdf-pages', status: 'ready' },
  { icon: '✏️', name: 'PDF 簽名', desc: '畫一畫蓋上去,馬上下載', to: '/pdf-sign', status: 'ready' },
  { icon: '🗂️', name: 'PDF 合併', desc: '多份 PDF 排序合併', to: '/pdf-merge', status: 'ready' },
  { icon: '✂️', name: 'PDF 拆分', desc: '選頁面,拆成新檔', to: '/pdf-split', status: 'ready' },
  { icon: '💧', name: 'PDF 加浮水印', desc: '文字 / 圖片,可拖可縮', to: '/pdf-watermark', status: 'ready' },
  { icon: '🖼️', name: 'PDF → 圖片', desc: '每頁變成 JPG / PNG', to: '/pdf-to-images', status: 'ready' },
  { icon: '📄', name: '圖片 → PDF', desc: '多張圖合成一份 PDF', to: '/images-to-pdf', status: 'ready' },
  { icon: '🍎', name: 'HEIC → JPG', desc: 'iPhone 照片一鍵變 JPG', to: '/heic-convert', status: 'ready', hideOnPlatforms: ['android'] },
  { icon: '🎨', name: '圖片格式互轉', desc: 'JPG ↔ PNG ↔ WebP', to: '/image-convert', status: 'ready' },
  { icon: '🗜️', name: '圖片壓縮', desc: '縮小檔案、保留品質', to: '/image-compress', status: 'ready' },
  { icon: '📐', name: '圖片裁切縮放', desc: '拖框裁切、旋轉、改尺寸', to: '/image-edit', status: 'ready' },
  { icon: '🎯', name: '圖片取色', desc: '萃取主要色票,點擊複製', to: '/image-colors', status: 'ready' },
  { icon: '🌈', name: '色票產生器', desc: '主色 → 6 種配色方案', to: '/palette', status: 'ready' },
  { icon: '📱', name: 'QR Code', desc: '即時產生,可下載 PNG/SVG', to: '/qr-code', status: 'ready' },
  { icon: '📰', name: 'HTML → PDF', desc: '貼 HTML,自動分頁產 PDF', to: '/html-to-pdf', status: 'ready' },
  { icon: '📝', name: 'Markdown → PDF', desc: '支援 GFM 表格、勾選框,可出 PDF/HTML', to: '/md-to-pdf', status: 'ready' },
]

const tools = computed(() =>
  allTools.filter((tool) => {
    if (tool.hideOnPlatforms?.includes('android') && isAndroid()) return false
    return true
  }),
)
</script>

<template>
  <div class="home">
    <header class="hero">
      <h1>✦ PIXEL TOOLBOX ✦</h1>
      <p class="tagline">100% 瀏覽器處理 · 不上傳</p>
    </header>

    <section class="tools">
      <div class="tool-grid">
        <component
          :is="tool.to ? RouterLink : 'div'"
          v-for="tool in tools"
          :key="tool.name"
          :to="tool.to"
          class="tool-link"
        >
          <PixelCard hoverable>
            <div class="tool-icon">{{ tool.icon }}</div>
            <h3>{{ tool.name }}</h3>
            <p class="tool-desc">{{ tool.desc }}</p>
            <PixelButton class="tool-btn" :disabled="tool.status === 'soon'" size="sm">
              {{ tool.status === 'soon' ? '即將推出' : '開始使用' }}
            </PixelButton>
          </PixelCard>
        </component>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 8px 0 16px;
}
.hero h1 {
  color: var(--accent);
  margin-bottom: 8px;
  font-size: 28px;
}
.tagline {
  color: var(--text-dim);
  font-size: 11px;
  margin: 0;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.tool-link {
  text-decoration: none;
  border-bottom: none;
  color: inherit;
}

.tool-icon {
  font-size: 40px;
  margin-bottom: 14px;
}

h3 {
  color: var(--text);
}
.tool-desc {
  color: var(--text-dim);
  font-size: 12px;
  min-height: 48px;
}

/* === 手機:緊湊兩欄,只留 icon + 名稱 === */
@media (max-width: 900px) {
  .hero h1 {
    font-size: 22px;
  }
  .tool-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .tool-icon {
    font-size: 38px;
    margin-bottom: 10px;
    text-align: center;
  }
  h3 {
    font-size: 13px;
    margin: 0;
    text-align: center;
  }
  .tool-desc {
    display: -webkit-box;
    font-size: 10px;
    min-height: 28px;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: center;
  }
  .tool-btn {
    width: 100%;
    margin-top: 10px;
  }
  /* 把卡片的內距調大一點，手機上看起來比較完整 */
  .tool-link :deep(.pixel-card-component) {
    padding: 20px 16px 18px;
    box-shadow: 4px 4px 0 0 var(--shadow);
  }
  .tool-link :deep(.pixel-card-component.hoverable:hover) {
    box-shadow: 6px 6px 0 0 var(--shadow);
  }
}

@media (max-width: 480px) {
  .hero h1 {
    font-size: 20px;
  }
  .tool-grid {
    grid-template-columns: 1fr;
  }
  .tool-link :deep(.pixel-card-component) {
    padding: 22px 16px 20px;
  }
  .tool-icon {
    font-size: 42px;
    margin-bottom: 12px;
  }
}
</style>
