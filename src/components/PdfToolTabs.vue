<script setup lang="ts">
import { RouterLink } from 'vue-router'

type Tab = {
  label: string
  to: string
}

defineProps<{
  current: string
}>()

const tabs: Tab[] = [
  { label: '工作台', to: '/pdf-pages' },
  { label: '合併', to: '/pdf-merge' },
  { label: '拆分', to: '/pdf-split' },
  { label: '浮水印', to: '/pdf-watermark' },
  { label: '轉圖片', to: '/pdf-to-images' },
]
</script>

<template>
  <nav class="pdf-tabs" aria-label="PDF 工具導覽">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="pdf-tab"
      :class="{ active: current === tab.to }"
    >
      {{ tab.label }}
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
  min-height: 38px;
  padding: 8px 12px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  box-shadow: 3px 3px 0 0 var(--shadow);
  border-bottom: none;
  font-size: 11px;
  text-decoration: none;
}

.pdf-tab.active {
  background: var(--accent);
  color: var(--bg);
}

@media (max-width: 640px) {
  .pdf-tab {
    flex: 1 1 calc(50% - 8px);
  }
}
</style>
