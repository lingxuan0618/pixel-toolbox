<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import JSZip from 'jszip'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

const pdfFile = ref<File | null>(null)
const totalPages = shallowRef(0)
const format = ref<'png' | 'jpeg'>('png')
const quality = ref(92)
const scale = ref(2)
const generated = shallowRef<{ url: string; pageNum: number }[]>([])
const error = ref<string | null>(null)
const isProcessing = ref(false)
const progress = ref(0)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function handleFile(f: File) {
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    error.value = '只接受 PDF'
    return
  }
  error.value = null
  pdfFile.value = f
  // 清掉之前的結果
  generated.value.forEach(g => URL.revokeObjectURL(g.url))
  generated.value = []
  const ab = await f.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
  totalPages.value = doc.numPages
  doc.destroy()
}

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handleFile(f)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) handleFile(f)
}

async function convertAll() {
  if (!pdfFile.value) return
  isProcessing.value = true
  error.value = null
  progress.value = 0
  generated.value.forEach(g => URL.revokeObjectURL(g.url))
  generated.value = []
  try {
    const ab = await pdfFile.value.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    const results: { url: string; pageNum: number }[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const mime = format.value === 'png' ? 'image/png' : 'image/jpeg'
      const q = format.value === 'jpeg' ? quality.value / 100 : undefined
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, q)
      })
      results.push({ url: URL.createObjectURL(blob), pageNum: i })
      progress.value = i
    }
    doc.destroy()
    generated.value = results
  } catch (e: unknown) {
    error.value = '轉換失敗:' + (e instanceof Error ? e.message : '未知錯誤')
  } finally {
    isProcessing.value = false
  }
}

async function downloadOne(g: { url: string; pageNum: number }) {
  const blob = await fetch(g.url).then(r => r.blob())
  const base = pdfFile.value!.name.replace(/\.pdf$/i, '')
  downloadBlob(blob, `${base}_p${g.pageNum}.${format.value}`)
}

async function downloadAllZip() {
  if (generated.value.length === 0) return
  const zip = new JSZip()
  const base = pdfFile.value!.name.replace(/\.pdf$/i, '')
  for (const g of generated.value) {
    const blob = await fetch(g.url).then(r => r.blob())
    zip.file(`${base}_p${g.pageNum}.${format.value}`, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, `${base}_images.zip`)
}

function reset() {
  generated.value.forEach(g => URL.revokeObjectURL(g.url))
  generated.value = []
  pdfFile.value = null
  totalPages.value = 0
}
</script>

<template>
  <ToolLayout
    title="PDF → 圖片"
    icon="🖼️"
    description="把 PDF 每一頁轉成圖片,可選格式、品質、解析度。"
  >
    <div
      v-if="!pdfFile"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">🖼️</div>
      <p>點這裡或拖 PDF 進來</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div v-if="pdfFile" class="form">
      <div class="file-row">📄 {{ pdfFile.name }} · {{ totalPages }} 頁</div>

      <div class="grid">
        <label class="field">
          <span class="label">輸出格式</span>
          <select v-model="format" class="pixel-input">
            <option value="png">PNG(無損,檔較大)</option>
            <option value="jpeg">JPEG(可壓縮)</option>
          </select>
        </label>

        <label v-if="format === 'jpeg'" class="field">
          <span class="label">JPEG 品質({{ quality }}%)</span>
          <input v-model.number="quality" type="range" min="40" max="100" />
        </label>

        <label class="field">
          <span class="label">解析度({{ scale }}x)</span>
          <input v-model.number="scale" type="range" min="1" max="4" step="0.5" />
        </label>
      </div>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="convertAll">
          {{ isProcessing ? `轉換中… (${progress}/${totalPages})` : '🚀 開始轉換' }}
        </PixelButton>
        <PixelButton variant="danger" size="sm" @click="reset">
          重新選檔
        </PixelButton>
      </div>

      <div v-if="generated.length > 0" class="results">
        <div class="results-bar">
          <h3>// 結果({{ generated.length }} 張)</h3>
          <PixelButton size="sm" @click="downloadAllZip">📦 全部打包下載 (ZIP)</PixelButton>
        </div>
        <div class="grid-preview">
          <div v-for="g in generated" :key="g.pageNum" class="thumb">
            <img :src="g.url" />
            <button class="thumb-dl" @click="downloadOne(g)">P.{{ g.pageNum }} ⬇</button>
          </div>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>

<style scoped>
.dropzone {
  border: 4px dashed var(--border);
  padding: 64px 24px;
  text-align: center;
  cursor: pointer;
  background: var(--surface);
}
.dropzone:hover,
.dropzone.active {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.dz-icon {
  font-size: 56px;
  margin-bottom: 12px;
}
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.file-row {
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  font-size: 11px;
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
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
.results-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
.results h3 {
  color: var(--accent);
  margin: 0;
}
.grid-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.thumb {
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  display: flex;
  flex-direction: column;
}
.thumb img {
  width: 100%;
  height: auto;
  display: block;
}
.thumb-dl {
  font-family: inherit;
  font-size: 10px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  padding: 8px;
  cursor: pointer;
}
</style>
