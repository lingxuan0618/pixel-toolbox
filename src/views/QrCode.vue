<script setup lang="ts">
import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

const text = ref('https://github.com/lingxuan0618')
const outputName = ref('qrcode')
const size = ref(512)
const ecLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const fgColor = ref('#1d2b53')
const bgColor = ref('#fff1e8')
const dataUrl = ref('')
const error = ref<string | null>(null)

async function render() {
  if (!text.value.trim()) {
    dataUrl.value = ''
    return
  }
  try {
    error.value = null
    dataUrl.value = await QRCode.toDataURL(text.value, {
      errorCorrectionLevel: ecLevel.value,
      width: size.value,
      margin: 2,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    })
  } catch (e: unknown) {
    error.value = '產生失敗:' + (e instanceof Error ? e.message : '未知')
    dataUrl.value = ''
  }
}

async function downloadPng() {
  if (!dataUrl.value) return
  const blob = await fetch(dataUrl.value).then(r => r.blob())
  const name = outputName.value.trim() || 'qrcode'
  downloadBlob(blob, /\.png$/i.test(name) ? name : name + '.png')
}

async function downloadSvg() {
  if (!text.value.trim()) return
  try {
    const svg = await QRCode.toString(text.value, {
      type: 'svg',
      errorCorrectionLevel: ecLevel.value,
      margin: 2,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    })
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const name = outputName.value.trim() || 'qrcode'
    downloadBlob(blob, /\.svg$/i.test(name) ? name : name + '.svg')
  } catch (e: unknown) {
    error.value = '產生 SVG 失敗:' + (e instanceof Error ? e.message : '未知')
  }
}

watch([text, size, ecLevel, fgColor, bgColor], render, { immediate: true })
</script>

<template>
  <ToolLayout
    title="QR Code 產生器"
    icon="📱"
    description="輸入文字或網址,即時產生 QR Code,可下載 PNG 或 SVG。"
  >
    <div class="layout">
      <section class="form">
        <label class="field">
          <span class="label">內容(文字 / 網址 / 任何字串)</span>
          <textarea
            v-model="text"
            class="pixel-input"
            rows="4"
            placeholder="https://..."
          ></textarea>
        </label>

        <div class="grid">
          <label class="field">
            <span class="label">尺寸({{ size }} px)</span>
            <input v-model.number="size" type="range" min="128" max="1024" step="32" />
          </label>

          <label class="field">
            <span class="label">糾錯等級</span>
            <select v-model="ecLevel" class="pixel-input">
              <option value="L">L · 7% 容錯</option>
              <option value="M">M · 15% 容錯(預設)</option>
              <option value="Q">Q · 25% 容錯</option>
              <option value="H">H · 30% 容錯(可遮 1/3)</option>
            </select>
          </label>

          <label class="field">
            <span class="label">前景色</span>
            <input v-model="fgColor" type="color" class="color-input" />
          </label>

          <label class="field">
            <span class="label">背景色</span>
            <input v-model="bgColor" type="color" class="color-input" />
          </label>
        </div>
      </section>

      <section class="preview">
        <p v-if="error" class="err">⚠ {{ error }}</p>
        <div class="qr-box">
          <img v-if="dataUrl" :src="dataUrl" class="qr" />
          <p v-else class="empty">輸入內容後即時產生</p>
        </div>
        <label class="field filename-field">
          <span class="label">檔名</span>
          <input v-model="outputName" class="pixel-input" type="text" placeholder="qrcode" />
        </label>

        <div class="actions">
          <PixelButton :disabled="!dataUrl" @click="downloadPng">⬇ PNG</PixelButton>
          <PixelButton variant="secondary" :disabled="!text" @click="downloadSvg">⬇ SVG</PixelButton>
        </div>
      </section>
    </div>
  </ToolLayout>
</template>

<style scoped>
.layout {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .layout {
    grid-template-columns: 1fr 1fr;
  }
}

.form {
  display: flex;
  flex-direction: column;
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
.pixel-input {
  font-family: inherit;
  font-size: 13px;
  padding: 10px 12px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  outline: none;
  resize: vertical;
}
.pixel-input:focus {
  border-color: var(--accent);
}
.color-input {
  width: 60px;
  height: 40px;
  border: 3px solid var(--border);
  padding: 0;
  cursor: pointer;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.qr-box {
  background: var(--surface);
  border: 4px solid var(--border);
  box-shadow: 8px 8px 0 0 var(--shadow);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}
.qr {
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}
.empty {
  color: var(--text-dim);
  font-size: 11px;
}
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
