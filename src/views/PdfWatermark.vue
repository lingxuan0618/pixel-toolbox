<script setup lang="ts">
import { ref, shallowRef, watch, onUnmounted, nextTick, computed } from 'vue'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { pdfjsLib, type PDFDocumentProxy } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

type Mode = 'text' | 'image'

const pdfFile = ref<File | null>(null)
const outputName = ref('watermarked')

// 共用
const mode = ref<Mode>('text')
const opacity = ref(30)
const xRatio = ref(0.5)       // 中心 x(0~1)
const yRatio = ref(0.5)       // 中心 y(0~1)
const widthRatio = ref(0.4)   // 圖片寬 = 頁面寬 × widthRatio;文字會用 fontSize 算
const rotation = ref(-45)     // 角度,逆時針正

// 文字模式
const text = ref('CONFIDENTIAL')
const color = ref('#29adff')
const fontSize = ref(60)      // pt

// 圖片模式
const imageFile = ref<File | null>(null)
const imageDataUrl = ref<string>('')
const imageEl = shallowRef<HTMLImageElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)

const error = ref<string | null>(null)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// 預覽相關
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const canvasWrap = ref<HTMLDivElement | null>(null)
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null)
const totalPages = ref(0)
const previewPage = ref(1)
const canvasDisplayWidth = ref(0)
const canvasDisplayHeight = ref(0)

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return rgb(0.16, 0.68, 1)
  return rgb(
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255
  )
}

async function handleFile(f: File) {
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    error.value = '只接受 PDF'
    return
  }
  pdfFile.value = f
  outputName.value = f.name.replace(/\.pdf$/i, '') + '_watermarked'
  error.value = null
  if (pdfDoc.value) pdfDoc.value.destroy()
  const ab = await f.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
  pdfDoc.value = doc
  totalPages.value = doc.numPages
  previewPage.value = 1
  await nextTick()
  await renderPreview()
}

async function handleImage(f: File) {
  if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
    error.value = '圖片只支援 PNG / JPG / WebP'
    return
  }
  imageFile.value = f
  error.value = null
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('讀取圖片失敗'))
    r.readAsDataURL(f)
  })
  imageDataUrl.value = url
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('解碼圖片失敗'))
    img.src = url
  })
  imageEl.value = img
}

async function renderPreview() {
  if (!pdfDoc.value || !previewCanvas.value) return
  const page = await pdfDoc.value.getPage(previewPage.value)
  const baseVp = page.getViewport({ scale: 1 })
  const wrapWidth =
    canvasWrap.value?.clientWidth ?? Math.min(window.innerWidth - 60, 560)
  const maxWidth = Math.min(wrapWidth - 8, 800)
  const scale = maxWidth / baseVp.width
  const vp = page.getViewport({ scale })
  const canvas = previewCanvas.value
  canvas.width = vp.width
  canvas.height = vp.height
  canvas.style.width = vp.width + 'px'
  canvas.style.height = vp.height + 'px'
  canvasDisplayWidth.value = vp.width
  canvasDisplayHeight.value = vp.height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
}

function changePage(delta: number) {
  const next = previewPage.value + delta
  if (next < 1 || next > totalPages.value) return
  previewPage.value = next
  renderPreview()
}

// === 浮水印 overlay 樣式 ===
const wmStyle = computed(() => {
  const cx = xRatio.value * canvasDisplayWidth.value
  const cy = yRatio.value * canvasDisplayHeight.value
  return {
    left: cx + 'px',
    top: cy + 'px',
    transform: `translate(-50%, -50%) rotate(${rotation.value}deg)`,
    opacity: String(opacity.value / 100),
  } as Record<string, string>
})

// 圖片浮水印的寬,以畫面像素計
const wmImageDisplayWidth = computed(() => {
  return widthRatio.value * canvasDisplayWidth.value
})

// 文字浮水印的 fontSize(預覽用),依預覽縮放比換算
const wmTextDisplaySize = computed(() => {
  // fontSize 是 pt(PDF 點),預覽 canvas 寬:頁面 PDF 寬比例 = canvasDisplayWidth / pdfPageWidth
  // 預估方便:用 widthRatio + fontSize 邏輯有點複雜,這邊直接用 fontSize * scale
  // 之後 apply 時用 PDF 原始 fontSize 即可
  if (!pdfDoc.value) return fontSize.value
  // canvas 寬÷頁面比例 ≒ scale,fontSize × scale 就是顯示像素
  return fontSize.value * (canvasDisplayWidth.value / 595) // 595 = A4 寬,粗估
})

