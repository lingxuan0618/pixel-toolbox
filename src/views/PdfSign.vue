<script setup lang="ts">
import { ref, shallowRef, computed, nextTick, onUnmounted } from 'vue'
import { PDFDocument } from 'pdf-lib'
import { pdfjsLib, type PDFDocumentProxy } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

interface PlacedSignature {
  id: string
  page: number
  // 全部用 0~1 的比例,儲存為 PDF 頁面比例;繪製時再乘上 canvas 顯示尺寸
  xRatio: number      // 左上角 x
  yRatio: number      // 左上角 y
  widthRatio: number  // 寬度
  dataUrl: string
  aspectRatio: number // height / width
}

// === 狀態 ===
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

// === Refs ===
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const canvasWrap = ref<HTMLDivElement | null>(null)
const sigCanvas = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)

const placedOnCurrentPage = computed(() =>
  placedSignatures.value.filter(s => s.page === currentPage.value)
)

// === 簽名繪製 ===
let drawing = false
let lastX = 0
let lastY = 0
const sigHasInk = ref(false)
const inkColor = ref('#1D2B53')
const inkWidth = ref(3)

// 簽名來源:畫的 or 上傳圖片
type SigMode = 'draw' | 'image'
const sigMode = ref<SigMode>('draw')
const sigImageFile = ref<File | null>(null)
const sigImageDataUrl = ref<string>('')
const sigImageEl = shallowRef<HTMLImageElement | null>(null)
const sigImageInput = ref<HTMLInputElement | null>(null)

const hasUploadedImage = computed(() => !!sigImageDataUrl.value)
const hasAnySignature = computed(() =>
  sigMode.value === 'draw' ? sigHasInk.value : hasUploadedImage.value
)

function getPointer(e: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function sigDown(e: PointerEvent) {
  if (!sigCanvas.value) return
  e.preventDefault()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  drawing = true
  const p = getPointer(e, sigCanvas.value)
  lastX = p.x
  lastY = p.y
  // 點一下也算有筆跡(防止單擊就跳出「請先簽名」)
  const ctx = sigCanvas.value.getContext('2d')!
  ctx.fillStyle = inkColor.value
  ctx.beginPath()
  ctx.arc(p.x, p.y, inkWidth.value / 2, 0, Math.PI * 2)
  ctx.fill()
  sigHasInk.value = true
}

function sigMove(e: PointerEvent) {
  if (!drawing || !sigCanvas.value) return
  e.preventDefault()
  const ctx = sigCanvas.value.getContext('2d')!
  const p = getPointer(e, sigCanvas.value)
  ctx.strokeStyle = inkColor.value
  ctx.lineWidth = inkWidth.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  lastX = p.x
  lastY = p.y
}

function sigUp() {
  drawing = false
}

function clearSignature() {
  if (sigCanvas.value) {
    const ctx = sigCanvas.value.getContext('2d')!
    ctx.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height)
  }
  sigHasInk.value = false
  sigImageFile.value = null
  sigImageDataUrl.value = ''
  sigImageEl.value = null
}

async function handleSigImage(f: File) {
  if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
    error.value = '簽名圖片只支援 PNG / JPG / WebP'
    return
  }
  error.value = null
  sigImageFile.value = f
  const url = await new Promise<string>(res => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(f)
  })
  sigImageDataUrl.value = url
  const img = new Image()
  await new Promise<void>(res => { img.onload = () => res(); img.src = url })
  sigImageEl.value = img
}

function onSigImageChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handleSigImage(f)
  ;(e.target as HTMLInputElement).value = ''
}

// 取得目前的簽名 dataUrl(無論畫的還是上傳的)
async function getSignatureDataUrl(): Promise<string | null> {
  if (sigMode.value === 'draw') {
    if (!sigHasInk.value || !sigCanvas.value) return null
    return sigCanvas.value.toDataURL('image/png')
  }
  if (!sigImageDataUrl.value) return null
  return sigImageDataUrl.value
}

