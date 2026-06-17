<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { marked } from 'marked'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'
import { downloadBlob } from '../lib/download'

const md = ref(`# 我的文件

> 把 Markdown 轉成 PDF 或 HTML。支援 GFM(表格、清單、勾選框)。

## 標題層級

### 三級標題
#### 四級標題

## 文字樣式

**粗體**、*斜體*、~~刪除~~、\`程式碼\`

## 清單

- 項目 1
- 項目 2
  - 巢狀
- 項目 3

## 任務清單

- [x] 完成的事
- [ ] 沒做的事

## 表格

| 名稱  | 數量 | 備註 |
|------|------|------|
| 蘋果  | 3    | 好吃 |
| 香蕉  | 5    | 黃色 |

## 程式碼區塊

\`\`\`js
function hello(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

## 引用

> 這是引言。
> 第二行。

## 連結

[Pixel Toolbox](https://github.com/lingxuan0618)
`)

const css = ref(`body {
  font-family: -apple-system, "Helvetica Neue", "Microsoft JhengHei", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #2c2137;
  padding: 32px;
  max-width: 760px;
  margin: 0 auto;
}
h1, h2, h3, h4 { color: #1d2b53; margin-top: 1.4em; }
h1 { border-bottom: 3px solid #29adff; padding-bottom: 8px; }
h2 { border-bottom: 1px solid #ddd; padding-bottom: 4px; }
a { color: #29adff; }
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
pre code { background: transparent; color: inherit; padding: 0; }
blockquote {
  border-left: 4px solid #29adff;
  padding: 4px 16px;
  color: #5f574f;
  margin: 1em 0;
  background: #f9f9f9;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
table th, table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}
table th { background: #f5f5f5; }
ul li input[type="checkbox"] { margin-right: 6px; }
img { max-width: 100%; }
`)

const format = ref<'a4' | 'letter' | 'a3'>('a4')
const orientation = ref<'portrait' | 'landscape'>('portrait')
const margin = ref(15)
const outputName = ref('document')
const error = ref<string | null>(null)
const isProcessing = ref(false)

marked.setOptions({ gfm: true, breaks: false })

const renderedHtml = computed(() => {
  try {
    return marked.parse(md.value, { async: false }) as string
  } catch (e) {
    return '<p style="color:red">Markdown 解析錯誤:' + (e as Error).message + '</p>'
  }
})

const fullHtml = computed(() => {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${outputName.value}</title><style>${css.value}</style></head><body>${renderedHtml.value}</body></html>`
})

const previewSrc = ref<string>('')

function refreshPreview() {
  const blob = new Blob([fullHtml.value], { type: 'text/html;charset=utf-8' })
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
  previewSrc.value = URL.createObjectURL(blob)
}

// 即時更新預覽(debounce 300ms)
let debounceTimer: number | null = null
watch([md, css], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(refreshPreview, 300)
}, { immediate: true })

async function downloadHtml() {
  const blob = new Blob([fullHtml.value], { type: 'text/html;charset=utf-8' })
  const fname = outputName.value.trim() || 'document'
  downloadBlob(blob, /\.html?$/i.test(fname) ? fname : fname + '.html')
}

async function downloadPdf() {
  isProcessing.value = true
  error.value = null
  try {
    const { default: html2pdf } = await import('html2pdf.js') as any
    const wrap = document.createElement('div')
    wrap.style.position = 'fixed'
    wrap.style.left = '-9999px'
    wrap.style.top = '0'
    wrap.style.width =
      orientation.value === 'portrait' ? '794px' : '1123px'
    wrap.innerHTML = `<style>${css.value}</style>${renderedHtml.value}`
    document.body.appendChild(wrap)

    const fname = outputName.value.trim() || 'document'
    const finalName = /\.pdf$/i.test(fname) ? fname : fname + '.pdf'

    await html2pdf()
      .set({
        margin: margin.value,
        filename: finalName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: format.value, orientation: orientation.value },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(wrap)
      .save()

    document.body.removeChild(wrap)
  } catch (e: unknown) {
    error.value = '產生失敗:' + (e instanceof Error ? e.message : '未知')
  } finally {
    isProcessing.value = false
  }
}

function loadMdFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const r = new FileReader()
  r.onload = () => { md.value = r.result as string }
  r.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

onUnmounted(() => {
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
})
</script>

<template>
  <ToolLayout
    title="Markdown → PDF / HTML"
    icon="📝"
    description="支援 GitHub 風格 Markdown(表格、勾選框)。可下載 HTML 或 PDF。"
  >
    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div class="grid">
      <label class="field tall">
        <span class="label">Markdown</span>
        <textarea
          v-model="md"
          class="pixel-input mono"
          rows="18"
          spellcheck="false"
          placeholder="# Hello"
        ></textarea>
      </label>

      <label class="field tall">
        <span class="label">CSS(選填,影響輸出樣式)</span>
        <textarea
          v-model="css"
          class="pixel-input mono"
          rows="18"
          spellcheck="false"
        ></textarea>
      </label>
    </div>

    <div class="row">
      <label class="file-pill">
        📂 匯入 .md
        <input type="file" accept=".md,.markdown,.txt,text/markdown" hidden @change="loadMdFile" />
      </label>
    </div>

    <div class="preview-block">
      <h3>// 即時預覽</h3>
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
        <span class="label">PDF 邊界({{ margin }} mm)</span>
        <input v-model.number="margin" type="range" min="0" max="40" />
      </label>
      <label class="field">
        <span class="label">檔名</span>
        <input v-model="outputName" class="pixel-input" type="text" placeholder="document" />
      </label>
    </div>

    <div class="actions">
      <PixelButton size="lg" :disabled="isProcessing" @click="downloadPdf">
        {{ isProcessing ? '產生中…' : '💾 下載 PDF' }}
      </PixelButton>
      <PixelButton variant="secondary" @click="downloadHtml">
        💾 下載 HTML
      </PixelButton>
    </div>

    <p class="warn">
      ⚠ 提醒:PDF 是「拍照成圖再嵌進去」,文字無法選取。
      HTML 則是真實標籤,可以複製、可以再編輯。
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
  height: 420px;
  background: white;
  border: 4px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--shadow);
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