// === 預設快捷:設定 ratios + rotation ===
function setPreset(p: 'diagonal' | 'center' | 'top' | 'bottom') {
  xRatio.value = 0.5
  if (p === 'diagonal') { yRatio.value = 0.5; rotation.value = -45 }
  else if (p === 'center') { yRatio.value = 0.5; rotation.value = 0 }
  else if (p === 'top') { yRatio.value = 0.1; rotation.value = 0 }
  else { yRatio.value = 0.9; rotation.value = 0 }
}

// === 拖曳 ===
let dragging = false
let dragStartCx = 0
let dragStartCy = 0
let dragStartXRatio = 0
let dragStartYRatio = 0

function onWmPointerDown(e: PointerEvent) {
  e.preventDefault()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  dragging = true
  dragStartCx = e.clientX
  dragStartCy = e.clientY
  dragStartXRatio = xRatio.value
  dragStartYRatio = yRatio.value
}

function onWmPointerMove(e: PointerEvent) {
  if (!dragging || !previewCanvas.value) return
  e.preventDefault()
  const rect = previewCanvas.value.getBoundingClientRect()
  const dx = e.clientX - dragStartCx
  const dy = e.clientY - dragStartCy
  xRatio.value = Math.max(0, Math.min(1, dragStartXRatio + dx / rect.width))
  yRatio.value = Math.max(0, Math.min(1, dragStartYRatio + dy / rect.height))
}

function onWmPointerUp() {
  dragging = false
}

// === 縮放(右下角 handle) ===
let resizing = false
let resizeStartX = 0
let resizeStartWidth = 0
let resizeStartFontSize = 0

function onResizeDown(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  resizing = true
  resizeStartX = e.clientX
  resizeStartWidth = widthRatio.value
  resizeStartFontSize = fontSize.value
}

function onResizeMove(e: PointerEvent) {
  if (!resizing || !previewCanvas.value) return
  e.preventDefault()
  const rect = previewCanvas.value.getBoundingClientRect()
  const deltaPx = e.clientX - resizeStartX
  const deltaRatio = deltaPx / rect.width
  if (mode.value === 'image') {
    widthRatio.value = Math.max(0.05, Math.min(1, resizeStartWidth + deltaRatio))
  } else {
    // 文字模式:fontSize 隨 deltaPx 增減
    fontSize.value = Math.max(12, Math.min(200, resizeStartFontSize + deltaPx / 4))
  }
}

function onResizeUp() {
  resizing = false
}

// 全域 wrap 監聽兩種拖
function onWrapPointerMove(e: PointerEvent) {
  if (dragging) onWmPointerMove(e)
  if (resizing) onResizeMove(e)
}
function onWrapPointerUp() {
  onWmPointerUp()
  onResizeUp()
}

// === 檔案輸入 ===
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

function onImageChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handleImage(f)
  ;(e.target as HTMLInputElement).value = ''
}

function clearImage() {
  imageFile.value = null
  imageDataUrl.value = ''
  imageEl.value = null
}

function reset() {
  if (pdfDoc.value) pdfDoc.value.destroy()
  pdfDoc.value = null
  pdfFile.value = null
  totalPages.value = 0
  clearImage()
}

