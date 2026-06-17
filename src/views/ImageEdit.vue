<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

const imageFile = ref<File | null>(null)
const sourceImg = ref<HTMLImageElement | null>(null)

const previewCanvas = ref<HTMLCanvasElement | null>(null)

// 操作參數
const rotation = ref(0)              // 0 / 90 / 180 / 270
const targetWidth = ref(0)
const targetHeight = ref(0)
const aspectLocked = ref(true)
const outputFormat = ref<'png' | 'jpeg' | 'webp'>('png')
const quality = ref(92)

// 裁切(用 0~1 ratio,基於旋轉後的圖)
const cropX = ref(0)
const cropY = ref(0)
const cropW = ref(1)
const cropH = ref(1)

const error = ref<string | null>(null)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const outputName = ref('edited')

const aspect = computed(() => {
  if (!sourceImg.value) return 1
  return rotation.value % 180 === 0
    ? sourceImg.value.width / sourceImg.value.height
    : sourceImg.value.height / sourceImg.value.width
})

async function handleFile(f: File) {
  if (!/^image\//.test(f.type)) {
    error.value = '只接受圖片'
    return
  }
  error.value = null
  imageFile.value = f
  outputName.value = f.name.replace(/\.[^.]+$/, '') + '_edited'
  const url = URL.createObjectURL(f)
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('解碼失敗'))
    img.src = url
  })
  sourceImg.value = img
  rotation.value = 0
  targetWidth.value = img.width
  targetHeight.value = img.height
  cropX.value = 0
  cropY.value = 0
  cropW.value = 1
  cropH.value = 1
  URL.revokeObjectURL(url)
  await nextTick()
  await drawPreview()
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

async function drawPreview() {
  if (!sourceImg.value || !previewCanvas.value) return
  const img = sourceImg.value
  // 旋轉後尺寸
  const rotW = rotation.value % 180 === 0 ? img.width : img.height
  const rotH = rotation.value % 180 === 0 ? img.height : img.width
  // 顯示寬上限 600px;內部解析度則乘上 DPR(2x or 3x)讓預覽變銳利
  const maxDisplayW = 600
  const displayScale = Math.min(maxDisplayW / rotW, 1)
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const internalScale = displayScale * dpr
  const displayW = rotW * displayScale
  const displayH = rotH * displayScale
  const canvasW = Math.round(rotW * internalScale)
  const canvasH = Math.round(rotH * internalScale)
  const canvas = previewCanvas.value
  canvas.width = canvasW
  canvas.height = canvasH
  canvas.style.width = displayW + 'px'
  canvas.style.height = displayH + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, canvasW, canvasH)
  ctx.save()
  ctx.translate(canvasW / 2, canvasH / 2)
  ctx.rotate((rotation.value * Math.PI) / 180)
  const drawW = img.width * internalScale
  const drawH = img.height * internalScale
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
}

function rotate90() {
  rotation.value = (rotation.value + 90) % 360
  // 旋轉時 target 尺寸也要交換
  const t = targetWidth.value
  targetWidth.value = targetHeight.value
  targetHeight.value = t
  drawPreview()
}

function onWidthChange(v: number) {
  targetWidth.value = Math.max(1, Math.round(v))
  if (aspectLocked.value && sourceImg.value) {
    targetHeight.value = Math.round(targetWidth.value / aspect.value)
  }
}

function onHeightChange(v: number) {
  targetHeight.value = Math.max(1, Math.round(v))
  if (aspectLocked.value && sourceImg.value) {
    targetWidth.value = Math.round(targetHeight.value * aspect.value)
  }
}

// === 裁切框拖曳 ===
let dragMode: 'move' | 'tl' | 'tr' | 'bl' | 'br' | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartCrop = { x: 0, y: 0, w: 0, h: 0 }

function startCropDrag(mode: typeof dragMode, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  dragMode = mode
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartCrop = {
    x: cropX.value,
    y: cropY.value,
    w: cropW.value,
    h: cropH.value,
  }
}

