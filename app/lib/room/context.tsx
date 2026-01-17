/**
 * Firebase Room Context
 * Re-exports Firebase room provider functionality
 */

export { FirebaseRoomProvider, useFirebaseRoom } from './firebase-context'

// Legacy export for backwards compatibility (if needed during migration)
// This will allow old code that uses useRoomProvider to work temporarily
export { useFirebaseRoom as useRoomProvider } from './firebase-context'