// === 輸出 ===
async function apply() {
  if (!pdfFile.value) {
    error.value = '請先選 PDF'
    return
  }
  if (mode.value === 'text' && !text.value.trim()) {
    error.value = '請輸入文字'
    return
  }
  if (mode.value === 'image' && !imageFile.value) {
    error.value = '請選一張圖片作為浮水印'
    return
  }
  isProcessing.value = true
  error.value = null
  try {
    const ab = await pdfFile.value.arrayBuffer()
    const doc = await PDFDocument.load(ab, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })
    const op = opacity.value / 100
    const theta = (rotation.value * Math.PI) / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)

    if (mode.value === 'text') {
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const c = hexToRgb(color.value)
      const fs = fontSize.value
      const tw = font.widthOfTextAtSize(text.value, fs)
      const th = fs
      for (const page of doc.getPages()) {
        const { width: pw, height: ph } = page.getSize()
        // 在 PDF 座標系中,y 軸向上;我們的 yRatio 是「從上到下」,要翻轉
        const cxPdf = pw * xRatio.value
        const cyPdf = ph * (1 - yRatio.value)
        // 找文字左下角位置,使得它「整塊」旋轉後中心對齊 (cxPdf, cyPdf)
        const x = cxPdf - (tw / 2) * cos + (th / 2) * sin
        const y = cyPdf - (tw / 2) * sin - (th / 2) * cos
        page.drawText(text.value, {
          x, y,
          size: fs,
          font,
          color: c,
          opacity: op,
          rotate: degrees(rotation.value),
        })
      }
    } else {
      const imgBytes = await imageFile.value!.arrayBuffer()
      const isPng = /\.png$/i.test(imageFile.value!.name) ||
                    imageFile.value!.type === 'image/png'
      let embedded
      if (isPng) {
        embedded = await doc.embedPng(imgBytes)
      } else if (imageFile.value!.type === 'image/webp' ||
                 /\.webp$/i.test(imageFile.value!.name)) {
        const bitmap = await createImageBitmap(imageFile.value!)
        const c = document.createElement('canvas')
        c.width = bitmap.width
        c.height = bitmap.height
        c.getContext('2d')!.drawImage(bitmap, 0, 0)
        const png = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'))
        embedded = await doc.embedPng(await png.arrayBuffer())
      } else {
        embedded = await doc.embedJpg(imgBytes)
      }
      for (const page of doc.getPages()) {
        const { width: pw, height: ph } = page.getSize()
        const iw = pw * widthRatio.value
        const ih = iw * (embedded.height / embedded.width)
        const cxPdf = pw * xRatio.value
        const cyPdf = ph * (1 - yRatio.value)
        const x = cxPdf - (iw / 2) * cos + (ih / 2) * sin
        const y = cyPdf - (iw / 2) * sin - (ih / 2) * cos
        page.drawImage(embedded, {
          x, y,
          width: iw, height: ih,
          rotate: degrees(rotation.value),
          opacity: op,
        })
      }
    }

    const bytes = await doc.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const fname = outputName.value.trim() || 'watermarked'
    downloadBlob(blob, /\.pdf$/i.test(fname) ? fname : fname + '.pdf')
  } catch (e: unknown) {
    error.value = '處理失敗:' + (e instanceof Error ? e.message : '未知錯誤')
  } finally {
    isProcessing.value = false
  }
}

watch([previewPage], renderPreview)

onUnmounted(() => {
  pdfDoc.value?.destroy()
})
</script>