function onCropMove(e: PointerEvent) {
  if (!dragMode || !previewCanvas.value) return
  e.preventDefault()
  const rect = previewCanvas.value.getBoundingClientRect()
  const dx = (e.clientX - dragStartX) / rect.width
  const dy = (e.clientY - dragStartY) / rect.height
  let x = dragStartCrop.x
  let y = dragStartCrop.y
  let w = dragStartCrop.w
  let h = dragStartCrop.h
  if (dragMode === 'move') {
    x = Math.max(0, Math.min(1 - w, dragStartCrop.x + dx))
    y = Math.max(0, Math.min(1 - h, dragStartCrop.y + dy))
  } else if (dragMode === 'tl') {
    x = Math.max(0, Math.min(dragStartCrop.x + dragStartCrop.w - 0.05, dragStartCrop.x + dx))
    y = Math.max(0, Math.min(dragStartCrop.y + dragStartCrop.h - 0.05, dragStartCrop.y + dy))
    w = dragStartCrop.x + dragStartCrop.w - x
    h = dragStartCrop.y + dragStartCrop.h - y
  } else if (dragMode === 'tr') {
    y = Math.max(0, Math.min(dragStartCrop.y + dragStartCrop.h - 0.05, dragStartCrop.y + dy))
    w = Math.max(0.05, Math.min(1 - dragStartCrop.x, dragStartCrop.w + dx))
    h = dragStartCrop.y + dragStartCrop.h - y
  } else if (dragMode === 'bl') {
    x = Math.max(0, Math.min(dragStartCrop.x + dragStartCrop.w - 0.05, dragStartCrop.x + dx))
    w = dragStartCrop.x + dragStartCrop.w - x
    h = Math.max(0.05, Math.min(1 - dragStartCrop.y, dragStartCrop.h + dy))
  } else {
    w = Math.max(0.05, Math.min(1 - dragStartCrop.x, dragStartCrop.w + dx))
    h = Math.max(0.05, Math.min(1 - dragStartCrop.y, dragStartCrop.h + dy))
  }
  cropX.value = x
  cropY.value = y
  cropW.value = w
  cropH.value = h
}

function endCropDrag() {
  dragMode = null
}

function resetCrop() {
  cropX.value = 0; cropY.value = 0; cropW.value = 1; cropH.value = 1
}

// === 輸出 ===
async function exportImage() {
  if (!sourceImg.value) return
  const img = sourceImg.value
  // 1. 在離屏 canvas 套用 rotation
  const rotW = rotation.value % 180 === 0 ? img.width : img.height
  const rotH = rotation.value % 180 === 0 ? img.height : img.width
  const rotated = document.createElement('canvas')
  rotated.width = rotW
  rotated.height = rotH
  const rctx = rotated.getContext('2d')!
  rctx.save()
  rctx.translate(rotW / 2, rotH / 2)
  rctx.rotate((rotation.value * Math.PI) / 180)
  rctx.drawImage(img, -img.width / 2, -img.height / 2)
  rctx.restore()

  // 2. 套用裁切
  const cx = Math.round(cropX.value * rotW)
  const cy = Math.round(cropY.value * rotH)
  const cw = Math.round(cropW.value * rotW)
  const ch = Math.round(cropH.value * rotH)

  // 3. 縮放到 targetWidth / Height
  const out = document.createElement('canvas')
  out.width = targetWidth.value
  out.height = targetHeight.value
  const octx = out.getContext('2d')!
  if (outputFormat.value === 'jpeg') {
    octx.fillStyle = '#fff'
    octx.fillRect(0, 0, out.width, out.height)
  }
  octx.drawImage(rotated, cx, cy, cw, ch, 0, 0, out.width, out.height)

  const mime =
    outputFormat.value === 'png' ? 'image/png' :
    outputFormat.value === 'jpeg' ? 'image/jpeg' : 'image/webp'
  const blob = await new Promise<Blob>(res =>
    out.toBlob(b => res(b!), mime, outputFormat.value === 'png' ? undefined : quality.value / 100)
  )
  const ext = outputFormat.value === 'jpeg' ? 'jpg' : outputFormat.value
  const fname = outputName.value.trim() || 'edited'
  const finalName = new RegExp(`\\.${ext}$`, 'i').test(fname) ? fname : `${fname}.${ext}`
  downloadBlob(blob, finalName)
}

function reset() {
  imageFile.value = null
  sourceImg.value = null
}

onUnmounted(() => {
  // nothing to clean (we don't keep blob URLs around)
})
</script>

