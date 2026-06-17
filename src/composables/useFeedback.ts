import { ref } from 'vue'

// 全站共用的回饋 modal 狀態
const open = ref(false)

export function useFeedback() {
  return {
    open,
    openModal: () => { open.value = true },
    closeModal: () => { open.value = false },
  }
}
