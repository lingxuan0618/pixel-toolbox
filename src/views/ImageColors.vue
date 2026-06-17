<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { extractPalette, rgbToHex } from '../lib/color'
import { downloadBlob } from '../lib/download'

const imageFile = ref<File | null>(null)
const imageUrl = ref<string>('')
const palette = ref<string[]>([])
const picked = ref<string[]>([])
const count = ref(6)
const error = ref<string | null>(null)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const copied = ref<string | null>(null)
let copiedTimer: number | null = null

// 隱形的原圖 canvas,用來取點像素
const sourceCanvas = shallowRef<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const hoverColor = ref<string | null>(null)

async function handleFile(f: File) {
  if (!/^image\//.test(f.type)) {
    error.value = '只接受圖片檔'
    return
  }
  error.value = null
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageFile.value = f
  imageUrl.value = URL.createObjectURL(f)
  picked.value = []
  await extract()
  await loadSourceCanvas()
}

async function loadSourceCanvas() {
  if (!imageFile.value) return
  const bitmap = await createImageBitmap(imageFile.value)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  sourceCanvas.value = canvas
}

async function extract() {
  if (!imageFile.value) return
  isProcessing.value = true
  try {
    const bitmap = await createImageBitmap(imageFile.value)
    const maxDim = 200
    const ratio = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1)
    const w = Math.round(bitmap.width * ratio)
    const h = Math.round(bitmap.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h)
    palette.value = extractPalette(data, count.value)
  } catch (e: unknown) {
    error.value = '分析失敗:' + (e instanceof Error ? e.message : '未知')
  } finally {
    isProcessing.value = false
  }
}

function colorAtEvent(e: MouseEvent): string | null {
  if (!sourceCanvas.value || !imageRef.value) return null
  const img = imageRef.value
  const rect = img.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  const sx = Math.floor(x * (sourceCanvas.value.width / rect.width))
  const sy = Math.floor(y * (sourceCanvas.value.height / rect.height))
  const data = sourceCanvas.value.getContext('2d')!.getImageData(sx, sy, 1, 1).data
  if (data[3] < 50) return null
  return rgbToHex({ r: data[0], g: data[1], b: data[2] })
}

function onImageMove(e: MouseEvent) {
  hoverColor.value = colorAtEvent(e)
}
function onImageLeave() {
  hoverColor.value = null
}
function onImageClick(e: MouseEvent) {
  const c = colorAtEvent(e)
  if (!c) return
  if (picked.value.includes(c)) return
  picked.value.push(c)
}

function removePicked(c: string) {
  picked.value = picked.value.filter(x => x !== c)
}

function clearPicked() {
  picked.value = []
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

async function copyHex(hex: string) {
  try {
    await navigator.clipboard.writeText(hex)
    copied.value = hex
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => (copied.value = null), 1200)
  } catch {}
}

function downloadCss() {
  const all = [...palette.value, ...picked.value]
  if (all.length === 0) return
  const lines = [':root {']
  all.forEach((c, i) => lines.push(`  --color-${i + 1}: ${c};`))
  lines.push('}')
  const blob = new Blob([lines.join('\n')], { type: 'text/css' })
  downloadBlob(blob, 'palette.css')
}

function reset() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageFile.value = null
  imageUrl.value = ''
  palette.value = []
  picked.value = []
  sourceCanvas.value = null
}
</script>

