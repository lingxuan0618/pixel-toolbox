<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from 'vue'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { pdfjsLib, type PDFDocumentProxy } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

void PdfToolTabs

type Mode = 'text' | 'image'
type Preset = 'diagonal' | 'center' | 'top' | 'bottom'

const pdfFile = ref<File | null>(null)
const pdfBytes = shallowRef<Uint8Array | null>(null)
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null)
const totalPages = ref(0)
const currentPage = ref(1)
const error = ref<string | null>(null)
const isLoading = ref(false)
const isExporting = ref(false)
const outputName = ref('watermarked')

const canvasDisplayWidth = ref(0)
const canvasDisplayHeight = ref(0)

const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const canvasWrap = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)

const mode = ref<Mode>('text')
const text = ref('CONFIDENTIAL')
const color = ref('#29adff')
const fontSize = ref(36)
const opacity = ref(30)
const xRatio = ref(0.5)
const yRatio = ref(0.5)
const rotation = ref(-45)
const widthRatio = ref(0.4)

const sigImageFile = ref<File | null>(null)
const sigImageDataUrl = ref('')
const sigImageEl = shallowRef<HTMLImageElement | null>(null)

const previewHint = computed(() =>
  mode.value === 'text'
    ? '拖曳可調整位置，旋轉手把可直接轉角度。'
    : '拖曳可調整位置，旋轉手把可直接轉角度。',
)

const displayImageWidth = computed(() => Math.round(widthRatio.value * canvasDisplayWidth.value))

const pageMarkers = computed(() =>
  Array.from({ length: totalPages.value }, (_, index) => {
    return { page: index + 1 }
  }),
)

function hexToRgb(hex: string) {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) return rgb(0.16, 0.68, 1)
  return rgb(
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
  )
}

async function loadPdfDocument(file: File) {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  pdfDoc.value?.destroy()
  pdfDoc.value = doc
  totalPages.value = doc.numPages
  currentPage.value = 1
  await nextTick()
  await renderPage(1)
}

async function handlePdfFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = '隢???PDF 瑼?'
    return
  }

  pdfFile.value = file
  pdfBytes.value = new Uint8Array(await file.arrayBuffer())
  outputName.value = file.name.replace(/\.pdf$/i, '') + '_watermarked'
  error.value = null
  await loadPdfDocument(file)
}

async function loadSignatureImage(file: File) {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    error.value = '隢???PNG / JPG / WebP ??'
    return
  }

  sigImageFile.value = file
  error.value = null

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('圖片讀取失敗'))
    reader.readAsDataURL(file)
  })

  sigImageDataUrl.value = dataUrl
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('??頛憭望?'))
    img.src = dataUrl
  })
  sigImageEl.value = img
}

async function renderPage(pageNum: number) {
  if (!pdfDoc.value || !pdfCanvas.value) return

  const page = await pdfDoc.value.getPage(pageNum)
  const baseViewport = page.getViewport({ scale: 1 })
  const wrapWidth = canvasWrap.value?.parentElement?.clientWidth ?? Math.min(window.innerWidth - 40, 900)
  const maxWidth = Math.min(wrapWidth - 8, 900)
  const scale = maxWidth / baseViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = pdfCanvas.value
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvasDisplayWidth.value = viewport.width
  canvasDisplayHeight.value = viewport.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
}

function changePage(delta: number) {
  const next = currentPage.value + delta
  if (next < 1 || next > totalPages.value) return
  currentPage.value = next
  void renderPage(next)
}

const textDisplaySize = computed(() => Math.max(12, Math.round(fontSize.value * (canvasDisplayWidth.value / 595))))
const imageDisplayWidth = computed(() => Math.round(widthRatio.value * canvasDisplayWidth.value))

function setPreset(preset: Preset) {
  xRatio.value = 0.5
  if (preset === 'diagonal') {
    yRatio.value = 0.5
    rotation.value = -45
    return
  }

  if (preset === 'center') {
    yRatio.value = 0.5
    rotation.value = 0
    return
  }

  if (preset === 'top') {
    yRatio.value = 0.18
    rotation.value = 0
    return
  }

  yRatio.value = 0.82
  rotation.value = 0
}

let dragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartXRatio = 0
let dragStartYRatio = 0
let rotating = false
let rotateStartAngle = 0
let rotateStartRotation = 0

function startDrag(e: PointerEvent) {
  e.preventDefault()
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartXRatio = xRatio.value
  dragStartYRatio = yRatio.value
}

function moveDrag(e: PointerEvent) {
  if (!dragging || !pdfCanvas.value) return
  e.preventDefault()
  const rect = pdfCanvas.value.getBoundingClientRect()
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  xRatio.value = Math.max(0, Math.min(1, dragStartXRatio + dx / rect.width))
  yRatio.value = Math.max(0, Math.min(1, dragStartYRatio + dy / rect.height))
}

function stopDrag() {
  dragging = false
}

function getWatermarkPoint(e: PointerEvent) {
  if (!pdfCanvas.value) return null
  const rect = pdfCanvas.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    rect,
  }
}

function startRotate(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const point = getWatermarkPoint(e)
  const target = e.currentTarget as HTMLElement | null
  if (!point || !target) return

  const rect = target.closest('.placed-watermark')?.getBoundingClientRect()
  if (!rect) return

  const centerX = rect.left + rect.width / 2 - point.rect.left
  const centerY = rect.top + rect.height / 2 - point.rect.top
  rotateStartAngle = Math.atan2(point.y - centerY, point.x - centerX)
  rotateStartRotation = rotation.value
  rotating = true
}

function moveRotate(e: PointerEvent) {
  if (!rotating) return
  e.preventDefault()
  const point = getWatermarkPoint(e)
  if (!point) return

  const target = document.querySelector('.placed-watermark')?.getBoundingClientRect()
  if (!target) return

  const centerX = target.left + target.width / 2 - point.rect.left
  const centerY = target.top + target.height / 2 - point.rect.top
  const currentAngle = Math.atan2(point.y - centerY, point.x - centerX)
  rotation.value = rotateStartRotation + ((currentAngle - rotateStartAngle) * 180) / Math.PI
}

let resizing = false
let resizeStartX = 0
let resizeStartWidth = 0
let resizeStartFontSize = 0

function startResize(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  resizing = true
  resizeStartX = e.clientX
  resizeStartWidth = widthRatio.value
  resizeStartFontSize = fontSize.value
}

function moveResize(e: PointerEvent) {
  if (!resizing || !pdfCanvas.value) return
  e.preventDefault()
  const rect = pdfCanvas.value.getBoundingClientRect()
  const deltaRatio = (e.clientX - resizeStartX) / rect.width

  if (mode.value === 'image') {
    widthRatio.value = Math.max(0.05, Math.min(1, resizeStartWidth + deltaRatio))
    return
  }

  fontSize.value = Math.max(12, Math.min(200, resizeStartFontSize + (e.clientX - resizeStartX) / 4))
}

function stopResize() {
  resizing = false
}

function onCanvasMove(e: PointerEvent) {
  if (dragging) moveDrag(e)
  if (resizing) moveResize(e)
  if (rotating) moveRotate(e)
}

function onCanvasUp() {
  stopDrag()
  stopResize()
  rotating = false
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void handlePdfFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void handlePdfFile(file)
}

function onImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void loadSignatureImage(file)
  ;(e.target as HTMLInputElement).value = ''
}

function clearSignatureImage() {
  sigImageFile.value = null
  sigImageDataUrl.value = ''
  sigImageEl.value = null
}

function reset() {
  pdfFile.value = null
  pdfBytes.value = null
  pdfDoc.value?.destroy()
  pdfDoc.value = null
  totalPages.value = 0
  currentPage.value = 1
  error.value = null
  clearSignatureImage()
}

