import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * Firebase configuration from environment variables
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

/**
 * Validate that all required Firebase environment variables are present
 */
function validateFirebaseConfig(): void {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
  ]

  const missing = required.filter(key => !import.meta.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase environment variables: ${missing.join(', ')}\n` +
      'Please create a .env.local file with your Firebase credentials. ' +
      'See .env.example for the required format.'
    )
  }
}

// Validate config on module load
validateFirebaseConfig()

/**
 * Firebase app instance
 */
export const app: FirebaseApp = initializeApp(firebaseConfig)

/**
 * Firebase Realtime Database instance
 */
export const database: Database = getDatabase(app)

/**
 * Firebase Authentication instance
 */
export const auth: Auth = getAuth(app)
