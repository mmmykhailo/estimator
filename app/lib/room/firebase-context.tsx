import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { startHeartbeat, setupDisconnectHandlers } from '../firebase/presence'

interface FirebaseRoomContextValue {
  roomId: string
  peerId: string
}

const FirebaseRoomContext = createContext<FirebaseRoomContextValue | null>(null)

interface FirebaseRoomProviderProps {
  roomId: string
  peerId: string
  children: ReactNode
}

/**
 * Firebase Room Provider
 * Manages room lifecycle, heartbeat, and disconnect handlers
 */
export function FirebaseRoomProvider({ roomId, peerId, children }: FirebaseRoomProviderProps) {
  useEffect(() => {
    // Set up disconnect handlers when component mounts
    setupDisconnectHandlers(roomId, peerId)

    // Start heartbeat
    const cleanup = startHeartbeat(roomId, peerId)

    // Cleanup on unmount
    return () => {
      cleanup()
    }
  }, [roomId, peerId])

  return (
    <FirebaseRoomContext.Provider value={{ roomId, peerId }}>
      {children}
    </FirebaseRoomContext.Provider>
  )
}

/**
 * Hook to access Firebase room context
 */
export function useFirebaseRoom(): FirebaseRoomContextValue {
  const context = useContext(FirebaseRoomContext)

  if (!context) {
    throw new Error('useFirebaseRoom must be used within a FirebaseRoomProvider')
  }

  return context
}
