<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import JSZip from 'jszip'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
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
const outputName = ref('images')
const fileLabel = computed(() => pdfFile.value?.name ?? '')
const progressPercent = computed(() =>
  totalPages.value > 0 ? Math.round((progress.value / totalPages.value) * 100) : 0,
)

async function handleFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = '請選擇 PDF 檔案。'
    return
  }

  error.value = null
  pdfFile.value = file
  generated.value.forEach((item) => URL.revokeObjectURL(item.url))
  generated.value = []

  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  totalPages.value = doc.numPages
  doc.destroy()
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void handleFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

async function convertAll() {
  if (!pdfFile.value) return

  isProcessing.value = true
  error.value = null
  progress.value = 0
  generated.value.forEach((item) => URL.revokeObjectURL(item.url))
  generated.value = []

  try {
    const buffer = await pdfFile.value.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const results: { url: string; pageNum: number }[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      if (!ctx) throw new Error('無法建立繪圖環境。')

      await page.render({ canvas, canvasContext: ctx, viewport }).promise

      const mime = format.value === 'png' ? 'image/png' : 'image/jpeg'
      const q = format.value === 'jpeg' ? quality.value / 100 : undefined
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('圖片輸出失敗。'))),
          mime,
          q,
        )
      })

      results.push({ url: URL.createObjectURL(blob), pageNum })
      progress.value = pageNum
    }

    doc.destroy()
    generated.value = results
  } catch (err: unknown) {
    error.value = `轉換失敗：${err instanceof Error ? err.message : '未知錯誤'}`
  } finally {
    isProcessing.value = false
  }
}

async function downloadOne(item: { url: string; pageNum: number }) {
  const blob = await fetch(item.url).then((response) => response.blob())
  const base = outputName.value.trim() || pdfFile.value!.name.replace(/\.pdf$/i, '')
  downloadBlob(blob, `${base}_p${item.pageNum}.${format.value}`)
}

async function downloadAllZip() {
  if (generated.value.length === 0) return
  const zip = new JSZip()
  const base = outputName.value.trim() || pdfFile.value!.name.replace(/\.pdf$/i, '')

  for (const item of generated.value) {
    const blob = await fetch(item.url).then((response) => response.blob())
    zip.file(`${base}_p${item.pageNum}.${format.value}`, blob)
  }

  const output = await zip.generateAsync({ type: 'blob' })
  downloadBlob(output, `${base}_images.zip`)
}

function reset() {
  generated.value.forEach((item) => URL.revokeObjectURL(item.url))
  generated.value = []
  pdfFile.value = null
  totalPages.value = 0
  progress.value = 0
}
</script>

<template>
  <ToolLayout
    title="PDF 轉圖片"
    icon="PDF"
    description="把 PDF 每一頁轉成 JPG 或 PNG，支援解析度、品質與批次下載。"
  >
    <PdfToolTabs current="/pdf-to-images" />

    <div
      v-if="!pdfFile"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">PDF</div>
      <p>點這裡或把 PDF 拖進來</p>
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
      <div class="file-row">{{ fileLabel }} · {{ totalPages }} 頁</div>

      <div class="grid">
        <label class="field">
          <span class="label">輸出格式</span>
          <select v-model="format" class="pixel-input">
            <option value="png">PNG（無損）</option>
            <option value="jpeg">JPEG（可壓縮）</option>
          </select>
        </label>

        <label v-if="format === 'jpeg'" class="field">
          <span class="label">JPEG 品質（{{ quality }}%）</span>
          <input v-model.number="quality" type="range" min="40" max="100" />
        </label>

        <label class="field">
          <span class="label">解析度（{{ scale }}x）</span>
          <input v-model.number="scale" type="range" min="1" max="4" step="0.5" />
          <small class="help">1x 適合快速預覽，2x 比較平衡，4x 細節最多但檔案也最大。</small>
        </label>

        <label class="field">
          <span class="label">輸出名稱</span>
          <input v-model="outputName" class="pixel-input" type="text" placeholder="images" />
        </label>
      </div>

      <div v-if="isProcessing || generated.length > 0" class="progress-wrap">
        <div class="progress-head">
          <span>{{ isProcessing ? `轉換中（${progress}/${totalPages}）` : '已完成' }}</span>
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
        <PixelButton variant="danger" size="sm" @click="reset">
          重新選檔
        </PixelButton>
      </div>

      <div v-if="generated.length > 0" class="results">
        <div class="results-bar">
          <h3>轉換結果（{{ generated.length }} 張）</h3>
          <PixelButton size="sm" @click="downloadAllZip">全部打包下載 (ZIP)</PixelButton>
        </div>
        <div class="grid-preview">
          <div v-for="item in generated" :key="item.pageNum" class="thumb">
            <img :src="item.url" :alt="`第 ${item.pageNum} 頁`" />
            <button class="thumb-dl" type="button" @click="downloadOne(item)">
              第 {{ item.pageNum }} 頁下載
            </button>
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
  font-size: 40px;
  margin-bottom: 12px;
  letter-spacing: 0;
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

.help {
  font-size: 10px;
  color: var(--text-dim);
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
