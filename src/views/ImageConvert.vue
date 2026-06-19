<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import JSZip from 'jszip'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

type Format = 'png' | 'jpeg' | 'webp'

interface Entry {
  id: string
  file: File
  thumbUrl: string
  status: 'pending' | 'processing' | 'done' | 'error'
  outBlob?: Blob
  outSize?: number
  outUrl?: string
  errMsg?: string
}

const entries = ref<Entry[]>([])
const format = ref<Format>('webp')
const quality = ref(85)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const globalErr = ref<string | null>(null)
const processedCount = ref(0)

const progressLabel = computed(() => {
  if (!isProcessing.value) return '尚未開始轉換'
  return `轉換中 ${processedCount.value}/${entries.value.length}`
})

const progressPercent = computed(() =>
  entries.value.length > 0 ? Math.round((processedCount.value / entries.value.length) * 100) : 0,
)

const selectedSize = computed(() =>
  entries.value.reduce((total, entry) => total + entry.file.size, 0),
)

function revokeEntry(entry: Entry) {
  URL.revokeObjectURL(entry.thumbUrl)
  if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
}

function resetConvertedState() {
  for (const entry of entries.value) {
    if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
    entry.outBlob = undefined
    entry.outSize = undefined
    entry.outUrl = undefined
    entry.errMsg = undefined
    entry.status = 'pending'
  }
  processedCount.value = 0
}

function handleFiles(list: FileList) {
  for (const file of Array.from(list)) {
    if (!/^image\//i.test(file.type) && !/\.(png|jpe?g|webp|bmp|gif|avif|heic)$/i.test(file.name)) {
      globalErr.value = `${file.name} 不是可處理的圖片格式`
      continue
    }

    entries.value.push({
      id: crypto.randomUUID(),
      file,
      thumbUrl: URL.createObjectURL(file),
      status: 'pending',
    })
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) handleFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}

function remove(id: string) {
  const entry = entries.value.find((item) => item.id === id)
  if (!entry) return
  revokeEntry(entry)
  entries.value = entries.value.filter((item) => item.id !== id)
}

function clearAll() {
  entries.value.forEach(revokeEntry)
  entries.value = []
  globalErr.value = null
  processedCount.value = 0
}

async function convertOne(file: File, fmt: Format, q: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('無法建立圖片轉換畫布')

  if (fmt === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.drawImage(bitmap, 0, 0)
  const mime = fmt === 'png' ? 'image/png' : fmt === 'jpeg' ? 'image/jpeg' : 'image/webp'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('圖片輸出失敗'))),
      mime,
      fmt === 'png' ? undefined : q / 100,
    )
  })
}

function buildExt() {
  return format.value === 'jpeg' ? 'jpg' : format.value
}

function autoDownloadResults(done: Entry[]) {
  if (done.length === 0) return

  if (done.length === 1 && done[0].outBlob) {
    const base = done[0].file.name.replace(/\.[^.]+$/, '')
    downloadBlob(done[0].outBlob, `${base}.${buildExt()}`)
    return
  }

  const zip = new JSZip()
  for (const entry of done) {
    if (!entry.outBlob) continue
    const base = entry.file.name.replace(/\.[^.]+$/, '')
    zip.file(`${base}.${buildExt()}`, entry.outBlob)
  }

  void zip.generateAsync({ type: 'blob' }).then((output) => {
    downloadBlob(output, `converted_${format.value}.zip`)
  })
}

