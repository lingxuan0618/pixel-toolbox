<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { PDFDocument, degrees } from 'pdf-lib'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

interface SourceDoc {
  id: string
  file: File
  name: string
  bytes: Uint8Array
  pageCount: number
  sizeKB: number
}

interface PageItem {
  id: string
  sourceId: string
  sourceName: string
  sourcePage: number
  thumbUrl: string
  rotation: number
  selected: boolean
}

const sources = ref<SourceDoc[]>([])
const pages = ref<PageItem[]>([])
const outputName = ref('workbench')
const isLoading = ref(false)
const isExporting = ref(false)
const error = ref<string | null>(null)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const selectedCount = computed(() => pages.value.filter((p) => p.selected).length)

function ensurePdfExt(name: string) {
  const trimmed = name.trim() || 'workbench'
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`
}

async function renderThumb(page: any): Promise<string> {
  const base = page.getViewport({ scale: 1 })
  const scale = 180 / base.width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立 Canvas')
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('縮圖轉換失敗'))),
      'image/jpeg',
      0.75,
    )
  })
  return URL.createObjectURL(blob)
}

async function handleFiles(list: FileList) {
  error.value = null
  isLoading.value = true
  try {
    for (const file of Array.from(list)) {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        error.value = `${file.name} 不是 PDF，已跳過`
        continue
      }

      const ab = await file.arrayBuffer()
      const bytes = new Uint8Array(ab)
      const sourceId = crypto.randomUUID()
      let pageCount = -1

      try {
        const meta = await PDFDocument.load(bytes.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        })
        pageCount = meta.getPageCount()
      } catch {
        pageCount = -1
      }

      const source: SourceDoc = {
        id: sourceId,
        file,
        name: file.name,
        bytes,
        pageCount,
        sizeKB: Math.round(file.size / 1024),
      }
      sources.value.push(source)

      const doc = await pdfjsLib.getDocument({ data: bytes }).promise
      try {
        const newPages: PageItem[] = []
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          const thumbUrl = await renderThumb(page)
          newPages.push({
            id: crypto.randomUUID(),
            sourceId,
            sourceName: file.name,
            sourcePage: pageNum - 1,
            thumbUrl,
            rotation: 0,
            selected: true,
          })
        }
        pages.value.push(...newPages)
      } finally {
        doc.destroy()
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '讀取 PDF 時發生錯誤'
  } finally {
    isLoading.value = false
  }
}

function onFileChange(e: Event) {
  const list = (e.target as HTMLInputElement).files
  if (list) handleFiles(list)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  const list = e.dataTransfer?.files
  if (list) handleFiles(list)
}

function togglePage(id: string) {
  const page = pages.value.find((p) => p.id === id)
  if (page) page.selected = !page.selected
}

function rotatePage(id: string) {
  const page = pages.value.find((p) => p.id === id)
  if (page) page.rotation = (page.rotation + 90) % 360
}

function movePage(id: string, delta: number) {
  const index = pages.value.findIndex((p) => p.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= pages.value.length) return
  const next = [...pages.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  pages.value = next
}

function deletePage(id: string) {
  const page = pages.value.find((p) => p.id === id)
  if (!page) return
  URL.revokeObjectURL(page.thumbUrl)
  pages.value = pages.value.filter((p) => p.id !== id)
}

function selectAll() {
  pages.value.forEach((p) => {
    p.selected = true
  })
}

function clearSelection() {
  pages.value.forEach((p) => {
    p.selected = false
  })
}

function clearAll() {
  pages.value.forEach((p) => URL.revokeObjectURL(p.thumbUrl))
  pages.value = []
  sources.value = []
  outputName.value = 'workbench'
  error.value = null
}

function onDragStart(id: string, e: DragEvent) {
  draggedId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
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
  const next = [...pages.value]
  const from = next.findIndex((p) => p.id === draggedId.value)
  const to = next.findIndex((p) => p.id === id)
  if (from < 0 || to < 0) return
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  pages.value = next
  draggedId.value = null
}

async function exportSelected() {
  const selected = pages.value.filter((p) => p.selected)
  if (selected.length === 0) {
    error.value = '請先選擇至少一個頁面'
    return
  }

  isExporting.value = true
  error.value = null

  try {
    const out = await PDFDocument.create()
    const sourceCache = new Map<string, PDFDocument>()

    for (const item of selected) {
      let src = sourceCache.get(item.sourceId)
      if (!src) {
        const source = sources.value.find((s) => s.id === item.sourceId)
        if (!source) continue
        src = await PDFDocument.load(source.bytes.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        })
        sourceCache.set(item.sourceId, src)
      }

      const sourcePage = src.getPage(item.sourcePage)
      const [copied] = await out.copyPages(src, [item.sourcePage])
      const angle = (sourcePage.getRotation().angle + item.rotation) % 360
      if (angle !== 0) copied.setRotation(degrees(angle))
      out.addPage(copied)
    }

    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    downloadBlob(blob, ensurePdfExt(outputName.value))
  } catch (e: unknown) {
    error.value = `匯出失敗：${e instanceof Error ? e.message : '未知錯誤'}`
  } finally {
    isExporting.value = false
  }
}

onUnmounted(() => {
  pages.value.forEach((p) => URL.revokeObjectURL(p.thumbUrl))
})
</script>

<template>
  <ToolLayout
    title="PDF 工作台"
    icon="🧩"
    description="多份 PDF 放在同一頁完成選頁、排序與輸出。"
  >
    <PdfToolTabs current="/pdf-pages" />

    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">📄</div>
      <p>{{ pages.length === 0 ? '點這裡或把 PDF 拖進來' : '繼續加入 PDF' }}</p>
      <p class="dz-sub">支援多檔上傳，頁面會直接展開成縮圖。</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="err">⚠ {{ error }}</p>
    <p v-if="isLoading" class="hint">載入中…</p>

    <div v-if="sources.length" class="source-strip">
      <div v-for="source in sources" :key="source.id" class="source-pill">
        {{ source.name }} ·
        <span v-if="source.pageCount >= 0">{{ source.pageCount }} 頁</span>
        <span v-else>無法讀取頁數</span>
        · {{ source.sizeKB }} KB
      </div>
    </div>

    <div v-if="pages.length" class="toolbar">
      <div class="count">{{ selectedCount }} / {{ pages.length }} 已選</div>
      <div class="toolbar-actions">
        <PixelButton size="sm" variant="secondary" @click="selectAll">全選</PixelButton>
        <PixelButton size="sm" variant="secondary" @click="clearSelection">清空選取</PixelButton>
        <PixelButton size="sm" :disabled="isExporting || selectedCount === 0" @click="exportSelected">
          {{ isExporting ? '輸出中…' : '匯出選取 PDF' }}
        </PixelButton>
      </div>
    </div>

    <div v-if="pages.length" class="page-grid">
      <div
        v-for="(page, index) in pages"
        :key="page.id"
        class="page-card"
        :class="{ selected: page.selected, 'drag-over': dragOverId === page.id }"
        draggable="true"
        @dragstart="onDragStart(page.id, $event)"
        @dragover="onDragOver(page.id, $event)"
        @dragleave="onDragLeave"
        @drop="onDropPage(page.id, $event)"
      >
        <div class="page-head">
          <button class="check-btn" type="button" @click="togglePage(page.id)">
            {{ page.selected ? '☑' : '☐' }}
          </button>
          <div class="page-meta">
            <div class="page-title">{{ page.sourceName }}</div>
            <div class="page-sub">來源頁 {{ page.sourcePage + 1 }} · 目前第 {{ index + 1 }} 頁</div>
          </div>
        </div>

        <div class="thumb-wrap">
          <img :src="page.thumbUrl" :style="{ transform: `rotate(${page.rotation}deg)` }" class="thumb" />
        </div>

        <div class="page-actions">
          <button class="pa-btn" type="button" :disabled="index === 0" @click="movePage(page.id, -1)">↑</button>
          <button class="pa-btn" type="button" @click="rotatePage(page.id)">↻</button>
          <button class="pa-btn" type="button" :disabled="index === pages.length - 1" @click="movePage(page.id, 1)">↓</button>
          <button class="pa-btn danger" type="button" @click="deletePage(page.id)">✕</button>
        </div>
      </div>
    </div>

    <div v-if="pages.length" class="output-row">
      <label class="filename-field">
        <span class="label">輸出名稱</span>
        <div class="filename-wrap">
          <input v-model="outputName" class="pixel-input" type="text" placeholder="workbench" />
          <span class="ext">.pdf</span>
        </div>
      </label>

      <div class="output-actions">
        <PixelButton size="lg" :disabled="isExporting || selectedCount === 0" @click="exportSelected">
          {{ isExporting ? '輸出中…' : '輸出 PDF' }}
        </PixelButton>
        <PixelButton variant="danger" size="sm" @click="clearAll">清空全部</PixelButton>
      </div>
    </div>
  </ToolLayout>
</template>

<style scoped>
.dropzone {
  border: 4px dashed var(--border);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  background: var(--surface);
}
.dropzone.active,
.dropzone:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.dz-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.dz-sub,
.hint {
  font-size: 10px;
  color: var(--text-dim);
  margin: 0;
}
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
}
.source-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
.source-pill {
  padding: 8px 10px;
  background: var(--surface);
  border: 3px solid var(--border);
  font-size: 10px;
  color: var(--text-dim);
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
  padding: 12px;
  border: 3px solid var(--border);
  background: var(--surface);
}
.count {
  font-size: 11px;
  color: var(--text-dim);
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.page-card {
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: grab;
  user-select: none;
}
.page-card:active {
  cursor: grabbing;
}
.page-card.selected {
  border-color: var(--accent);
}
.page-card.drag-over {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.page-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.check-btn {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
}
.page-meta {
  min-width: 0;
}
.page-title {
  font-size: 11px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-sub {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}
.thumb-wrap {
  height: 190px;
  border: 2px solid var(--border);
  background: var(--p8-white);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.thumb {
  max-width: 100%;
  max-height: 100%;
  display: block;
}
.page-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.pa-btn {
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  padding: 6px 0;
  cursor: pointer;
}
.pa-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg);
}
.pa-btn.danger:hover {
  background: var(--danger);
  color: var(--p8-white);
}
.pa-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.output-row {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 3px dashed var(--border);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
}
.filename-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: min(100%, 320px);
}
.label {
  font-size: 10px;
  color: var(--accent-2);
}
.filename-wrap {
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
.output-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
