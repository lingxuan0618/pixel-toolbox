<script setup lang="ts">
import { ref } from 'vue'
import { PDFDocument } from 'pdf-lib'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob, readableSize } from '../lib/download'

interface ImageEntry {
  id: string
  file: File
  url: string
}

const images = ref<ImageEntry[]>([])
const outputName = ref('images')
const pageSize = ref<'A4' | 'Letter' | 'fit'>('A4')
const orientation = ref<'auto' | 'portrait' | 'landscape'>('auto')
const margin = ref(20)
const error = ref<string | null>(null)
const isProcessing = ref(false)
const dropActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function isImage(f: File): boolean {
  return /^image\/(png|jpe?g|webp)$/i.test(f.type) ||
         /\.(png|jpe?g|webp)$/i.test(f.name)
}

function handleFiles(list: FileList) {
  for (const f of Array.from(list)) {
    if (!isImage(f)) {
      error.value = `${f.name} 不是支援的圖片(PNG/JPG/WebP),已跳過`
      continue
    }
    images.value.push({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) })
  }
}

function onFileChange(e: Event) {
  const fl = (e.target as HTMLInputElement).files
  if (fl) handleFiles(fl)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}

function remove(id: string) {
  const e = images.value.find(i => i.id === id)
  if (e) URL.revokeObjectURL(e.url)
  images.value = images.value.filter(i => i.id !== id)
}
function moveUp(id: string) {
  const i = images.value.findIndex(x => x.id === id)
  if (i > 0) {
    const arr = [...images.value]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    images.value = arr
  }
}
function moveDown(id: string) {
  const i = images.value.findIndex(x => x.id === id)
  if (i >= 0 && i < images.value.length - 1) {
    const arr = [...images.value]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    images.value = arr
  }
}
function clearAll() {
  images.value.forEach(i => URL.revokeObjectURL(i.url))
  images.value = []
}

async function generate() {
  if (images.value.length === 0) return
  isProcessing.value = true
  error.value = null
  try {
    const doc = await PDFDocument.create()
    for (const entry of images.value) {
      const ab = await entry.file.arrayBuffer()
      const isPng = /\.png$/i.test(entry.file.name) || entry.file.type === 'image/png'
      let img
      if (isPng) {
        img = await doc.embedPng(ab)
      } else if (entry.file.type === 'image/webp' || /\.webp$/i.test(entry.file.name)) {
        // pdf-lib 不直接支援 webp,要先用 Canvas 轉成 PNG
        const bitmap = await createImageBitmap(entry.file)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
        const pngBlob = await new Promise<Blob>(res =>
          canvas.toBlob(b => res(b!), 'image/png')
        )
        img = await doc.embedPng(await pngBlob.arrayBuffer())
      } else {
        img = await doc.embedJpg(ab)
      }

      // 決定頁面尺寸
      let pageW: number, pageH: number
      const isLandscape =
        orientation.value === 'landscape' ||
        (orientation.value === 'auto' && img.width > img.height)
      if (pageSize.value === 'A4') {
        pageW = isLandscape ? 842 : 595
        pageH = isLandscape ? 595 : 842
      } else if (pageSize.value === 'Letter') {
        pageW = isLandscape ? 792 : 612
        pageH = isLandscape ? 612 : 792
      } else {
        pageW = img.width
        pageH = img.height
      }

      const page = doc.addPage([pageW, pageH])
      const m = pageSize.value === 'fit' ? 0 : margin.value
      const availW = pageW - 2 * m
      const availH = pageH - 2 * m
      const ratio = Math.min(availW / img.width, availH / img.height, 1)
      const w = img.width * ratio
      const h = img.height * ratio
      page.drawImage(img, {
        x: (pageW - w) / 2,
        y: (pageH - h) / 2,
        width: w,
        height: h,
      })
    }
    const bytes = await doc.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const fname = outputName.value.trim() || 'images'
    downloadBlob(blob, /\.pdf$/i.test(fname) ? fname : fname + '.pdf')
  } catch (e: unknown) {
    error.value = '產生失敗:' + (e instanceof Error ? e.message : '未知錯誤')
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <ToolLayout
    title="圖片 → PDF"
    icon="📄"
    description="多張圖片合成一份 PDF。順序由上到下,每張一頁。"
  >
    <div
      class="dropzone"
      :class="{ active: dropActive }"
      @click="fileInput?.click()"
      @dragover.prevent="dropActive = true"
      @dragleave="dropActive = false"
      @drop="onDrop"
    >
      <div class="dz-icon">📥</div>
      <p>{{ images.length === 0 ? '點這裡或拖圖片進來' : '繼續加入更多' }}</p>
      <p class="sub">支援 PNG / JPG / WebP,可一次選多張</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div v-if="images.length > 0" class="settings">
      <div class="grid">
        <label class="field">
          <span class="label">頁面尺寸</span>
          <select v-model="pageSize" class="pixel-input">
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="fit">符合原圖尺寸</option>
          </select>
        </label>
        <label v-if="pageSize !== 'fit'" class="field">
          <span class="label">方向</span>
          <select v-model="orientation" class="pixel-input">
            <option value="auto">自動(依圖判斷)</option>
            <option value="portrait">直向</option>
            <option value="landscape">橫向</option>
          </select>
        </label>
        <label v-if="pageSize !== 'fit'" class="field">
          <span class="label">邊界({{ margin }}px)</span>
          <input v-model.number="margin" type="range" min="0" max="80" />
        </label>
      </div>

      <h3>// 排序({{ images.length }} 張)</h3>
      <ul class="list">
        <li v-for="(im, idx) in images" :key="im.id" class="row">
          <span class="idx">{{ idx + 1 }}.</span>
          <img :src="im.url" class="prev" />
          <div class="info">
            <div class="name">{{ im.file.name }}</div>
            <div class="meta">{{ readableSize(im.file.size) }}</div>
          </div>
          <div class="row-act">
            <button class="ib" :disabled="idx === 0" @click="moveUp(im.id)">▲</button>
            <button class="ib" :disabled="idx === images.length - 1" @click="moveDown(im.id)">▼</button>
            <button class="ib danger" @click="remove(im.id)">✕</button>
          </div>
        </li>
      </ul>

      <label class="field filename-field">
        <span class="label">輸出檔名</span>
        <div class="filename-row">
          <input v-model="outputName" class="pixel-input" type="text" placeholder="images" />
          <span class="ext">.pdf</span>
        </div>
      </label>

      <div class="actions">
        <PixelButton size="lg" :disabled="isProcessing" @click="generate">
          {{ isProcessing ? '產生中…' : '💾 產生 PDF' }}
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
}
.dropzone:hover,
.dropzone.active {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.dz-icon {
  font-size: 48px;
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
.settings {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
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
}
.filename-row {
  display: flex;
  gap: 8px;
}
.filename-row .pixel-input {
  flex: 1;
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
.settings h3 {
  color: var(--accent-2);
  margin: 0;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--surface);
  border: 3px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--shadow);
}
.idx {
  font-size: 14px;
  color: var(--accent);
  min-width: 28px;
}
.prev {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: 2px solid var(--border);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: 10px;
  color: var(--text-dim);
}
.row-act {
  display: flex;
  gap: 4px;
}
.ib {
  width: 36px;
  height: 36px;
  background: var(--surface);
  color: var(--text);
  border: 2px solid var(--border);
  cursor: pointer;
  font-family: inherit;
}
.ib:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg);
}
.ib.danger:hover {
  background: var(--danger);
  color: var(--p8-white);
}
.ib:disabled {
  opacity: 0.4;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 3px dashed var(--border);
}
</style>
