import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

function getFirebaseAuth(): Auth {
  if (!auth) {
    if (!firebaseConfig.apiKey) {
      throw new Error('Missing Firebase configuration')
    }
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
  }
  return auth
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth()
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth()
  await firebaseSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, callback)
}

export async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth()
  return auth.currentUser
}
