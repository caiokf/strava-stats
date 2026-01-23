<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorInfo = ref<string>('')

onErrorCaptured((err, instance, info) => {
  error.value = err
  errorInfo.value = info
  console.error('Error captured:', err, info)
  return false // Prevent propagation
})

function retry() {
  error.value = null
  errorInfo.value = ''
  window.location.reload()
}
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">!</div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">{{ error.message }}</p>
      <p v-if="errorInfo" class="error-info">{{ errorInfo }}</p>
      <div class="error-actions">
        <button class="retry-btn" @click="retry">Reload Page</button>
        <a href="/" class="home-link">Go to Home</a>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 2rem;
}

.error-content {
  max-width: 500px;
  background: #fff;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.error-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #fee2e2;
  color: #dc2626;
  font-size: 2rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 0.75rem 0;
}

.error-message {
  color: #666;
  margin: 0 0 0.5rem 0;
  word-break: break-word;
}

.error-info {
  color: #999;
  font-size: 0.875rem;
  margin: 0 0 1.5rem 0;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  background: #fc4c02;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #e04400;
}

.home-link {
  padding: 0.75rem 1.5rem;
  background: #fff;
  color: #666;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}

.home-link:hover {
  border-color: #fc4c02;
  color: #fc4c02;
}
</style>
