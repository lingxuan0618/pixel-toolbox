<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { pdfjsLib, type PDFDocumentProxy } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

void PdfToolTabs

type SigMode = 'draw' | 'image'

interface PlacedSignature {
  id: string
  page: number
  xRatio: number
  yRatio: number
  widthRatio: number
  rotation: number
  dataUrl: string
  aspectRatio: number
}

const pdfFile = ref<File | null>(null)
const pdfBytes = shallowRef<Uint8Array | null>(null)
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null)
const totalPages = ref(0)
const currentPage = ref(1)
const error = ref<string | null>(null)
const isLoading = ref(false)
const isExporting = ref(false)
const outputName = ref('signed')

const placedSignatures = ref<PlacedSignature[]>([])
const canvasDisplayWidth = ref(0)
const canvasDisplayHeight = ref(0)

const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const canvasWrap = ref<HTMLDivElement | null>(null)
const sigCanvas = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const sigImageInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)

const sigMode = ref<SigMode>('draw')
const sigHasInk = ref(false)
const inkColor = ref('#1d2b53')
const inkWidth = ref(3)
const sigImageFile = ref<File | null>(null)
const sigImageDataUrl = ref('')
const sigImageEl = shallowRef<HTMLImageElement | null>(null)

const selectedCount = computed(() => placedSignatures.value.length)
const hasUploadedImage = computed(() => !!sigImageDataUrl.value)
const hasAnySignature = computed(() =>
  sigMode.value === 'draw' ? sigHasInk.value : hasUploadedImage.value,
)
const placedOnCurrentPage = computed(() =>
  placedSignatures.value.filter((sig) => sig.page === currentPage.value),
)

function getPointer(e: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  }
}

let drawing = false
let lastX = 0
let lastY = 0

function sigDown(e: PointerEvent) {
  if (!sigCanvas.value) return
  e.preventDefault()
  drawing = true
  const point = getPointer(e, sigCanvas.value)
  lastX = point.x
  lastY = point.y
  const ctx = sigCanvas.value.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = inkColor.value
  ctx.beginPath()
  ctx.arc(point.x, point.y, inkWidth.value / 2, 0, Math.PI * 2)
  ctx.fill()
  sigHasInk.value = true
}

function sigMove(e: PointerEvent) {
  if (!drawing || !sigCanvas.value) return
  e.preventDefault()
  const ctx = sigCanvas.value.getContext('2d')
  if (!ctx) return
  const point = getPointer(e, sigCanvas.value)
  ctx.strokeStyle = inkColor.value
  ctx.lineWidth = inkWidth.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
  lastX = point.x
  lastY = point.y
}

function sigUp() {
  drawing = false
}

function clearSignature() {
  if (sigCanvas.value) {
    const ctx = sigCanvas.value.getContext('2d')
    ctx?.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height)
  }
  sigHasInk.value = false
  sigImageFile.value = null
  sigImageDataUrl.value = ''
  sigImageEl.value = null
}

async function handleSigImage(file: File) {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    error.value = '請選擇 PNG、JPG 或 WebP 圖片'
    return
  }

  error.value = null
  sigImageFile.value = file

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
    img.onerror = () => reject(new Error('圖片載入失敗'))
    img.src = dataUrl
  })
  sigImageEl.value = img
}

function onSigImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void handleSigImage(file)
  ;(e.target as HTMLInputElement).value = ''
}

async function getSignatureDataUrl(): Promise<string | null> {
  if (sigMode.value === 'draw') {
    if (!sigHasInk.value || !sigCanvas.value) return null
    return sigCanvas.value.toDataURL('image/png')
  }
  return sigImageDataUrl.value || null
}

async function downloadSignature() {
  const dataUrl = await getSignatureDataUrl()
  if (!dataUrl) return
  const blob = await fetch(dataUrl).then((response) => response.blob())
  const ext = dataUrl.startsWith('data:image/png')
    ? 'png'
    : dataUrl.startsWith('data:image/jpeg')
      ? 'jpg'
      : dataUrl.startsWith('data:image/webp')
        ? 'webp'
        : 'png'
  downloadBlob(blob, `signature.${ext}`)
}

