<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
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
const progressText = computed(() => {
  if (!isProcessing.value) return '🚀 開始壓縮'
  return `壓縮中… (${processedCount.value}/${entries.value.length})`
})

function handleFiles(list: FileList) {
  for (const f of Array.from(list)) {
    if (!/^image\//i.test(f.type)) {
      globalErr.value = `${f.name} 不是圖片,已跳過`
      continue
    }
    entries.value.push({
      id: crypto.randomUUID(),
      file: f,
      thumbUrl: URL.createObjectURL(f),
      status: 'pending',
    })
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
  const entry = entries.value.find(x => x.id === id)
  if (entry?.thumbUrl) URL.revokeObjectURL(entry.thumbUrl)
  if (entry?.outUrl) URL.revokeObjectURL(entry.outUrl)
  entries.value = entries.value.filter(x => x.id !== id)
}
function clearAll() {
  entries.value.forEach(e => {
    URL.revokeObjectURL(e.thumbUrl)
    if (e.outUrl) URL.revokeObjectURL(e.outUrl)
  })
  entries.value = []
  globalErr.value = null
}

async function compressAll() {
  if (entries.value.length === 0) return
  isProcessing.value = true
  globalErr.value = null
  processedCount.value = 0
  for (const e of entries.value) {
    try {
      e.status = 'processing'
      const out = await imageCompression(e.file, {
        maxSizeMB: targetSizeMB.value,
        maxWidthOrHeight: maxDim.value,
        useWebWorker: true,
      })
      if (e.outUrl) URL.revokeObjectURL(e.outUrl)
      e.outFile = out
      e.outUrl = URL.createObjectURL(out)
      e.status = 'done'
    } catch (err: unknown) {
      e.status = 'error'
      e.errMsg = err instanceof Error ? err.message : '未知錯誤'
    } finally {
      processedCount.value += 1
    }
  }
  isProcessing.value = false
}

function downloadOne(e: Entry) {
  if (!e.outFile) return
  downloadBlob(e.outFile, `compressed_${e.file.name}`)
}

async function downloadAllZip() {
  const done = entries.value.filter(e => e.status === 'done' && e.outFile)
  if (done.length === 0) return
  const zip = new JSZip()
  for (const e of done) {
    zip.file(`compressed_${e.file.name}`, e.outFile!)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, 'compressed_images.zip')
}

onUnmounted(() => {
  entries.value.forEach(e => {
    URL.revokeObjectURL(e.thumbUrl)
    if (e.outUrl) URL.revokeObjectURL(e.outUrl)
  })
})
</script>

<template>
  <ToolLayout
    title="圖片壓縮"
    icon="🗜️"
    description="把又大又胖的圖片壓到指定大小,保留可看清的品質。"
  >
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">🗜️</div>
      <p>{{ entries.length === 0 ? '點這裡或拖圖片進來' : '繼續加入' }}</p>
      <p class="sub">適合縮小手機照、貼網路上的尺寸</p>
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
          <span class="label">目標檔案大小:約 {{ targetSizeMB }} MB</span>
          <input v-model.number="targetSizeMB" type="range" min="0.1" max="10" step="0.1" />
        </label>
        <label class="field">
          <span class="label">最大邊長({{ maxDim }} px)</span>
          <input v-model.number="maxDim" type="range" min="640" max="4096" step="160" />
        </label>
      </div>

      <ul class="list">
        <li v-for="e in entries" :key="e.id" class="row">
          <div class="preview">
            <img :src="e.thumbUrl" :alt="e.file.name" />
          </div>
          <div class="info">
            <div class="name">{{ e.file.name }}</div>
            <div class="meta">
              {{ readableSize(e.file.size) }}
              <span v-if="e.status === 'done' && e.outFile">
                → {{ readableSize(e.outFile.size) }}
                <span class="ratio">({{ Math.round((e.outFile.size / e.file.size) * 100) }}%)</span> ✓
              </span>
              <span v-if="e.status === 'error'" class="row-err"> ✗ {{ e.errMsg }}</span>
            </div>
          </div>
          <div class="result-preview">
            <img v-if="e.outUrl" :src="e.outUrl" :alt="`${e.file.name} 壓縮後`" />
            <span v-else>預覽</span>
          </div>
          <PixelButton v-if="e.status === 'done'" size="sm" @click="downloadOne(e)">⬇</PixelButton>
          <button class="ib danger" @click="remove(e.id)">✕</button>
        </li>
      </ul>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="compressAll">
          {{ progressText }}
        </PixelButton>
        <PixelButton
          variant="secondary"
          size="sm"
          :disabled="!entries.some(e => e.status === 'done')"
          @click="downloadAllZip"
        >📦 全部打包 (ZIP)</PixelButton>
        <PixelButton variant="secondary" size="sm" @click="clearAll">🧹 清除</PixelButton>
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
}
.preview img,
.result-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.result-preview {
  font-size: 10px;
  color: var(--text-dim);
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
.status-processing {
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
</style>
