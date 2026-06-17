<script setup lang="ts">
import { ref } from 'vue'
import JSZip from 'jszip'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

interface Entry {
  id: string
  file: File
  status: 'pending' | 'done' | 'error'
  outBlob?: Blob
  outUrl?: string
  outSize?: number
  errMsg?: string
}

const entries = ref<Entry[]>([])
const format = ref<'jpeg' | 'png'>('jpeg')
const quality = ref(90)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const globalErr = ref<string | null>(null)

function handleFiles(list: FileList) {
  for (const f of Array.from(list)) {
    if (!/\.(heic|heif)$/i.test(f.name)) {
      globalErr.value = `${f.name} 不是 HEIC/HEIF,已跳過`
      continue
    }
    entries.value.push({ id: crypto.randomUUID(), file: f, status: 'pending' })
  }
}
function onFileChange(e: Event) {
  const fl = (e.target as HTMLInputElement).files
  if (fl) handleFiles(fl)
  ;(e.target as HTMLInputElement).value = ''
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}
function remove(id: string) {
  const e = entries.value.find(x => x.id === id)
  if (e?.outUrl) URL.revokeObjectURL(e.outUrl)
  entries.value = entries.value.filter(x => x.id !== id)
}
function clearAll() {
  entries.value.forEach(e => e.outUrl && URL.revokeObjectURL(e.outUrl))
  entries.value = []
  globalErr.value = null
}

async function convertAll() {
  if (entries.value.length === 0) return
  isProcessing.value = true
  globalErr.value = null
  // heic2any 體積大,動態載入
  const { default: heic2any } = await import('heic2any')

  for (const entry of entries.value) {
    if (entry.status === 'done') continue
    try {
      const out = await heic2any({
        blob: entry.file,
        toType: format.value === 'jpeg' ? 'image/jpeg' : 'image/png',
        quality: quality.value / 100,
      })
      const blob = Array.isArray(out) ? out[0] : out
      entry.outBlob = blob
      entry.outUrl = URL.createObjectURL(blob)
      entry.outSize = blob.size
      entry.status = 'done'
    } catch (e: unknown) {
      entry.status = 'error'
      entry.errMsg = e instanceof Error ? e.message : '未知錯誤'
    }
  }
  isProcessing.value = false
}

function downloadOne(e: Entry) {
  if (!e.outBlob) return
  const base = e.file.name.replace(/\.(heic|heif)$/i, '')
  downloadBlob(e.outBlob, `${base}.${format.value === 'jpeg' ? 'jpg' : 'png'}`)
}

async function downloadAllZip() {
  const done = entries.value.filter(e => e.status === 'done' && e.outBlob)
  if (done.length === 0) return
  const zip = new JSZip()
  for (const e of done) {
    const base = e.file.name.replace(/\.(heic|heif)$/i, '')
    zip.file(`${base}.${format.value === 'jpeg' ? 'jpg' : 'png'}`, e.outBlob!)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, 'heic_converted.zip')
}
</script>

<template>
  <ToolLayout
    title="HEIC → JPG / PNG"
    icon="🍎"
    description="iPhone 拍的 .HEIC 一鍵變回常見格式。批次處理,完全離線。"
  >
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">🍎</div>
      <p>{{ entries.length === 0 ? '點這裡或拖 HEIC 檔進來' : '繼續加入' }}</p>
      <p class="sub">支援 .heic / .heif,可批次</p>
      <input
        ref="fileInput"
        type="file"
        accept=".heic,.heif"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="globalErr" class="err">⚠ {{ globalErr }}</p>

    <div v-if="entries.length > 0" class="settings">
      <div class="grid">
        <label class="field">
          <span class="label">輸出格式</span>
          <select v-model="format" class="pixel-input">
            <option value="jpeg">JPG(常用)</option>
            <option value="png">PNG(無損)</option>
          </select>
        </label>
        <label v-if="format === 'jpeg'" class="field">
          <span class="label">品質({{ quality }}%)</span>
          <input v-model.number="quality" type="range" min="40" max="100" />
        </label>
      </div>

      <ul class="list">
        <li v-for="e in entries" :key="e.id" class="row">
          <div class="info">
            <div class="name">{{ e.file.name }}</div>
            <div class="meta">
              {{ readableSize(e.file.size) }}
              <span v-if="e.status === 'done'"> → {{ readableSize(e.outSize!) }} ✓</span>
              <span v-if="e.status === 'error'" class="row-err"> ✗ {{ e.errMsg }}</span>
            </div>
          </div>
          <PixelButton
            v-if="e.status === 'done'"
            size="sm"
            @click="downloadOne(e)"
          >⬇</PixelButton>
          <button class="ib danger" @click="remove(e.id)">✕</button>
        </li>
      </ul>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="convertAll">
          {{ isProcessing ? '轉換中…' : '🚀 開始轉換' }}
        </PixelButton>
        <PixelButton
          variant="secondary"
          size="sm"
          :disabled="!entries.some(e => e.status === 'done')"
          @click="downloadAllZip"
        >📦 全部打包 (ZIP)</PixelButton>
        <PixelButton variant="secondary" size="sm" @click="clearAll">
          🧹 清除
        </PixelButton>
      </div>
    </div>
  </ToolLayout>
</template>

<style scoped>
.dropzone {
  border: 4px dashed var(--border);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  background: var(--surface);
}
.dropzone:hover,
.dropzone.active {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.dz-icon {
  font-size: 48px;
}
.sub {
  font-size: 10px;
  color: var(--text-dim);
}
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
}
.settings {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: 10px;
  color: var(--text-dim);
}
.row-err {
  color: var(--danger);
}
.ib {
  width: 36px;
  height: 36px;
  background: var(--surface);
  border: 2px solid var(--border);
  cursor: pointer;
  font-family: inherit;
}
.ib.danger:hover {
  background: var(--danger);
  color: var(--p8-white);
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
