<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { PDFDocument } from 'pdf-lib'
import { pdfjsLib } from '../lib/pdfjs'
import ToolLayout from '../components/ToolLayout.vue'
import PdfToolTabs from '../components/PdfToolTabs.vue'
import PixelButton from '../components/PixelButton.vue'

interface FileEntry {
  id: string
  file: File
  pageCount: number
  sizeKB: number
  thumbUrl?: string
}

// File 物件本身沒有 private fields,可以放 ref;但每次操作 PDF 時都用區域變數,不要放 ref
const files = ref<FileEntry[]>([])
const outputName = ref('merged')
const isMerging = ref(false)
const error = ref<string | null>(null)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function ensurePdfExt(name: string): string {
  const trimmed = name.trim() || 'merged'
  return /\.pdf$/i.test(trimmed) ? trimmed : trimmed + '.pdf'
}

async function generateThumb(id: string, ab: ArrayBuffer) {
  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    const page = await doc.getPage(1)
    const baseVp = page.getViewport({ scale: 1 })
    const scale = 96 / baseVp.width
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
    const blob = await new Promise<Blob>(res =>
      canvas.toBlob(b => res(b!), 'image/jpeg', 0.7)
    )
    doc.destroy()
    const entry = files.value.find(f => f.id === id)
    if (entry) entry.thumbUrl = URL.createObjectURL(blob)
  } catch {
    // 縮圖失敗就算了,反正只是視覺輔助
  }
}

async function handleFiles(list: FileList) {
  error.value = null
  for (const f of Array.from(list)) {
    const isPdf =
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      error.value = `${f.name} 不是 PDF,已跳過`
      continue
    }
    try {
      const ab = await f.arrayBuffer()
      let pageCount = 0
      try {
        const doc = await PDFDocument.load(ab.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        })
        pageCount = doc.getPageCount()
      } catch {
        pageCount = -1
      }
      const id = crypto.randomUUID()
      files.value.push({
        id,
        file: f,
        pageCount,
        sizeKB: Math.round(f.size / 1024),
      })
      // 背景產縮圖,不擋使用者繼續加檔
      void generateThumb(id, ab)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知錯誤'
      error.value = `${f.name} 讀取失敗:${msg}`
    }
  }
}

function onFileChange(e: Event) {
  const fl = (e.target as HTMLInputElement).files
  if (fl) handleFiles(fl)
  ;(e.target as HTMLInputElement).value = ''  // 允許重選同樣的檔案
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}

function remove(id: string) {
  const entry = files.value.find(f => f.id === id)
  if (entry?.thumbUrl) URL.revokeObjectURL(entry.thumbUrl)
  files.value = files.value.filter(f => f.id !== id)
}

function moveUp(id: string) {
  const i = files.value.findIndex(f => f.id === id)
  if (i > 0) {
    const arr = [...files.value]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    files.value = arr
  }
}

function moveDown(id: string) {
  const i = files.value.findIndex(f => f.id === id)
  if (i >= 0 && i < files.value.length - 1) {
    const arr = [...files.value]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    files.value = arr
  }
}

function clearAll() {
  files.value.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl))
  files.value = []
  error.value = null
}

onUnmounted(() => {
  files.value.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl))
})

async function merge() {
  if (files.value.length < 2) {
    error.value = '至少要選 2 份 PDF'
    return
  }
  isMerging.value = true
  error.value = null
  try {
    const out = await PDFDocument.create()
    const skipped: string[] = []
    for (const entry of files.value) {
      try {
        const ab = await entry.file.arrayBuffer()
        const src = await PDFDocument.load(ab, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        })
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach(p => out.addPage(p))
      } catch {
        skipped.push(entry.file.name)
      }
    }
    if (out.getPageCount() === 0) {
      throw new Error('每份檔案都讀不出來,可能是加密或結構非標準的 PDF。' +
        '試試先用 Chrome / Edge 開啟 → 列印 → 另存為 PDF,再合併。')
    }
    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = ensurePdfExt(outputName.value)
    a.click()
    URL.revokeObjectURL(url)
    if (skipped.length > 0) {
      error.value =
        '已合併成功,但有些檔案讀不出來被跳過:\n· ' + skipped.join('\n· ')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知錯誤'
    error.value = '合併失敗:' + msg
  } finally {
    isMerging.value = false
  }
}
</script>

