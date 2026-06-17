<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

interface Entry {
  id: string
  file: File
  thumbUrl: string
  status: 'pending' | 'processing' | 'done' | 'error'
  outFile?: File
  outUrl?: string
  errMsg?: string
}

const entries = ref<Entry[]>([])
const targetSizeMB = ref(1)
const maxDim = ref(1920)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const globalErr = ref<string | null>(null)
const processedCount = ref(0)
const preview = ref<{ src: string; title: string } | null>(null)

const progressText = computed(() => {
  if (!isProcessing.value) return '等待開始壓縮'
  return `壓縮中（${processedCount.value}/${entries.value.length}）`
})

const progressPercent = computed(() =>
  entries.value.length > 0 ? Math.round((processedCount.value / entries.value.length) * 100) : 0,
)

function handleFiles(list: FileList) {
  for (const file of Array.from(list)) {
    if (!/^image\//i.test(file.type)) {
      globalErr.value = `${file.name} 不是支援的圖片格式。`
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

function openPreview(src: string, title: string) {
  preview.value = { src, title }
}

function closePreview() {
  preview.value = null
}

function remove(id: string) {
  const entry = entries.value.find((item) => item.id === id)
  if (entry?.thumbUrl) URL.revokeObjectURL(entry.thumbUrl)
  if (entry?.outUrl) URL.revokeObjectURL(entry.outUrl)
  entries.value = entries.value.filter((item) => item.id !== id)
}

function clearAll() {
  entries.value.forEach((entry) => {
    URL.revokeObjectURL(entry.thumbUrl)
    if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
  })
  entries.value = []
  globalErr.value = null
  preview.value = null
  processedCount.value = 0
}

async function compressAll() {
  if (entries.value.length === 0) return

  isProcessing.value = true
  globalErr.value = null
  processedCount.value = 0

  for (const entry of entries.value) {
    try {
      entry.status = 'processing'
      const output = await imageCompression(entry.file, {
        maxSizeMB: targetSizeMB.value,
        maxWidthOrHeight: maxDim.value,
        useWebWorker: true,
      })

      if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
      entry.outFile = output
      entry.outUrl = URL.createObjectURL(output)
      entry.status = 'done'
    } catch (err: unknown) {
      entry.status = 'error'
      entry.errMsg = err instanceof Error ? err.message : '圖片壓縮失敗。'
    } finally {
      processedCount.value += 1
    }
  }

  isProcessing.value = false
}

function downloadOne(entry: Entry) {
  if (!entry.outFile) return
  downloadBlob(entry.outFile, `compressed_${entry.file.name}`)
}

async function downloadAllZip() {
  const done = entries.value.filter((entry) => entry.status === 'done' && entry.outFile)
  if (done.length === 0) return

  const zip = new JSZip()
  for (const entry of done) {
    zip.file(`compressed_${entry.file.name}`, entry.outFile!)
  }

  const output = await zip.generateAsync({ type: 'blob' })
  downloadBlob(output, 'compressed_images.zip')
}

onUnmounted(() => {
  entries.value.forEach((entry) => {
    URL.revokeObjectURL(entry.thumbUrl)
    if (entry.outUrl) URL.revokeObjectURL(entry.outUrl)
  })
})
</script>

<template>
  <ToolLayout
    title="圖片壓縮"
    icon="IMG"
    description="批次壓縮圖片，控制目標容量與最大邊長。"
  >
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">IMG</div>
      <p>{{ entries.length === 0 ? '點這裡或拖曳圖片進來' : '可繼續加入更多圖片' }}</p>
      <p class="sub">支援 JPG、PNG、WebP、BMP、GIF。</p>
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
          <span class="label">目標容量（{{ targetSizeMB }} MB）</span>
          <input v-model.number="targetSizeMB" type="range" min="0.1" max="10" step="0.1" />
        </label>
        <label class="field">
          <span class="label">最大邊長（{{ maxDim }} px）</span>
          <input v-model.number="maxDim" type="range" min="640" max="4096" step="160" />
        </label>
      </div>

      <div v-if="isProcessing || processedCount > 0" class="progress-wrap">
        <div class="progress-head">
          <span>{{ progressText }}</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <ul class="list">
        <li v-for="entry in entries" :key="entry.id" class="row">
          <button
            type="button"
            class="preview"
            @click="openPreview(entry.thumbUrl, entry.file.name)"
            :title="entry.file.name"
          >
            <img :src="entry.thumbUrl" :alt="entry.file.name" />
          </button>

          <div class="info">
            <div class="name">{{ entry.file.name }}</div>
            <div class="meta">
              {{ readableSize(entry.file.size) }}
              <span v-if="entry.status === 'done' && entry.outFile">
                → {{ readableSize(entry.outFile.size) }}
                <span class="ratio">
                  ({{ Math.round((entry.outFile.size / entry.file.size) * 100) }}%)
                </span>
              </span>
              <span v-if="entry.status === 'error'" class="row-err"> {{ entry.errMsg }}</span>
              <span v-if="entry.status === 'processing'" class="row-state"> 處理中</span>
            </div>
          </div>

          <button
            type="button"
            class="result-preview"
            :disabled="!entry.outUrl"
            :title="entry.outUrl ? '查看壓縮後結果' : '尚未完成壓縮'"
            @click="entry.outUrl && openPreview(entry.outUrl, `壓縮後 - ${entry.file.name}`)"
          >
            <img v-if="entry.outUrl" :src="entry.outUrl" :alt="`${entry.file.name} 壓縮後預覽`" />
            <span v-else>未完成</span>
          </button>

          <PixelButton v-if="entry.status === 'done'" size="sm" @click="downloadOne(entry)">
            下載
          </PixelButton>
          <button class="ib danger" type="button" @click="remove(entry.id)">刪</button>
        </li>
      </ul>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="compressAll">
          {{ isProcessing ? '壓縮中…' : '開始壓縮' }}
        </PixelButton>
        <PixelButton
          variant="secondary"
          size="sm"
          :disabled="!entries.some((entry) => entry.status === 'done')"
          @click="downloadAllZip"
        >
          全部下載 (ZIP)
        </PixelButton>
        <PixelButton variant="secondary" size="sm" @click="clearAll">清空</PixelButton>
      </div>
    </div>

    <div v-if="preview" class="lightbox" @click.self="closePreview">
      <div class="lightbox-panel">
        <div class="lightbox-bar">
          <span class="lightbox-title">{{ preview.title }}</span>
          <button type="button" class="lightbox-close" @click="closePreview">關閉</button>
        </div>
        <img class="lightbox-img" :src="preview.src" :alt="preview.title" />
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
  font-size: 40px;
  margin-bottom: 12px;
  letter-spacing: 0;
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

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
}

.preview,
.result-preview {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border: 2px solid var(--border);
  background: var(--bg);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
}

.preview img,
.result-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.result-preview {
  font-size: 10px;
  color: var(--text-dim);
}

.result-preview:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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

.row-state {
  color: var(--accent);
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

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 30;
}

.lightbox-panel {
  width: min(92vw, 980px);
  max-height: 92vh;
  background: var(--surface);
  border: 4px solid var(--border);
  box-shadow: 8px 8px 0 0 var(--shadow);
  display: flex;
  flex-direction: column;
}

.lightbox-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 3px dashed var(--border);
}

.lightbox-title {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-close {
  width: auto;
  min-height: 32px;
  padding: 0 10px;
  border: 2px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  font-family: inherit;
}

.lightbox-img {
  width: 100%;
  max-height: calc(92vh - 56px);
  object-fit: contain;
  background: #111;
}
</style>
