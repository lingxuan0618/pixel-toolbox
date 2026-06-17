<script setup lang="ts">
import { useToast, type Toast } from '../composables/useToast'

const { toasts } = useToast()

function iconFor(t: Toast): string {
  if (t.type === 'error') return '✕'
  if (t.type === 'info') return 'ℹ'
  return '✓'
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast" tag="div" class="stack-inner">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`type-${t.type}`"
        >
          <span class="icon">{{ iconFor(t) }}</span>
          <span class="message">{{ t.message }}</span>
          <!-- 環繞的像素星星 -->
          <span class="sparkles" aria-hidden="true">
            <span class="sparkle s1">✦</span>
            <span class="sparkle s2">✧</span>
            <span class="sparkle s3">⋆</span>
            <span class="sparkle s4">✦</span>
            <span class="sparkle s5">✧</span>
            <span class="sparkle s6">⋆</span>
          </span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 96px;          /* 在 FAB 上面 */
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 999;
  pointer-events: none;
}
.stack-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  pointer-events: none;
}
.toast {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  font-family: inherit;
  font-size: 13px;
  font-weight: bold;
  color: var(--bg);
  background: var(--success);
  border: 3px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--border);
  pointer-events: auto;
  max-width: 92vw;
}
.toast.type-error {
  background: var(--danger);
  color: var(--p8-white);
}
.toast.type-info {
  background: var(--accent);
  color: var(--bg);
}

.icon {
  font-size: 18px;
  flex-shrink: 0;
}
.message {
  word-break: break-all;
}

/* 星星裝飾 */
.sparkles {
  position: absolute;
  inset: -20px;
  pointer-events: none;
}
.sparkle {
  position: absolute;
  font-size: 18px;
  color: var(--highlight);
  opacity: 0;
  text-shadow: 0 0 6px var(--highlight);
  animation: sparkle 1.4s ease-out;
}
.sparkle.s1 { top: -8px;  left:  8%; animation-delay: 0.05s; }
.sparkle.s2 { top: -14px; left: 30%; animation-delay: 0.25s; }
.sparkle.s3 { top: -6px;  right: 25%; animation-delay: 0.15s; }
.sparkle.s4 { bottom: -10px; left: 18%; animation-delay: 0.35s; }
.sparkle.s5 { bottom: -14px; right: 12%; animation-delay: 0.45s; }
.sparkle.s6 { bottom: -6px;  right: 38%; animation-delay: 0.55s; }

@keyframes sparkle {
  0%   { opacity: 0; transform: scale(0)   rotate(0deg); }
  30%  { opacity: 1; transform: scale(1.4) rotate(180deg); }
  70%  { opacity: 1; transform: scale(1)   rotate(270deg); }
  100% { opacity: 0; transform: scale(0.4) rotate(360deg); }
}

/* Vue 進場 / 退場 transition */
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.9);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
}

@media (max-width: 480px) {
  .toast-stack {
    bottom: 80px;
  }
  .toast {
    font-size: 12px;
    padding: 10px 16px;
    box-shadow: 4px 4px 0 0 var(--border);
  }
}
</style>
