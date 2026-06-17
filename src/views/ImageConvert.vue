<script setup lang="ts">
import { ref } from 'vue'
import JSZip from 'jszip'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

type Format = 'png' | 'jpeg' | 'webp'

interface Entry {
  id: string
  file: File
  status: 'pending' | 'done' | 'error'
  outBlob?: Blob
  outSize?: number
  errMsg?: string
}

const entries = ref<Entry[]>([])
const format = ref<Format>('webp')
const quality = ref(85)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const globalErr = ref<string | null>(null)

function handleFiles(list: FileList) {
  for (const f of Array.from(list)) {
    if (!/^image\//i.test(f.type) && !/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name)) {
      globalErr.value = `${f.name} 不是圖片,已跳過`
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
  entries.value = entries.value.filter(x => x.id !== id)
}
function clearAll() {
  entries.value = []
  globalErr.value = null
}

async function convertOne(file: File, fmt: Format, q: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  if (fmt === 'jpeg') {
    // JPEG 沒透明度,先塗白
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bitmap, 0, 0)
  const mime = fmt === 'png' ? 'image/png' : fmt === 'jpeg' ? 'image/jpeg' : 'image/webp'
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('toBlob 失敗'))),
      mime,
      fmt === 'png' ? undefined : q / 100
    )
  })
}

async function convertAll() {
  if (entries.value.length === 0) return
  isProcessing.value = true
  globalErr.value = null
  for (const e of entries.value) {
    if (e.status === 'done') continue
    try {
      const blob = await convertOne(e.file, format.value, quality.value)
      e.outBlob = blob
      e.outSize = blob.size
      e.status = 'done'
    } catch (err: unknown) {
      e.status = 'error'
      e.errMsg = err instanceof Error ? err.message : '未知錯誤'
    }
  }
  isProcessing.value = false
}

function downloadOne(e: Entry) {
  if (!e.outBlob) return
  const base = e.file.name.replace(/\.[^.]+$/, '')
  const ext = format.value === 'jpeg' ? 'jpg' : format.value
  downloadBlob(e.outBlob, `${base}.${ext}`)
}

async function downloadAllZip() {
  const done = entries.value.filter(e => e.status === 'done' && e.outBlob)
  if (done.length === 0) return
  const zip = new JSZip()
  const ext = format.value === 'jpeg' ? 'jpg' : format.value
  for (const e of done) {
    const base = e.file.name.replace(/\.[^.]+$/, '')
    zip.file(`${base}.${ext}`, e.outBlob!)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, `converted_${format.value}.zip`)
}
</script>

<template>
  <ToolLayout
    title="圖片格式互轉"
    icon="🎨"
    description="JPG / PNG / WebP 自由互轉,可批次,可調品質。"
  >
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">🎨</div>
      <p>{{ entries.length === 0 ? '點這裡或拖圖片進來' : '繼續加入' }}</p>
      <p class="sub">支援 PNG / JPG / WebP / BMP / GIF,可一次選多張</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
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
            <option value="webp">WebP(現代、檔小)</option>
            <option value="jpeg">JPG(相容好)</option>
            <option value="png">PNG(無損、有透明)</option>
          </select>
        </label>
        <label v-if="format !== 'png'" class="field">
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
              <span v-if="e.status === 'done' && e.outSize !== undefined">
                → {{ readableSize(e.outSize) }}
                <span class="ratio">
                  ({{ Math.round((e.outSize / e.file.size) * 100) }}%)
                </span> ✓
              </span>
              <span v-if="e.status === 'error'" class="row-err"> ✗ {{ e.errMsg }}</span>
            </div>
          </div>
          <PixelButton v-if="e.status === 'done'" size="sm" @click="downloadOne(e)">⬇</PixelButton>
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
.ratio {
  color: var(--success);
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
