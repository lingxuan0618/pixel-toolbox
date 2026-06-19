<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import JSZip from 'jszip'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

void PdfToolTabs

type GeneratedImage = {
  url: string
  pageNum: number
}

type PreviewImage = {
  url: string
  width: number
  height: number
}

const pdfFile = ref<File | null>(null)
const totalPages = ref(0)
const format = ref<'png' | 'jpeg'>('png')
const quality = ref(92)
const scale = ref(2)
const previewPage = ref(1)
const generated = ref<GeneratedImage[]>([])
const error = ref<string | null>(null)
const previewError = ref<string | null>(null)
const isProcessing = ref(false)
const previewLoading = ref(false)
const progress = ref(0)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const outputName = ref('images')
const fileLabel = computed(() => pdfFile.value?.name ?? '')
const progressPercent = computed(() =>
  totalPages.value > 0 ? Math.round((progress.value / totalPages.value) * 100) : 0,
)

const previewScaleText = computed(() => `${scale.value}x`)
const scaleHelpText = computed(() => {
  if (scale.value <= 1) {
    return '1x 適合快速檢視，畫質和檔案都最小。'
  }

  if (scale.value < 3) {
    return '2x 是畫質和檔案大小比較平衡的選擇。'
  }

  return '4x 細節最多，但輸出檔案也會明顯變大。'
})

const previewState = ref<{
  base: PreviewImage | null
  current: PreviewImage | null
}>({
  base: null,
  current: null,
})

let previewRunId = 0

function revokePreviewUrls() {
  if (previewState.value.base) URL.revokeObjectURL(previewState.value.base.url)
  if (previewState.value.current && previewState.value.current !== previewState.value.base) {
    URL.revokeObjectURL(previewState.value.current.url)
  }
}

function revokeGeneratedUrls() {
  generated.value.forEach((item) => URL.revokeObjectURL(item.url))
}

function clampPreviewPage(pageNum: number) {
  if (totalPages.value <= 0) return 1
  return Math.min(Math.max(Math.trunc(pageNum) || 1, 1), totalPages.value)
}

async function loadPdf(file: File) {
  const buffer = await file.arrayBuffer()
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
}

async function renderPage(page: any, pageScale: number) {
  const viewport = page.getViewport({ scale: pageScale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('?⊥?撱箇????汗?怠?')

  await page.render({ canvas, canvasContext: ctx, viewport }).promise

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((output) => {
      if (output) resolve(output)
      else reject(new Error('???汗頛詨憭望?'))
    }, 'image/png')
  })

  return {
    url: URL.createObjectURL(blob),
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
  }
}

async function refreshPreview() {
  if (!pdfFile.value) return

  const runId = ++previewRunId
  previewLoading.value = true
  previewError.value = null

  const previousBase = previewState.value.base
  const previousCurrent = previewState.value.current

  try {
    const doc = await loadPdf(pdfFile.value)
    const pageNum = clampPreviewPage(previewPage.value)
    previewPage.value = pageNum
    const page = await doc.getPage(pageNum)

    const base = await renderPage(page, 1)
    const current = scale.value === 1 ? { ...base } : await renderPage(page, scale.value)

    doc.destroy()

    if (runId !== previewRunId) {
      URL.revokeObjectURL(base.url)
      if (current.url !== base.url) URL.revokeObjectURL(current.url)
      return
    }

    if (previousBase) URL.revokeObjectURL(previousBase.url)
    if (previousCurrent && previousCurrent !== previousBase) URL.revokeObjectURL(previousCurrent.url)

    previewState.value = {
      base,
      current,
    }
  } catch (err: unknown) {
    if (runId === previewRunId) {
      previewError.value = err instanceof Error ? err.message : '?汗憭望?'
      revokePreviewUrls()
      previewState.value = { base: null, current: null }
    }
  } finally {
    if (runId === previewRunId) previewLoading.value = false
  }
}

async function handleFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = '隢???PDF 瑼?'
    return
  }

  error.value = null
  previewError.value = null
  pdfFile.value = file
  totalPages.value = 0
  previewPage.value = 1
  progress.value = 0
  revokeGeneratedUrls()
  generated.value = []
  revokePreviewUrls()
  previewState.value = { base: null, current: null }

  try {
    const doc = await loadPdf(file)
    totalPages.value = doc.numPages
    doc.destroy()
    await refreshPreview()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '霈??PDF 憭望?'
  }
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

function changePreviewPage(delta: number) {
  if (totalPages.value <= 0) return
  previewPage.value = clampPreviewPage(previewPage.value + delta)
  void refreshPreview()
}

function commitPreviewPage() {
  if (totalPages.value <= 0) return
  previewPage.value = clampPreviewPage(previewPage.value)
  void refreshPreview()
}

watch(scale, () => {
  if (pdfFile.value) void refreshPreview()
})