<template>
  <ToolLayout
    title="PDF 加浮水印"
    icon="💧"
    description="文字或圖片浮水印。預設位置點一下就到位,然後可以自由拖移、縮放、旋轉。會套用到所有頁面。"
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
      <div class="dz-icon">💧</div>
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

    <div v-if="pdfFile" class="workspace">
      <!-- 預覽區 -->
      <section class="preview-area">
        <div class="file-row">📄 {{ pdfFile.name }}</div>
        <div v-if="totalPages > 1" class="page-bar">
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="previewPage <= 1"
            @click="changePage(-1)"
          >◄</PixelButton>
          <span class="page-info">P. {{ previewPage }} / {{ totalPages }}</span>
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="previewPage >= totalPages"
            @click="changePage(1)"
          >►</PixelButton>
        </div>

        <div
          ref="canvasWrap"
          class="canvas-wrap"
          @pointermove="onWrapPointerMove"
          @pointerup="onWrapPointerUp"
          @pointercancel="onWrapPointerUp"
          @pointerleave="onWrapPointerUp"
        >
          <canvas ref="previewCanvas" class="preview-canvas" />
          <!-- 文字浮水印 overlay -->
          <div
            v-if="mode === 'text' && text.trim()"
            ref="wmEl"
            class="wm-overlay wm-text"
            :style="{
              ...wmStyle,
              fontSize: wmTextDisplaySize + 'px',
              color: color,
            }"
            @pointerdown="onWmPointerDown"
          >
            <span class="wm-text-inner">{{ text }}</span>
            <div class="resize-handle" @pointerdown="onResizeDown"></div>
          </div>
          <!-- 圖片浮水印 overlay -->
          <div
            v-else-if="mode === 'image' && imageDataUrl"
            ref="wmEl"
            class="wm-overlay wm-image"
            :style="{
              ...wmStyle,
              width: wmImageDisplayWidth + 'px',
            }"
            @pointerdown="onWmPointerDown"
          >
            <img :src="imageDataUrl" :draggable="false" class="wm-img" />
            <div class="resize-handle" @pointerdown="onResizeDown"></div>
          </div>
        </div>
        <p class="hint">↑ 浮水印可以**直接拖移**,右下角可以**拉動縮放**</p>
      </section>

      <!-- 控制區 -->
      <section class="controls">
        <!-- 模式切換 -->
        <div class="mode-switch">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: mode === 'text' }"
            @click="mode = 'text'"
          >🅰 文字</button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: mode === 'image' }"
            @click="mode = 'image'"
          >🖼 圖片</button>
        </div>

        <!-- 文字模式控制 -->
        <template v-if="mode === 'text'">
          <label class="field">
            <span class="label">浮水印文字</span>
            <input v-model="text" class="pixel-input" type="text" maxlength="40" />
          </label>
          <label class="field">
            <span class="label">顏色</span>
            <input v-model="color" type="color" class="color-input" />
          </label>
          <label class="field">
            <span class="label">字級({{ fontSize }}pt)</span>
            <input v-model.number="fontSize" type="range" min="12" max="200" />
          </label>
        </template>

        <!-- 圖片模式控制 -->
        <template v-else>
          <div class="field">
            <span class="label">浮水印圖片</span>
            <div v-if="!imageFile" class="img-drop" @click="imageInput?.click()">
              <span class="img-drop-icon">🖼</span>
              <span class="img-drop-text">點這裡選 PNG / JPG / WebP</span>
            </div>
            <div v-else class="img-pick">
              <img :src="imageDataUrl" class="img-preview-thumb" />
              <div class="img-info">
                <div class="img-name">{{ imageFile.name }}</div>
                <button class="img-clear" @click="clearImage">✕ 換一張</button>
              </div>
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
            <span class="label">寬度(頁面的 {{ Math.round(widthRatio * 100) }}%)</span>
            <input v-model.number="widthRatio" type="range" min="0.05" max="1" step="0.01" />
          </label>
        </template>

        <!-- 預設位置快捷 -->
        <div class="field">
          <span class="label">快捷位置</span>
          <div class="preset-grid">
            <button type="button" class="preset-btn" @click="setPreset('diagonal')">
              ✕ 對角
            </button>
            <button type="button" class="preset-btn" @click="setPreset('center')">
              ⊙ 中央
            </button>
            <button type="button" class="preset-btn" @click="setPreset('top')">
              ▲ 頂端
            </button>
            <button type="button" class="preset-btn" @click="setPreset('bottom')">
              ▼ 底部
            </button>
          </div>
        </div>

        <label class="field">
          <span class="label">旋轉({{ rotation }}°)</span>
          <input v-model.number="rotation" type="range" min="-180" max="180" />
        </label>
        <label class="field">
          <span class="label">透明度({{ opacity }}%)</span>
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
          <PixelButton size="lg" :disabled="isProcessing" @click="apply">
            {{ isProcessing ? '處理中…' : '💾 加浮水印並下載' }}
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
.dropzone.active,
.dropzone:hover {
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

.workspace {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}
@media (min-width: 960px) {
  .workspace {
    grid-template-columns: 1.4fr 1fr;
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
.page-info {
  font-size: 11px;
  color: var(--text-dim);
}
.canvas-wrap {
  position: relative;
  border: 4px solid var(--border);
  background: var(--p8-white);
  box-shadow: 6px 6px 0 0 var(--shadow);
  overflow: hidden;
  width: fit-content;
  max-width: 100%;
  touch-action: none;
}
.preview-canvas {
  display: block;
  max-width: 100%;
  image-rendering: auto;
}

/* 浮水印 overlay(可拖、可縮) */
.wm-overlay {
  position: absolute;
  cursor: grab;
  user-select: none;
  touch-action: none;
  border: 2px dashed var(--accent);
}
.wm-overlay:active {
  cursor: grabbing;
}
.wm-text {
  font-family: Helvetica, Arial, sans-serif;
  font-weight: bold;
  white-space: nowrap;
  padding: 2px 6px;
}
.wm-text-inner {
  pointer-events: none;
}
.wm-image .wm-img {
  width: 100%;
  height: auto;
  display: block;
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
  font-size: 10px;
  color: var(--text-dim);
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
  padding: 10px;
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

/* 圖片選擇區 */
.img-drop {
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
.img-drop:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.img-drop-icon {
  font-size: 28px;
}
.img-drop-text {
  font-size: 11px;
  color: var(--text-dim);
}
.img-pick {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--surface);
  border: 3px solid var(--border);
  align-items: center;
}
.img-preview-thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: var(--p8-white);
  border: 2px solid var(--border);
}
.img-info {
  flex: 1;
  min-width: 0;
}
.img-name {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.img-clear {
  margin-top: 4px;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 10px;
  color: var(--danger);
  cursor: pointer;
  padding: 0;
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
