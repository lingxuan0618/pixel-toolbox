<script setup lang="ts">
import { useFeedback } from '../composables/useFeedback'
import { GITHUB_REPO_URL } from '../config'

const year = new Date().getFullYear()
const { openModal } = useFeedback()
</script>

<template>
  <footer class="app-footer">
    <div class="row">
      <button
        type="button"
        class="link-btn"
        title="留個回饋(會跳到 GitHub Issues)"
        @click="openModal"
      >💬 回饋 / 建議</button>
      <a
        :href="GITHUB_REPO_URL"
        target="_blank"
        rel="noopener noreferrer"
      >GitHub @lingxuan0618</a>
      <span class="meta">© {{ year }} Xuan · MIT</span>
    </div>
    <p class="note">
      所有檔案 100% 在你的瀏覽器處理,絕對不會上傳到任何伺服器。
    </p>
  </footer>
</template>

<style scoped>
.app-footer {
  margin-top: 80px;
  /* 為 FAB 預留底部空間,避免遮住版權字 */
  padding: 24px 0 80px;
  border-top: 4px dashed var(--border);
  text-align: center;
}
.row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 10px;
  color: var(--text-dim);
}
.row a {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
}
.row a:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.link-btn {
  background: transparent;
  border: none;
  color: var(--accent);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.link-btn:hover {
  color: var(--accent-2);
}
.meta {
  color: var(--text-dim);
}
.note {
  margin: 12px 0 0;
  font-size: 9px;
  color: var(--text-dim);
}
</style>
