<script setup lang="ts">
import { ref, shallowRef, computed, onUnmounted } from 'vue'
import { PDFDocument } from 'pdf-lib'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

interface Thumb {
  pageNum: number
  url: string
}

const pdfFile = ref<File | null>(null)
const totalPages = ref(0)
const rangeInput = ref('')
const outputName = ref('split_pages')
const error = ref<string | null>(null)
const isSplitting = ref(false)
const isLoadingThumbs = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const thumbs = shallowRef<Thumb[]>([])

// 解析「1-3, 5, 7-9」這樣的字串成 0-based page indices
function parseRanges(input: string, total: number): number[] | string {
  if (!input.trim()) return '請輸入要保留的頁數'
  const result: number[] = []
  const seen = new Set<number>()
  const parts = input.split(/[,,]/).map(s => s.trim()).filter(Boolean)
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*[-－~]\s*(\d+)$/)
    if (m) {
      const a = parseInt(m[1], 10)
      const b = parseInt(m[2], 10)
      if (a < 1 || b > total || a > b) {
        return `「${part}」超出範圍(1 ~ ${total})`
      }
      for (let i = a; i <= b; i++) {
        if (!seen.has(i)) {
          seen.add(i)
          result.push(i - 1)
        }
      }
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      if (n < 1 || n > total) {
        return `「${part}」超出範圍(1 ~ ${total})`
      }
      if (!seen.has(n)) {
        seen.add(n)
        result.push(n - 1)
      }
    } else {
      return `看不懂「${part}」,請用例如「1-3, 5, 7-9」的格式`
    }
  }
  return result
}

const parsedPreview = computed<{
  ok: boolean
  message: string
  indices?: number[]
}>(() => {
  if (totalPages.value === 0) return { ok: false, message: '' }
  const result = parseRanges(rangeInput.value, totalPages.value)
  if (typeof result === 'string') return { ok: false, message: result }
  return {
    ok: true,
    message: `將擷取 ${result.length} 頁`,
    indices: result,
  }
})

const selectedSet = computed(() => {
  const s = new Set<number>()
  if (parsedPreview.value.ok && parsedPreview.value.indices) {
    parsedPreview.value.indices.forEach(i => s.add(i + 1))
  }
  return s
})

async function handleFile(f: File) {
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    error.value = '只接受 PDF 檔案'
    return
  }
  error.value = null
  try {
    pdfFile.value = f
    outputName.value = f.name.replace(/\.pdf$/i, '') + '_pages'
    const ab = await f.arrayBuffer()

    // 用 pdf-lib 拿頁數(快)
    const meta = await PDFDocument.load(ab.slice(0), { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false })
    totalPages.value = meta.getPageCount()
    if (!rangeInput.value) rangeInput.value = `1-${totalPages.value}`

    // 用 PDF.js 渲染縮圖(每一頁)
    isLoadingThumbs.value = true
    thumbs.value.forEach(t => URL.revokeObjectURL(t.url))
    thumbs.value = []
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    const list: Thumb[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const baseVp = page.getViewport({ scale: 1 })
      const scale = 160 / baseVp.width
      const vp = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width
      canvas.height = vp.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
      const blob = await new Promise<Blob>(res =>
        canvas.toBlob(b => res(b!), 'image/jpeg', 0.7)
      )
      list.push({ pageNum: i, url: URL.createObjectURL(blob) })
      // 邊產生邊顯示(每張都觸發 reactive 更新)
      thumbs.value = [...list]
    }
    doc.destroy()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知錯誤'
    error.value = '無法讀取這份 PDF:' + msg
  } finally {
    isLoadingThumbs.value = false
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
  thumbs.value.forEach(t => URL.revokeObjectURL(t.url))
  thumbs.value = []
  pdfFile.value = null
  totalPages.value = 0
  rangeInput.value = ''
  error.value = null
}

function toggleThumb(pageNum: number) {
  // 點縮圖切換選取:把這頁加入或移出 rangeInput
  if (selectedSet.value.has(pageNum)) {
    // 移除這頁:把現有選擇展開成單張清單,排除該頁
    const others = Array.from(selectedSet.value)
      .filter(n => n !== pageNum)
      .sort((a, b) => a - b)
    rangeInput.value = compress(others)
  } else {
    const next = [...selectedSet.value, pageNum].sort((a, b) => a - b)
    rangeInput.value = compress(next)
  }
}

// 把 [1,2,3,5,7,8] 壓回 "1-3, 5, 7-8"
function compress(pages: number[]): string {
  if (pages.length === 0) return ''
  const parts: string[] = []
  let start = pages[0]
  let prev = pages[0]
  for (let i = 1; i < pages.length; i++) {
    if (pages[i] === prev + 1) {
      prev = pages[i]
    } else {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`)
      start = pages[i]
      prev = pages[i]
    }
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`)
  return parts.join(', ')
}

async function doSplit() {
  if (!pdfFile.value || !parsedPreview.value.ok || !parsedPreview.value.indices) {
    error.value = parsedPreview.value.message || '請先選擇 PDF 並輸入頁碼'
    return
  }
  isSplitting.value = true
  error.value = null
  try {
    const ab = await pdfFile.value.arrayBuffer()
    const src = await PDFDocument.load(ab, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false })
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, parsedPreview.value.indices)
    pages.forEach(p => out.addPage(p))
    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const fname = outputName.value.trim() || 'split_pages'
    downloadBlob(blob, /\.pdf$/i.test(fname) ? fname : fname + '.pdf')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知錯誤'
    error.value = '拆分失敗:' + msg
  } finally {
    isSplitting.value = false
  }
}

