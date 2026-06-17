<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import ToolLayout from '../components/ToolLayout.vue'
import PixelButton from '../components/PixelButton.vue'

type Format = 'a4' | 'letter' | 'a3' | 'a5'
type Orientation = 'portrait' | 'landscape'

const html = ref(`<h1>標題</h1>
<p>把任何 HTML 貼進來,按下生成就會變成 PDF。</p>
<p>支援 <strong>標籤</strong>、<em>樣式</em>、表格、清單、圖片(用網址 url 引用)…</p>
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

function refreshPreview() {
  // 用 data: URI 做出 sandbox iframe 預覽
  const blob = new Blob([builtHtml.value], { type: 'text/html;charset=utf-8' })
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
  previewSrc.value = URL.createObjectURL(blob)
}

async function generate() {
  isProcessing.value = true
  error.value = null
  try {
    // 動態載入 html2pdf,避免初始 bundle 太大
    const { default: html2pdf } = await import('html2pdf.js') as any

    // 把 HTML 放進隱形容器,html2canvas 才有東西可拍
    const wrap = document.createElement('div')
    wrap.style.position = 'fixed'
    wrap.style.left = '-9999px'
    wrap.style.top = '0'
    wrap.style.width =
      orientation.value === 'portrait' ? '794px' : '1123px' // A4 @ 96dpi
    wrap.innerHTML = `<style>${css.value}</style>${html.value}`
    document.body.appendChild(wrap)

    const fname = outputName.value.trim() || 'document'
    const finalName = /\.pdf$/i.test(fname) ? fname : fname + '.pdf'

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

    document.body.removeChild(wrap)
  } catch (e: unknown) {
    error.value = '產生失敗:' + (e instanceof Error ? e.message : '未知錯誤')
  } finally {
    isProcessing.value = false
  }
}

function loadFromHtmlFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    // 抽出 <style> 與 <body>
    const styleMatch = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    if (styleMatch) css.value = styleMatch[1].trim()
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    html.value = bodyMatch ? bodyMatch[1].trim() : text
  }
  reader.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

// 初始化一次預覽
refreshPreview()

onUnmounted(() => {
  if (previewSrc.value) URL.revokeObjectURL(previewSrc.value)
})
</script>

<template>
  <ToolLayout
    title="HTML → PDF"
    icon="📰"
    description="貼上 HTML、可選 CSS,自動分頁產生 PDF。也可以直接匯入 .html 檔。"
  >
    <p v-if="error" class="err">⚠ {{ error }}</p>

    <div class="grid">
      <!-- HTML 輸入 -->
      <label class="field tall">
        <span class="label">HTML(只要寫 body 內容就好)</span>
        <textarea
          v-model="html"
          class="pixel-input mono"
          rows="14"
          spellcheck="false"
        ></textarea>
      </label>

      <!-- CSS 輸入 -->
      <label class="field tall">
        <span class="label">CSS(選填)</span>
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
        🔄 更新預覽
      </PixelButton>

      <label class="file-pill">
        📂 匯入 .html
        <input type="file" accept=".html,.htm,text/html" hidden @change="loadFromHtmlFile" />
      </label>
    </div>

    <!-- 預覽 iframe -->
    <div class="preview-block">
      <h3>// 預覽</h3>
      <iframe
        v-if="previewSrc"
        :src="previewSrc"
        class="preview-iframe"
        sandbox="allow-same-origin"
      ></iframe>
    </div>

    <!-- 輸出設定 -->
    <div class="grid">
      <label class="field">
        <span class="label">紙張大小</span>
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
        <span class="label">邊界({{ margin }} mm)</span>
        <input v-model.number="margin" type="range" min="0" max="40" />
      </label>
      <label class="field">
        <span class="label">解析度({{ scale }}x)</span>
        <input v-model.number="scale" type="range" min="1" max="3" step="0.5" />
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
        {{ isProcessing ? '產生中…' : '💾 產生 PDF' }}
      </PixelButton>
    </div>

    <p class="warn">
      ⚠ 純前端 HTML → PDF 是「拍照成圖再嵌進 PDF」,文字無法選取(但版面 100% 準確)。
      想要文字可選取的高品質輸出,目前還是要用 Chrome / Edge 的「列印 → 另存 PDF」最強。
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