async function downloadSignature() {
  const dataUrl = await getSignatureDataUrl()
  if (!dataUrl) return
  const blob = await fetch(dataUrl).then(r => r.blob())
  const ext = dataUrl.startsWith('data:image/png') ? 'png' :
              dataUrl.startsWith('data:image/jpeg') ? 'jpg' :
              dataUrl.startsWith('data:image/webp') ? 'webp' : 'png'
  downloadBlob(blob, `signature.${ext}`)
}

// === PDF 載入 + 渲染 ===
async function handleFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = '只接受 PDF 檔案'
    return
  }
  error.value = null
  isLoading.value = true
  placedSignatures.value = []
  try {
    pdfFile.value = file
    outputName.value = file.name.replace(/\.pdf$/i, '') + '_signed'
    const ab = await file.arrayBuffer()
    pdfBytes.value = new Uint8Array(ab)
    const task = pdfjsLib.getDocument({ data: new Uint8Array(ab.slice(0)) })
    const doc = await task.promise
    pdfDoc.value = doc
    totalPages.value = doc.numPages
    currentPage.value = 1
    await nextTick()
    await renderPage(1)
  } catch (e: unknown) {
    error.value = '無法讀取這份 PDF:' + (e instanceof Error ? e.message : '未知')
    pdfDoc.value = null
  } finally {
    isLoading.value = false
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc.value || !pdfCanvas.value) return
  const page = await pdfDoc.value.getPage(pageNum)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const wrapWidth =
    canvasWrap.value?.clientWidth ?? Math.min(window.innerWidth - 40, 900)
  const maxWidth = Math.min(wrapWidth - 8, 900)
  const baseVp = page.getViewport({ scale: 1 })
  const scale = (maxWidth / baseVp.width) * dpr
  const vp = page.getViewport({ scale })
  const canvas = pdfCanvas.value
  canvas.width = vp.width
  canvas.height = vp.height
  const displayW = vp.width / dpr
  const displayH = vp.height / dpr
  canvas.style.width = displayW + 'px'
  canvas.style.height = displayH + 'px'
  canvasDisplayWidth.value = displayW
  canvasDisplayHeight.value = displayH
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
}

function changePage(delta: number) {
  const next = currentPage.value + delta
  if (next < 1 || next > totalPages.value) return
  currentPage.value = next
  renderPage(next)
}

// === 套用簽名到目前頁面 ===
async function applySignatureToCurrentPage() {
  const dataUrl = await getSignatureDataUrl()
  if (!dataUrl) {
    error.value = sigMode.value === 'draw'
      ? '請先在簽名區畫上你的簽名'
      : '請先上傳一張簽名圖片'
    return
  }
  error.value = null
  // 計算簽名圖原始比例
  const img = sigMode.value === 'image' && sigImageEl.value
    ? sigImageEl.value
    : await new Promise<HTMLImageElement>(res => {
        const i = new Image()
        i.onload = () => res(i)
        i.src = dataUrl
      })
  const aspectRatio = img.height / img.width
  // 預設放在頁面下半中央,寬度 = 頁面 30%
  placedSignatures.value.push({
    id: crypto.randomUUID(),
    page: currentPage.value,
    xRatio: 0.35,
    yRatio: 0.7,
    widthRatio: 0.3,
    dataUrl,
    aspectRatio,
  })
}

function removeSignature(id: string) {
  placedSignatures.value = placedSignatures.value.filter(s => s.id !== id)
}

// === 拖曳 / 縮放 ===
let dragging: PlacedSignature | null = null
let dragOffsetX = 0
let dragOffsetY = 0
let resizing: PlacedSignature | null = null
let resizeStartX = 0
let resizeStartWidth = 0

function startDrag(sig: PlacedSignature, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  dragging = sig
  // 滑鼠跟簽名左上角的差
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
  // 限制不要拖出邊界
  dragging.xRatio = Math.max(0, Math.min(1 - dragging.widthRatio, newXRatio))
  const heightRatio = dragging.widthRatio * dragging.aspectRatio * (rect.width / rect.height)
  dragging.yRatio = Math.max(0, Math.min(1 - heightRatio, newYRatio))
}

function endDrag() {
  dragging = null
  resizing = null
}

