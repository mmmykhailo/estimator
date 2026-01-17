/**
 * Firebase Room Context
 * Re-exports Firebase room provider functionality
 */

// Legacy export for backwards compatibility (if needed during migration)
// This will allow old code that uses useRoomProvider to work temporarily
export {
	FirebaseRoomProvider,
	useFirebaseRoom,
	useFirebaseRoom as useRoomProvider,
} from "./firebase-context";