onUnmounted(() => {
  thumbs.value.forEach(t => URL.revokeObjectURL(t.url))
})
</script>

<template>
  <ToolLayout
    title="PDF 拆分"
    icon="✂️"
    description="點縮圖或輸入頁碼範圍,把想要的頁面拆成一份新 PDF。"
  >
    <!-- 選檔 -->
    <div
      v-if="!pdfFile"
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dropzone-icon">✂️</div>
      <p class="dropzone-text">點這裡或把 PDF 拖進來</p>
      <p class="dropzone-sub">只能選一份</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="error">⚠ {{ error }}</p>

    <!-- 工作區 -->
    <div v-if="pdfFile" class="settings">
      <div class="file-row">
        <span class="file-name">📄 {{ pdfFile.name }}</span>
        <span class="file-meta">共 {{ totalPages }} 頁</span>
      </div>

      <label class="field">
        <span class="label">要保留的頁碼 / 範圍</span>
        <input
          v-model="rangeInput"
          class="pixel-input"
          type="text"
          placeholder="例:1-3, 5, 7-9"
        />
        <small class="help">
          用 <code>-</code> 表示範圍,用 <code>,</code> 分隔多段。也可以直接點下面的縮圖切換。
        </small>
      </label>

      <div
        class="preview-msg"
        :class="{ ok: parsedPreview.ok, bad: !parsedPreview.ok && rangeInput }"
      >
        {{ parsedPreview.message || ' ' }}
      </div>

      <!-- 縮圖 -->
      <h3 class="thumbs-title">// 頁面縮圖({{ thumbs.length }} / {{ totalPages }})</h3>
      <p v-if="isLoadingThumbs && thumbs.length === 0" class="hint">產生縮圖中…</p>
      <div class="thumb-grid">
        <button
          v-for="t in thumbs"
          :key="t.pageNum"
          type="button"
          class="thumb"
          :class="{ selected: selectedSet.has(t.pageNum) }"
          :title="`點擊切換第 ${t.pageNum} 頁`"
          @click="toggleThumb(t.pageNum)"
        >
          <img :src="t.url" :alt="`page ${t.pageNum}`" />
          <span class="thumb-label">P. {{ t.pageNum }}</span>
        </button>
      </div>

      <label class="filename-field">
        <span class="label">輸出檔名</span>
        <div class="filename-row">
          <input
            v-model="outputName"
            class="pixel-input"
            type="text"
            placeholder="split_pages"
          />
          <span class="ext">.pdf</span>
        </div>
      </label>

      <div class="actions">
        <PixelButton
          size="lg"
          :disabled="!parsedPreview.ok || isSplitting"
          @click="doSplit"
        >
          {{ isSplitting ? '處理中…' : '💾 拆分並下載' }}
        </PixelButton>
        <PixelButton variant="danger" size="sm" @click="reset">
          重新選擇檔案
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
  transition: background-color 0.15s;
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
  color: var(--text);
}
.dropzone-sub {
  font-size: 10px;
  color: var(--text-dim);
  margin: 0;
}

.error {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 16px 0;
  font-size: 12px;
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
}

.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.file-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  font-size: 11px;
  flex-wrap: wrap;
}
.file-name {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-meta {
  color: var(--text-dim);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 11px;
  color: var(--accent-2);
}
.pixel-input {
  font-family: inherit;
  font-size: 14px;
  padding: 12px 16px;
  background: var(--surface);
  color: var(--text);
  border: 4px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  outline: none;
}
.pixel-input:focus {
  border-color: var(--accent);
}
.help {
  font-size: 10px;
  color: var(--text-dim);
}
.help code {
  background: var(--bg);
  padding: 1px 6px;
  border: 1px solid var(--border);
  font-size: 10px;
}

.preview-msg {
  padding: 10px;
  font-size: 11px;
  border: 3px solid var(--border);
  min-height: 1.6em;
}
.preview-msg.ok {
  color: var(--success);
  border-color: var(--success);
}
.preview-msg.bad {
  color: var(--danger);
  border-color: var(--danger);
}

.thumbs-title {
  color: var(--accent-2);
  margin: 8px 0 0;
  font-size: 14px;
}
.hint {
  font-size: 10px;
  color: var(--text-dim);
  margin: 0;
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.thumb {
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  transition:
    transform 0.06s ease-out,
    box-shadow 0.06s ease-out;
}
.thumb:hover {
  transform: translate(-1px, -1px);
}
.thumb img {
  width: 100%;
  height: auto;
  display: block;
  background: var(--p8-white);
}
.thumb-label {
  font-size: 10px;
  padding: 4px;
  background: var(--surface);
  color: var(--text-dim);
}
.thumb.selected {
  border-color: var(--accent);
  box-shadow:
    4px 4px 0 0 var(--accent),
    0 0 0 4px var(--accent) inset;
}
.thumb.selected .thumb-label {
  background: var(--accent);
  color: var(--bg);
  font-weight: bold;
}

.filename-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