function startResize(sig: PlacedSignature, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  resizing = sig
  resizeStartX = e.clientX
  resizeStartWidth = sig.widthRatio
}

function onResizeMove(e: PointerEvent) {
  if (!resizing || !pdfCanvas.value) return
  e.preventDefault()
  const rect = pdfCanvas.value.getBoundingClientRect()
  const deltaPx = e.clientX - resizeStartX
  const deltaRatio = deltaPx / rect.width
  const newWidth = resizeStartWidth + deltaRatio
  resizing.widthRatio = Math.max(0.05, Math.min(0.95, newWidth))
}

// 全域 pointermove / up 監聽,只在拖曳時用
function onWrapPointerMove(e: PointerEvent) {
  if (dragging) onDragMove(e)
  if (resizing) onResizeMove(e)
}

// === 匯出 ===
async function downloadSigned() {
  if (!pdfBytes.value || placedSignatures.value.length === 0) {
    error.value = '尚未套用任何簽名'
    return
  }
  isExporting.value = true
  error.value = null
  try {
    const doc = await PDFDocument.load(pdfBytes.value.slice(0), {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })
    for (const sig of placedSignatures.value) {
      const page = doc.getPage(sig.page - 1)
      const { width: pw, height: ph } = page.getSize()
      const pngBytes = await fetch(sig.dataUrl).then(r => r.arrayBuffer())
      const png = await doc.embedPng(pngBytes)
      const sigW = pw * sig.widthRatio
      const sigH = sigW * sig.aspectRatio
      page.drawImage(png, {
        x: pw * sig.xRatio,
        // PDF 原點在「左下」, Canvas 是「左上」, 要翻轉並考慮 sig 高度
        y: ph - ph * sig.yRatio - sigH,
        width: sigW,
        height: sigH,
      })
    }
    const out = await doc.save()
    const blob = new Blob([out as BlobPart], { type: 'application/pdf' })
    const fname = outputName.value.trim() || 'signed'
    const finalName = /\.pdf$/i.test(fname) ? fname : fname + '.pdf'
    downloadBlob(blob, finalName)
  } catch (e: unknown) {
    error.value = '匯出失敗:' + (e instanceof Error ? e.message : '未知')
  } finally {
    isExporting.value = false
  }
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
    icon="✏️"
    description="畫簽名 → 套用 → 拖曳到想要的位置 → 拉角調大小 → 下載。檔案不上傳。"
  >
    <div
      v-if="!pdfDoc"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dropzone-icon">📄</div>
      <p class="dropzone-text">點這裡或把 PDF 拖進來</p>
      <p class="dropzone-sub">檔案只在你的瀏覽器處理</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="error">⚠ {{ error }}</p>
    <p v-if="isLoading" class="loading">載入中…</p>

    <div v-if="pdfDoc" class="workspace">
      <!-- 左:PDF + 翻頁 + 簽名 overlay -->
      <section class="pdf-area">
        <div class="page-bar">
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="currentPage <= 1"
            @click="changePage(-1)"
          >◄ 上一頁</PixelButton>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="currentPage >= totalPages"
            @click="changePage(1)"
          >下一頁 ►</PixelButton>
        </div>

        <div
          ref="canvasWrap"
          class="pdf-canvas-wrap"
          @pointermove="onWrapPointerMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @pointerleave="endDrag"
        >
          <canvas ref="pdfCanvas" class="pdf-canvas" />
          <!-- 已套用的簽名 overlay -->
          <div
            v-for="sig in placedOnCurrentPage"
            :key="sig.id"
            class="placed-sig"
            :style="{
              left: sig.xRatio * canvasDisplayWidth + 'px',
              top: sig.yRatio * canvasDisplayHeight + 'px',
              width: sig.widthRatio * canvasDisplayWidth + 'px',
            }"
            @pointerdown="startDrag(sig, $event)"
          >
            <img :src="sig.dataUrl" class="sig-img" :draggable="false" />
            <button
              class="del-btn"
              title="移除"
              @pointerdown.stop
              @click="removeSignature(sig.id)"
            >✕</button>
            <div
              class="resize-handle"
              title="拉動調整大小"
              @pointerdown="startResize(sig, $event)"
            ></div>
          </div>
        </div>

        <p class="hint">
          套用後可以**直接拖動**簽名,角落小方塊可以**拉動調整大小**
        </p>
      </section>

      <!-- 右:簽名 + 動作 -->
      <section class="signing-area">
        <h3>// 1. 準備簽名</h3>

        <div class="mode-switch">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: sigMode === 'draw' }"
            @click="sigMode = 'draw'"
          >✍️ 手寫</button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: sigMode === 'image' }"
            @click="sigMode = 'image'"
          >🖼 上傳圖片</button>
        </div>

        <!-- 手寫模式 -->
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
          />
          <div class="ink-controls">
            <label class="ink-field">
              <span class="ink-label">墨色</span>
              <input v-model="inkColor" type="color" class="ink-color" />
            </label>
            <label class="ink-field flex-1">
              <span class="ink-label">筆觸({{ inkWidth }}px)</span>
              <input v-model.number="inkWidth" type="range" min="1" max="10" />
            </label>
          </div>
        </template>

        <!-- 圖片上傳模式 -->
        <template v-else>
          <div
            v-if="!sigImageFile"
            class="sig-img-drop"
            @click="sigImageInput?.click()"
          >
            <span class="sig-img-icon">🖼</span>
            <span>點這裡選圖片(PNG / JPG / WebP)</span>
            <span class="sub-hint">適合公司印章、手寫簽名掃描檔、簽名章圖檔</span>
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
            🧹 清除
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="!hasAnySignature"
            @click="downloadSignature"
          >⬇ 下載簽名 PNG</PixelButton>
        </div>

        <h3>// 2. 套用</h3>
        <PixelButton
          :disabled="!hasAnySignature"
          @click="applySignatureToCurrentPage"
        >
          ➕ 套用到第 {{ currentPage }} 頁
        </PixelButton>
        <p class="sub-hint" v-if="placedSignatures.length > 0">
          已套用 {{ placedSignatures.length }} 個簽名(可繼續加)
        </p>

        <h3>// 3. 輸出</h3>
        <label class="filename-field">
          <span class="label">檔名</span>
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
            :disabled="placedSignatures.length === 0 || isExporting"
            size="lg"
            @click="downloadSigned"
          >
            {{ isExporting ? '匯出中…' : '💾 下載 PDF' }}
          </PixelButton>
          <PixelButton variant="danger" size="sm" @click="reset">
            重新選檔
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
.dropzone-sub {
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

.pdf-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.page-info {
  font-size: 12px;
  color: var(--text-dim);
}

.pdf-canvas-wrap {
  position: relative;
  border: 4px solid var(--border);
  background: var(--p8-white);
  box-shadow: 6px 6px 0 0 var(--shadow);
  overflow: hidden;
  touch-action: none;
  width: fit-content;
  max-width: 100%;
}
.pdf-canvas {
  display: block;
  max-width: 100%;
  image-rendering: auto;
}

/* 套用後的簽名(可拖、可縮放、可刪除) */
.placed-sig {
  position: absolute;
  cursor: grab;
  border: 2px dashed var(--accent);
  background: transparent;
  user-select: none;
  touch-action: none;
}
.placed-sig:active {
  cursor: grabbing;
}
.placed-sig .sig-img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}
.del-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 24px;
  height: 24px;
  background: var(--danger);
  color: var(--p8-white);
  border: 2px solid var(--border);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
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
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
  margin: 0;
}

/* 右側簽名區 */
.signing-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.signing-area h3 {
  color: var(--accent-2);
  margin: 8px 0 4px;
  font-size: 13px;
}
.sig-canvas {
  width: 100%;
  height: 180px;
  border: 4px solid var(--border);
  background: #fff;
  box-shadow: 6px 6px 0 0 var(--shadow);
  touch-action: none;
}
.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 4px;
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
.sub-hint {
  font-size: 10px;
  color: var(--text-dim);
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
.sig-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.sub-hint {
  font-size: 10px;
  color: var(--success);
  margin: 0;
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

.export {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
