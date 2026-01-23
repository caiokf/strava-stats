import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithGoogle as firebaseSignIn,
  signOut as firebaseSignOut,
  onAuthChange,
  getIdToken,
} from '@/lib/firebase'
import type { User } from 'firebase/auth'

const ALLOWED_EMAIL = 'caiokf@gmail.com'
const TOKEN_STORAGE_KEY = 'strava_stats_token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value && !!token.value)
  const isAuthorized = computed(() => user.value?.email === ALLOWED_EMAIL)
  const userEmail = computed(() => user.value?.email ?? null)
  const userDisplayName = computed(() => user.value?.displayName ?? null)
  const userPhotoURL = computed(() => user.value?.photoURL ?? null)

  function initializeAuth() {
    return onAuthChange(async (firebaseUser) => {
      user.value = firebaseUser
      loading.value = false

      if (firebaseUser) {
        if (firebaseUser.email !== ALLOWED_EMAIL) {
          error.value = 'Unauthorized: Access restricted'
          await firebaseSignOut()
          user.value = null
          token.value = null
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          return
        }

        const idToken = await getIdToken()
        if (idToken) {
          token.value = idToken
          localStorage.setItem(TOKEN_STORAGE_KEY, idToken)
        }
        error.value = null
      } else {
        token.value = null
        localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    })
  }

  async function signIn() {
    loading.value = true
    error.value = null

    try {
      const firebaseUser = await firebaseSignIn()

      if (firebaseUser.email !== ALLOWED_EMAIL) {
        error.value = 'Unauthorized: Access restricted to specific users'
        await firebaseSignOut()
        user.value = null
        token.value = null
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        loading.value = false
        return false
      }

      user.value = firebaseUser
      const idToken = await getIdToken()
      if (idToken) {
        token.value = idToken
        localStorage.setItem(TOKEN_STORAGE_KEY, idToken)
      }
      loading.value = false
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign in failed'
      loading.value = false
      return false
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut()
      user.value = null
      token.value = null
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign out failed'
    }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isAuthorized,
    userEmail,
    userDisplayName,
    userPhotoURL,
    initializeAuth,
    signIn,
    signOut,
  }
})
