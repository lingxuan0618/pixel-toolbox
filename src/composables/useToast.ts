import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])

function show(message: string, type: ToastType = 'success', durationMs = 2500) {
  const id = crypto.randomUUID()
  toasts.value.push({ id, message, type })
  window.setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, durationMs)
}

export function useToast() {
  return { toasts, show }
}