<template>
  <ToolLayout
    title="圖片裁切 / 縮放 / 旋轉"
    icon="📐"
    description="拖裁切框、輸入目標尺寸、90° 旋轉,輸出 PNG / JPG / WebP。"
  >
    <div
      v-if="!imageFile"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">📐</div>
      <p>點這裡或拖圖片進來</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div v-if="imageFile" class="workspace">
      <!-- 預覽 + 裁切框 -->
      <section>
        <h3>// 預覽(拖框裁切)</h3>
        <div
          class="canvas-wrap"
          @pointermove="onCropMove"
          @pointerup="endCropDrag"
          @pointercancel="endCropDrag"
          @pointerleave="endCropDrag"
        >
          <canvas ref="previewCanvas" class="preview-canvas" />
          <!-- 裁切框 -->
          <div
            class="crop-box"
            :style="{
              left: cropX * 100 + '%',
              top: cropY * 100 + '%',
              width: cropW * 100 + '%',
              height: cropH * 100 + '%',
            }"
            @pointerdown="startCropDrag('move', $event)"
          >
            <div class="crop-handle h-tl" @pointerdown="startCropDrag('tl', $event)"></div>
            <div class="crop-handle h-tr" @pointerdown="startCropDrag('tr', $event)"></div>
            <div class="crop-handle h-bl" @pointerdown="startCropDrag('bl', $event)"></div>
            <div class="crop-handle h-br" @pointerdown="startCropDrag('br', $event)"></div>
          </div>
        </div>
        <p class="hint">↑ 拖中間移動,拉四角縮放裁切範圍。預覽縮小顯示但**輸出會保留原圖品質**。</p>
      </section>

      <!-- 控制 -->
      <section class="controls">
        <div class="row">
          <PixelButton variant="secondary" size="sm" @click="rotate90">↻ 旋轉 90°</PixelButton>
          <PixelButton variant="secondary" size="sm" @click="resetCrop">↺ 重設裁切</PixelButton>
        </div>

        <div class="grid">
          <label class="field">
            <span class="label">寬(px)</span>
            <input
              :value="targetWidth"
              type="number"
              class="pixel-input"
              min="1"
              @input="onWidthChange(($event.target as HTMLInputElement).valueAsNumber)"
            />
          </label>
          <label class="field">
            <span class="label">高(px)</span>
            <input
              :value="targetHeight"
              type="number"
              class="pixel-input"
              min="1"
              @input="onHeightChange(($event.target as HTMLInputElement).valueAsNumber)"
            />
          </label>
        </div>
        <label class="check">
          <input v-model="aspectLocked" type="checkbox" />
          <span>鎖定寬高比</span>
        </label>

        <div class="grid">
          <label class="field">
            <span class="label">輸出格式</span>
            <select v-model="outputFormat" class="pixel-input">
              <option value="png">PNG(無損)</option>
              <option value="jpeg">JPG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label v-if="outputFormat !== 'png'" class="field">
            <span class="label">品質({{ quality }}%)</span>
            <input v-model.number="quality" type="range" min="40" max="100" />
          </label>
        </div>

        <label class="field">
          <span class="label">檔名</span>
          <input v-model="outputName" type="text" class="pixel-input" />
        </label>

        <div class="meta">
          原圖:{{ readableSize(imageFile.size) }}
          · 裁切後尺寸:{{ Math.round(cropW * 100) }}% × {{ Math.round(cropH * 100) }}%
        </div>

        <div class="actions">
          <PixelButton size="lg" @click="exportImage">💾 匯出</PixelButton>
          <PixelButton variant="danger" size="sm" @click="reset">換一張</PixelButton>
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
.dz-icon {
  font-size: 56px;
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
    grid-template-columns: 1.6fr 1fr;
    align-items: start;
  }
}

h3 {
  color: var(--accent-2);
  margin: 0 0 8px;
  font-size: 13px;
}

.canvas-wrap {
  position: relative;
  background: var(--p8-white);
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
  width: fit-content;
  max-width: 100%;
  touch-action: none;
}
.preview-canvas {
  display: block;
  max-width: 100%;
}
.crop-box {
  position: absolute;
  border: 2px dashed var(--accent);
  background: rgba(41, 173, 255, 0.1);
  cursor: move;
  touch-action: none;
}
.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border: 2px solid var(--border);
  touch-action: none;
}
.h-tl { top: -8px; left: -8px; cursor: nwse-resize; }
.h-tr { top: -8px; right: -8px; cursor: nesw-resize; }
.h-bl { bottom: -8px; left: -8px; cursor: nesw-resize; }
.h-br { bottom: -8px; right: -8px; cursor: nwse-resize; }

.hint {
  font-size: 10px;
  color: var(--text-dim);
  margin: 8px 0 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.meta {
  font-size: 10px;
  color: var(--text-dim);
  padding: 8px;
  background: var(--surface);
  border: 2px solid var(--border);
}
.actions {
  display: flex;
  gap: 12px;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
