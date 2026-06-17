<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  icon?: string
  description?: string
}>()
</script>

<template>
  <article class="tool-layout">
    <header class="tool-header">
      <RouterLink to="/" class="back-link" title="回首頁">
        <span class="arrow">◄</span>
        <span>HOME</span>
      </RouterLink>
      <div class="title-block">
        <span v-if="icon" class="tool-icon">{{ icon }}</span>
        <h1>{{ title }}</h1>
      </div>
      <p v-if="description" class="tool-desc">{{ description }}</p>
    </header>

    <section class="tool-body">
      <slot />
    </section>
  </article>
</template>

<style scoped>
.tool-layout {
  max-width: 960px;
  margin: 0 auto;
}

.tool-header {
  margin-bottom: 32px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-dim);
  border-bottom: none;
  margin-bottom: 24px;
}
.back-link:hover {
  color: var(--accent);
}
.back-link .arrow {
  font-size: 14px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 16px;
}
.tool-icon {
  font-size: 36px;
}
.tool-header h1 {
  margin: 0;
  color: var(--accent);
  font-size: 22px;
}

.tool-desc {
  margin: 12px 0 0;
  color: var(--text-dim);
  font-size: 11px;
}

.tool-body {
  margin-top: 16px;
}
</style>
