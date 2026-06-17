import { createApp } from 'vue'
import { router } from './router'
import './style.css'
import App from './App.vue'

const redirect = sessionStorage.getItem('ptb-redirect')
if (redirect) {
  sessionStorage.removeItem('ptb-redirect')
}

const app = createApp(App).use(router)

if (redirect) {
  router.replace(redirect)
}

router.isReady().then(() => {
  app.mount('#app')
})
