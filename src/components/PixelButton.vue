<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <button
    class="pixel-button"
    :class="[`v-${variant ?? 'primary'}`, `s-${size ?? 'md'}`]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.pixel-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  font-family: inherit;
  letter-spacing: 0.5px;
  cursor: pointer;
  text-transform: uppercase;
  transition:
    transform 0.06s ease-out,
    box-shadow 0.06s ease-out;
}

.pixel-button:hover:not(:disabled) {
  transform: translate(2px, 2px);
}
.pixel-button:active:not(:disabled) {
  transform: translate(4px, 4px);
  box-shadow: none !important;
}
.pixel-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 尺寸 */
.pixel-button.s-sm {
  padding: 8px 14px;
  font-size: 10px;
}
.pixel-button.s-md {
  padding: 12px 20px;
  font-size: 12px;
}
.pixel-button.s-lg {
  padding: 16px 28px;
  font-size: 14px;
}

/* 顏色 */
.pixel-button.v-primary {
  background: var(--accent);
  color: var(--bg);
  box-shadow:
    4px 0 0 0 var(--border),
    0 4px 0 0 var(--border),
    4px 4px 0 0 var(--border);
}
.pixel-button.v-primary:hover:not(:disabled) {
  box-shadow:
    2px 0 0 0 var(--border),
    0 2px 0 0 var(--border),
    2px 2px 0 0 var(--border);
}

.pixel-button.v-secondary {
  background: var(--surface);
  color: var(--text);
  box-shadow:
    4px 0 0 0 var(--border),
    0 4px 0 0 var(--border),
    4px 4px 0 0 var(--border);
}
.pixel-button.v-secondary:hover:not(:disabled) {
  box-shadow:
    2px 0 0 0 var(--border),
    0 2px 0 0 var(--border),
    2px 2px 0 0 var(--border);
}

.pixel-button.v-danger {
  background: var(--danger);
  color: var(--p8-white);
  box-shadow:
    4px 0 0 0 var(--border),
    0 4px 0 0 var(--border),
    4px 4px 0 0 var(--border);
}
.pixel-button.v-danger:hover:not(:disabled) {
  box-shadow:
    2px 0 0 0 var(--border),
    0 2px 0 0 var(--border),
    2px 2px 0 0 var(--border);
}
</style>