async function applyWatermark() {
  if (!pdfFile.value) {
    error.value = '請先放入 PDF'
    return
  }

  if (mode.value === 'text' && !text.value.trim()) {
    error.value = '請先輸入水印文字'
    return
  }

  if (mode.value === 'image' && !sigImageFile.value) {
    error.value = '請先選擇水印圖片'
    return
  }

  isExporting.value = true
  error.value = null

  try {
    const freshBytes = new Uint8Array(await pdfFile.value.arrayBuffer())
    const doc = await PDFDocument.load(freshBytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })
    const op = opacity.value / 100
    const pdfRotation = -rotation.value
    const theta = (pdfRotation * Math.PI) / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)

    if (mode.value === 'text') {
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const c = hexToRgb(color.value)
      const fs = fontSize.value
      const textWidth = font.widthOfTextAtSize(text.value, fs)
      const textHeight = fs

      for (const page of doc.getPages()) {
        const { width: pw, height: ph } = page.getSize()
        const cxPdf = pw * xRatio.value
        const cyPdf = ph * (1 - yRatio.value)
        const x = cxPdf - (textWidth / 2) * cos + (textHeight / 2) * sin
        const y = cyPdf - (textWidth / 2) * sin - (textHeight / 2) * cos

        page.drawText(text.value, {
          x,
          y,
          size: fs,
          font,
          color: c,
          opacity: op,
          rotate: degrees(pdfRotation),
        })
      }
    } else {
      const file = sigImageFile.value!
      const bytes = await file.arrayBuffer()
      const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
      const isWebp = file.type === 'image/webp' || /\.webp$/i.test(file.name)
      let embedded

      if (isPng) {
        embedded = await doc.embedPng(bytes)
      } else if (isWebp) {
        const bitmap = await createImageBitmap(file)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('??頧?憭望?')
        ctx.drawImage(bitmap, 0, 0)
        const png = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('??頧?憭望?'))
          }, 'image/png')
        })
        embedded = await doc.embedPng(await png.arrayBuffer())
      } else {
        embedded = await doc.embedJpg(bytes)
      }

      for (const page of doc.getPages()) {
        const { width: pw, height: ph } = page.getSize()
        const wmW = pw * widthRatio.value
        const wmH = wmW * (embedded.height / embedded.width)
        const cxPdf = pw * xRatio.value
        const cyPdf = ph * (1 - yRatio.value)
        const x = cxPdf - (wmW / 2) * cos + (wmH / 2) * sin
        const y = cyPdf - (wmW / 2) * sin - (wmH / 2) * cos

        page.drawImage(embedded, {
          x,
          y,
          width: wmW,
          height: wmH,
          rotate: degrees(pdfRotation),
          opacity: op,
        })
      }
    }

    const out = await doc.save()
    const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const name = outputName.value.trim() || 'watermarked'
    downloadBlob(blob, /\.pdf$/i.test(name) ? name : `${name}.pdf`)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '輸出失敗'
  } finally {
    isExporting.value = false
  }
}
watch(currentPage, () => {
  void renderPage(currentPage.value)
})

onUnmounted(() => {
  pdfDoc.value?.destroy()
})
</script>

