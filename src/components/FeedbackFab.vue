<script setup lang="ts">
import { useFeedback } from '../composables/useFeedback'

const { openModal } = useFeedback()
</script>

<template>
  <button
    type="button"
    class="fab"
    title="留個回饋 / 建議(會跳到 GitHub)"
    aria-label="留回饋"
    @click="openModal"
  >
    <span class="fab-icon">💬</span>
    <span class="fab-label">回饋</span>
  </button>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 900;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: var(--accent);
  color: var(--bg);
  border: 3px solid var(--border);
  font-family: inherit;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  box-shadow:
    4px 0 0 0 var(--border),
    0 4px 0 0 var(--border),
    4px 4px 0 0 var(--border);
  transition:
    transform 0.06s ease-out,
    box-shadow 0.06s ease-out;
  /* 在手機上稍微縮小 + 留安全區 */
  margin-bottom: env(safe-area-inset-bottom, 0);
}
.fab:hover {
  transform: translate(2px, 2px);
  box-shadow:
    2px 0 0 0 var(--border),
    0 2px 0 0 var(--border),
    2px 2px 0 0 var(--border);
}
.fab:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
.fab-icon {
  font-size: 14px;
}

@media (max-width: 480px) {
  .fab {
    right: 12px;
    bottom: 12px;
    padding: 10px 12px;
    font-size: 11px;
  }
  .fab-label {
    display: none;
  }
  .fab-icon {
    font-size: 18px;
  }
}
</style>
