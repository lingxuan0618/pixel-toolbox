<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ThemeToggle from './components/ThemeToggle.vue'
import AppFooter from './components/AppFooter.vue'
import FeedbackFab from './components/FeedbackFab.vue'
import FeedbackModal from './components/FeedbackModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useFeedback } from './composables/useFeedback'
import logo from './assets/logo.png'

const { open, closeModal } = useFeedback()
</script>

<template>
  <main>
    <nav class="topbar">
      <RouterLink to="/" class="brand">
        <img :src="logo" alt="logo" class="brand-logo" />
        <span class="brand-text">PIXEL TOOLBOX</span>
      </RouterLink>
      <ThemeToggle />
    </nav>

    <RouterView />

    <AppFooter />

    <FeedbackFab />
    <FeedbackModal :open="open" @close="closeModal" />
    <ToastContainer />
  </main>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 16px;
  gap: 12px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  border-bottom: none;
}
.brand:hover {
  color: var(--accent);
}
.brand-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid var(--border);
  box-shadow: 3px 3px 0 0 var(--shadow);
  background: var(--p8-black);
}
.brand-text {
  font-size: 11px;
  letter-spacing: 0.5px;
}

@media (max-width: 480px) {
  .brand-text {
    display: none;
  }
}
</style>
