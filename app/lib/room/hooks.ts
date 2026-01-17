import { useEffect, useState } from "react";
import type {
  RoomStatus,
  Workstream,
  Task,
  ConnectionStatus,
  Participant,
  Round,
  CompletedRound,
  RoomMetadata,
} from "~/types/room";
import {
  onRoomMetadata,
  onParticipants,
  onWorkstreams,
  onTasks,
  onCurrentRound,
  onCompletedRounds,
  onParticipantEstimates,
  onConnectionStatus,
} from "../firebase/listeners";
import { useFirebaseRoom as useFirebaseRoomContext } from "./firebase-context";

/**
 * Hook to access the Firebase room context
 * Re-exported from firebase-context
 */
export { useFirebaseRoom } from "./firebase-context";

/**
 * Hook to get room status
 */
export function useRoomStatus(roomId: string): RoomStatus {
  const [status, setStatus] = useState<RoomStatus>("lobby");

  useEffect(() => {
    return onRoomMetadata(roomId, (metadata) => {
      if (metadata) {
        setStatus(metadata.status);
      }
    });
  }, [roomId]);

  return status;
}

/**
 * Hook to get organizer ID
 */
export function useOrganizerId(roomId: string): string {
  const [organizerId, setOrganizerId] = useState("");

  useEffect(() => {
    return onRoomMetadata(roomId, (metadata) => {
      if (metadata) {
        setOrganizerId(metadata.organizer_id);
      }
    });
  }, [roomId]);

  return organizerId;
}

/**
 * Hook to check if current user is organizer
 */
export function useIsOrganizer(roomId: string, userId: string | null): boolean {
  const organizerId = useOrganizerId(roomId);
  return userId ? organizerId === userId : false;
}

/**
 * Hook to get workstreams
 */
export function useWorkstreams(
  roomId: string,
  initialData?: Workstream[],
): Workstream[] {
  const [workstreams, setWorkstreams] = useState<Workstream[]>(
    initialData || [],
  );

  useEffect(() => {
    return onWorkstreams(roomId, setWorkstreams);
  }, [roomId]);

  return workstreams;
}

/**
 * Hook to get tasks
 */
export function useTasks(roomId: string, initialData?: Task[]): Task[] {
  const [tasks, setTasks] = useState<Task[]>(initialData || []);

  useEffect(() => {
    return onTasks(roomId, setTasks);
  }, [roomId]);

  return tasks;
}

/**
 * Hook to get current task
 */
export function useCurrentTask(roomId: string): Task | null {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [metadata, setMetadata] = useState<RoomMetadata | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const unsubMetadata = onRoomMetadata(roomId, setMetadata);
    const unsubTasks = onTasks(roomId, setTasks);

    return () => {
      unsubMetadata();
      unsubTasks();
    };
  }, [roomId]);

  useEffect(() => {
    if (metadata && tasks.length > 0) {
      const task = tasks.find((t) => t.order === metadata.current_task_index);
      setCurrentTask(task || null);
    } else {
      setCurrentTask(null);
    }
  }, [metadata, tasks]);

  return currentTask;
}

/**
 * Hook to get current round
 */
export function useCurrentRound(
  roomId: string,
  initialData?: Round | null,
): Round | null {
  const [round, setRound] = useState<Round | null>(initialData || null);

  useEffect(() => {
    return onCurrentRound(roomId, setRound);
  }, [roomId]);

  return round;
}

/**
 * Hook to get current round estimates
 */
export function useEstimates(roomId: string): Record<string, any> | null {
  const [estimates, setEstimates] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    return onCurrentRound(roomId, (round) => {
      setEstimates(round?.estimates || null);
    });
  }, [roomId]);

  return estimates;
}

/**
 * Hook to get participants
 */
export function useParticipants(
  roomId: string,
  initialData?: Participant[],
): Participant[] | null {
  const [participants, setParticipants] = useState<Participant[] | null>(
    initialData || null,
  );

  useEffect(() => {
    return onParticipants(roomId, setParticipants);
  }, [roomId]);

  return participants;
}

/**
 * Hook to get my user ID from context
 */
export function useMyPeerId(roomId: string): string {
  const { userId } = useFirebaseRoomContext();
  return userId || "";
}

/**
 * Hook to get connection status
 */