<template>
  <ToolLayout
    title="圖片取色"
    icon="🎯"
    description="自動萃取主要色票,或點圖片任一點選自訂顏色。"
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
      <div class="dz-icon">🎯</div>
      <p>點這裡或拖圖片進來</p>
      <p class="sub">JPG / PNG / WebP 都行</p>
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
      <section class="image-side">
        <div class="image-wrap">
          <img
            ref="imageRef"
            :src="imageUrl"
            class="image-preview"
            :draggable="false"
            @mousemove="onImageMove"
            @mouseleave="onImageLeave"
            @click="onImageClick"
          />
          <!-- hover 即時顯示游標位置色 -->
          <div v-if="hoverColor" class="hover-pip">
            <span class="hover-chip" :style="{ background: hoverColor }"></span>
            <span class="hover-hex">{{ hoverColor }}</span>
          </div>
        </div>
        <p class="hint">↑ 滑鼠移到任一點看顏色,**點擊**會把這點顏色加進「自選色」</p>
      </section>

      <section class="result-side">
        <!-- 自動萃取 -->
        <div class="block">
          <header class="block-head">
            <h3>// 主要色票({{ palette.length }})</h3>
            <input
              v-model.number="count"
              type="range"
              min="3"
              max="10"
              class="mini-slider"
              @change="extract"
            />
          </header>
          <p v-if="isProcessing" class="hint">分析中…</p>
          <div v-if="palette.length > 0" class="swatches">
            <button
              v-for="c in palette"
              :key="c"
              type="button"
              class="swatch"
              :style="{ background: c }"
              :title="`複製 ${c}`"
              @click="copyHex(c)"
            >
              <span class="hex">{{ c }}</span>
              <span v-if="copied === c" class="ok">✓</span>
            </button>
          </div>
        </div>

        <!-- 自選色 -->
        <div class="block">
          <header class="block-head">
            <h3>// 自選色({{ picked.length }})</h3>
            <button
              v-if="picked.length > 0"
              class="link-btn"
              @click="clearPicked"
            >全部清除</button>
          </header>
          <p v-if="picked.length === 0" class="hint">點左邊的圖片任一點即可加入</p>
          <div v-else class="swatches">
            <div
              v-for="c in picked"
              :key="c"
              role="button"
              tabindex="0"
              class="swatch"
              :style="{ background: c }"
              :title="`複製 ${c}(右鍵移除)`"
              @click="copyHex(c)"
              @keydown.enter="copyHex(c)"
              @contextmenu.prevent="removePicked(c)"
            >
              <span class="hex">{{ c }}</span>
              <span v-if="copied === c" class="ok">✓</span>
              <button
                type="button"
                class="remove-x"
                title="移除"
                @click.stop="removePicked(c)"
              >✕</button>
            </div>
          </div>
        </div>

        <div class="actions">
          <PixelButton
            size="sm"
            :disabled="palette.length === 0 && picked.length === 0"
            @click="downloadCss"
          >⬇ CSS(全部)</PixelButton>
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

.workspace {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .workspace {
    grid-template-columns: 1fr 1fr;
  }
}

.image-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.image-wrap {
  position: relative;
  background: var(--surface);
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
  padding: 12px;
  display: flex;
  justify-content: center;
}
.image-preview {
  max-width: 100%;
  height: auto;
  cursor: crosshair;
  user-select: none;
}
.hover-pip {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: var(--surface);
  border: 3px solid var(--border);
  padding: 6px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
.hover-chip {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
}
.hover-hex {
  font-size: 11px;
  color: var(--text);
}
.hint {
  font-size: 10px;
  color: var(--text-dim);
  margin: 0;
}

.result-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h3 {
  color: var(--accent-2);
  margin: 0;
  font-size: 13px;
}
.mini-slider {
  flex: 1;
  max-width: 120px;
}
.link-btn {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 10px;
  color: var(--danger);
  cursor: pointer;
  text-decoration: underline;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 6px;
}
.swatch {
  height: 70px;
  border: 3px solid var(--border);
  cursor: pointer;
  padding: 0;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-family: inherit;
}
.swatch:hover {
  transform: translate(-1px, -1px);
}
.hex {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  padding: 2px 6px;
  font-size: 10px;
  margin-bottom: 4px;
}
.ok {
  position: absolute;
  top: 4px;
  left: 4px;
  background: var(--success);
  color: #000;
  font-size: 9px;
  padding: 2px 6px;
}
.remove-x {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: var(--danger);
  color: var(--p8-white);
  border: 2px solid var(--border);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
