import { ref, watch, onMounted } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pixel-pdf-theme'

const theme = ref<Theme>('light')

function applyTheme(value: Theme) {
  document.documentElement.setAttribute('data-theme', value)
}

function readStored(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  // 沒存過 → 跟隨系統一次,之後使用者切就會被記下來
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function useTheme() {
  onMounted(() => {
    theme.value = readStored()
    applyTheme(theme.value)
  })

  watch(theme, value => {
    localStorage.setItem(STORAGE_KEY, value)
    applyTheme(value)
  })

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { theme, toggle }
}
