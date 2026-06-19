<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { useToast } from '../composables/useToast'
import { downloadBlob } from '../lib/download'

type Format = 'a4' | 'letter' | 'a3' | 'a5'
type Orientation = 'portrait' | 'landscape'

const html = ref(`<h1>HTML 轉 PDF</h1>
<p>把 HTML 內容與樣式整理成正式文件，再匯出成 PDF。</p>
<p>支援 <strong>粗體</strong>、<em>斜體</em>、<code>code</code> 與清單。</p>
<ul>
  <li>預覽內容</li>
  <li>調整 CSS</li>
</ul>`)

const css = ref(`html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #222;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  padding: 32px;
}

#export-root {
  max-width: 760px;
  margin: 0 auto;
  background: #ffffff;
  color: #222;
}

h1, h2, h3, h4 {
  color: #1d2b53;
  margin: 1.4em 0 0.6em;
}

h1 {
  border-bottom: 3px solid #29adff;
  padding-bottom: 8px;
}

p {
  margin: 0 0 1em;
}

a {
  color: #29adff;
}

code {
  background: #f4f3ec;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: Consolas, Menlo, monospace;
  font-size: 0.92em;
}

pre {
  background: #1d2b53;
  color: #fff1e8;
  padding: 12px 16px;
  border-radius: 4px;
  overflow-x: auto;
}

pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

blockquote {
  border-left: 4px solid #29adff;
  padding: 4px 16px;
  color: #5f574f;
  margin: 1em 0;
  background: #f9f9f9;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

table th,
table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

table th {
  background: #f5f5f5;
}

img {
  max-width: 100%;
  display: block;
}`)

const format = ref<Format>('a4')
const orientation = ref<Orientation>('portrait')
const margin = ref(12)
const scale = ref(2)
const outputName = ref('document')
const error = ref<string | null>(null)
const isProcessing = ref(false)
const previewHost = ref<HTMLDivElement | null>(null)
const { show } = useToast()

const exportCss = computed(() => {
  return `${css.value}
html, body, #export-root {
  background: #fff !important;
  color: #222 !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}`
})

function refreshPreview() {
  const host = previewHost.value
  if (!host) return
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>${exportCss.value}</style>
    <div id="export-root">${html.value}</div>
  `
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

  await Promise.all([fontReady, ...imageReady])
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function buildExportTarget() {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = orientation.value === 'portrait' ? '794px' : '1123px'
  host.style.minHeight = '1px'
  host.style.pointerEvents = 'none'
  host.style.visibility = 'hidden'
  host.style.overflow = 'hidden'

  host.innerHTML = `
    <style>${exportCss.value}</style>
    <div id="export-root">${html.value}</div>
  `

  document.body.appendChild(host)

  const target = host.querySelector('#export-root') as HTMLElement | null
  if (!target) throw new Error('無法建立 PDF 匯出內容')

  await waitForRender(target)
  return { host, target }
}

async function generate() {
  isProcessing.value = true
  error.value = null
  let host: HTMLElement | null = null

  try {
    const { default: html2pdf } = (await import('html2pdf.js')) as any
    const built = await buildExportTarget()
    host = built.host
    const target = built.target

    const fname = outputName.value.trim() || 'document'
    const finalName = /\.pdf$/i.test(fname) ? fname : `${fname}.pdf`

    const blob = await html2pdf()
      .set({
        margin: margin.value,
        filename: finalName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: scale.value,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          foreignObjectRendering: false,
        },
        jsPDF: { unit: 'mm', format: format.value, orientation: orientation.value },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(target)
      .outputPdf('blob')

    downloadBlob(blob, finalName)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '匯出失敗'
    error.value = message
    show(`匯出失敗：${message}`, 'error')
  } finally {
    if (host?.parentNode) host.parentNode.removeChild(host)
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
    refreshPreview()
  }
  reader.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

onMounted(() => {
  refreshPreview()
})

watch([html, css], () => {
  refreshPreview()
})
</script>

<template>
  <ToolLayout
    title="HTML 轉 PDF"
    icon="🧾"
    description="輸入 HTML 與 CSS，先預覽再匯出成排版正常的 PDF。"
  >
    <p v-if="error" class="err">匯出失敗：{{ error }}</p>

    <div class="grid">
      <label class="field tall">
        <span class="label">HTML 內容</span>
        <textarea v-model="html" class="pixel-input mono" rows="14" spellcheck="false"></textarea>
      </label>

      <label class="field tall">
        <span class="label">CSS</span>
        <textarea v-model="css" class="pixel-input mono" rows="14" spellcheck="false"></textarea>
      </label>
    </div>

    <div class="row">
      <PixelButton variant="secondary" size="sm" @click="refreshPreview">重新整理預覽</PixelButton>

      <label class="file-pill">
        匯入 .html
        <input type="file" accept=".html,.htm,text/html" hidden @change="loadFromHtmlFile" />
      </label>
    </div>

    <div class="preview-block">
      <h3>預覽</h3>
      <div ref="previewHost" class="preview-host"></div>
    </div>

    <div class="grid">
      <label class="field">
        <span class="label">紙張格式</span>
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
        <span class="label">解析度（{{ scale }}x）</span>
        <input v-model.number="scale" type="range" min="1" max="3" step="0.5" />
        <small class="help">1x 比較快，2x 較平衡，3x 細節最多但檔案也最大。</small>
      </label>
    </div>

    <label class="field">
      <span class="label">輸出檔名</span>
      <div class="filename-row">
        <input v-model="outputName" class="pixel-input" type="text" placeholder="document" />
        <span class="ext">.pdf</span>
      </div>
    </label>

    <div class="actions">
      <PixelButton size="lg" :disabled="isProcessing" @click="generate">
        {{ isProcessing ? '匯出中…' : '匯出 PDF' }}
      </PixelButton>
    </div>

    <p class="warn">
      提示：如果匯出內容超出頁面，可以先調整邊界、方向或解析度。預覽正常時，匯出通常也會正常。
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

.help {
  font-size: 10px;
  color: var(--text-dim);
  line-height: 1.5;
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
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
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

.preview-host {
  width: 100%;
  height: 420px;
  background: #fff;
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
  overflow: auto;
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
