<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'

const { theme, toggle } = useTheme()

const label = computed(() => (theme.value === 'light' ? 'LIGHT' : 'DARK'))
const icon = computed(() => (theme.value === 'light' ? '☀' : '☾'))
</script>

<template>
  <button
    class="theme-toggle"
    :title="`目前:${label}(點擊切換)`"
    @click="toggle"
  >
    <span class="icon">{{ icon }}</span>
    <span class="label">{{ label }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow:
    3px 0 0 0 var(--border),
    0 3px 0 0 var(--border),
    3px 3px 0 0 var(--border);
  transition:
    transform 0.06s ease-out,
    box-shadow 0.06s ease-out;
}
.theme-toggle:hover {
  transform: translate(1px, 1px);
  box-shadow:
    2px 0 0 0 var(--border),
    0 2px 0 0 var(--border),
    2px 2px 0 0 var(--border);
}
.theme-toggle:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}

.icon {
  font-size: 14px;
  color: var(--accent);
}
.label {
  font-weight: bold;
}
</style>
