<script setup lang="ts">
defineProps<{
  hoverable?: boolean
}>()
</script>

<template>
  <div class="pixel-card-component" :class="{ hoverable }">
    <slot />
  </div>
</template>

<style scoped>
.pixel-card-component {
  background: var(--surface);
  border: 4px solid var(--border);
  padding: 24px;
  box-shadow: 8px 8px 0 0 var(--shadow);
  transition:
    transform 0.1s ease-out,
    box-shadow 0.1s ease-out;
}
.pixel-card-component.hoverable {
  cursor: pointer;
}
.pixel-card-component.hoverable:hover {
  transform: translate(-2px, -2px);
  box-shadow: 10px 10px 0 0 var(--shadow);
}
</style>
