<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import PixelButton from './PixelButton.vue'
import { GITHUB_REPO_URL } from '../config'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const route = useRoute()

const subject = ref('')
const message = ref('')
const contact = ref('')

const issueUrl = computed(() => {
  const pageInfo = `來源頁面: ${typeof window !== 'undefined' ? window.location.origin : ''}${route.fullPath}`
  const body = [
    message.value || '(這裡寫你想說的)',
    '',
    '---',
    contact.value ? `回覆方式: ${contact.value}` : '',
    pageInfo,
  ].filter(Boolean).join('\n')

  const title = `[回饋] ${subject.value || (route.meta.title as string) || '使用回饋'}`
  return `${GITHUB_REPO_URL}/issues/new?` +
    `title=${encodeURIComponent(title)}&` +
    `body=${encodeURIComponent(body)}&` +
    `labels=feedback`
})

function submit() {
  window.open(issueUrl.value, '_blank', 'noopener,noreferrer')
  emit('close')
  // 清空,以便下次乾淨
  subject.value = ''
  message.value = ''
  contact.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="$emit('close')">
      <div class="modal pixel-card">
        <header class="head">
          <h3>💬 留個回饋</h3>
          <button class="close-btn" title="關閉" @click="$emit('close')">✕</button>
        </header>

        <p class="intro">
          有 bug / 想加什麼工具 / 哪裡不順手?
          <strong>填一下,送出會跳到 GitHub</strong>(需要 GitHub 帳號)。
        </p>

        <label class="field">
          <span class="label">主題(選填,沒填就用當前工具名)</span>
          <input v-model="subject" type="text" class="pixel-input" maxlength="80" />
        </label>

        <label class="field">
          <span class="label">想說的話 *</span>
          <textarea
            v-model="message"
            class="pixel-input"
            rows="5"
            placeholder="例:PDF 簽名能不能支援多個簽名?"
          ></textarea>
        </label>

        <label class="field">
          <span class="label">回覆方式(選填,email / 任何聯絡方式)</span>
          <input v-model="contact" type="text" class="pixel-input" maxlength="120" />
        </label>

        <p class="note">
          ⚠ 送出時會開新分頁到 GitHub,你的留言會預先填好,**最後一步要在 GitHub 上按「Submit new issue」**才完成。
        </p>

        <div class="actions">
          <PixelButton variant="secondary" size="sm" @click="$emit('close')">取消</PixelButton>
          <PixelButton :disabled="!message.trim()" @click="submit">
            🚀 提交到 GitHub
          </PixelButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}
.modal {
  background: var(--surface);
  border: 4px solid var(--border);
  box-shadow: 8px 8px 0 0 var(--shadow);
  padding: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.head h3 {
  color: var(--accent);
  margin: 0;
  font-size: 16px;
}
.close-btn {
  background: var(--surface);
  border: 3px solid var(--border);
  color: var(--text);
  width: 32px;
  height: 32px;
  font-family: inherit;
  cursor: pointer;
}
.intro {
  font-size: 11px;
  color: var(--text-dim);
  margin: 0 0 16px;
  line-height: 1.6;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.label {
  font-size: 10px;
  color: var(--accent-2);
}
.pixel-input {
  font-family: inherit;
  font-size: 13px;
  padding: 10px 12px;
  background: var(--bg);
  color: var(--text);
  border: 3px solid var(--border);
  outline: none;
  resize: vertical;
}
.pixel-input:focus {
  border-color: var(--accent);
}
.note {
  font-size: 10px;
  color: var(--text-dim);
  border: 3px dashed var(--highlight);
  padding: 10px;
  margin: 12px 0;
  line-height: 1.5;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