<template>
  <ToolLayout
    title="PDF 浮水印"
    icon="💧"
    description="在 PDF 上加上文字或圖片浮水印，支援拖曳、縮放與旋轉。"
  >
    <PdfToolTabs current="/pdf-watermark" />

    <div
      v-if="!pdfDoc"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dropzone-icon">💧</div>
      <p class="dropzone-text">點擊或拖放 PDF 檔案</p>
      <p class="dropzone-sub">先載入 PDF，再把文字或圖片放上去。</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="error">錯誤：{{ error }}</p>
    <p v-if="isLoading" class="loading">載入中...</p>

    <div v-if="pdfDoc" class="workspace">
      <section class="preview-area">
        <div class="file-row">{{ pdfFile?.name }}</div>

        <div v-if="totalPages > 1" class="page-bar">
          <PixelButton variant="secondary" size="sm" :disabled="currentPage <= 1" @click="changePage(-1)">
            上一頁
          </PixelButton>
          <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <PixelButton variant="secondary" size="sm" :disabled="currentPage >= totalPages" @click="changePage(1)">
            下一頁
          </PixelButton>
        </div>

        <div class="page-strip">
          <button
            v-for="marker in pageMarkers"
            :key="marker.page"
            type="button"
            class="page-chip"
            :class="{ active: marker.page === currentPage }"
            @click="currentPage = marker.page"
          >
            <span>第 {{ marker.page }} 頁</span>
          </button>
        </div>

        <div
          ref="canvasWrap"
          class="pdf-canvas-wrap"
          @pointermove="onCanvasMove"
          @pointerup="onCanvasUp"
          @pointercancel="onCanvasUp"
          @pointerleave="onCanvasUp"
        >
          <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>

          <div
            v-if="mode === 'text' && text.trim()"
            class="placed-watermark text-watermark"
            :style="{
              left: `${xRatio * canvasDisplayWidth}px`,
              top: `${yRatio * canvasDisplayHeight}px`,
              color,
              fontSize: `${textDisplaySize}px`,
              opacity: String(opacity / 100),
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }"
            @pointerdown="startDrag"
          >
            <button class="rotate-handle" type="button" title="按住拖曳旋轉" @pointerdown.stop="startRotate">
              ↻
            </button>
            <span class="watermark-text">{{ text }}</span>
            <div class="resize-handle" @pointerdown="startResize"></div>
          </div>

          <div
            v-else-if="mode === 'image' && sigImageDataUrl"
            class="placed-watermark image-watermark"
            :style="{
              left: `${xRatio * canvasDisplayWidth}px`,
              top: `${yRatio * canvasDisplayHeight}px`,
              width: `${imageDisplayWidth}px`,
              opacity: String(opacity / 100),
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }"
            @pointerdown="startDrag"
          >
            <button class="rotate-handle" type="button" title="按住拖曳旋轉" @pointerdown.stop="startRotate">
              ↻
            </button>
            <img :src="sigImageDataUrl" class="watermark-image" :draggable="false" />
            <div class="resize-handle" @pointerdown="startResize"></div>
          </div>
        </div>

        <p class="hint">{{ previewHint }}</p>
      </section>

      <section class="controls">
        <div class="mode-switch">
          <button type="button" class="mode-btn" :class="{ active: mode === 'text' }" @click="mode = 'text'">文字浮水印</button>
          <button type="button" class="mode-btn" :class="{ active: mode === 'image' }" @click="mode = 'image'">圖片浮水印</button>
        </div>
        <template v-if="mode === 'text'">
          <label class="field">
            <span class="label">水印文字</span>
            <input v-model="text" class="pixel-input" type="text" maxlength="40" />
          </label>
          <label class="field">
            <span class="label">文字顏色</span>
            <input v-model="color" type="color" class="color-input" />
          </label>
          <label class="field">
            <span class="label">字級（{{ fontSize }}pt）</span>
            <input v-model.number="fontSize" type="range" min="12" max="200" />
          </label>
        </template>

        <template v-else>
          <div class="field">
            <span class="label">水印圖片</span>
            <div v-if="!sigImageFile" class="image-drop" @click="imageInput?.click()">
              <span class="image-drop-icon">🖼</span>
              <span>點擊上傳 PNG / JPG / WebP</span>
              <span class="sub-hint">適合直接放入已做好的圖樣。</span>
            </div>
            <div v-else class="image-preview">
              <img :src="sigImageDataUrl" />
              <div class="image-info">{{ sigImageFile.name }}</div>
            </div>
            <input
              ref="imageInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              hidden
              @change="onImageChange"
            />
          </div>
          <label class="field">
            <span class="label">圖片寬度（{{ Math.round(widthRatio * 100) }}% / {{ displayImageWidth }}px）</span>
            <input v-model.number="widthRatio" type="range" min="0.05" max="1" step="0.01" />
          </label>
        </template>

        <div class="field">
          <span class="label">快速位置</span>
          <div class="preset-grid">
            <button type="button" class="preset-btn" @click="setPreset('diagonal')">斜角</button>
            <button type="button" class="preset-btn" @click="setPreset('center')">置中</button>
            <button type="button" class="preset-btn" @click="setPreset('top')">上方</button>
            <button type="button" class="preset-btn" @click="setPreset('bottom')">下方</button>
          </div>
        </div>

        <label class="field">
          <span class="label">水平位置（{{ Math.round(xRatio * 100) }}%）</span>
          <input v-model.number="xRatio" type="range" min="0" max="1" step="0.01" />
        </label>

        <label class="field">
          <span class="label">垂直位置（{{ Math.round(yRatio * 100) }}%）</span>
          <input v-model.number="yRatio" type="range" min="0" max="1" step="0.01" />
        </label>

        <label class="field">
          <span class="label">旋轉角度（{{ Math.round(rotation) }}°）</span>
          <input v-model.number="rotation" type="range" min="-180" max="180" />
        </label>

        <label class="field">
          <span class="label">透明度（{{ opacity }}%）</span>
          <input v-model.number="opacity" type="range" min="10" max="100" />
        </label>

        <label class="field">
          <span class="label">輸出檔名</span>
          <div class="filename-row">
            <input v-model="outputName" class="pixel-input" type="text" placeholder="watermarked" />
            <span class="ext">.pdf</span>
          </div>
        </label>

        <div class="actions">
          <PixelButton size="lg" :disabled="isExporting" @click="applyWatermark">
            {{ isExporting ? '輸出中' : '套用浮水印' }}
          </PixelButton>
          <PixelButton variant="danger" size="sm" @click="reset">重新選擇</PixelButton>
        </div>
      </section>
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

