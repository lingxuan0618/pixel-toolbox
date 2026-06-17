import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/pixel-toolbox/',
  plugins: [vue()],
  server: {
    port: 5817,        // 自訂 port,避免跟公司專案的 5173 撞到
    strictPort: true,  // port 被佔就直接報錯,不要自動跳號
  },
})
