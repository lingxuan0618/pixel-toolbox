<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PixelCard from '../components/PixelCard.vue'
import PixelButton from '../components/PixelButton.vue'
import { isAndroid } from '../lib/platform'

interface Tool {
  badge: string
  name: string
  desc: string
  to?: string
  status: 'ready' | 'soon'
  hideOnPlatforms?: ('android' | 'ios')[]
}

const allTools: Tool[] = [
  {
    badge: 'PDF',
    name: 'PDF 頁面工具',
    desc: '合併、拆頁、重排、旋轉、刪除頁面後再匯出成新的 PDF。',
    to: '/pdf-pages',
    status: 'ready',
  },
  {
    badge: 'PDF',
    name: 'PDF 簽名',
    desc: '在 PDF 上加入手寫簽名、文字或標記。',
    to: '/pdf-sign',
    status: 'ready',
  },
  {
    badge: 'PDF',
    name: 'PDF 合併',
    desc: '把多個 PDF 合成一份，保留頁面順序。',
    to: '/pdf-merge',
    status: 'ready',
  },
  {
    badge: 'PDF',
    name: 'PDF 拆分',
    desc: '把 PDF 拆成單頁或指定頁段。',
    to: '/pdf-split',
    status: 'ready',
  },
  {
    badge: 'PDF',
    name: 'PDF 浮水印',
    desc: '替 PDF 加上文字或圖片浮水印。',
    to: '/pdf-watermark',
    status: 'ready',
  },
  {
    badge: 'PDF',
    name: 'PDF 轉圖片',
    desc: '把每一頁輸出成 JPG 或 PNG，適合預覽與分享。',
    to: '/pdf-to-images',
    status: 'ready',
  },
  {
    badge: 'IMG',
    name: '圖片轉 PDF',
    desc: '把多張圖片排成一份 PDF，方便列印與歸檔。',
    to: '/images-to-pdf',
    status: 'ready',
  },
  {
    badge: 'HEIC',
    name: 'HEIC 轉 JPG',
    desc: '把 iPhone 拍的 HEIC 轉成 JPG 或 PNG。',
    to: '/heic-convert',
    status: 'ready',
    hideOnPlatforms: ['android'],
  },
  {
    badge: 'IMG',
    name: '圖片格式轉換',
    desc: 'JPG、PNG、WebP 互轉，支援批次處理。',
    to: '/image-convert',
    status: 'ready',
  },
  {
    badge: 'IMG',
    name: '圖片壓縮',
    desc: '批次壓縮圖片，控制容量與尺寸。',
    to: '/image-compress',
    status: 'ready',
  },
  {
    badge: 'IMG',
    name: '圖片編輯',
    desc: '裁切、旋轉、調整大小，處理完直接下載。',
    to: '/image-edit',
    status: 'ready',
  },
  {
    badge: 'IMG',
    name: '圖片取色',
    desc: '從圖片抓出代表色與色碼。',
    to: '/image-colors',
    status: 'ready',
  },
  {
    badge: 'PALETTE',
    name: '色票產生器',
    desc: '建立與管理常用色盤，支援匯出 JSON 與 CSS。',
    to: '/palette',
    status: 'ready',
  },
  {
    badge: 'QR',
    name: 'QR Code',
    desc: '輸入文字或網址，快速產生 QR Code。',
    to: '/qr-code',
    status: 'ready',
  },
  {
    badge: 'HTML',
    name: 'HTML 轉 PDF',
    desc: '把 HTML 頁面輸出成可下載的 PDF。',
    to: '/html-to-pdf',
    status: 'ready',
  },
  {
    badge: 'MD',
    name: 'Markdown 轉 PDF / HTML',
    desc: '把 GitHub Flavored Markdown 轉成 PDF 或 HTML。',
    to: '/md-to-pdf',
    status: 'ready',
  },
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
      <h1>PIXEL TOOLBOX</h1>
      <p class="tagline">一組直接可用的 PDF 與圖片工具，全部在瀏覽器內完成。</p>
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
            <div class="tool-badge">{{ tool.badge }}</div>
            <h3>{{ tool.name }}</h3>
            <p class="tool-desc">{{ tool.desc }}</p>
            <PixelButton class="tool-btn" :disabled="tool.status === 'soon'" size="sm">
              {{ tool.status === 'soon' ? '即將推出' : '立即使用' }}
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

.tool-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 4px 8px;
  margin-bottom: 12px;
  border: 2px solid var(--border);
  background: var(--bg);
  color: var(--accent-2);
  font-size: 10px;
  letter-spacing: 0;
}

h3 {
  color: var(--text);
  margin: 0 0 8px;
}

.tool-desc {
  color: var(--text-dim);
  font-size: 11px;
  min-height: 36px;
}

@media (max-width: 900px) {
  .hero h1 {
    font-size: 22px;
  }

  .tool-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .tool-badge {
    margin-bottom: 10px;
  }

  h3 {
    font-size: 12px;
  }

  .tool-desc {
    display: none;
  }

  .tool-btn {
    width: 100%;
    margin-top: 10px;
  }

  .tool-link :deep(.pixel-card-component) {
    padding: 16px 12px;
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
    padding: 18px 14px;
  }
}
</style>