.dropzone-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

.dropzone-text {
  font-size: 14px;
  margin: 8px 0;
}

.dropzone-sub,
.sub-hint,
.hint,
.page-info {
  font-size: 10px;
  color: var(--text-dim);
}

.error {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  white-space: pre-wrap;
}

.loading {
  color: var(--accent);
  font-size: 12px;
  margin: 16px 0;
}

.workspace {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}

@media (min-width: 960px) {
  .workspace {
    grid-template-columns: 1.6fr 1fr;
    align-items: start;
  }
}

.preview-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-row {
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.page-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.page-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 3px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.page-chip.active {
  background: var(--accent);
  color: var(--bg);
}

.page-chip.hasMark small {
  background: var(--highlight);
  color: var(--text);
  padding: 1px 6px;
  border: 2px solid var(--border);
}

.pdf-canvas-wrap {
  position: relative;
  border: 4px solid var(--border);
  background: var(--p8-white);
  box-shadow: 6px 6px 0 0 var(--shadow);
  overflow: hidden;
  touch-action: none;
  width: 100%;
}

.pdf-canvas {
  display: block;
  max-width: 100%;
}

.placed-watermark {
  position: absolute;
  cursor: grab;
  border: 2px dashed var(--accent);
  background: transparent;
  user-select: none;
  touch-action: none;
}

.placed-watermark:active {
  cursor: grabbing;
}

.rotate-handle {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg);
  display: grid;
  place-items: center;
  font-size: 14px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  box-shadow: 2px 2px 0 0 var(--shadow);
}

.watermark-image {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  bottom: -8px;
  right: -8px;
  width: 16px;
  height: 16px;
  background: var(--accent);
  border: 2px solid var(--border);
  cursor: nwse-resize;
}

.hint {
  text-align: center;
  margin: 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mode-btn {
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  font-family: inherit;
  font-size: 12px;
  padding: 8px;
  cursor: pointer;
}

.mode-btn.active {
  background: var(--accent);
  color: var(--bg);
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
  flex: 1;
  font-family: inherit;
  font-size: 13px;
  padding: 10px 12px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  outline: none;
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

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.preset-btn {
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  font-family: inherit;
  font-size: 11px;
  padding: 8px 4px;
  cursor: pointer;
}

.preset-btn:hover {
  background: var(--highlight);
}

.image-drop {
  border: 3px dashed var(--border);
  padding: 20px;
  text-align: center;
  cursor: pointer;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.image-drop:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.image-drop-icon {
  font-size: 28px;
}

.image-preview {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--surface);
  border: 3px solid var(--border);
  align-items: center;
}

.image-preview img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: var(--p8-white);
  border: 2px solid var(--border);
}

.image-info {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filename-row {
  display: flex;
  gap: 8px;
}

.ext {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  background: var(--bg);
  border: 3px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