async function convertAll() {
  if (!pdfFile.value) return

  isProcessing.value = true
  error.value = null
  progress.value = 0
  revokeGeneratedUrls()
  generated.value = []

  try {
    const doc = await loadPdf(pdfFile.value)
    const results: GeneratedImage[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('?⊥?撱箇????怠?')

      await page.render({ canvas, canvasContext: ctx, viewport }).promise

      const mime = format.value === 'png' ? 'image/png' : 'image/jpeg'
      const q = format.value === 'jpeg' ? quality.value / 100 : undefined

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => {
            if (output) resolve(output)
            else reject(new Error('??頛詨憭望?'))
          },
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
    error.value = err instanceof Error ? err.message : '頧?憭望?'
  } finally {
    isProcessing.value = false
  }
}

async function downloadOne(item: GeneratedImage) {
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
  revokeGeneratedUrls()
  revokePreviewUrls()
  generated.value = []
  previewState.value = { base: null, current: null }
  pdfFile.value = null
  totalPages.value = 0
  progress.value = 0
  error.value = null
  previewError.value = null
}

onBeforeUnmount(() => {
  revokeGeneratedUrls()
  revokePreviewUrls()
})
</script>

<template>
  <ToolLayout
    title="PDF 轉圖片"
    icon="🖼️"
    description="上傳 PDF 後可以逐頁預覽，並匯出成 PNG 或 JPEG。"
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
      <div class="dz-icon">🖼️</div>
      <p>點擊或拖放 PDF 檔案</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="err">錯誤：{{ error }}</p>

    <div v-if="pdfFile" class="form">
      <div class="file-row">{{ fileLabel }} / 共 {{ totalPages }} 頁</div>

      <section class="preview-panel">
        <div class="results-bar">
          <div>
            <h3>頁面預覽</h3>
            <p class="help">
              你可以切換頁碼查看不同頁面，右側是目前倍率的輸出效果。
            </p>
          </div>
          <div class="preview-nav">
            <PixelButton
              size="sm"
              variant="secondary"
              :disabled="previewLoading || previewPage <= 1"
              @click="changePreviewPage(-1)"
            >
              上一頁
            </PixelButton>
            <label class="preview-page-field">
              <span class="help">頁碼</span>
              <input
                v-model.number="previewPage"
                class="page-input"
                type="number"
                min="1"
                :max="totalPages"
                @change="commitPreviewPage"
              />
            </label>
            <PixelButton
              size="sm"
              variant="secondary"
              :disabled="previewLoading || previewPage >= totalPages"
              @click="changePreviewPage(1)"
            >
              下一頁
            </PixelButton>
          </div>
        </div>

        <div class="preview-meta">
          <span class="preview-state">
            {{ previewLoading ? '預覽更新中' : `第 ${previewPage} / ${totalPages || 0} 頁` }}
          </span>
        </div>

        <p v-if="previewError" class="err">預覽失敗：{{ previewError }}</p>

        <div v-if="previewState.base && previewState.current" class="preview-grid">
          <article class="preview-card">
            <div class="preview-headline">
              <span>1x 基準</span>
              <strong>{{ previewState.base.width }} × {{ previewState.base.height }} px</strong>
            </div>
            <img :src="previewState.base.url" :alt="`第 ${previewPage} 頁 1x 預覽`" />
          </article>

          <article class="preview-card">
            <div class="preview-headline">
              <span>目前倍率 {{ previewScaleText }}</span>
              <strong>{{ previewState.current.width }} × {{ previewState.current.height }} px</strong>
            </div>
            <img :src="previewState.current.url" :alt="`第 ${previewPage} 頁 ${previewScaleText} 預覽`" />
          </article>
        </div>

        <p class="help">{{ scaleHelpText }}</p>
      </section>

      <div class="grid">
        <label class="field">
          <span class="label">輸出格式</span>
          <select v-model="format" class="pixel-input">
            <option value="png">PNG - 適合保留細節</option>
            <option value="jpeg">JPEG - 適合較小檔案</option>
          </select>
        </label>

        <label v-if="format === 'jpeg'" class="field">
          <span class="label">JPEG 品質（{{ quality }}%）</span>
          <input v-model.number="quality" type="range" min="40" max="100" />
        </label>

        <label class="field">
          <span class="label">輸出倍率（{{ previewScaleText }}）</span>
          <input v-model.number="scale" type="range" min="1" max="4" step="0.5" />
          <small class="help">倍率越高，畫面越細，但檔案也會更大。</small>
        </label>

        <label class="field">
          <span class="label">輸出檔名前綴</span>
          <input v-model="outputName" class="pixel-input" type="text" placeholder="images" />
        </label>
      </div>

      <div v-if="isProcessing || generated.length > 0" class="progress-wrap">
        <div class="progress-head">
          <span>{{ isProcessing ? `轉換中 ${progress}/${totalPages}` : '處理完成' }}</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="convertAll">
          {{ isProcessing ? '轉換中' : '開始轉換' }}
        </PixelButton>
        <PixelButton variant="danger" size="sm" @click="reset">
          重新選擇
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
              下載第 {{ item.pageNum }} 頁
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

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
}

.preview-meta {
  display: flex;
  justify-content: flex-end;
}

.preview-nav {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-page-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-input {
  width: 88px;
  font-family: inherit;
  font-size: 13px;
  padding: 8px 10px;
  background: var(--bg);
  color: var(--text);
  border: 2px solid var(--border);
  outline: none;
}

.preview-state {
  padding: 6px 10px;
  background: var(--accent);
  color: var(--bg);
  border: 2px solid var(--border);
  font-size: 10px;
  white-space: nowrap;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.preview-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 3px solid var(--border);
  background: var(--bg);
  padding: 10px;
}

.preview-headline {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  font-size: 10px;
  flex-wrap: wrap;
}

.preview-headline span {
  color: var(--accent-2);
}

.preview-headline strong {
  color: var(--text);
}

.preview-card img {
  width: 100%;
  height: auto;
  display: block;
  background: #fff;
  border: 2px solid var(--border);
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
  line-height: 1.5;
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
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
  overflow: hidden;
}

.thumb img {
  width: 100%;
  aspect-ratio: 3 / 4;
  height: auto;
  display: block;
  object-fit: contain;
  background: #fff;
  border-bottom: 2px solid var(--border);
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

