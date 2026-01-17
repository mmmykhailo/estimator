import { onValue, ref, type Unsubscribe } from "firebase/database";
import type {
	CompletedRound,
	Estimate,
	Participant,
	RoomMetadata,
	Round,
	Task,
	Workstream,
} from "~/types/room";
import { database } from "./config";

/**
 * Listen to room metadata changes
 */
export function onRoomMetadata(
	roomId: string,
	callback: (metadata: RoomMetadata | null) => void,
): Unsubscribe {
	const metadataRef = ref(database, `rooms/${roomId}/metadata`);

	return onValue(metadataRef, (snapshot) => {
		if (snapshot.exists()) {
			callback(snapshot.val() as RoomMetadata);
		} else {
			callback(null);
		}
	});
}

/**
 * Listen to participants changes
 */
export function onParticipants(
	roomId: string,
	callback: (participants: Participant[]) => void,
): Unsubscribe {
	const participantsRef = ref(database, `rooms/${roomId}/participants`);

	return onValue(participantsRef, (snapshot) => {
		if (snapshot.exists()) {
			const participantsData = snapshot.val();
			const participants = Object.values(participantsData) as Participant[];
			callback(participants);
		} else {
			callback([]);
		}
	});
}

/**
 * Listen to workstreams changes
 */
export function onWorkstreams(
	roomId: string,
	callback: (workstreams: Workstream[]) => void,
): Unsubscribe {
	const workstreamsRef = ref(database, `rooms/${roomId}/workstreams`);

	return onValue(workstreamsRef, (snapshot) => {
		if (snapshot.exists()) {
			const workstreamsData = snapshot.val();
			const workstreams = Object.values(workstreamsData) as Workstream[];
			// Sort by order
			workstreams.sort((a, b) => a.order - b.order);
			callback(workstreams);
		} else {
			callback([]);
		}
	});
}

/**
 * Listen to tasks changes
 */
export function onTasks(
	roomId: string,
	callback: (tasks: Task[]) => void,
): Unsubscribe {
	const tasksRef = ref(database, `rooms/${roomId}/tasks`);

	return onValue(tasksRef, (snapshot) => {
		if (snapshot.exists()) {
			const tasksData = snapshot.val();
			const tasks = Object.values(tasksData) as Task[];
			// Sort by order
			tasks.sort((a, b) => a.order - b.order);
			callback(tasks);
		} else {
			callback([]);
		}
	});
}

/**
 * Listen to current round changes
 */
export function onCurrentRound(
	roomId: string,
	callback: (round: Round | null) => void,
): Unsubscribe {
	const currentRoundRef = ref(database, `rooms/${roomId}/current_round`);

	return onValue(currentRoundRef, (snapshot) => {
		if (snapshot.exists()) {
			const roundData = snapshot.val();

			// Convert estimates to proper structure
			const estimates: Round["estimates"] = {};
			if (roundData.estimates) {
				Object.entries(roundData.estimates).forEach(
					([participantId, estimate]) => {
						const est = estimate as {
							workstreams?: Record<string, Estimate>;
							is_done?: boolean;
							done_at?: number;
						};
						estimates[participantId] = {
							workstreams: est.workstreams || {},
							is_done: est.is_done || false,
							done_at: est.done_at || undefined,
						};
					},
				);
			}

			callback({
				task_id: roundData.task_id,
				started_at: roundData.started_at,
				estimates,
			});
		} else {
			callback(null);
		}
	});
}

/**
 * Listen to completed rounds changes
 */
export function onCompletedRounds(
	roomId: string,
	callback: (rounds: CompletedRound[]) => void,
): Unsubscribe {
	const completedRoundsRef = ref(database, `rooms/${roomId}/completed_rounds`);

	return onValue(completedRoundsRef, (snapshot) => {
		if (snapshot.exists()) {
			const roundsData = snapshot.val();
			// Firebase push generates keys, we need to convert to array
			const rounds = Object.entries(roundsData).map(([_key, round]) => {
				const r = round as CompletedRound;
				return {
					task_id: r.task_id,
					started_at: r.started_at,
					completed_at: r.completed_at,
					estimates: r.estimates || {},
				};
			}) as CompletedRound[];

			// Sort by completed_at (most recent first)
			rounds.sort((a, b) => b.completed_at - a.completed_at);

			callback(rounds);
		} else {
			callback([]);
		}
	});
}

/**
 * Listen to a specific estimate for a participant and workstream
 */
export function onEstimate(
	roomId: string,
	participantId: string,
	workstreamId: string,
	callback: (estimate: Estimate | null) => void,
): Unsubscribe {
	const estimateRef = ref(
		database,
		`rooms/${roomId}/current_round/estimates/${participantId}/workstreams/${workstreamId}`,
	);

	return onValue(estimateRef, (snapshot) => {
		if (snapshot.exists()) {
			callback(snapshot.val() as Estimate);
		} else {
			callback(null);
		}
	});
}

/**
 * Listen to all estimates for a specific participant
 */
export function onParticipantEstimates(
	roomId: string,
	participantId: string,
	callback: (workstreams: Record<string, Estimate>, isDone: boolean) => void,
): Unsubscribe {
	const participantEstimatesRef = ref(
		database,
		`rooms/${roomId}/current_round/estimates/${participantId}`,
	);

	return onValue(participantEstimatesRef, (snapshot) => {
		if (snapshot.exists()) {
			const data = snapshot.val();
			callback(data.workstreams || {}, data.is_done || false);
		} else {
			callback({}, false);
		}
	});
}

/**
 * Listen to Firebase connection status
 */
export function onConnectionStatus(
	callback: (connected: boolean) => void,
): Unsubscribe {
	const connectedRef = ref(database, ".info/connected");

	return onValue(connectedRef, (snapshot) => {
		callback(snapshot.val() === true);
	});
}
