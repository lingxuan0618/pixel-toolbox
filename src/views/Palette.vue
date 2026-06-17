<script setup lang="ts">
import { ref, computed } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { generateSchemes } from '../lib/color'
import { downloadBlob } from '../lib/download'

const baseColor = ref('#29adff')
const copied = ref<string | null>(null)
let copiedTimer: number | null = null

const schemes = computed(() => generateSchemes(baseColor.value))

async function copyHex(hex: string) {
  try {
    await navigator.clipboard.writeText(hex)
    copied.value = hex
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => (copied.value = null), 1200)
  } catch {
    // 沒權限就算了
  }
}

function downloadJson() {
  const out: Record<string, string[]> = {}
  for (const s of schemes.value) out[s.name] = s.colors
  const blob = new Blob([JSON.stringify({ base: baseColor.value, schemes: out }, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, 'palette.json')
}

function downloadCss() {
  const lines: string[] = [':root {']
  schemes.value.forEach(s => {
    s.colors.forEach((c, i) => {
      const safeName = s.name.replace(/[^\w]/g, '-').toLowerCase()
      lines.push(`  --color-${safeName}-${i + 1}: ${c};`)
    })
  })
  lines.push('}')
  const blob = new Blob([lines.join('\n')], { type: 'text/css' })
  downloadBlob(blob, 'palette.css')
}
</script>

<template>
  <ToolLayout
    title="色票產生器"
    icon="🌈"
    description="輸入一個主色,自動產生六種配色方案。點任一色塊複製 hex,可下載 CSS 或 JSON。"
  >
    <section class="picker">
      <div class="picker-row">
        <label class="field">
          <span class="label">主色</span>
          <div class="color-row">
            <input v-model="baseColor" type="color" class="color-input" />
            <input v-model="baseColor" type="text" class="pixel-input" maxlength="7" />
          </div>
        </label>
        <div class="actions">
          <PixelButton size="sm" @click="downloadCss">⬇ CSS</PixelButton>
          <PixelButton variant="secondary" size="sm" @click="downloadJson">⬇ JSON</PixelButton>
        </div>
      </div>
    </section>

    <section class="schemes">
      <article v-for="s in schemes" :key="s.name" class="scheme-card">
        <header>
          <h3>{{ s.name }}</h3>
          <span class="desc">{{ s.desc }}</span>
        </header>
        <div class="swatch-row">
          <button
            v-for="c in s.colors"
            :key="c"
            type="button"
            class="swatch"
            :style="{ background: c }"
            :title="`點擊複製 ${c}`"
            @click="copyHex(c)"
          >
            <span class="hex">{{ c }}</span>
            <span v-if="copied === c" class="ok">✓ 已複製</span>
          </button>
        </div>
      </article>
    </section>
  </ToolLayout>
</template>

<style scoped>
.picker {
  margin-bottom: 24px;
}
.picker-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 10px;
  color: var(--accent-2);
}
.color-row {
  display: flex;
  gap: 8px;
}
.color-input {
  width: 56px;
  height: 44px;
  border: 3px solid var(--border);
  padding: 0;
  cursor: pointer;
}
.pixel-input {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 12px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  outline: none;
  width: 120px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.schemes {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .schemes {
    grid-template-columns: 1fr 1fr;
  }
}

.scheme-card {
  background: var(--surface);
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
  padding: 16px;
}
.scheme-card header {
  margin-bottom: 12px;
}
.scheme-card h3 {
  color: var(--accent);
  margin: 0;
  font-size: 14px;
}
.desc {
  font-size: 10px;
  color: var(--text-dim);
}

.swatch-row {
  display: flex;
  gap: 6px;
}
.swatch {
  flex: 1;
  height: 80px;
  border: 3px solid var(--border);
  cursor: pointer;
  padding: 0;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-family: inherit;
  transition:
    transform 0.06s,
    box-shadow 0.06s;
}
.swatch:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 var(--border);
}
.hex {
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  font-size: 10px;
  margin-bottom: 4px;
}
.ok {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--success);
  color: #000;
  font-size: 9px;
  padding: 2px 6px;
}
</style>