async function convertAll() {
  if (entries.value.length === 0 || isProcessing.value) return

  isProcessing.value = true
  globalErr.value = null
  processedCount.value = 0

  try {
    for (const entry of entries.value) {
      entry.status = 'processing'
      entry.errMsg = undefined

      try {
        const blob = await convertOne(entry.file, format.value, quality.value)
        if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
        entry.outBlob = blob
        entry.outSize = blob.size
        entry.outUrl = URL.createObjectURL(blob)
        entry.status = 'done'
      } catch (err: unknown) {
        if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
        entry.outBlob = undefined
        entry.outSize = undefined
        entry.outUrl = undefined
        entry.status = 'error'
        entry.errMsg = err instanceof Error ? err.message : '轉換失敗'
      } finally {
        processedCount.value += 1
      }
    }
  } finally {
    isProcessing.value = false
    const done = entries.value.filter((entry) => entry.status === 'done' && entry.outBlob)
    autoDownloadResults(done)
  }
}

function downloadOne(entry: Entry) {
  if (!entry.outBlob) return
  const base = entry.file.name.replace(/\.[^.]+$/, '')
  downloadBlob(entry.outBlob, `${base}.${buildExt()}`)
}

async function downloadAllZip() {
  const done = entries.value.filter((entry) => entry.status === 'done' && entry.outBlob)
  if (done.length === 0) return

  const zip = new JSZip()
  for (const entry of done) {
    const base = entry.file.name.replace(/\.[^.]+$/, '')
    zip.file(`${base}.${buildExt()}`, entry.outBlob!)
  }

  const output = await zip.generateAsync({ type: 'blob' })
  downloadBlob(output, `converted_${format.value}.zip`)
}

watch([format, quality], () => {
  if (isProcessing.value) return
  resetConvertedState()
})

onUnmounted(() => {
  entries.value.forEach(revokeEntry)
})
</script>

<template>
  <ToolLayout
    title="圖片格式互轉"
    icon="🎨"
    description="加入圖片後，可一次轉成 PNG、JPG 或 WebP，並保留單檔與批次下載。"
  >
    <p v-if="globalErr" class="err">錯誤：{{ globalErr }}</p>

    <section class="section">
      <div
        class="dropzone"
        :class="{ active: dropActive }"
        @click="fileInput?.click()"
        @dragover.prevent="dropActive = true"
        @dragleave="dropActive = false"
        @drop="onDrop"
      >
        <div class="dz-icon">🎨</div>
        <p>{{ entries.length === 0 ? '點這裡或拖曳圖片進來' : '再加入更多圖片' }}</p>
        <p class="sub">支援 PNG、JPG、WebP、BMP、GIF、AVIF、HEIC</p>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="onFileChange"
        />
      </div>

      <div v-if="entries.length > 0" class="file-summary">
        <div class="summary-head">
          <span>已加入 {{ entries.length }} 張圖片</span>
          <span>{{ readableSize(selectedSize) }}</span>
        </div>
        <div class="file-list">
          <span v-for="entry in entries" :key="entry.id" class="file-chip">
            {{ entry.file.name }}
          </span>
        </div>
      </div>
    </section>

    <section v-if="entries.length > 0" class="section">
      <h3 class="section-title">輸出設定</h3>
      <div class="grid">
        <label class="field">
          <span class="label">輸出格式</span>
          <select v-model="format" class="pixel-input">
            <option value="webp">WebP</option>
            <option value="jpeg">JPG</option>
            <option value="png">PNG</option>
          </select>
        </label>

        <label v-if="format !== 'png'" class="field">
          <span class="label">品質（{{ quality }}%）</span>
          <input v-model.number="quality" type="range" min="40" max="100" />
        </label>
      </div>

      <div v-if="isProcessing || processedCount > 0" class="progress-wrap">
        <div class="progress-head">
          <span>{{ progressLabel }}</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="convertAll">
          {{ isProcessing ? '轉換中…' : '開始轉換' }}
        </PixelButton>
        <PixelButton
          variant="secondary"
          size="sm"
          :disabled="!entries.some((entry) => entry.status === 'done')"
          @click="downloadAllZip"
        >
          批次下載 ZIP
        </PixelButton>
        <PixelButton variant="secondary" size="sm" @click="clearAll">清空</PixelButton>
      </div>
    </section>

    <section v-if="entries.length > 0" class="section">
      <h3 class="section-title">轉換結果</h3>
      <div class="preview-grid">
        <article v-for="entry in entries" :key="entry.id" class="preview-card">
          <div class="preview-head">
            <span class="preview-name">{{ entry.file.name }}</span>
            <span class="preview-state" :class="entry.status">{{ entry.status }}</span>
          </div>

          <div class="preview-body">
            <figure class="preview-shot">
              <img :src="entry.thumbUrl" :alt="entry.file.name" />
              <figcaption>原圖</figcaption>
            </figure>

            <figure class="preview-shot">
              <img v-if="entry.outUrl" :src="entry.outUrl" :alt="`${entry.file.name} 的轉換結果`" />
              <div v-else class="preview-empty">尚未轉換</div>
              <figcaption>
                {{ entry.outSize !== undefined ? readableSize(entry.outSize) : '等待輸出' }}
              </figcaption>
            </figure>
          </div>

          <div class="preview-foot">
            <span class="meta">
              {{ readableSize(entry.file.size) }}
              <template v-if="entry.status === 'done' && entry.outSize !== undefined">
                → {{ readableSize(entry.outSize) }}
                ({{ Math.round((entry.outSize / entry.file.size) * 100) }}%)
              </template>
            </span>

            <span class="meta state" :class="entry.status">
              <template v-if="entry.status === 'processing'">轉換中</template>
              <template v-else-if="entry.status === 'done'">完成</template>
              <template v-else-if="entry.status === 'error'">失敗：{{ entry.errMsg }}</template>
              <template v-else>等待轉換</template>
            </span>
          </div>

          <div class="preview-actions">
            <PixelButton v-if="entry.status === 'done'" size="sm" @click="downloadOne(entry)">
              下載
            </PixelButton>
            <button class="ib danger" type="button" @click="remove(entry.id)">刪</button>
          </div>
        </article>
      </div>
    </section>
  </ToolLayout>
