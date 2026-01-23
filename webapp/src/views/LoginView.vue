<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { watch } from 'vue'

const auth = useAuthStore()
const router = useRouter()

watch(
  () => auth.isAuthenticated,
  (isAuth) => {
    if (isAuth) {
      router.push('/dashboard')
    }
  },
  { immediate: true },
)

async function handleSignIn() {
  const success = await auth.signIn()
  if (success) {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">Strava Stats</h1>
      <p class="login-subtitle">Track your activities</p>

      <div class="login-actions">
        <div v-if="auth.loading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>

        <button
          v-else
          class="google-signin-btn"
          @click="handleSignIn"
          :disabled="auth.loading"
        >
          <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <p v-if="auth.error" class="error-message">
          {{ auth.error }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 1rem;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fc4c02;
  margin: 0 0 0.5rem 0;
}

.login-subtitle {
  font-size: 1rem;
  color: #666;
  margin: 0 0 2rem 0;
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #666;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e0e0e0;
  border-top-color: #fc4c02;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.google-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: #333;
  background: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.google-signin-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.google-signin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-icon {
  flex-shrink: 0;
}

.error-message {
  color: #d32f2f;
  font-size: 0.875rem;
  margin: 0;
  padding: 0.75rem;
  background: #ffebee;
  border-radius: 8px;
  width: 100%;
}
</style>
