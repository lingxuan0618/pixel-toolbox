<script setup lang="ts">
import { ref, shallowRef, onUnmounted } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

interface Page {
  id: string
  originalIndex: number   // 在原 PDF 中的 0-based 頁碼
  rotation: number        // 累積旋轉 (0/90/180/270)
  thumbUrl: string
}

const pdfFile = ref<File | null>(null)
const pdfBytes = shallowRef<Uint8Array | null>(null)
const pages = ref<Page[]>([])
const outputName = ref('reordered')
const isLoading = ref(false)
const isExporting = ref(false)
const error = ref<string | null>(null)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// 拖曳排序狀態
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

async function handleFile(f: File) {
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    error.value = '只接受 PDF'
    return
  }
  error.value = null
  isLoading.value = true
  pages.value.forEach(p => URL.revokeObjectURL(p.thumbUrl))
  pages.value = []
  try {
    pdfFile.value = f
    outputName.value = f.name.replace(/\.pdf$/i, '') + '_reordered'
    const ab = await f.arrayBuffer()
    pdfBytes.value = new Uint8Array(ab)
    // 用 PDF.js 渲染每頁縮圖
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab.slice(0)) }).promise
    const list: Page[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const baseVp = page.getViewport({ scale: 1 })
      const scale = 180 / baseVp.width
      const vp = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width
      canvas.height = vp.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.75))
      list.push({
        id: crypto.randomUUID(),
        originalIndex: i - 1,
        rotation: 0,
        thumbUrl: URL.createObjectURL(blob),
      })
      pages.value = [...list]  // progressive update
    }
    doc.destroy()
  } catch (e: unknown) {
    error.value = '讀取失敗:' + (e instanceof Error ? e.message : '未知')
  } finally {
    isLoading.value = false
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

function rotatePage(id: string) {
  const p = pages.value.find(x => x.id === id)
  if (p) p.rotation = (p.rotation + 90) % 360
}
function deletePage(id: string) {
  const p = pages.value.find(x => x.id === id)
  if (p) URL.revokeObjectURL(p.thumbUrl)
  pages.value = pages.value.filter(x => x.id !== id)
}
function movePage(id: string, delta: number) {
  const i = pages.value.findIndex(x => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= pages.value.length) return
  const arr = [...pages.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  pages.value = arr
}

// HTML drag-and-drop for reordering on desktop
function onDragStart(id: string, e: DragEvent) {
  draggedId.value = id
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(id: string, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverId.value = id
}
function onDragLeave() {
  dragOverId.value = null
}
function onDropPage(id: string, e: DragEvent) {
  e.preventDefault()
  dragOverId.value = null
  if (!draggedId.value || draggedId.value === id) return
  const arr = [...pages.value]
  const from = arr.findIndex(p => p.id === draggedId.value)
  const to = arr.findIndex(p => p.id === id)
  if (from < 0 || to < 0) return
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  pages.value = arr
  draggedId.value = null
}

async function exportPdf() {
  if (!pdfBytes.value || pages.value.length === 0) {
    error.value = '尚未選 PDF 或沒有頁面可輸出'
    return
  }
  isExporting.value = true
  error.value = null
  try {
    const src = await PDFDocument.load(pdfBytes.value.slice(0), {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })
    const out = await PDFDocument.create()
    const indices = pages.value.map(p => p.originalIndex)
    const copied = await out.copyPages(src, indices)
    copied.forEach((p, i) => {
      const meta = pages.value[i]
      if (meta.rotation !== 0) {
        // pdf-lib rotation 是「累積」,所以要先取得原本的
        const orig = p.getRotation().angle
        p.setRotation(degrees((orig + meta.rotation) % 360))
      }
      out.addPage(p)
    })
    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const fname = outputName.value.trim() || 'reordered'
    downloadBlob(blob, /\.pdf$/i.test(fname) ? fname : fname + '.pdf')
  } catch (e: unknown) {
    error.value = '輸出失敗:' + (e instanceof Error ? e.message : '未知')
  } finally {
    isExporting.value = false
  }
}

function reset() {
  pages.value.forEach(p => URL.revokeObjectURL(p.thumbUrl))
  pages.value = []
  pdfFile.value = null
  pdfBytes.value = null
}

onUnmounted(() => {
  pages.value.forEach(p => URL.revokeObjectURL(p.thumbUrl))
})
</script>

<template>
  <ToolLayout
    title="PDF 頁面管理"
    icon="🔄"
    description="拖曳排序頁面、單頁旋轉、刪除不要的頁。一次搞定。"
  >
    <PdfToolTabs current="/pdf-pages" />

    <div
      v-if="!pdfFile"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">🔄</div>
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
    <p v-if="isLoading" class="hint">產生縮圖中…({{ pages.length }} 已完成)</p>

    <div v-if="pdfFile && pages.length > 0">
      <div class="file-row">
        📄 {{ pdfFile.name }} · {{ pages.length }} 頁(已經過編輯)
      </div>

      <div class="page-grid">
        <div
          v-for="(p, idx) in pages"
          :key="p.id"
          class="page-card"
          :class="{ 'drag-over': dragOverId === p.id }"
          :draggable="true"
          @dragstart="onDragStart(p.id, $event)"
          @dragover="onDragOver(p.id, $event)"
          @dragleave="onDragLeave"
          @drop="onDropPage(p.id, $event)"
        >
          <div class="page-num">P. {{ idx + 1 }}</div>
          <div class="thumb-wrap">
            <img
              :src="p.thumbUrl"
              :style="{ transform: `rotate(${p.rotation}deg)` }"
              class="thumb"
            />
          </div>
          <div class="page-actions">
            <button class="pa-btn" title="左移" @click="movePage(p.id, -1)" :disabled="idx === 0">◄</button>
            <button class="pa-btn" title="旋轉" @click="rotatePage(p.id)">↻</button>
            <button class="pa-btn" title="右移" @click="movePage(p.id, 1)" :disabled="idx === pages.length - 1">►</button>
            <button class="pa-btn danger" title="刪除" @click="deletePage(p.id)">✕</button>
          </div>
        </div>
      </div>

      <label class="field">
        <span class="label">輸出檔名</span>
        <div class="filename-row">
          <input v-model="outputName" type="text" class="pixel-input" placeholder="reordered" />
          <span class="ext">.pdf</span>
        </div>
      </label>

      <div class="actions">
        <PixelButton size="lg" :disabled="isExporting" @click="exportPdf">
          {{ isExporting ? '匯出中…' : '💾 匯出 PDF' }}
        </PixelButton>
        <PixelButton variant="danger" size="sm" @click="reset">
          重新選檔
        </PixelButton>
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
}
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
}
.hint {
  color: var(--text-dim);
  font-size: 11px;
}

.file-row {
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  font-size: 11px;
  margin-bottom: 16px;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.page-card {
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  display: flex;
  flex-direction: column;
  padding: 8px;
  cursor: grab;
  user-select: none;
}
.page-card:active {
  cursor: grabbing;
}
.page-card.drag-over {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.page-num {
  font-size: 11px;
  color: var(--accent);
  text-align: center;
  margin-bottom: 4px;
}
.thumb-wrap {
  height: 180px;
  background: var(--p8-white);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.thumb {
  max-width: 100%;
  max-height: 100%;
  display: block;
  transition: transform 0.15s;
}
.page-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 6px;
}
.pa-btn {
  background: var(--surface);
  color: var(--text);
  border: 2px solid var(--border);
  font-family: inherit;
  font-size: 11px;
  padding: 6px 0;
  cursor: pointer;
}
.pa-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg);
}
.pa-btn:disabled {
  opacity: 0.4;
}
.pa-btn.danger:hover {
  background: var(--danger);
  color: var(--p8-white);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
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
