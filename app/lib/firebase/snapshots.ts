import { ref, get } from "firebase/database";
import { database } from "./config";
import type {
  RoomMetadata,
  Participant,
  Workstream,
  Task,
  Round,
  CompletedRound,
} from "~/types/room";

/**
 * Get a one-time snapshot of room metadata
 */
export async function getMetadataSnapshot(
  roomId: string,
): Promise<RoomMetadata | null> {
  const metadataRef = ref(database, `rooms/${roomId}/metadata`);
  const snapshot = await get(metadataRef);
  return snapshot.exists() ? (snapshot.val() as RoomMetadata) : null;
}

/**
 * Get a one-time snapshot of participants
 */
export async function getParticipantsSnapshot(
  roomId: string,
): Promise<Participant[]> {
  const participantsRef = ref(database, `rooms/${roomId}/participants`);
  const snapshot = await get(participantsRef);

  if (snapshot.exists()) {
    const participantsData = snapshot.val();
    return Object.values(participantsData) as Participant[];
  }
  return [];
}

/**
 * Get a one-time snapshot of workstreams
 */
export async function getWorkstreamsSnapshot(
  roomId: string,
): Promise<Workstream[]> {
  const workstreamsRef = ref(database, `rooms/${roomId}/workstreams`);
  const snapshot = await get(workstreamsRef);

  if (snapshot.exists()) {
    const workstreamsData = snapshot.val();
    const workstreams = Object.values(workstreamsData) as Workstream[];
    workstreams.sort((a, b) => a.order - b.order);
    return workstreams;
  }
  return [];
}

/**
 * Get a one-time snapshot of tasks
 */
export async function getTasksSnapshot(roomId: string): Promise<Task[]> {
  const tasksRef = ref(database, `rooms/${roomId}/tasks`);
  const snapshot = await get(tasksRef);

  if (snapshot.exists()) {
    const tasksData = snapshot.val();
    const tasks = Object.values(tasksData) as Task[];
    tasks.sort((a, b) => a.order - b.order);
    return tasks;
  }
  return [];
}

/**
 * Get a one-time snapshot of current round
 */
export async function getCurrentRoundSnapshot(
  roomId: string,
): Promise<Round | null> {
  const currentRoundRef = ref(database, `rooms/${roomId}/current_round`);
  const snapshot = await get(currentRoundRef);

  if (snapshot.exists()) {
    const roundData = snapshot.val();
    const estimates: Record<string, any> = {};

    if (roundData.estimates) {
      Object.entries(roundData.estimates).forEach(
        ([participantId, estimate]: [string, any]) => {
          estimates[participantId] = {
            workstreams: estimate.workstreams || {},
            is_done: estimate.is_done || false,
            done_at: estimate.done_at || undefined,
          };
        },
      );
    }

    return {
      task_id: roundData.task_id,
      started_at: roundData.started_at,
      estimates,
    };
  }
  return null;
}

/**
 * Get a one-time snapshot of completed rounds
 */
export async function getCompletedRoundsSnapshot(
  roomId: string,
): Promise<CompletedRound[]> {
  const completedRoundsRef = ref(database, `rooms/${roomId}/completed_rounds`);
  const snapshot = await get(completedRoundsRef);

  if (snapshot.exists()) {
    const roundsData = snapshot.val();
    const rounds = Object.entries(roundsData).map(
      ([key, round]: [string, any]) => ({
        task_id: round.task_id,
        started_at: round.started_at,
        completed_at: round.completed_at,
        estimates: round.estimates || {},
      }),
    ) as CompletedRound[];

    rounds.sort((a, b) => b.completed_at - a.completed_at);
    return rounds;
  }
  return [];
}

/**
 * Fetch all initial data for a room in parallel
 */
export async function getRoomInitialData(roomId: string) {
  const [metadata, participants, workstreams, tasks, currentRound, completedRounds] =
    await Promise.all([
      getMetadataSnapshot(roomId),
      getParticipantsSnapshot(roomId),
      getWorkstreamsSnapshot(roomId),
      getTasksSnapshot(roomId),
      getCurrentRoundSnapshot(roomId),
      getCompletedRoundsSnapshot(roomId),
    ]);

  return {
    metadata,
    participants,
    workstreams,
    tasks,
    currentRound,
    completedRounds,
  };
}
