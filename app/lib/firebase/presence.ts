import {
	get,
	onDisconnect,
	ref,
	serverTimestamp,
	set,
} from "firebase/database";
import { database } from "./config";

// Constants
export const HEARTBEAT_INTERVAL = 2000; // 2 seconds
export const STALE_THRESHOLD = 6000; // 6 seconds (3 missed heartbeats)

/**
 * Start heartbeat for a participant
 * Returns a cleanup function to stop the heartbeat
 */
export function startHeartbeat(
	roomId: string,
	userId: string,
	interval: number = HEARTBEAT_INTERVAL,
): () => void {
	// Update presence immediately
	updatePresence(roomId, userId);

	// Set up interval for periodic updates
	const intervalId = setInterval(() => {
		updatePresence(roomId, userId);
	}, interval);

	// Return cleanup function
	return () => {
		clearInterval(intervalId);
	};
}

/**
 * Update participant presence (heartbeat)
 */
export async function updatePresence(
	roomId: string,
	userId: string,
): Promise<void> {
	const participantRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}`,
	);

	// Check if participant still exists
	const snapshot = await get(participantRef);
	if (!snapshot.exists()) return;

	const lastHeartbeatRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}/last_heartbeat`,
	);
	await set(lastHeartbeatRef, serverTimestamp());

	// Also update room's last activity
	const lastActivityRef = ref(
		database,
		`rooms/${roomId}/metadata/last_activity`,
	);
	await set(lastActivityRef, serverTimestamp());
}

/**
 * Set up disconnect handlers using Firebase onDisconnect API
 * This automatically updates participant status when connection is lost
 */
export async function setupDisconnectHandlers(
	roomId: string,
	userId: string,
): Promise<void> {
	const participantRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}`,
	);

	// Remove participant entry entirely after disconnect
	await onDisconnect(participantRef).remove();
}

/**
 * Detect stale participants (haven't sent heartbeat within threshold)
 * Returns array of stale participant IDs
 */
export async function detectStaleParticipants(
	roomId: string,
	timeoutMs: number = STALE_THRESHOLD,
): Promise<string[]> {
	const participantsRef = ref(database, `rooms/${roomId}/participants`);
	const snapshot = await get(participantsRef);

	if (!snapshot.exists()) return [];

	const participants = snapshot.val();
	const now = Date.now();
	const staleIds: string[] = [];

	Object.entries(participants).forEach(([participantId, participant]) => {
		const p = participant as { last_heartbeat?: number };
		const lastHeartbeat = p.last_heartbeat;

		// If lastHeartbeat is a number (timestamp)
		if (typeof lastHeartbeat === "number") {
			const timeSinceHeartbeat = now - lastHeartbeat;
			if (timeSinceHeartbeat > timeoutMs) {
				staleIds.push(participantId);
			}
		}
	});

	return staleIds;
}

/**
 * Clean up stale participants from the room
 */
export async function cleanupStaleParticipants(
	roomId: string,
	staleIds: string[],
): Promise<void> {
	// Remove each stale participant
	const removePromises = staleIds.map(async (participantId) => {
		const participantRef = ref(
			database,
			`rooms/${roomId}/participants/${participantId}`,
		);
		await set(participantRef, null); // Using set(null) instead of remove() for compatibility
	});

	await Promise.all(removePromises);
}

/**
 * Mark participant as online
 */
export async function markOnline(
	roomId: string,
	userId: string,
): Promise<void> {
	const connectionStatusRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}/connection_status`,
	);
	await set(connectionStatusRef, "online");
}

/**
 * Mark participant as offline
 */
export async function markOffline(
	roomId: string,
	userId: string,
): Promise<void> {
	const connectionStatusRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}/connection_status`,
	);
	await set(connectionStatusRef, "offline");
}

/**
 * Cancel disconnect handlers (useful when leaving intentionally)
 */
export async function cancelDisconnectHandlers(
	roomId: string,
	userId: string,
): Promise<void> {
	const participantRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}`,
	);
	const connectionStatusRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}/connection_status`,
	);
	const lastHeartbeatRef = ref(
		database,
		`rooms/${roomId}/participants/${userId}/last_heartbeat`,
	);

	// Cancel all disconnect handlers
	await onDisconnect(participantRef).cancel();
	await onDisconnect(connectionStatusRef).cancel();
	await onDisconnect(lastHeartbeatRef).cancel();
}