</template>

<style scoped>
.section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 3px dashed var(--border);
}

.section-title {
  font-size: 13px;
  margin: 0 0 12px;
  color: var(--accent-2);
}

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
  font-size: 40px;
  margin-bottom: 12px;
  letter-spacing: 0;
}

.sub {
  font-size: 10px;
  color: var(--text-dim);
}

.file-summary {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 10px;
  color: var(--text-dim);
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border: 2px solid var(--border);
  background: var(--bg);
  font-size: 10px;
}

.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 0 0 16px;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 10px;
  color: var(--text-dim);
}

.progress-track {
  width: 100%;
  height: 14px;
  border: 2px solid var(--border);
  background: var(--bg);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.preview-card {
  border: 3px solid var(--border);
  background: var(--surface);
  box-shadow: 4px 4px 0 0 var(--shadow);
  padding: 12px;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 10px;
}

.preview-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-state {
  color: var(--text-dim);
}

.preview-state.processing {
  color: var(--accent);
}

.preview-state.done {
  color: var(--success);
}

.preview-state.error {
  color: var(--danger);
}

.preview-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.preview-shot {
  margin: 0;
  border: 2px solid var(--border);
  background: var(--bg);
  min-height: 110px;
  display: grid;
  grid-template-rows: 1fr auto;
}

.preview-shot img {
  width: 100%;
  height: 110px;
  object-fit: contain;
  background: var(--bg);
}

.preview-empty {
  min-height: 110px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 10px;
}

.preview-shot figcaption {
  padding: 6px 8px;
  font-size: 10px;
  color: var(--text-dim);
  border-top: 2px solid var(--border);
}

.preview-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  font-size: 10px;
}

.meta {
  color: var(--text-dim);
  min-width: 0;
}

.meta.state.done {
  color: var(--success);
}

.meta.state.processing {
  color: var(--accent);
}

.meta.state.error {
  color: var(--danger);
}

.preview-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
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
  margin-top: 16px;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
