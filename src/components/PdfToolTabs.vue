<script setup lang="ts">
import { RouterLink } from 'vue-router'

type Tab = {
  icon: string
  label: string
  to: string
}

defineProps<{
  current: string
}>()

const tabs: Tab[] = [
  { icon: '🧩', label: 'PDF 頁面管理', to: '/pdf-pages' },
  { icon: '✍️', label: 'PDF 簽名', to: '/pdf-sign' },
  { icon: '🗂️', label: 'PDF 合併', to: '/pdf-merge' },
  { icon: '✂️', label: 'PDF 拆分', to: '/pdf-split' },
  { icon: '💧', label: 'PDF 浮水印', to: '/pdf-watermark' },
  { icon: '🖼️', label: 'PDF 轉圖片', to: '/pdf-to-images' },
]
</script>

<template>
  <nav class="pdf-tabs" aria-label="PDF 工具分頁">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="pdf-tab"
      :class="{ active: current === tab.to }"
      :title="tab.label"
      :aria-label="tab.label"
    >
      <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      <span class="sr-only">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.pdf-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.pdf-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  box-shadow: 3px 3px 0 0 var(--shadow);
  border-bottom: none;
  text-decoration: none;
  font-size: 22px;
  line-height: 1;
  flex: 0 0 auto;
}

.pdf-tab.active {
  background: var(--accent);
  color: var(--bg);
}

.tab-icon {
  display: block;
  transform: translateY(-1px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .pdf-tab {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}
</style>