export function useConnectionStatus(roomId: string): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    return onConnectionStatus((connected) => {
      setStatus(connected ? "connected" : "disconnected");
    });
  }, [roomId]);

  return status;
}

/**
 * Hook to get connected peers (returns participant IDs with online status)
 */
export function useConnectedPeers(roomId: string): string[] {
  const [peers, setPeers] = useState<string[]>([]);

  useEffect(() => {
    return onParticipants(roomId, (participants) => {
      const connectedPeerIds = participants
        .filter((p) => p.connection_status === "online")
        .map((p) => p.peer_id);
      setPeers(connectedPeerIds);
    });
  }, [roomId]);

  return peers;
}

/**
 * Hook to get completed rounds
 */
export function useCompletedRounds(roomId: string): CompletedRound[] {
  const [rounds, setRounds] = useState<CompletedRound[]>([]);

  useEffect(() => {
    return onCompletedRounds(roomId, setRounds);
  }, [roomId]);

  return rounds;
}

/**
 * Hook to get the last completed round
 */
export function useLastCompletedRound(roomId: string): CompletedRound | null {
  const completedRounds = useCompletedRounds(roomId);
  return completedRounds[0] || null; // First item is most recent (sorted in listener)
}

/**
 * Hook to check if participant has submitted for a workstream
 */
export function useHasEstimate(
  roomId: string,
  participantId: string,
  workstreamId: string,
): boolean {
  const [hasEstimate, setHasEstimate] = useState(false);

  useEffect(() => {
    return onParticipantEstimates(roomId, participantId, (workstreams) => {
      setHasEstimate(workstreamId in workstreams);
    });
  }, [roomId, participantId, workstreamId]);

  return hasEstimate;
}

/**
 * Hook to check if all participants are done
 */
export function useAllParticipantsDone(roomId: string): boolean {
  const participants = useParticipants(roomId);
  const estimates = useEstimates(roomId);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (!estimates || !participants || participants.length === 0) {
      setAllDone(false);
      return;
    }

    // Check if all participants have marked themselves as done
    const participantIds = participants.map((p) => p.peer_id);
    const allParticipantsDone = participantIds.every((participantId) => {
      const participantEstimate = estimates[participantId];
      return participantEstimate?.is_done === true;
    });

    setAllDone(allParticipantsDone);
  }, [participants, estimates]);

  return allDone;
}

/**
 * Hook to get workstream submitters
 */
export function useWorkstreamSubmitters(
  roomId: string,
  workstreamId: string,
): string[] {
  const estimates = useEstimates(roomId);
  const [submitters, setSubmitters] = useState<string[]>([]);

  useEffect(() => {
    if (!estimates) {
      setSubmitters([]);
      return;
    }

    const submitterIds: string[] = [];
    Object.entries(estimates).forEach(
      ([participantId, participantEstimate]: [string, any]) => {
        if (
          participantEstimate.workstreams &&
          workstreamId in participantEstimate.workstreams
        ) {
          submitterIds.push(participantId);
        }
      },
    );

    setSubmitters(submitterIds);
  }, [estimates, workstreamId]);

  return submitters;
}

/**
 * Hook to get room metadata
 */
export function useRoomMetadata(
  roomId: string,
  initialData?: RoomMetadata | null,
): RoomMetadata | null {
  const [metadata, setMetadata] = useState<RoomMetadata | null>(
    initialData || null,
  );

  useEffect(() => {
    return onRoomMetadata(roomId, setMetadata);
  }, [roomId]);

  return metadata;
}

/**
 * Hook to get all estimates from all completed rounds
 */
export function useAllEstimates(roomId: string): Array<{
  task_id: string;
  participant_name: string;
  workstreams: Record<string, any>;
}> {
  const completedRounds = useCompletedRounds(roomId);
  const [allEstimates, setAllEstimates] = useState<
    Array<{
      task_id: string;
      participant_name: string;
      workstreams: Record<string, any>;
    }>
  >([]);

  useEffect(() => {
    const estimates: Array<{
      task_id: string;
      participant_name: string;
      workstreams: Record<string, any>;
    }> = [];

    completedRounds.forEach((round) => {
      Object.entries(round.estimates).forEach(([, data]: [string, any]) => {
        estimates.push({
          task_id: round.task_id,
          participant_name: data.participant_name,
          workstreams: data.workstreams,
        });
      });
    });

    setAllEstimates(estimates);
  }, [completedRounds]);

  return allEstimates;
}