async function handleFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = '請放入 PDF 檔案'
    return
  }

  error.value = null
  isLoading.value = true
  placedSignatures.value = []

  try {
    pdfFile.value = file
    outputName.value = file.name.replace(/\.pdf$/i, '') + '_signed'
    const buffer = await file.arrayBuffer()
    pdfBytes.value = new Uint8Array(buffer)
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    pdfDoc.value = doc
    totalPages.value = doc.numPages
    currentPage.value = 1
    await nextTick()
    await renderPage(1)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '讀取 PDF 失敗'
    pdfDoc.value = null
  } finally {
    isLoading.value = false
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc.value || !pdfCanvas.value) return
  const page = await pdfDoc.value.getPage(pageNum)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const wrapWidth = canvasWrap.value?.parentElement?.clientWidth ?? Math.min(window.innerWidth - 40, 900)
  const maxWidth = Math.min(wrapWidth - 8, 900)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = (maxWidth / baseViewport.width) * dpr
  const viewport = page.getViewport({ scale })

  const canvas = pdfCanvas.value
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width / dpr}px`
  canvas.style.height = `${viewport.height / dpr}px`
  canvasDisplayWidth.value = viewport.width / dpr
  canvasDisplayHeight.value = viewport.height / dpr

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

async function applySignatureToCurrentPage() {
  const dataUrl = await getSignatureDataUrl()
  if (!dataUrl) {
    error.value = sigMode.value === 'draw' ? '請先寫下簽名' : '請先選擇簽名圖片'
    return
  }

  error.value = null
  const image =
    sigMode.value === 'image' && sigImageEl.value
      ? sigImageEl.value
      : await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.src = dataUrl
        })

  placedSignatures.value.push({
    id: crypto.randomUUID(),
    page: currentPage.value,
    xRatio: 0.35,
    yRatio: 0.7,
    widthRatio: 0.3,
    rotation: 0,
    dataUrl,
    aspectRatio: image.height / image.width,
  })
}

function removeSignature(id: string) {
  placedSignatures.value = placedSignatures.value.filter((item) => item.id !== id)
}

let dragging: PlacedSignature | null = null
let dragOffsetX = 0
let dragOffsetY = 0
let resizing: PlacedSignature | null = null
let resizeStartX = 0
let resizeStartWidth = 0
let rotating: PlacedSignature | null = null
let rotateStartAngle = 0
let rotateStartRotation = 0

function getCanvasPoint(e: PointerEvent) {
  if (!pdfCanvas.value) return null
  const rect = pdfCanvas.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    rect,
  }
}

function startDrag(sig: PlacedSignature, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragging = sig
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragOffsetX = e.clientX - rect.left
  dragOffsetY = e.clientY - rect.top
}

function onDragMove(e: PointerEvent) {
  if (!dragging || !pdfCanvas.value) return
  e.preventDefault()
  const rect = pdfCanvas.value.getBoundingClientRect()
  const px = e.clientX - rect.left - dragOffsetX
  const py = e.clientY - rect.top - dragOffsetY
  const newXRatio = px / rect.width
  const newYRatio = py / rect.height
  dragging.xRatio = Math.max(0, Math.min(1 - dragging.widthRatio, newXRatio))
  const heightRatio = dragging.widthRatio * dragging.aspectRatio * (rect.width / rect.height)
  dragging.yRatio = Math.max(0, Math.min(1 - heightRatio, newYRatio))
}

function startResize(sig: PlacedSignature, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  resizing = sig
  resizeStartX = e.clientX
  resizeStartWidth = sig.widthRatio
}

function startRotate(sig: PlacedSignature, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const point = getCanvasPoint(e)
  if (!point) return

  const element = document.querySelector(`[data-sig-id="${sig.id}"]`) as HTMLElement | null
  if (!element) return

  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2 - point.rect.left
  const centerY = rect.top + rect.height / 2 - point.rect.top
  rotateStartAngle = Math.atan2(point.y - centerY, point.x - centerX)
  rotateStartRotation = sig.rotation
  rotating = sig
}

function onResizeMove(e: PointerEvent) {
  if (!resizing || !pdfCanvas.value) return
  e.preventDefault()
  const rect = pdfCanvas.value.getBoundingClientRect()
  const deltaPx = e.clientX - resizeStartX
  const deltaRatio = deltaPx / rect.width
  resizing.widthRatio = Math.max(0.05, Math.min(0.95, resizeStartWidth + deltaRatio))
}

function onRotateMove(e: PointerEvent) {
  if (!rotating || !pdfCanvas.value) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (!point) return

  const element = document.querySelector(`[data-sig-id="${rotating.id}"]`) as HTMLElement | null
  if (!element) return

  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2 - point.rect.left
  const centerY = rect.top + rect.height / 2 - point.rect.top
  const currentAngle = Math.atan2(point.y - centerY, point.x - centerX)
  rotating.rotation = ((rotateStartRotation + ((currentAngle - rotateStartAngle) * 180) / Math.PI) % 360 + 360) % 360
}

function onWrapPointerMove(e: PointerEvent) {
  if (rotating) onRotateMove(e)
  if (dragging) onDragMove(e)
  if (resizing) onResizeMove(e)
}

function endDrag() {
  dragging = null
  resizing = null
  rotating = null
}

async function downloadSigned() {
  if (!pdfFile.value || placedSignatures.value.length === 0) {
    error.value = '請先放入至少一個簽名'
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

    for (const sig of placedSignatures.value) {
      const page = doc.getPage(sig.page - 1)
      const { width: pw, height: ph } = page.getSize()
      const pngBytes = await fetch(sig.dataUrl).then((response) => response.arrayBuffer())
      const png = await doc.embedPng(pngBytes)
      const sigW = pw * sig.widthRatio
      const sigH = sigW * sig.aspectRatio

      page.drawImage(png, {
        x: pw * sig.xRatio,
        y: ph - ph * sig.yRatio - sigH,
        width: sigW,
        height: sigH,
        rotate: degrees(-sig.rotation),
      })
    }

    const out = await doc.save()
    const blob = new Blob([out as BlobPart], { type: 'application/pdf' })
    const name = outputName.value.trim() || 'signed'
    downloadBlob(blob, /\.pdf$/i.test(name) ? name : `${name}.pdf`)
  } catch (e: unknown) {
    error.value = `輸出失敗：${e instanceof Error ? e.message : '未知錯誤'}`
  } finally {
    isExporting.value = false
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

function reset() {
  pdfFile.value = null
  pdfBytes.value = null
  pdfDoc.value = null
  placedSignatures.value = []
  totalPages.value = 0
  currentPage.value = 1
  error.value = null
  clearSignature()
}

onUnmounted(() => {
  pdfDoc.value?.destroy()
})
</script>

<template>
  <ToolLayout
    title="PDF 簽名"
    icon="✍"
    description="在 PDF 上放置簽名，支援拖曳、縮放與旋轉。"
  >
    <PdfToolTabs current="/pdf-sign" />

    <div
      v-if="!pdfDoc"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dropzone-icon">✍</div>
      <p class="dropzone-text">點擊或拖放 PDF 檔案</p>
      <p class="dropzone-sub">可以先準備簽名，再放到指定頁面上。</p>
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

        <div
          ref="canvasWrap"
          class="pdf-canvas-wrap"
          @pointermove="onWrapPointerMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @pointerleave="endDrag"
        >
          <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>

          <div
            v-for="sig in placedOnCurrentPage"
            :key="sig.id"
            class="placed-sig"
            :data-sig-id="sig.id"
            :style="{
              left: `${sig.xRatio * canvasDisplayWidth}px`,
              top: `${sig.yRatio * canvasDisplayHeight}px`,
              width: `${sig.widthRatio * canvasDisplayWidth}px`,
              transform: `rotate(${sig.rotation}deg)`,
            }"
            @pointerdown="startDrag(sig, $event)"
          >
            <img :src="sig.dataUrl" class="sig-img" :draggable="false" />
            <button
              class="del-btn"
              type="button"
              title="刪除"
              @pointerdown.stop
              @click="removeSignature(sig.id)"
            >
              ×
            </button>
            <button
              class="rotate-btn"
              type="button"
              title="按住拖曳旋轉"
              @pointerdown.stop="startRotate(sig, $event)"
            >
              ↻
            </button>
            <div class="resize-handle" @pointerdown="startResize(sig, $event)"></div>
          </div>
        </div>

        <p class="hint">拖曳可移動，拖曳圓點可旋轉，右下角可縮放。</p>
      </section>

      <section class="signing-area">
        <div class="mode-switch">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: sigMode === 'draw' }"
            @click="sigMode = 'draw'"
          >
            手寫簽名
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: sigMode === 'image' }"
            @click="sigMode = 'image'"
          >
            圖片簽名
          </button>
        </div>

        <template v-if="sigMode === 'draw'">
          <canvas
            ref="sigCanvas"
            width="500"
            height="200"
            class="sig-canvas"
            @pointerdown="sigDown"
            @pointermove="sigMove"
            @pointerup="sigUp"
            @pointercancel="sigUp"
            @pointerleave="sigUp"
          ></canvas>
          <div class="ink-controls">
            <label class="ink-field">
              <span class="ink-label">顏色</span>
              <input v-model="inkColor" type="color" class="ink-color" />
            </label>
            <label class="ink-field flex-1">
              <span class="ink-label">筆畫寬度（{{ inkWidth }}px）</span>
              <input v-model.number="inkWidth" type="range" min="1" max="10" />
            </label>
          </div>
        </template>

        <template v-else>
          <div
            v-if="!sigImageFile"
            class="sig-img-drop"
            @click="sigImageInput?.click()"
          >
            <span class="sig-img-icon">🖼</span>
            <span>點擊上傳 PNG / JPG / WebP</span>
            <span class="sub-hint">適合直接匯入已完成的簽名圖。</span>
          </div>
          <div v-else class="sig-img-preview">
            <img :src="sigImageDataUrl" />
            <div class="sig-img-info">{{ sigImageFile.name }}</div>
          </div>
          <input
            ref="sigImageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            hidden
            @change="onSigImageChange"
          />
        </template>

        <div class="sig-actions">
          <PixelButton variant="secondary" size="sm" @click="clearSignature">
            清除簽名
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="!hasAnySignature"
            @click="downloadSignature"
          >
            下載簽名 PNG
          </PixelButton>
        </div>

        <div class="apply-row">
          <PixelButton :disabled="!hasAnySignature" @click="applySignatureToCurrentPage">
            套用到第 {{ currentPage }} 頁
          </PixelButton>
          <p v-if="selectedCount > 0" class="sub-hint">
            目前已放置 {{ selectedCount }} 個簽名
          </p>
        </div>

        <label class="filename-field">
          <span class="label">輸出檔名</span>
          <div class="filename-row">
            <input
              v-model="outputName"
              class="pixel-input"
              type="text"
              placeholder="signed"
            />
            <span class="ext">.pdf</span>
          </div>
        </label>

        <div class="export">
          <PixelButton
            size="lg"
            :disabled="placedSignatures.length === 0 || isExporting"
            @click="downloadSigned"
          >
            {{ isExporting ? '輸出中' : '輸出 PDF' }}
          </PixelButton>
          <PixelButton variant="danger" size="sm" @click="reset">
            重新選擇
          </PixelButton>
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

.placed-sig {
  position: absolute;
  cursor: grab;
  border: 2px dashed var(--accent);
  background: transparent;
  user-select: none;
  touch-action: none;
  transform-origin: center center;
}

.placed-sig:active {
  cursor: grabbing;
}

.sig-img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}

.del-btn,
.rotate-btn {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  color: var(--p8-white);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.del-btn {
  top: -12px;
  right: -12px;
  background: var(--danger);
}

.rotate-btn {
  top: -12px;
  left: -12px;
  background: var(--accent);
  color: var(--bg);
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

.signing-area {
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

.sig-canvas {
  width: 100%;
  height: 180px;
  border: 4px solid var(--border);
  background: #fff;
  box-shadow: 6px 6px 0 0 var(--shadow);
  touch-action: none;
}

.ink-controls {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.ink-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ink-field.flex-1 {
  flex: 1;
}

.ink-label {
  font-size: 10px;
  color: var(--text-dim);
}

.ink-color {
  width: 44px;
  height: 36px;
  border: 3px solid var(--border);
  padding: 0;
  cursor: pointer;
}

.sig-img-drop {
  border: 3px dashed var(--border);
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.sig-img-drop:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.sig-img-icon {
  font-size: 32px;
}

.sig-img-preview {
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.sig-img-preview img {
  max-width: 100%;
  max-height: 160px;
  background: var(--p8-white);
  border: 2px solid var(--border);
}

.sig-img-info {
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
  word-break: break-all;
}

.sig-actions,
.apply-row,
.export {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.apply-row {
  align-items: center;
}

.filename-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 10px;
  color: var(--accent-2);
}

.filename-row {
  display: flex;
  gap: 8px;
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

.ext {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  background: var(--bg);
  border: 3px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
