<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'

type Format = 'a4' | 'letter' | 'a3' | 'a5'
type Orientation = 'portrait' | 'landscape'

const html = ref(`<h1>標題</h1>
<p>這是 HTML 轉 PDF 的範例內容。你可以直接改成自己的 body 內容。</p>
<p>也可以輸入 <strong>粗體</strong>、<em>斜體</em>、<code>code</code>。</p>
<ul>
  <li>項目 1</li>
  <li>項目 2</li>
</ul>`)

const css = ref(`body {
  font-family: "Helvetica", "Microsoft JhengHei", sans-serif;
  font-size: 14px;
  color: #222;
  line-height: 1.6;
  padding: 24px;
}
h1 { color: #1d2b53; }
table { border-collapse: collapse; width: 100%; }
table td, table th { border: 1px solid #ccc; padding: 6px; }`)

const format = ref<Format>('a4')
const orientation = ref<Orientation>('portrait')
const margin = ref(10)
const scale = ref(2)
const outputName = ref('document')
const error = ref<string | null>(null)
const isProcessing = ref(false)
const previewSrc = ref<string>('')

const builtHtml = computed(() => {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><style>${css.value}</style></head><body>${html.value}</body></html>`
})

function waitForFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitForRender(target: HTMLElement) {
  const fontReady =
    'fonts' in document ? (document as Document & { fonts: FontFaceSet }).fonts.ready : Promise.resolve()
  const imageReady = Array.from(target.querySelectorAll('img')).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
  )

  await Promise.all([fontReady, waitForFrame(), ...imageReady])
}

function refreshPreview() {
  const blob = new Blob([builtHtml.value], { type: 'text/html;charset=utf-8' })
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
  previewSrc.value = URL.createObjectURL(blob)
}

async function generate() {
  isProcessing.value = true
  error.value = null
  let wrap: HTMLDivElement | null = null

  try {
    const { default: html2pdf } = (await import('html2pdf.js')) as any

    wrap = document.createElement('div')
    wrap.style.position = 'fixed'
    wrap.style.left = '-9999px'
    wrap.style.top = '0'
    wrap.style.width = orientation.value === 'portrait' ? '794px' : '1123px'
    wrap.innerHTML = `<style>${css.value}</style>${html.value}`
    document.body.appendChild(wrap)
    await waitForRender(wrap)

    const fname = outputName.value.trim() || 'document'
    const finalName = /\.pdf$/i.test(fname) ? fname : `${fname}.pdf`

    await html2pdf()
      .set({
        margin: margin.value,
        filename: finalName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: scale.value, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: format.value, orientation: orientation.value },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(wrap)
      .save()
  } catch (e: unknown) {
    error.value = `匯出失敗：${e instanceof Error ? e.message : '未知錯誤'}`
  } finally {
    if (wrap && wrap.parentNode) {
      wrap.parentNode.removeChild(wrap)
    }
    isProcessing.value = false
  }
}

function loadFromHtmlFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '')
    const styleMatch = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    if (styleMatch) css.value = styleMatch[1].trim()
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    html.value = bodyMatch ? bodyMatch[1].trim() : text
  }
  reader.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

refreshPreview()

onUnmounted(() => {
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
})
</script>

<template>
  <ToolLayout
    title="HTML 轉 PDF"
    icon="📰"
    description="貼上 HTML 與 CSS，預覽後直接輸出成 PDF。"
  >
    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div class="grid">
      <label class="field tall">
        <span class="label">HTML（只要 body 內容）</span>
        <textarea
          v-model="html"
          class="pixel-input mono"
          rows="14"
          spellcheck="false"
        ></textarea>
      </label>

      <label class="field tall">
        <span class="label">CSS</span>
        <textarea
          v-model="css"
          class="pixel-input mono"
          rows="14"
          spellcheck="false"
        ></textarea>
      </label>
    </div>

    <div class="row">
      <PixelButton variant="secondary" size="sm" @click="refreshPreview">
        更新預覽
      </PixelButton>

      <label class="file-pill">
        匯入 .html
        <input type="file" accept=".html,.htm,text/html" hidden @change="loadFromHtmlFile" />
      </label>
    </div>

    <div class="preview-block">
      <h3>// 預覽</h3>
      <iframe
        v-if="previewSrc"
        :src="previewSrc"
        class="preview-iframe"
        sandbox="allow-same-origin"
      ></iframe>
    </div>

    <div class="grid">
      <label class="field">
        <span class="label">紙張</span>
        <select v-model="format" class="pixel-input">
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
          <option value="a3">A3</option>
          <option value="a5">A5</option>
        </select>
      </label>
      <label class="field">
        <span class="label">方向</span>
        <select v-model="orientation" class="pixel-input">
          <option value="portrait">直向</option>
          <option value="landscape">橫向</option>
        </select>
      </label>
      <label class="field">
        <span class="label">邊界（{{ margin }} mm）</span>
        <input v-model.number="margin" type="range" min="0" max="40" />
      </label>
      <label class="field">
        <span class="label">縮放（{{ scale }}x）</span>
        <input v-model.number="scale" type="range" min="1" max="3" step="0.5" />
      </label>
    </div>

    <label class="field">
      <span class="label">輸出名稱</span>
      <div class="filename-row">
        <input v-model="outputName" class="pixel-input" type="text" placeholder="document" />
        <span class="ext">.pdf</span>
      </div>
    </label>

    <div class="actions">
      <PixelButton size="lg" :disabled="isProcessing" @click="generate">
        {{ isProcessing ? 'Generating...' : 'Download PDF' }}
      </PixelButton>
    </div>

    <p class="warn">
      提醒：HTML → PDF 是用瀏覽器把內容渲染成圖，再轉成 PDF。
      如果內容太大或有外部資源沒載入完成，輸出可能會有差異。
    </p>
  </ToolLayout>
</template>

<style scoped>
.err {
  color: var(--danger);
  border: 3px solid var(--danger);
  padding: 12px;
  margin: 0 0 16px;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field.tall textarea {
  height: 100%;
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
  resize: vertical;
}
.pixel-input.mono {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
}
.pixel-input:focus {
  border-color: var(--accent);
}

.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  align-items: center;
}
.file-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 8px 14px;
  background: var(--surface);
  color: var(--text);
  border: 3px solid var(--border);
  cursor: pointer;
}
.file-pill:hover {
  background: var(--accent);
  color: var(--bg);
}

.preview-block {
  margin: 16px 0 24px;
}
.preview-block h3 {
  color: var(--accent-2);
  margin: 0 0 8px;
  font-size: 13px;
}
.preview-iframe {
  width: 100%;
  height: 320px;
  background: white;
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
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

.warn {
  margin-top: 16px;
  padding: 12px;
  border: 3px dashed var(--highlight);
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.6;
}
</style>
