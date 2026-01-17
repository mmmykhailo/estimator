import { createContext, type ReactNode, useContext, useEffect } from "react";
import { setupDisconnectHandlers, startHeartbeat } from "../firebase/presence";

interface FirebaseRoomContextValue {
	roomId: string;
	userId: string | null;
}

const FirebaseRoomContext = createContext<FirebaseRoomContextValue | null>(
	null,
);

interface FirebaseRoomProviderProps {
	roomId: string;
	userId: string | null;
	children: ReactNode;
}

/**
 * Firebase Room Provider
 * Manages room lifecycle, heartbeat, and disconnect handlers
 */
export function FirebaseRoomProvider({
	roomId,
	userId,
	children,
}: FirebaseRoomProviderProps) {
	useEffect(() => {
		if (!userId) return;

		// Set up disconnect handlers when component mounts
		setupDisconnectHandlers(roomId, userId);

		// Start heartbeat
		const cleanup = startHeartbeat(roomId, userId);

		// Cleanup on unmount
		return () => {
			cleanup();
		};
	}, [roomId, userId]);

	return (
		<FirebaseRoomContext.Provider value={{ roomId, userId }}>
			{children}
		</FirebaseRoomContext.Provider>
	);
}

/**
 * Hook to access Firebase room context
 */
export function useFirebaseRoom(): FirebaseRoomContextValue {
	const context = useContext(FirebaseRoomContext);

	if (!context) {
		throw new Error(
			"useFirebaseRoom must be used within a FirebaseRoomProvider",
		);
	}

	return context;
}