<template>
  <ToolLayout
    title="PDF 合併"
    icon="🗂️"
    description="多份 PDF 加進來,排好順序,一鍵合併下載。順序由上到下。"
  >
    <PdfToolTabs current="/pdf-merge" />

    <!-- 拖曳區 -->
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dropzone-icon">📥</div>
      <p class="dropzone-text">
        {{ files.length === 0 ? '點這裡或把多份 PDF 拖進來' : '繼續加入更多 PDF' }}
      </p>
      <p class="dropzone-sub">可以一次選好幾份,也可以分次加進來</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="error">⚠ {{ error }}</p>

    <!-- 檔案列表 -->
    <div v-if="files.length > 0" class="file-list">
      <h3>// 排序({{ files.length }} 份)</h3>
      <ul>
        <li
          v-for="(f, idx) in files"
          :key="f.id"
          class="file-row"
        >
          <span class="index">{{ idx + 1 }}.</span>
          <div class="thumb-box">
            <img v-if="f.thumbUrl" :src="f.thumbUrl" class="thumb-img" :alt="f.file.name" />
            <span v-else class="thumb-placeholder">…</span>
          </div>
          <div class="file-info">
            <div class="file-name">{{ f.file.name }}</div>
            <div class="file-meta">
              <span v-if="f.pageCount === -1">⚠ 頁數讀不出</span>
              <span v-else>{{ f.pageCount }} 頁</span>
              · {{ f.sizeKB }} KB
            </div>
          </div>
          <div class="row-actions">
            <button
              class="icon-btn"
              :disabled="idx === 0"
              title="上移"
              @click="moveUp(f.id)"
            >▲</button>
            <button
              class="icon-btn"
              :disabled="idx === files.length - 1"
              title="下移"
              @click="moveDown(f.id)"
            >▼</button>
            <button
              class="icon-btn danger"
              title="移除"
              @click="remove(f.id)"
            >✕</button>
          </div>
        </li>
      </ul>

      <label class="filename-field">
        <span class="label">輸出檔名</span>
        <div class="filename-row">
          <input
            v-model="outputName"
            class="pixel-input"
            type="text"
            placeholder="merged"
          />
          <span class="ext">.pdf</span>
        </div>
      </label>

      <div class="actions">
        <PixelButton
          size="lg"
          :disabled="files.length < 2 || isMerging"
          @click="merge"
        >
          {{ isMerging ? '合併中…' : '💾 合併並下載' }}
        </PixelButton>
        <PixelButton variant="secondary" size="sm" @click="clearAll">
          🧹 全部清除
        </PixelButton>
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
  transition: background-color 0.15s;
}
.dropzone:hover,
.dropzone.active {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.dropzone-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.dropzone-text {
  font-size: 13px;
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

.file-list {
  margin-top: 24px;
}
.file-list h3 {
  color: var(--accent-2);
  margin-bottom: 12px;
}
.file-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
}
.index {
  font-size: 16px;
  color: var(--accent);
  min-width: 24px;
}
.thumb-box {
  width: 48px;
  height: 64px;
  border: 2px solid var(--border);
  background: var(--p8-white);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.thumb-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.thumb-placeholder {
  font-size: 14px;
  color: var(--text-dim);
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 11px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-meta {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 4px;
}
.row-actions {
  display: flex;
  gap: 6px;
}
.icon-btn {
  width: 36px;
  height: 36px;
  background: var(--surface);
  color: var(--text);
  border: 2px solid var(--border);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}
.icon-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg);
}
.icon-btn.danger:hover {
  background: var(--danger);
  color: var(--p8-white);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.filename-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
}
.label {
  font-size: 10px;
  color: var(--accent-2);
}
.filename-row {
  display: flex;
  align-items: stretch;
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

.actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 3px dashed var(--border);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
